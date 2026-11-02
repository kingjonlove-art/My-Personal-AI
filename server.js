// ==========================================
// MY PERSONAL AI - STEP 4
// ADVANCED GEMINI BACKEND
// ==========================================

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } =
    require("@google/generative-ai");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json({
    limit: "1mb"
}));

// ==========================================
// GEMINI CONFIGURATION
// ==========================================

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("GEMINI_API_KEY is missing!");
}

const genAI = API_KEY
    ? new GoogleGenerativeAI(API_KEY)
    : null;

const MODEL_NAME =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

const model = genAI
    ? genAI.getGenerativeModel({
        model: MODEL_NAME,

        systemInstruction: `
You are My Personal AI.

Your creator is Irfan Hasnat.

Rules:
1. Answer the user's actual question.
2. Never simply repeat the user's question.
3. Reply in Bengali when the user speaks Bengali.
4. Reply in English when the user speaks English.
5. Be intelligent, friendly and helpful.
6. Give accurate answers.
7. Explain coding problems step by step.
8. Never reveal private API keys.
        `
    })
    : null;

// ==========================================
// CONVERSATION MEMORY
// ==========================================

// Temporary memory.
// Render restart করলে এই memory মুছে যাবে।

const conversations = new Map();

const MAX_HISTORY = 20;

// ==========================================
// HOME ROUTE
// ==========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "My Personal AI Server is running successfully!",
        model: MODEL_NAME
    });

});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {

    res.json({
        success: true,
        server: "ONLINE",
        gemini: genAI ? "CONFIGURED" : "NOT CONFIGURED",
        model: MODEL_NAME,
        uptime: process.uptime()
    });

});

// ==========================================
// GEMINI CHAT API
// ==========================================

app.post("/api/chat", async (req, res) => {

    try {

        if (!model) {

            return res.status(500).json({
                success: false,
                error: "Gemini API key is not configured."
            });

        }

        const message =
            req.body.message ||
            req.body.prompt ||
            req.body.query;

        const sessionId =
            String(req.body.sessionId || "default");

        if (!message || typeof message !== "string") {

            return res.status(400).json({
                success: false,
                error: "Please provide a valid message."
            });

        }

        const cleanMessage = message.trim();

        if (!cleanMessage) {

            return res.status(400).json({
                success: false,
                error: "Message cannot be empty."
            });

        }

        if (cleanMessage.length > 10000) {

            return res.status(413).json({
                success: false,
                error: "Message is too long."
            });

        }

        // GET CONVERSATION HISTORY

        let history =
            conversations.get(sessionId) || [];

        // START GEMINI CHAT

        const chat = model.startChat({
            history: history
        });

        // SEND MESSAGE

        const result =
            await chat.sendMessage(cleanMessage);

        const response =
            await result.response;

        const aiReply = response.text();

        if (!aiReply) {

            throw new Error(
                "Gemini returned an empty response."
            );

        }

        // SAVE CONVERSATION

        history.push({

            role: "user",

            parts: [
                { text: cleanMessage }
            ]

        });

        history.push({

            role: "model",

            parts: [
                { text: aiReply }
            ]

        });

        // KEEP LAST 20 MESSAGES

        if (history.length > MAX_HISTORY) {

            history = history.slice(-MAX_HISTORY);

        }

        conversations.set(sessionId, history);

        // SEND RESPONSE

        res.json({

            success: true,

            reply: aiReply,

            sessionId: sessionId,

            model: MODEL_NAME,

            historyLength: history.length

        });

    } catch (error) {

        console.error(
            "GEMINI ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            error: "Failed to generate AI response.",

            details:
                process.env.NODE_ENV === "development"
                ? error.message
                : undefined

        });

    }

});

// ==========================================
// CLEAR CHAT MEMORY
// ==========================================

app.post("/api/clear-memory", (req, res) => {

    const sessionId =
        String(req.body.sessionId || "default");

    conversations.delete(sessionId);

    res.json({

        success: true,

        message: "Conversation memory cleared."

    });

});

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        error: "Route not found."

    });

});

// ==========================================
// SERVER START
// ==========================================

app.listen(PORT, () => {

    console.log(
        "================================"
    );

    console.log(
        "MY PERSONAL AI SERVER ONLINE"
    );

    console.log(
        "PORT:",
        PORT
    );

    console.log(
        "GEMINI MODEL:",
        MODEL_NAME
    );

    console.log(
        "================================"
    );

});
