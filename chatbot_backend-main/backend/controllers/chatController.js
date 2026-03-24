// controllers/chatController.js

import ChatHistory from "../models/ChatHistory.js";
import Document from "../models/Document.js";
import AuditLog from "../models/AuditLog.js";
import {
  retrieveRelevantContext,
  buildContextualPrompt,
} from "../services/ragService.js";
import { generateResponse } from "../services/llmService.js";
import { getAllowedAccessLevels } from "../middleware/auth.js";

// Helper: Generate Title
const generateSmartTitle = async (firstMessage) => {
  try {
    const titlePrompt = `Summarize this message into a short, catchy 3-5 word title. Do not use quotes. Message: "${firstMessage}"`;
    const title = await generateResponse(titlePrompt, false);
    return title.replace(/"/g, '').trim();
  } catch (error) {
    console.error("Title Generation Failed:", error);
    return "New Conversation";
  }
};

// ─────────────────────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { message, sessionId, guestId } = req.body;
    const userId = req.user?.userId || null;
    const userRole = req.user?.role || 'guest';
    const userSessionId = sessionId || `session-${Date.now()}`;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ──────────────────────────────────────────────────────────
    // 🔒 STEP 1: DETERMINE ALLOWED ACCESS LEVELS FOR THIS USER
    // getAllowedAccessLevels returns null for admin (no filter),
    // or an array like ['public','employee'] for other roles
    // ──────────────────────────────────────────────────────────
    const allowedLevels = getAllowedAccessLevels(userRole);

    // ──────────────────────────────────────────────────────────
    // 🔒 STEP 2: FETCH ONLY AUTHORIZED DOCUMENTS
    // Server-side filtering BEFORE any LLM context is built
    // ──────────────────────────────────────────────────────────
    const docFilter = allowedLevels ? { accessLevel: { $in: allowedLevels } } : {};
    const authorizedDocuments = await Document.find(docFilter).lean();

    // Extract authorized document IDs for chunk filtering
    const allowedDocIds = authorizedDocuments.map((doc) => doc._id);

    // Build file URL references for LLM (only from authorized docs)
    const documentUrls = authorizedDocuments.map((doc) => ({
      type: doc.fileType === "pdf" ? "pdf" : "document",
      url: `${process.env.BASE_URL || "https://fluxai-910t.onrender.com"}/api/documents/${doc._id}/download`,
    }));

    // ──────────────────────────────────────────────────────────
    // 🔒 STEP 3: RETRIEVE TEXT CONTEXT (role-filtered chunks only)
    // ──────────────────────────────────────────────────────────
    const textContext = await retrieveRelevantContext(
      message,
      allowedLevels === null ? null : allowedDocIds   // null = admin sees all
    );

    // ──────────────────────────────────────────────────────────
    // STEP 4: GET CHAT HISTORY (context injection)
    // ──────────────────────────────────────────────────────────
    let chatHistory = null;
    let historyMessages = [];

    const query = { sessionId: userSessionId };
    if (userId) query.userId = userId;
    else if (guestId) query.guestId = guestId;

    if (userId || guestId) {
      chatHistory = await ChatHistory.findOne(query);
      if (chatHistory?.messages) {
        historyMessages = chatHistory.messages.slice(-10);
      }
    }

    // ──────────────────────────────────────────────────────────
    // STEP 5: BUILD FINAL PROMPT
    // ──────────────────────────────────────────────────────────
    const prompt = buildContextualPrompt(message, textContext, historyMessages);

    const provider = process.env.LLM_PROVIDER?.toLowerCase() || "openai";
    console.log(`🤖 LLM Provider: ${provider} | User Role: ${userRole} | Allowed Docs: ${allowedDocIds.length}`);

    // ──────────────────────────────────────────────────────────
    // STEP 6: GROQ MODE (no streaming)
    // ──────────────────────────────────────────────────────────
    if (provider === "groq") {
      try {
        const response = await generateResponse(prompt, false, documentUrls);

        if (userId || guestId) {
          if (!chatHistory) {
            chatHistory = new ChatHistory({
              userId,
              guestId,
              sessionId: userSessionId,
              messages: [],
              title: "New Chat",
            });
          }

          chatHistory.messages.push({ role: "user", content: message });
          chatHistory.messages.push({ role: "assistant", content: response });

          if (chatHistory.messages.length <= 2) {
            const newTitle = await generateSmartTitle(message);
            chatHistory.title = newTitle;
          }

          await chatHistory.save();
        }

        // 🔒 STEP 7: WRITE AUDIT LOG
        AuditLog.create({
          userId,
          userRole,
          query: message,
          documentIdsUsed: textContext.chunks.map((c) => c.documentId?._id).filter(Boolean),
        }).catch((err) => console.error("Audit log error:", err));

        return res.json({ message: response });
      } catch (err) {
        console.error("Groq Error:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    // ──────────────────────────────────────────────────────────
    // STEP 6b: STREAMING MODE (OpenAI / Gemini / Claude / Deepseek)
    // ──────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    try {
      const stream = await generateResponse(prompt, true, documentUrls);

      for await (const chunk of stream) {
        const content =
          chunk.choices?.[0]?.delta?.content ||
          chunk.text?.() ||
          chunk.delta?.text ||
          "";

        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ content: "", done: true })}\n\n`);

      if (userId || guestId) {
        if (!chatHistory) {
          chatHistory = new ChatHistory({
            userId,
            guestId,
            sessionId: userSessionId,
            messages: [],
            title: "New Chat",
          });
        }

        chatHistory.messages.push({ role: "user", content: message });
        chatHistory.messages.push({ role: "assistant", content: fullResponse });

        if (chatHistory.messages.length <= 2) {
          const newTitle = await generateSmartTitle(message);
          chatHistory.title = newTitle;
        }

        await chatHistory.save();
      }

      // 🔒 STEP 7: WRITE AUDIT LOG
      AuditLog.create({
        userId,
        userRole,
        query: message,
        documentIdsUsed: textContext.chunks.map((c) => c.documentId?._id).filter(Boolean),
      }).catch((err) => console.error("Audit log error:", err));

      res.end();
    } catch (err) {
      console.error("Streaming Error:", err);
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET CHAT HISTORY
// ─────────────────────────────────────────────────────────────
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user?.userId || null;
    const guestId = req.query.guestId || null;
    const { sessionId } = req.query;

    if (!userId && !guestId) {
      return res.status(400).json({ error: "Missing userId or guestId" });
    }

    const query = {};
    if (userId) query.userId = userId;
    else if (guestId) query.guestId = guestId;

    if (sessionId) query.sessionId = sessionId;

    const history = await ChatHistory.find(query)
      .sort({ updatedAt: -1 })
      .limit(20);

    res.json(history);
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE CHAT STATUS (Pin, Archive, Rename)
// ─────────────────────────────────────────────────────────────
export const updateChatStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { isPinned, isArchived, title, guestId } = req.body;
    const userId = req.user?.userId;

    const query = { sessionId };
    if (userId) query.userId = userId;
    else if (guestId) query.guestId = guestId;
    else return res.status(401).json({ error: "Unauthorized" });

    const updateFields = {};
    if (isPinned !== undefined) updateFields.isPinned = isPinned;
    if (isArchived !== undefined) updateFields.isArchived = isArchived;
    if (title !== undefined) updateFields.title = title;

    const updatedChat = await ChatHistory.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedChat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json(updatedChat);
  } catch (error) {
    console.error("Update chat error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE CHAT
// ─────────────────────────────────────────────────────────────
export const deleteChat = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { guestId } = req.body;
    const userId = req.user?.userId;

    const query = { sessionId };
    if (userId) query.userId = userId;
    else if (guestId) query.guestId = guestId;
    else return res.status(401).json({ error: "Unauthorized" });

    const deletedChat = await ChatHistory.findOneAndDelete(query);

    if (!deletedChat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json({ message: "Chat deleted" });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ error: error.message });
  }
};
