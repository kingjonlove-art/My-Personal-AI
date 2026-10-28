import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// এনভায়রনমেন্ট ভেরিয়েবল লোড করা
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// মিডলওয়্যার
app.use(express.json());
app.use(express.static('public'));

// জেমিনি এপিআই ইনিশিয়ালাইজেশন
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// রুট রাউট (টেস্ট করার জন্য)
app.get('/', (req, res) => {
  res.send('My Personal AI Server is running successfully!');
});

// চ্যাট এপিআই এন্ডপয়েন্ট
app.post('/api/chat', async (req, res) => {
  try {
    const { message, prompt } = req.body;
    const userMessage = message || prompt;

    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // সিস্টেম ইনস্ট্রাকশন বা ক্রিয়েটরের পরিচয় (আপনার নাম সেট করা)
    const systemInstruction = "তোমার নাম একটি এআই সহকারী এবং তোমার ক্রিয়েটর বা নির্মাতা হলেন ইরফান হাসনাত (Irfan Hasnat)। কেউ যদি তোমার ক্রিয়েটর সম্পর্কে জানতে চায়, তবে তুমি স্পষ্টভাবে বলবে যে তোমার ক্রিয়েটর ইরফান হাসনাত।";

    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent(userMessage);
    const responseText = result.response.text();

    res.json({ reply: responseText, response: responseText });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// সার্ভার স্টার্ট (0.0.0.0 সহ পোর্ট বাইন্ডিং নিশ্চিত করা হয়েছে যাতে রেন্ডার পোর্ট ধরতে পারে)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
