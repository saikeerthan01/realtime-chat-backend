import express from "express";
import healthRoutes from "./routes/health.routes";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";


const app = express();


console.log("CHAT APP VERSION 2 - AUTH ROUTES LOADED");
app.use(express.json());
app.get("/api/test", (req, res) => {
    res.json({ message: "Main app is working" });
});
app.use("/api/auth", authRoutes);

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/conversations", messageRoutes);

export default app;