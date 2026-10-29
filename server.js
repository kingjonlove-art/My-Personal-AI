const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// CORS এবং JSON মিডলওয়্যার এনাবল করা হলো যাতে ফ্রন্টএন্ড থেকে রিকোয়েস্ট ব্লক না হয়
app.use(cors());
app.use(express.json());

// রেন্ডারের Environment Variables থেকে স্বয়ংক্রিয়ভাবে GEMINI_API_KEY নিবে
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ১. রুট রাউট (Root Route) যোগ করা হলো যাতে ব্রাউজারে হোম পেজে গেলে "Cannot GET /" না দেখায়
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: "success", 
        message: "AI Chatbot Backend is running successfully!" 
    });
});

// ২. চ্যাট API রাউট
app.post('/api/chat', async (req, res) => {
    try {
        const userPrompt = req.body.prompt || req.body.message || req.body.query;
        
        if (!userPrompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // জেমিনির স্টেবল মডেল ব্যবহার করা হলো
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent(userPrompt);
        const responseText = result.response.text();

        res.json({ reply: responseText });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
