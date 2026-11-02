require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ==========================================
// GEMINI CONFIGURATION
// ==========================================

const MODEL_NAME = "gemini-3.7-flash";

// ==========================================
// HOME PAGE
// ==========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {
    res.json({
        success: true,
        server: "ONLINE",
        gemini: process.env.GEMINI_API_KEY
            ? "CONFIGURED"
            : "NOT CONFIGURED",
        model: MODEL_NAME
    });
});

// ==========================================
// GEMINI AI CHAT
// ==========================================

app.post("/api/chat", async (req, res) => {
    try {

        // Check API Key
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({
                error: "GEMINI_API_KEY is missing!"
            });
        }

        // Check messages
        const messages = req.body.messages;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "Please provide valid messages."
            });
        }

        // Validate messages
        const validMessages = messages
            .filter(message =>
                message &&
                ["user", "assistant"].includes(message.role) &&
                typeof message.content === "string" &&
                message.content.trim().length > 0
            )
            .slice(-20);

        if (validMessages.length === 0) {
            return res.status(400).json({
                error: "No valid messages found."
            });
        }

        // Last message must be from user
        if (validMessages[validMessages.length - 1].role !== "user") {
            return res.status(400).json({
                error: "Last message must be from user."
            });
        }

        // Convert messages to Gemini format
        const contents = validMessages.map(message => ({
            role: message.role === "assistant"
                ? "model"
                : "user",
            parts: [
                { text: message.content.trim() }
            ]
        }));

        // Connect Gemini
        const ai = new GoogleGenAI({
            apiKey: API_KEY
        });

        // Generate AI response
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: `
You are My Personal AI.

Your creator is Irfan Hasnat.

Your rules:

1. Answer the actual question.
2. Reply in Bengali when the user speaks Bengali.
3. Reply in English when the user speaks English.
4. Be intelligent, friendly and helpful.
5. Give accurate answers.
6. Explain coding problems step by step.
7. Help with programming and technology.
8. Never reveal private API keys.
9. Do not repeat the user's question unnecessarily.
10. Give clear and useful answers.
                `
            }
        });

        // Get AI reply
        const aiReply = response.text;

        if (!aiReply) {
            throw new Error("Gemini returned an empty response.");
        }

        // Send response
        res.json({
            success: true,
            reply: aiReply,
            model: MODEL_NAME
        });

    } catch (error) {

        console.error("GEMINI ERROR:", error);

        res.status(500).json({
            success: false,
            error: "AI সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
        });
    }
});

// ==========================================
// CLEAR MEMORY
// ==========================================

app.post("/api/clear-memory", (req, res) => {
    res.json({
        success: true,
        message: "Chat cleared successfully."
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
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log("================================");
    console.log("MY PERSONAL AI IS ONLINE");
    console.log("PORT:", PORT);
    console.log("GEMINI MODEL:", MODEL_NAME);
    console.log("================================");

});
