import { Router } from "express";
import {
    createConversation,
    getConversations,
} from "../controllers/conversation.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticateToken, createConversation);
router.get("/", authenticateToken, getConversations);

export default router;