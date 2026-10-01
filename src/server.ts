import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import app from "./app";
import pool from "./Config/database";

dotenv.config();

const PORT = 3000;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("Authentication error: token required"));
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET as string
        );

        socket.data.user = decoded;

        console.log(
            "Socket user authenticated:",
            (decoded as jwt.JwtPayload).userId
        );

        next();
    } catch {
        return next(new Error("Authentication error: invalid token"));
    }
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

        socket.on("join_conversation", async (conversationId) => {
        const user = socket.data.user as jwt.JwtPayload;
        const parsedConversationId = Number(conversationId);

        if (
            !Number.isInteger(parsedConversationId) ||
            parsedConversationId <= 0
        ) {
            socket.emit("room_error", {
                message: "A valid conversation ID is required",
            });
            return;
        }

        try {
            const participantResult = await pool.query(
                `
                SELECT 1
                FROM conversation_participants
                WHERE conversation_id = $1
                  AND user_id = $2
                `,
                [parsedConversationId, user.userId]
            );

            if (participantResult.rows.length === 0) {
                socket.emit("room_error", {
                    message: "You are not a participant in this conversation",
                });
                return;
            }

            const roomName = `conversation:${parsedConversationId}`;

            socket.join(roomName);

            console.log(
                `User ${user.userId} joined ${roomName}`
            );

            socket.emit("joined_conversation", {
                conversationId: parsedConversationId,
            });
         } catch (error) {
                    console.error("Failed to join conversation room:", error);

                    socket.emit("room_error", {
                        message: "Failed to join conversation room",
                    });
                }
         });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });

            socket.on("send_message", async ({ conversationId, content }) => {
        const user = socket.data.user as jwt.JwtPayload;
        const parsedConversationId = Number(conversationId);
        const messageContent =
            typeof content === "string" ? content.trim() : "";

        if (
            !Number.isInteger(parsedConversationId) ||
            parsedConversationId <= 0 ||
            !messageContent
        ) {
            socket.emit("message_error", {
                message: "A valid conversation ID and message are required",
            });
            return;
        }

        const roomName = `conversation:${parsedConversationId}`;

        if (!socket.rooms.has(roomName)) {
            socket.emit("message_error", {
                message: "Join the conversation before sending a message",
            });
            return;
        }

        try {
            const result = await pool.query(
                `
                INSERT INTO messages
                    (conversation_id, sender_id, content)
                VALUES ($1, $2, $3)
                RETURNING id, conversation_id, sender_id, content, created_at
                `,
                [
                    parsedConversationId,
                    user.userId,
                    messageContent,
                ]
            );

            const savedMessage = result.rows[0];

            io.to(roomName).emit("receive_message", savedMessage);

            console.log(
                `Message saved and sent to ${roomName}:`,
                savedMessage.content
            );
        } catch (error) {
            console.error("Failed to save socket message:", error);

            socket.emit("message_error", {
                message: "Failed to save message",
            });
        }
    });

});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});