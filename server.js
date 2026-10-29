const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// রেন্ডারের Environment Variables থেকে GEMINI_API_KEY নিবে
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/chat', async (req, res) => {
    try {
        const userPrompt = req.body.prompt || req.body.message || req.body.query;
        
        if (!userPrompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // সরাসরি gemini-3.7-flash মডেল কনফিগারেশন
        const response = await ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: userPrompt,
        });

        res.json({ reply: response.text });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
