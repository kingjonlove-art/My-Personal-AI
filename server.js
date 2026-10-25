import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// জেমিনি এপিআই ইনিশিয়ালাইজেশন
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.get("/", (req, res) => {
  res.send("My Personal AI Coding Server is running!");
});

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // সিস্টেম ইনস্ট্রাকশন বা ক্রিয়েটরের পরিচয় (আপনার নাম সেট করা)
    const systemInstruction = "তোমার নাম একটি এআই সহকারী এবং তোমার ক্রিয়েটর বা নির্মাতা হলেন ইরফান হাসনাত (Irfan Hasnat)। কেউ যদি তোমার ক্রিয়েটর সম্পর্কে জানতে চায়, তবে তুমি স্পষ্টভাবে বলবে যে তোমার ক্রিয়েটর ইরফান হাসনাত।";

    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ response: responseText });
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
