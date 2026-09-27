import express from "express";
import healthRoutes from "./routes/health.routes";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";

const app = express();
console.log("CHAT APP VERSION 2 - AUTH ROUTES LOADED");
app.use(express.json());
app.get("/api/test", (req, res) => {
    res.json({ message: "Main app is working" });
});
app.use("/api/auth", authRoutes);

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);

export default app;