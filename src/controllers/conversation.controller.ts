import { Request, Response } from "express";
import type { PoolClient } from "pg";
import pool from "../Config/database";

export const createConversation = async (req: Request, res: Response) => {
    let client: PoolClient | undefined;
    let inTransaction = false;

    try {
        const currentUser = (req as any).user;
        const currentUserId = Number(currentUser.userId);
        const otherUserId = Number(req.body?.userId);

        if (!Number.isInteger(otherUserId) || otherUserId <= 0) {
            return res.status(400).json({
                message: "A valid user ID is required",
            });
        }

        if (otherUserId === currentUserId) {
            return res.status(400).json({
                message: "You cannot start a conversation with yourself",
            });
        }

        const userResult = await pool.query(
            `
            SELECT 1
            FROM users
            WHERE id = $1
            `,
            [otherUserId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        client = await pool.connect();

        await client.query("BEGIN");
        inTransaction = true;

        // Serialize "find or create" for this pair of users so two requests
        // at the same moment cannot create two conversations.
        const lowId = Math.min(currentUserId, otherUserId);
        const highId = Math.max(currentUserId, otherUserId);

        await client.query(
            "SELECT pg_advisory_xact_lock($1::int, $2::int)",
            [lowId, highId]
        );

        const existingResult = await client.query(
            `
            SELECT c.id, c.created_at
            FROM conversations c
            JOIN conversation_participants a
                ON a.conversation_id = c.id
               AND a.user_id = $1
            JOIN conversation_participants b
                ON b.conversation_id = c.id
               AND b.user_id = $2
            ORDER BY c.created_at ASC, c.id ASC
            LIMIT 1
            `,
            [currentUserId, otherUserId]
        );

        if (existingResult.rows.length > 0) {
            await client.query("COMMIT");
            inTransaction = false;

            return res.status(200).json({
                message: "Conversation already exists",
                conversation: existingResult.rows[0],
            });
        }

        const conversationResult = await client.query(
            `
            INSERT INTO conversations
            DEFAULT VALUES
            RETURNING id, created_at
            `
        );

        const conversation = conversationResult.rows[0];

        await client.query(
            `
            INSERT INTO conversation_participants
            (conversation_id, user_id)
            VALUES ($1, $2), ($1, $3)
            `,
            [conversation.id, currentUserId, otherUserId]
        );

        await client.query("COMMIT");
        inTransaction = false;

        return res.status(201).json({
            message: "Conversation created successfully",
            conversation,
        });
    } catch (error) {
        if (client && inTransaction) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
        }

        console.error(error);

        return res.status(500).json({
            message: "Failed to create conversation",
        });
    } finally {
        if (client) {
            client.release();
        }
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