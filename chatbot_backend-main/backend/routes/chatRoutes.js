import express from "express";
import {
  sendMessage,
  getChatHistory,
  updateChatStatus,
  deleteChat,
} from "../controllers/chatController.js";
import { optionalAuth } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Chat endpoint (supports authenticated users & signed guests, rate limited)
router.post("/message", optionalAuth, chatLimiter, sendMessage);

// History (isolated by verified token)
router.get("/history", optionalAuth, getChatHistory);

// Update Chat (Pin/Archive/Rename - verified owner only)
router.patch("/:sessionId", optionalAuth, updateChatStatus);

// Delete Chat (verified owner only)
router.delete("/:sessionId", optionalAuth, deleteChat);

export default router;
