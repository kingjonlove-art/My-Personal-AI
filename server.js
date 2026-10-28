const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();

// ১. মিডলওয়্যার কনফিগারেশন (CORS ও JSON পার্সিং যাতে ফ্রন্টএন্ডের সাথে ব্লক না হয়)
app.use(cors({
    origin: '*', // প্রয়োজনে নির্দিষ্ট ডোমেইন দিতে পারেন, '*' দিলে যেকোনো ফ্রন্টএন্ড থেকে এক্সেস পাবে
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// ২. Gemini API ইনিশিয়ালাইজেশন (Render-এর Environment Variable থেকে API Key নিবে)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ৩. হেলথ চেক রাউট (আপনার ফ্রন্টএন্ডের HEALTH_ENDPOINT এটি চেক করে)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ৪. মূল চ্যাট রাউট (ফ্রন্টএন্ডের API_ENDPOINT থেকে রিকোয়েস্ট রিসিভ করবে)
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Gemini মডেল কল করা (gemini-2.5-flash ব্যবহার করা হচ্ছে)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
        });

        const replyText = response.text;

        // সফলভাবে ফ্রন্টএন্ডে উত্তর পাঠানো
        res.json({
            reply: replyText,
            conversationId: conversationId || "conv_" + Date.now()
        });

    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ 
            error: error.message || "Internal Server Error. Please try again later." 
        });
    }
});

// ৫. সার্ভার পোর্ট লিসেনিং (Render স্বয়ংক্রিয়ভাবে PORT অ্যাসাইন করবে)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running successfully on port ${PORT}`);
});
