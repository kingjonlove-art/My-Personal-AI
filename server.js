const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require("@google/genai");

const app = express();

// মিডলওয়্যার কনফিগারেশন
app.use(express.json());
app.use(cors());

// জেমিনি এপিআই ইনিশিয়ালাইজ (রেন্ডারের Environment Variables থেকে API Key রিড করবে)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// রুট টেস্ট রাউট
app.get('/', (req, res) => {
    res.send('My Personal AI Server is running successfully!');
});

// চ্যাট এন্ডপয়েন্ট
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.prompt || req.body.message || req.body.query;
        if (!userMessage) {
            return res.status(400).json({ reply: "কোনো বার্তা পাওয়া যায়নি।" });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                // নির্মাতা সম্পর্কিত সুনির্দিষ্ট নির্দেশনা
                systemInstruction: "You are 'My Personal AI'. You were created, built, and developed by Irfan Hasnat (ইরফান হাসনাত). If anyone asks who created you, who is your creator, or who made you, always proudly answer that you were created by Irfan Hasnat (ইরফান হাসনাত)."
            }
        });

        // রেসপন্স টেক্সট এক্সট্রাক্ট করা
        const replyText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || "দুঃখিত, উত্তর পাওয়া যায়নি।";
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
