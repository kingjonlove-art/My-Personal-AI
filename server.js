require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;

app.use(express.json({ limit: "100kb" }));

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/chat", async (req, res) => {
    try {
        if (!API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY সেট করা হয়নি।"
            });
        }

        const messages = req.body.messages;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "সঠিক মেসেজ পাঠান।"
            });
        }

        const safeMessages = messages
            .filter(message =>
                message &&
                ["user", "assistant"].includes(message.role) &&
                typeof message.content === "string"
            )
            .slice(-20)
            .map(message => ({
                role: message.role,
                content: message.content.slice(0, 4000)
            }));

        if (
            safeMessages.length === 0 ||
            safeMessages[safeMessages.length - 1].role !== "user"
        ) {
            return res.status(400).json({
                error: "একটি ব্যবহারকারীর মেসেজ প্রয়োজন।"
            });
        }

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },

                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are My Personal AI, a helpful assistant. " +
                                "Respond in Bengali when the user writes in Bengali."
                        },
                        ...safeMessages
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI API error:", data);

            return res.status(502).json({
                error: "AI API অনুরোধ ব্যর্থ হয়েছে। API Key, বিলিং এবং মডেল অ্যাক্সেস পরীক্ষা করুন।"
            });
        }

        const reply = data.choices?.[0]?.message?.content;

        if (!reply) {
            return res.status(502).json({
                error: "AI থেকে কোনো উত্তর পাওয়া যায়নি।"
            });
        }

        res.json({ reply });

    } catch (error) {
        console.error("Server error:", error.message);

        res.status(500).json({
            error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`My Personal AI server running on port ${PORT}`);
});
