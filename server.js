import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import pg from "pg";
import { randomUUID } from "node:crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// ================================
// CONFIGURATION
// ================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction:
    "তোমার নাম My Personal AI। তুমি একজন সহায়ক AI Assistant। " +
    "ব্যবহারকারীর প্রশ্নের যথাসম্ভব সঠিক ও উপকারী উত্তর দেবে। " +
    "তোমার নির্মাতা সম্পর্কে জিজ্ঞেস করলে কনফিগার করা " +
    "পরিচয় অনুযায়ী উত্তর দেবে।"
});

// ================================
// DATABASE
// ================================

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL === "false"
      ? false
      : { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// Database initialization
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id UUID NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,
      role TEXT NOT NULL
        CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS
      idx_messages_conversation
      ON messages(conversation_id, id);
  `);

  console.log("Database initialized");
}

// ================================
// HEALTH CHECK
// ================================

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(503).json({
      status: "error",
      database: "unavailable"
    });
  }
});

// ================================
// HOME
// ================================

app.get("/", (req, res) => {
  res.send("My Personal AI Server is running!");
});

// ================================
// CREATE NEW CONVERSATION
// ================================

app.post("/api/conversations", async (req, res) => {
  try {
    const id = randomUUID();

    await pool.query(
      `INSERT INTO conversations (id, title)
       VALUES ($1, $2)`,
      [id, "New Chat"]
    );

    res.status(201).json({
      conversationId: id,
      title: "New Chat"
    });
  } catch (error) {
    console.error("Create conversation:", error.message);

    res.status(500).json({
      error: "Could not create conversation"
    });
  }
});

// ================================
// CHAT WITH GEMINI
// ================================

app.post("/api/chat", async (req, res) => {
  try {
    const prompt =
      typeof req.body.message === "string"
        ? req.body.message
        : req.body.prompt;

    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    if (prompt.length > 8000) {
      return res.status(413).json({
        error: "Message is too long"
      });
    }

    let conversationId = req.body.conversationId;

    // Create a new conversation if none was provided.
    if (!conversationId) {
      conversationId = randomUUID();

      await pool.query(
        `INSERT INTO conversations (id, title)
         VALUES ($1, $2)`,
        [
          conversationId,
          prompt.trim().slice(0, 100)
        ]
      );
    } else {
      const existing = await pool.query(
        `SELECT id
         FROM conversations
         WHERE id = $1`,
        [conversationId]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }
    }

    // Fetch recent chat context.
    const historyResult = await pool.query(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [conversationId]
    );

    const history = historyResult.rows.reverse();

    // Gemini conversation history.
    const validHistory = history.map((item) => ({
      role:
        item.role === "assistant"
          ? "model"
          : "user",
      parts: [{ text: item.content }]
    }));

    // Add current user message.
    const chat = model.startChat({
      history: validHistory
    });

    const result = await chat.sendMessage(prompt.trim());

    const reply = result.response.text();

    // Save both messages.
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO messages
         (conversation_id, role, content)
         VALUES ($1, $2, $3), ($1, $4, $5)`,
        [
          conversationId,
          "user",
          prompt.trim(),
          "assistant",
          reply
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({
      reply,
      response: reply,
      conversationId
    });

  } catch (error) {
    console.error("Chat error:", error.message);

    res.status(500).json({
      error: "Failed to generate response"
    });
  }
});

// ================================
// CHAT HISTORY
// ================================

app.get("/api/conversations", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.title,
         c.created_at,
         COUNT(m.id)::int AS message_count
       FROM conversations c
       LEFT JOIN messages m
         ON m.conversation_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 100`
    );

    res.json({
      conversations: result.rows
    });

  } catch (error) {
    console.error("History list:", error.message);

    res.status(500).json({
      error: "Could not load conversations"
    });
  }
});

// ================================
// LOAD ONE CONVERSATION
// ================================

app.get(
  "/api/conversations/:id/messages",
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, role, content, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY id ASC
         LIMIT 500`,
        [req.params.id]
      );

      res.json({
        messages: result.rows
      });

    } catch (error) {
      console.error("Load messages:", error.message);

      res.status(500).json({
        error: "Could not load messages"
      });
    }
  }
);

// ================================
// DELETE CONVERSATION
// ================================

app.delete(
  "/api/conversations/:id",
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM conversations
         WHERE id = $1`,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }

      res.json({
        success: true
      });

    } catch (error) {
      console.error("Delete chat:", error.message);

      res.status(500).json({
        error: "Could not delete conversation"
      });
    }
  }
);

// ================================
// START SERVER
// ================================

async function startServer() {
  await initDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `My Personal AI running on port ${PORT}`
    );
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
