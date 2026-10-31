const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GEMINI_API_KEY;

// Primary and fallback models can be configured in Render.
const PRIMARY_MODEL =
    process.env.GEMINI_MODEL || "gemini-3.8-flash";

const FALLBACK_MODEL =
    process.env.GEMINI_FALLBACK_MODEL || "";

if (!API_KEY) {
    console.error("ERROR: GEMINI_API_KEY is missing.");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: API_KEY
});

app.use(cors());

app.use(express.json({
    limit: "1mb"
}));

// Basic health check
app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "My Personal AI Server is running!",
        model: PRIMARY_MODEL
    });
});

// Check whether an error is temporary.
function isRetryableError(error) {
    const status = Number(
        error.status ||
        error.statusCode ||
        error.code
    );

    const message = String(error.message || "");

    return (
        [408, 429, 500, 502, 503, 504].includes(status) ||
        /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|timeout/i.test(message)
    );
}

// Wait before retrying.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate an AI response with retry support.
async function generateWithRetry(model, prompt, language) {

    const languageInstruction =
        language === "bn"
            ? "Reply in Bengali."
            : language === "en"
                ? "Reply in English."
                : "Reply in the same language used by the user.";

    const systemInstruction = `
You are My Personal AI.

Your creator is Irfan Hasnat.

Be helpful, accurate, polite and conversational.

${languageInstruction}

Do not repeat the user's question as your answer.
Answer the actual question directly.
If you do not know something, say so honestly.
`;
        let lastError;

    for (let attempt = 0; attempt < 3; attempt++) {

        try {

            console.log(
                `Gemini request: ${model} | Attempt ${attempt + 1}/3`
            );

            const result = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction
                }
            });

            const answer = result.text;

            if (!answer || !answer.trim()) {
                throw new Error("Gemini returned an empty response.");
            }

            return answer.trim();

        } catch (error) {

            lastError = error;

            console.error("Gemini attempt failed:", {
                model,
                attempt: attempt + 1,
                status: error.status || error.statusCode || error.code,
                message: error.message
            });

            if (!isRetryableError(error) || attempt === 2) {
                throw error;
            }

            // Exponential backoff with small random jitter.
            const delay =
                (1000 * Math.pow(2, attempt)) +
                Math.floor(Math.random() * 500);

            console.log(`Retrying in ${delay}ms...`);

            await sleep(delay);
        }
    }

    throw lastError;
}


// Main chat endpoint
app.post("/api/chat", async (req, res) => {

    try {

        const userPrompt =
            req.body.prompt ||
            req.body.message ||
            req.body.query;

        const language = req.body.language || "auto";

        if (
            typeof userPrompt !== "string" ||
            !userPrompt.trim()
        ) {
            return res.status(400).json({
                error: "A valid message is required."
            });
        }

        if (!["auto", "bn", "en"].includes(language)) {
            return res.status(400).json({
                error: "Invalid language setting."
            });
        }

        if (userPrompt.length > 8000) {
            return res.status(413).json({
                error: "Message is too long."
            });
        }

        let reply;

        try {

            reply = await generateWithRetry(
                PRIMARY_MODEL,
                userPrompt.trim(),
                language
            );

        } catch (primaryError) {

            console.error(
                "Primary Gemini model failed:",
                primaryError.message
            );

            // Only try fallback if configured.
            if (
                FALLBACK_MODEL &&
                FALLBACK_MODEL !== PRIMARY_MODEL
            ) {

                console.log(
                    "Trying fallback model:",
                    FALLBACK_MODEL
                );

                reply = await generateWithRetry(
                    FALLBACK_MODEL,
                    userPrompt.trim(),
                    language
                );

            } else {

                throw primaryError;
            }
        }

        return res.status(200).json({
            success: true,
            reply: reply,
            model: PRIMARY_MODEL
        });

    } catch (error) {

        const status = Number(
            error.status ||
            error.statusCode ||
            error.code
        );

        console.error("DETAILED API ERROR:", {
            status: status || "unknown",
            message: error.message
        });

        if (isRetryableError(error)) {

            return res.status(503).json({
                success: false,
                error: "Gemini is temporarily unavailable.",
                details: "Please try again in a few moments."
            });
        }

        return res.status(500).json({
            success: false,
            error: "Failed to generate AI response.",
            details: error.message || "Unknown server error."
        });
    }
});
// Start server
app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log("MY PERSONAL AI SERVER STARTED");
    console.log("--------------------------------");

    console.log("Port:", PORT);
    console.log("Primary Model:", PRIMARY_MODEL);

    console.log(
        "Fallback Model:",
        FALLBACK_MODEL || "Not configured"
    );

    console.log("API Status: READY");
    console.log("--------------------------------");
});
