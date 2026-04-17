require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer config - memory storage for Render compatibility
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  }
});

// Extract text from PDF buffer
async function extractTextFromPDF(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text;
}

// Extract text from image buffer using Tesseract
async function extractTextFromImage(buffer, mimetype) {
  const Tesseract = require('tesseract.js');
  const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
    logger: () => {}
  });
  return text;
}

// Call OpenRouter AI API
async function generateQuestionsFromAI(extractedText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set in environment variables');

  const prompt = `Analyze the following study material and generate exam questions in this EXACT format:

## 📝 Short Answer Questions (5)
1. [question]
2. [question]
3. [question]
4. [question]
5. [question]

## 📖 Long Answer Questions (5)
1. [question]
2. [question]
3. [question]
4. [question]
5. [question]

## ⭐ Important Exam Questions (5)
1. [question]
2. [question]
3. [question]
4. [question]
5. [question]

## 🧠 Tricky / Analytical Questions (3)
1. [question]
2. [question]
3. [question]

Keep questions clear, exam-oriented, and based strictly on the content provided. Do not add extra commentary outside this format.

Study Material:
"""
${extractedText.substring(0, 4000)}
"""`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mini-ai-exam-generator.onrender.com',
      'X-Title': 'Mini AI Exam Question Generator'
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from AI.';
}

// Upload + Process endpoint
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { mimetype, buffer, originalname } = req.file;
    let extractedText = '';

    // Extract text based on file type
    if (mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(buffer);
    } else if (['image/jpeg', 'image/png', 'image/jpg'].includes(mimetype)) {
      extractedText = await extractTextFromImage(buffer, mimetype);
    } else {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    extractedText = extractedText.trim();
    if (!extractedText || extractedText.length < 30) {
      return res.status(400).json({ error: 'Could not extract meaningful text from the file. Please try a clearer image or a text-based PDF.' });
    }

    // Generate questions using AI
    const questions = await generateQuestionsFromAI(extractedText);

    res.json({
      success: true,
      filename: originalname,
      extractedLength: extractedText.length,
      questions
    });
  } catch (err) {
    console.error('Processing error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
