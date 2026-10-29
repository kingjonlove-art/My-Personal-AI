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
            return res.status(400).json({ reply: "No message provided." });
        }

        const model = genAI.getGenerativeModel({ 
            model: 'gemini-3.7-flash',
            systemInstruction: `You are 'My Personal AI', created, built, and developed by Irfan Hasnat (ইরফান হাসনাত). 
            CRITICAL LANGUAGE RULE: 
            - If the user's input is in English, you MUST reply strictly in English.
            - If the user's input is in Bengali, you MUST reply strictly in Bengali.
            - Answer all questions accurately and intelligently.
            - If anyone asks who created you or who made you, proudly answer that you were created by Irfan Hasnat (ইরফান হাসনাত) in the matching language.`
        });

        const result = await model.generateContent(userMessage);
        const response = await result.response;
        const replyText = response.text() || "No response generated.";

        res.json({ reply: replyText });

    } catch (error) {
        console.error("API Error: ", error.message);
        res.status(500).json({ reply: `Server Error: ${error.message}` });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
