import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import cors from 'cors';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(cors());
// ================================
// CONFIGURATION
// ================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
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
// IN-MEMORY STORAGE (Database Removed)
// ================================

const conversations = new Map(); // id -> { id, title, created_at }
const messages = new Map();    // conversationId -> Array of messages

// ================================
// HEALTH CHECK
// ================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    database: "not-required (in-memory)"
  });
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

app.post("/api/conversations", (req, res) => {
  try {
    const id = randomUUID();
    const newChat = {
      id,
      title: "New Chat",
      created_at: new Date()
    };

    conversations.set(id, newChat);
    messages.set(id, []);

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
      conversations.set(conversationId, {
        id: conversationId,
        title: prompt.trim().slice(0, 100),
        created_at: new Date()
      });
      messages.set(conversationId, []);
    } else {
      if (!conversations.has(conversationId)) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }
    }

    // Fetch recent chat context.
    const chatMessages = messages.get(conversationId) || [];
    const recentHistory = chatMessages.slice(-20);

    // Gemini conversation history.
    const validHistory = recentHistory.map((item) => ({
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

    // Save both messages in memory.
    chatMessages.push({
      id: chatMessages.length + 1,
      role: "user",
      content: prompt.trim(),
      created_at: new Date()
    });

    chatMessages.push({
      id: chatMessages.length + 1,
      role: "assistant",
      content: reply,
      created_at: new Date()
    });

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

app.get("/api/conversations", (req, res) => {
  try {
    const list = Array.from(conversations.values())
      .map(c => ({
        ...c,
        message_count: (messages.get(c.id) || []).length
      }))
      .sort((a, b) => b.created_at - a.created_at);

    res.json({
      conversations: list
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
  (req, res) => {
    try {
      const convId = req.params.id;
      if (!conversations.has(convId)) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }

      const chatMessages = messages.get(convId) || [];

      res.json({
        messages: chatMessages
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
  (req, res) => {
    try {
      const convId = req.params.id;
      if (!conversations.has(convId)) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }

      conversations.delete(convId);
      messages.delete(convId);

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `My Personal AI running on port ${PORT}`
  );
});
