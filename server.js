require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.get("/", (req, res) => {
  res.send("My Personal AI Coding Server is running!");
});

app.post("/generate-code", async (req, res) => {
  try {
    const { task } = req.body;

    if (!task || typeof task !== "string") {
      return res.status(400).json({
        error: "Please describe the program you want to create."
      });
    }

    if (task.length > 10000) {
      return res.status(400).json({
        error: "Your request is too long."
      });
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: `You are My Personal AI, an expert programming assistant.
Write complete, working code for the user's request.
Explain which filename to use and how to run the code.
If the user asks to fix code, identify the problem and return the corrected code.
Never claim that code was tested unless it actually was.
Do not reveal API keys or secrets.
Do not execute generated code.

User request:
${task}`
    });

    res.json({
      success: true,
      code: response.text || "No code was generated.",
      message: "Code generation completed."
    });
  } catch (error) {
    console.error("AI error:", error.message);

    res.status(500).json({
      success: false,
      error: "AI could not generate code. Check your API key and server logs."
    });
  }
});

app.listen(PORT, () => {
  console.log(`My Personal AI is running on port ${PORT}`);
});
