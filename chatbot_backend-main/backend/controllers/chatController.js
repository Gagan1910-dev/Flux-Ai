import crypto from 'crypto';
import ChatHistory from "../models/ChatHistory.js";
import Document from "../models/Document.js";
import AuditLog from "../models/AuditLog.js";
import {
  retrieveRelevantContext,
  buildContextualPrompt,
  parseVerificationResponse,
} from "../services/ragService.js";
import { generateResponse } from "../services/llmService.js";
import { getAllowedAccessLevels } from "../middleware/auth.js";
import { generateGuestToken } from "../utils/jwt.js";

// Helper: Generate Title (asynchronous, non-blocking)
const generateSmartTitle = async (firstMessage) => {
  try {
    const titlePrompt = `Summarize this message into a short, catchy 3-5 word title. Do not use quotes. Message: "${firstMessage.substring(0, 200)}"`;
    const title = await generateResponse(titlePrompt, false);
    return title.replace(/["\n\r]/g, '').trim().substring(0, 60);
  } catch (error) {
    return "New Conversation";
  }
};

// ─────────────────────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Strict input validation (blocks non-strings / NoSQL objects)
    if (typeof message !== 'string') {
      return res.status(400).json({ error: "Message must be a plain text string" });
    }

    const cleanMessage = message.trim();
    if (!cleanMessage) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }
    if (cleanMessage.length > 4000) {
      return res.status(400).json({ error: "Message exceeds maximum allowed length of 4000 characters" });
    }

    // Determine user or guest identity securely
    const userId = req.user?.userId || null;
    let guestId = req.user?.guestId || null;
    let assignedGuestToken = null;

    // If caller is completely anonymous, provision a signed guest token
    if (!userId && !guestId) {
      guestId = `guest_${crypto.randomUUID()}`;
      assignedGuestToken = generateGuestToken(guestId);
    }

    const userRole = req.user?.role || 'guest';

    // Validate sessionId format
    let cleanSessionId = `session-${Date.now()}`;
    if (typeof sessionId === 'string' && sessionId.trim().length > 0 && sessionId.length <= 128) {
      cleanSessionId = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    }

    // 🔒 STEP 1: Determine allowed access levels
    const allowedLevels = getAllowedAccessLevels(userRole);

    // 🔒 STEP 2: Fetch only authorized, COMPLETED documents
    const docFilter = { status: 'completed' };
    if (allowedLevels) {
      docFilter.accessLevel = { $in: allowedLevels };
    }
    const authorizedDocuments = await Document.find(docFilter).select('_id fileType').lean();
    const allowedDocIds = authorizedDocuments.map((doc) => doc._id);

    // 🔒 STEP 3: Retrieve text context (role-filtered, verified chunks)
    const textContext = await retrieveRelevantContext(
      cleanMessage,
      allowedLevels === null ? null : allowedDocIds
    );

    // STEP 4: Retrieve chat history for this specific owner only
    let chatHistory = null;
    let historyMessages = [];

    const historyQuery = { sessionId: cleanSessionId };
    if (userId) {
      historyQuery.userId = userId;
    } else {
      historyQuery.guestId = guestId;
      historyQuery.userId = { $in: [null, undefined] };
    }

    chatHistory = await ChatHistory.findOne(historyQuery);
    if (chatHistory?.messages) {
      historyMessages = chatHistory.messages.slice(-10);
    }

    // STEP 5: Build contextual prompt with prompt-injection defense
    const prompt = buildContextualPrompt(cleanMessage, textContext, historyMessages);

    // STEP 6: Generate response & verify evidence with Flux Verify
    const rawLlmResponse = await generateResponse(prompt, false);
    const { answer, verification } = parseVerificationResponse(
      rawLlmResponse,
      textContext.chunks,
      textContext.faqs
    );

    // STEP 7: Persist conversation history with verification metadata
    if (!chatHistory) {
      chatHistory = new ChatHistory({
        userId: userId || undefined,
        guestId: userId ? undefined : guestId,
        sessionId: cleanSessionId,
        messages: [],
        title: "New Chat",
      });
    }

    chatHistory.messages.push({ role: "user", content: cleanMessage });
    chatHistory.messages.push({
      role: "assistant",
      content: answer,
      verification,
    });
    await chatHistory.save();

    // Generate title asynchronously if this is the first exchange
    if (chatHistory.messages.length <= 2) {
      generateSmartTitle(cleanMessage)
        .then(async (newTitle) => {
          await ChatHistory.findByIdAndUpdate(chatHistory._id, { title: newTitle });
        })
        .catch(() => {});
    }

    // STEP 8: Write Audit Log (non-blocking)
    AuditLog.create({
      userId,
      userRole,
      query: cleanMessage.substring(0, 500),
      documentIdsUsed: textContext.chunks.map((c) => c.documentId?._id).filter(Boolean),
    }).catch((err) => console.error("Audit log error:", err.message));

    return res.json({
      message: answer,
      verification,
      sessionId: cleanSessionId,
      ...(assignedGuestToken ? { guestToken: assignedGuestToken, guestId } : {}),
    });
  } catch (err) {
    console.error("Chat Error:", err.message);
    res.status(500).json({ error: "Failed to process chat query" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET CHAT HISTORY — strictly isolated by verified user or guest token
// ─────────────────────────────────────────────────────────────
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const guestId = req.user?.guestId;

    // Caller must have either a valid user token or a valid guest session token
    if (!userId && !guestId) {
      return res.json([]);
    }

    const query = {};
    if (userId) {
      query.userId = userId;
    } else {
      query.guestId = guestId;
      query.userId = { $in: [null, undefined] };
    }

    if (typeof req.query.sessionId === 'string' && req.query.sessionId.trim()) {
      query.sessionId = req.query.sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    }

    const history = await ChatHistory.find(query)
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    res.json(history);
  } catch (error) {
    console.error("Get chat history error:", error.message);
    res.status(500).json({ error: "Failed to retrieve conversation history" });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE CHAT STATUS (Pin, Archive, Rename)
// ─────────────────────────────────────────────────────────────
export const updateChatStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const userId = req.user?.userId;
    const guestId = req.user?.guestId;

    if (!userId && !guestId) {
      return res.status(401).json({ error: "Authentication or valid guest token required" });
    }

    const query = { sessionId: sessionId.trim() };
    if (userId) {
      query.userId = userId;
    } else {
      query.guestId = guestId;
      query.userId = { $in: [null, undefined] };
    }

    const { isPinned, isArchived, title } = req.body;
    const updateFields = {};

    if (typeof isPinned === 'boolean') updateFields.isPinned = isPinned;
    if (typeof isArchived === 'boolean') updateFields.isArchived = isArchived;
    if (typeof title === 'string' && title.trim().length > 0) {
      updateFields.title = title.trim().substring(0, 100);
    }

    const updatedChat = await ChatHistory.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedChat) {
      return res.status(404).json({ error: "Chat conversation not found or access denied" });
    }

    res.json(updatedChat);
  } catch (error) {
    console.error("Update chat error:", error.message);
    res.status(500).json({ error: "Failed to update chat session" });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE CHAT
// ─────────────────────────────────────────────────────────────
export const deleteChat = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const userId = req.user?.userId;
    const guestId = req.user?.guestId;

    if (!userId && !guestId) {
      return res.status(401).json({ error: "Authentication or valid guest token required" });
    }

    const query = { sessionId: sessionId.trim() };
    if (userId) {
      query.userId = userId;
    } else {
      query.guestId = guestId;
      query.userId = { $in: [null, undefined] };
    }

    const deletedChat = await ChatHistory.findOneAndDelete(query);
    if (!deletedChat) {
      return res.status(404).json({ error: "Chat conversation not found or access denied" });
    }

    res.json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Delete chat error:", error.message);
    res.status(500).json({ error: "Failed to delete chat session" });
  }
};
