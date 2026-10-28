import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================
// 1. MIDDLEWARE
// =====================================
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// =====================================
// 2. GEMINI CONFIGURATION
// =====================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL_NAME =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

let model = null;

if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: [
            "তোমার নাম My Personal AI।",
            "তুমি একজন সহায়ক AI Assistant।",
            "তোমার নির্মাতা বা ক্রিয়েটর হলেন ইরফান হাসনাত।",
            "নির্মাতা সম্পর্কে জিজ্ঞেস করলে এই পরিচয় অনুযায়ী উত্তর দেবে।",
            "প্রশ্নের সরাসরি, পরিষ্কার ও সহায়ক উত্তর দেবে।"
        ].join("\n")
    });
}

// =====================================
// 3. IN-MEMORY STORAGE
// =====================================
const conversations = new Map();
const messages = new Map();

// =====================================
// 4. HEALTH CHECK
// =====================================
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        server: "running",
        geminiConfigured: Boolean(GEMINI_API_KEY),
        model: MODEL_NAME
    });
});

// =====================================
// 5. HOME
// =====================================
app.get("/", (req, res) => {
    res.status(200).send(
        "My Personal AI Server is running!"
    );
});

// =====================================
// 6. CREATE CONVERSATION
// =====================================
app.post("/api/conversations", (req, res) => {
    const id = randomUUID();

    conversations.set(id, {
        id,
        title: "New Chat",
        created_at: new Date()
    });

    messages.set(id, []);

    res.status(201).json({
        conversationId: id,
        title: "New Chat"
    });
});

// =====================================
// 7. CHAT API
// =====================================
app.post("/api/chat", async (req, res) => {
    if (!model) {
        return res.status(503).json({
            error: "Gemini API is not configured."
        });
    }

    const prompt =
        typeof req.body?.message === "string"
            ? req.body.message
            : req.body?.prompt;

    if (
        typeof prompt !== "string" ||
        !prompt.trim()
    ) {
        return res.status(400).json({
            error: "Message is required."
        });
    }

    const userMessage = prompt.trim();

    if (userMessage.length > 8000) {
        return res.status(413).json({
            error: "Message is too long."
        });
    }

    let conversationId = req.body?.conversationId;

    if (
        conversationId !== undefined &&
        (
            typeof conversationId !== "string" ||
            conversationId.length > 100
        )
    ) {
        return res.status(400).json({
            error: "Invalid conversationId."
        });
    }

    if (!conversationId) {
        conversationId = randomUUID();

        conversations.set(conversationId, {
            id: conversationId,
            title: userMessage.slice(0, 100),
            created_at: new Date()
        });

        messages.set(conversationId, []);
    } else if (!conversations.has(conversationId)) {
        return res.status(404).json({
            error: "Conversation not found."
        });
    }

    const chatMessages =
        messages.get(conversationId);

    // =================================
    // 8. CHAT HISTORY
    // =================================
    const recentHistory = chatMessages.slice(-20);

    const validHistory = recentHistory.map(item => ({
        role: item.role === "assistant"
            ? "model"
            : "user",
        parts: [{ text: item.content }]
    }));

    // =================================
    // 9. GEMINI REQUEST
    // =================================
    let timeout;

    try {
        const controller = new AbortController();

        timeout = setTimeout(() => {
            controller.abort();
        }, 60000);

        const chat = model.startChat({
            history: validHistory,
            generationConfig: {
                maxOutputTokens: 2048
            }
        });

        const result = await chat.sendMessage(
            userMessage,
            {
                abortSignal: controller.signal
            }
        );

        const reply = result.response.text();

        if (!reply || !reply.trim()) {
            throw new Error(
                "Gemini returned an empty response."
            );
        }

        // =================================
        // 10. SAVE CHAT
        // =================================
        chatMessages.push({
            id: randomUUID(),
            role: "user",
            content: userMessage,
            created_at: new Date()
        });

        chatMessages.push({
            id: randomUUID(),
            role: "assistant",
            content: reply,
            created_at: new Date()
        });

        // Limit memory usage per conversation.
        if (chatMessages.length > 200) {
            chatMessages.splice(
                0,
                chatMessages.length - 200
            );
        }

        return res.status(200).json({
            reply,
            response: reply,
            conversationId
        });

    } catch (error) {
        console.error("Gemini chat error:", error);

        if (error.name === "AbortError") {
            return res.status(504).json({
                error: "Gemini request timed out."
            });
        }

        return res.status(500).json({
            error: "Failed to generate AI response."
        });

    } finally {
        clearTimeout(timeout);
    }
});

// =====================================
// 11. LIST CONVERSATIONS
// =====================================
app.get("/api/conversations", (req, res) => {
    const list = Array.from(
        conversations.values()
    ).map(c => ({
        ...c,
        message_count:
            (messages.get(c.id) || []).length
    }));

    list.sort(
        (a, b) =>
            new Date(b.created_at) -
            new Date(a.created_at)
    );

    res.json({
        conversations: list
    });
});

// =====================================
// 12. GET CONVERSATION MESSAGES
// =====================================
app.get(
    "/api/conversations/:id/messages",
    (req, res) => {
        const id = req.params.id;

        if (!conversations.has(id)) {
            return res.status(404).json({
                error: "Conversation not found."
            });
        }

        res.json({
            messages: messages.get(id) || []
        });
    }
);

// =====================================
// 13. DELETE CONVERSATION
// =====================================
app.delete(
    "/api/conversations/:id",
    (req, res) => {
        const id = req.params.id;

        if (!conversations.has(id)) {
            return res.status(404).json({
                error: "Conversation not found."
            });
        }

        conversations.delete(id);
        messages.delete(id);

        res.json({
            success: true
        });
    }
);

// =====================================
// 14. UNKNOWN ROUTE
// =====================================
app.use((req, res) => {
    res.status(404).json({
        error: "Route not found."
    });
});

// =====================================
// 15. SERVER START
// =====================================
const server = app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `My Personal AI running on port ${PORT}`
        );

        console.log(
            `Gemini configured: ${Boolean(GEMINI_API_KEY)}`
        );

        console.log(
            `Model: ${MODEL_NAME}`
        );
    }
);

// =====================================
// 16. SERVER ERROR
// =====================================
server.on("error", error => {
    console.error("Server startup error:", error);
    process.exit(1);
});
