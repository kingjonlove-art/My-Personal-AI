```javascript
require("dotenv").config();
const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const app = express();
const PORT = process.env.PORT || 3000;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "index.html"));
});
app.post("/api/chat", async (req, res) => {
try {
if (!process.env.GEMINI_API_KEY) {
return res.status(500).json({
error: "GEMINI_API_KEY সেট করা হয়নি",
});
}
const { messages } = req.body;
if (!Array.isArray(messages) || messages.length === 0) {
return res.status(400).json({
error: "সঠিক মেসেজ পাঠান",
});
}
const contents = messages.map((msg) => ({
role: msg.role === "assistant" ? "model" : "user",
parts: [{ text: msg.content.slice(0, 4000) }],
}));
const response = await ai.models.generateContent({
model: "gemini-2.5-flash",
contents: contents,
config: {
systemInstruction: "You are My Personal AI Assistant. Respond in Bengali whenever appropriate.",
},
});
const replyText = response.text;
if (!replyText) {
return res.status(500).json({
error: "এমনকি থেকে কোনো উত্তর পাওয়া যায়নি",
});
}
res.json({ reply: replyText });
} catch (error) {
console.error("Server error:", error.message);
res.status(500).json({
error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
});
}
});
app.listen(PORT, "0.0.0.0", () => {
console.log(My Personal AI server running on port ${PORT});
});

