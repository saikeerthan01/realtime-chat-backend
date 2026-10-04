import { Router } from "express";
import { createUser, getUserById, getUsers } from "../controllers/user.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/", createUser);
router.get("/", authenticateToken, getUsers);
router.get("/:id", authenticateToken, getUserById);

export default router;