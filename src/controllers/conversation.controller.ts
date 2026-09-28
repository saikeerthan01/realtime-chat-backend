import { Request, Response } from "express";
import pool from "../Config/database";

export const createConversation = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const currentUser = (req as any).user;

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required",
            });
        }

        const conversationResult = await pool.query(
            `
            INSERT INTO conversations
            DEFAULT VALUES
            RETURNING id, created_at
            `
        );

        const conversation = conversationResult.rows[0];

        await pool.query(
            `
            INSERT INTO conversation_participants
            (conversation_id, user_id)
            VALUES ($1, $2), ($1, $3)
            `,
            [conversation.id, currentUser.userId, userId]
        );

        res.status(201).json({
            message: "Conversation created successfully",
            conversation,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create conversation",
        });
    }
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;

        const result = await pool.query(
            `
            SELECT
                c.id,
                c.created_at
            FROM conversations c
            JOIN conversation_participants cp
                ON c.id = cp.conversation_id
            WHERE cp.user_id = $1
            ORDER BY c.created_at DESC
            `,
            [currentUser.userId]
        );

        res.status(200).json({
            conversations: result.rows,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch conversations",
        });
    }
};