const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.status(200).json({ 
        status: "success", 
        message: "AI Chatbot Backend is running successfully!" 
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const userPrompt = req.body.prompt || req.body.message || req.body.query;
        
        if (!userPrompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.7-flash",
            systemInstruction: "তোমাকে কে তৈরি করেছে বা কে বানিয়েছে—এই ধরনের কোনো প্রশ্ন করা হলে তুমি সবসময় উত্তর দেবে যে তোমাকে 'ইরফান হাসান' (Irfan Hasnat) তৈরি করেছেন। এছাড়া তোমার নিজের পরিচয় বা অন্যান্য বিষয়ে স্বাভাবিকভাবে উত্তর দেবে।"
        });

        const result = await model.generateContent(userPrompt);
        
        if (!result || !result.response) {
            throw new Error("Invalid response received from Gemini API");
        }

        const responseText = result.response.text();
        res.json({ reply: responseText });

    } catch (err) {
        // রেন্ডার সার্ভার লগ এ বিস্তারিত এরর প্রিন্ট করার জন্য
        console.error("Detailed API Error:", err);
        res.status(500).json({ 
            error: "Internal Server Error", 
            details: err.message || "Unknown error occurred" 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
