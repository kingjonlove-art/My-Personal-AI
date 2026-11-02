require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || ""
});

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        server: "ONLINE",
        gemini: process.env.GEMINI_API_KEY
            ? "CONFIGURED"
            : "NOT CONFIGURED"
    });
});

app.post("/api/chat", async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                error: "Gemini API Key পাওয়া যায়নি।"
            });
        }

        const messages = req.body.messages;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "সঠিক মেসেজ পাঠান।"
            });
        }

        const contents = messages
            .filter(m =>
                m &&
                ["user", "assistant"].includes(m.role) &&
                typeof m.content === "string" &&
                m.content.trim()
            )
            .map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }]
            }));

        if (!contents.length ||
            contents[contents.length - 1].role !== "user") {
            return res.status(400).json({
                error: "শেষ মেসেজটি User-এর হতে হবে।"
            });
        }

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: contents,
            config: {
                systemInstruction:
                    "You are My Personal AI. Your creator is Irfan Hasnat. Reply in Bengali when the user speaks Bengali. Reply in English when the user speaks English. Be intelligent, friendly and helpful. Explain coding problems step by step."
            }
        });

        const reply = response.text;

        if (!reply) {
            throw new Error("Empty AI response");
        }

        res.json({
            success: true,
            reply: reply
        });

    } catch (error) {
        console.error("GEMINI ERROR:", error);

        res.status(500).json({
            error: "AI সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
        });
    }
});

app.listen(PORT, () => {
    console.log("================================");
    console.log("MY PERSONAL AI ONLINE");
    console.log("PORT:", PORT);
    console.log("MODEL:", MODEL);
    console.log("================================");
});
