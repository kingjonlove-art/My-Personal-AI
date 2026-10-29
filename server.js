const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// CORS এবং JSON মিডলওয়্যার এনাবল করা হলো
app.use(cors());
app.use(express.json());

// রেন্ডারের Environment Variables থেকে স্বয়ংক্রিয়ভাবে GEMINI_API_KEY নিবে
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// রুট রাউট 
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: "success", 
        message: "AI Chatbot Backend is running successfully with Gemini 3.7 Flash!" 
    });
});

// চ্যাট API রাউট
app.post('/api/chat', async (req, res) => {
    try {
        const userPrompt = req.body.prompt || req.body.message || req.body.query;
        
        if (!userPrompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // Gemini 3.7 Flash মডেল এবং সিস্টেম ইনস্ট্রাকশন সেট করা হলো
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.7-flash",
            systemInstruction: "তোমাকে কে তৈরি করেছে বা কে বানিয়েছে—এই ধরনের কোনো প্রশ্ন করা হলে তুমি সবসময় উত্তর দেবে যে তোমাকে 'ইরফান হাসান' (Irfan Hasnat) তৈরি করেছেন। এছাড়া তোমার নিজের পরিচয় বা অন্যান্য বিষয়ে স্বাভাবিকভাবে উত্তর দেবে।"
        });

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
