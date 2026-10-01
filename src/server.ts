import http from "http";
import app from "./app";
import { Server } from "socket.io";

const PORT = 3000;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });

    socket.on("send_message", (message) => {
        console.log("Message received:", message);

        socket.emit("receive_message", message);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});