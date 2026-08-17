import express from "express";
import healthRoutes from "./routes/health.routes";

const app = express();

app.use("/api/health", healthRoutes);

export default app;