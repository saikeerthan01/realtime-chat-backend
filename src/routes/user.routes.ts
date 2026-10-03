import { Router } from "express";
import { createUser, getUserById } from "../controllers/user.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/", createUser);
router.get("/:id", authenticateToken, getUserById);

export default router;