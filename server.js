const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json());
app.use(cors());

// জেমিনি এপিআই ইনিশিয়ালাইজ
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.send('My Personal AI Server is running successfully!');
});

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.prompt || req.body.message || req.body.query;
        if (!userMessage) {
            return res.status(400).json({ reply: "কোনো বার্তা পাওয়া যায়নি।" });
        }

        // মডেল ডিক্লেয়ারেশন ও সিস্টেম ইনস্ট্রাকশনসহ কল করা
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: "You are 'My Personal AI'. You were created, built, and developed by Irfan Hasnat (ইরফান হাসনাত). If anyone asks who created you, who is your creator, or who made you, always proudly answer that you were created by Irfan Hasnat (ইরফান হাসনাত)."
        });

        const result = await model.generateContent(userMessage);
        const response = await result.response;
        const replyText = response.text() || "দুঃখিত, উত্তর পাওয়া যায়নি।";

        res.json({ reply: replyText });

    } catch (error) {
        console.error("API Error: ", error);
        res.status(500).json({ reply: "সার্ভার সংযোগে সমস্যা হচ্ছে, দয়া করে আবার চেষ্টা করুন।" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
