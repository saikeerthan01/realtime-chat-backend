import express from "express";
import healthRoutes from "./routes/health.routes";
import userRoutes from "./routes/user.routes";

const app = express();

app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);

export default app;