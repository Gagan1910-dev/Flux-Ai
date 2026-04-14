// import OpenAI from 'openai';
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';

// Lazy clients
// let openaiClient = null;
// let geminiClient = null;
// let anthropicClient = null;
let groqClient = null;

/* ---------------------- CLIENT INITIALIZERS ---------------------- */

// const getOpenAIClient = () => {
//   if (!openaiClient && process.env.OPENAI_API_KEY) {
//     openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//   }
//   return openaiClient;
// };

// const getGeminiClient = () => {
//   if (!geminiClient && process.env.GEMINI_API_KEY) {
//     geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//   }
//   return geminiClient;
// };

// const getAnthropicClient = () => {
//   if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
//     anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
//   }
//   return anthropicClient;
// };

// ----------- NEW: GROQ CLIENT --------------
const getGroqClient = () => {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = axios.create({
      baseURL: "https://api.groq.com/openai/v1",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
  }
  return groqClient;
};

/* -------------------------- MAIN ROUTER -------------------------- */

export const generateResponse = async (prompt, stream = false) => {
  try {
    switch (LLM_PROVIDER.toLowerCase()) {
      /*
      case 'openai':
        return await generateOpenAIResponse(prompt, stream);

      case 'azure':
        return await generateAzureResponse(prompt, stream);

      case 'gemini':
        return await generateGeminiResponse(prompt, stream);

      case 'claude':
        return await generateClaudeResponse(prompt, stream);

      case 'deepseek':
        return await generateDeepSeekResponse(prompt, stream);
      */

      case 'groq':                                 // <---- ADDED
        return await generateGroqResponse(prompt, stream);

      default:
        throw new Error(`Unsupported LLM provider: ${LLM_PROVIDER}`);
    }

  } catch (error) {
    console.error('LLM Error:', error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
};

/*
// ---------------------------- OPENAI -----------------------------

const generateOpenAIResponse = async (prompt, stream) => {
  const client = getOpenAIClient();

  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    stream: stream,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return stream ? response : response.choices[0].message.content;
};

// ----------------------------- AZURE -----------------------------

const generateAzureResponse = async (prompt, stream) => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await axios.post(
    url,
    {
      messages: [{ role: 'user', content: prompt }],
      stream: stream,
      temperature: 0.7,
      max_tokens: 1000,
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      responseType: stream ? 'stream' : 'json',
    }
  );

  return stream ? response.data : response.data.choices[0].message.content;
};

// ---------------------------- GEMINI -----------------------------

const generateGeminiResponse = async (prompt, stream) => {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('Gemini API key not configured');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';

  const model = client.getGenerativeModel({ model: modelName });

  if (stream) {
    try {
      const result = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      return result.stream;
    } catch (error) {
      console.error("Gemini streaming error:", error);
      throw new Error(`Gemini API streaming error: ${error.message}`);
    }
  }

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return result.response.text();
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

// ---------------------------- CLAUDE -----------------------------

const generateClaudeResponse = async (prompt, stream) => {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
    stream: stream,
  });

  return stream ? response : response.content[0].text;
};

// --------------------------- DEEPSEEK ----------------------------

const generateDeepSeekResponse = async (prompt, stream) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  try {
    const response = await axios.post(
      `${baseURL}/v1/chat/completions`,
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        stream: stream,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: stream ? 'stream' : 'json',
      }
    );

    return stream ? response.data : response.data.choices[0].message.content;

  } catch (error) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
};
*/

/* ---------------------------- GROQ ----------------------------- */
/* NEW — Using your key: gsk_bbW..... */

/* ---------------------------- GROQ ----------------------------- */

const generateGroqResponse = async (prompt, stream) => {
  const client = getGroqClient();
  if (!client) {
    throw new Error("Groq API key not configured");
  }

  // ✅ FIX: use valid Groq model
  const modelName = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  try {
    const response = await client.post(
      "/chat/completions",
      {
        model: modelName,
        messages: Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt }],
        // ❗ Groq does NOT support OpenAI-style streaming request flag
        stream: false,
        temperature: 0.7,
        max_tokens: 1000,
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error("Groq API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
};
