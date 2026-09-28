import { Router } from "express";
import {
    createMessage,
    getMessages,
} from "../controllers/message.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/:conversationId/messages", authenticateToken, createMessage);
router.get("/:conversationId/messages", authenticateToken, getMessages);

export default router;