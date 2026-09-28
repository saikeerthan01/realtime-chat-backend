import { Request, Response } from "express";
import pool from "../Config/database";

export const createMessage = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;
        const currentUser = (req as any).user;

        if (!content || !content.trim()) {
            return res.status(400).json({
                message: "Message content is required",
            });
        }

        const participantResult = await pool.query(
            `
            SELECT 1
            FROM conversation_participants
            WHERE conversation_id = $1
              AND user_id = $2
            `,
            [conversationId, currentUser.userId]
        );

        if (participantResult.rows.length === 0) {
            return res.status(403).json({
                message: "You are not a participant in this conversation",
            });
        }

        const result = await pool.query(
            `
            INSERT INTO messages
                (conversation_id, sender_id, content)
            VALUES ($1, $2, $3)
            RETURNING id, conversation_id, sender_id, content, created_at
            `,
            [conversationId, currentUser.userId, content.trim()]
        );

        res.status(201).json({
            message: "Message sent successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to send message",
        });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const currentUser = (req as any).user;

        const participantResult = await pool.query(
            `
            SELECT 1
            FROM conversation_participants
            WHERE conversation_id = $1
              AND user_id = $2
            `,
            [conversationId, currentUser.userId]
        );

        if (participantResult.rows.length === 0) {
            return res.status(403).json({
                message: "You are not a participant in this conversation",
            });
        }

        const result = await pool.query(
            `
            SELECT
                m.id,
                m.content,
                m.created_at,
                u.id AS sender_id,
                u.username AS sender
            FROM messages m
            JOIN users u
                ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
            `,
            [conversationId]
        );

        res.status(200).json({
            conversationId: Number(conversationId),
            messages: result.rows,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch messages",
        });
    }
};