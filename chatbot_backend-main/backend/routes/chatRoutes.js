import express from "express";
import { sendMessage, getChatHistory, updateChatStatus, deleteChat } from "../controllers/chatController.js";
import { optionalAuth, authenticate } from "../middleware/auth.js";

const router = express.Router();

// Chat endpoint (supports anonymous users)
router.post("/message", optionalAuth, sendMessage);

// History (Supports users & guests)
router.get("/history", optionalAuth, getChatHistory);

// Update Chat (Pin/Archive/Rename)
router.patch("/:sessionId", optionalAuth, updateChatStatus);

// Delete Chat
router.delete("/:sessionId", optionalAuth, deleteChat);

export default router;
