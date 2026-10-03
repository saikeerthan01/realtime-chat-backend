const state = {
    token: localStorage.getItem("chat_token"),
    user: JSON.parse(localStorage.getItem("chat_user") || "null"),
    socket: null,
    activeConversationId: null,
};

const statusElement = document.getElementById("status");
const authPanel = document.getElementById("auth-panel");
const chatPanel = document.getElementById("chat-panel");
const currentUserElement = document.getElementById("current-user");
const conversationsElement = document.getElementById("conversations");
const messagesElement = document.getElementById("messages");
const chatTitleElement = document.getElementById("chat-title");
const messageForm = document.getElementById("message-form");

function showStatus(message) {
    statusElement.textContent = message;
}

async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

function saveSession(token, user) {
    state.token = token;
    state.user = user;

    localStorage.setItem("chat_token", token);
    localStorage.setItem("chat_user", JSON.stringify(user));
}

function clearSession() {
    state.token = null;
    state.user = null;
    state.activeConversationId = null;

    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_user");

    if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
    }
}

function showLoggedOut() {
    authPanel.classList.remove("hidden");
    chatPanel.classList.add("hidden");
    currentUserElement.textContent = "";
    conversationsElement.replaceChildren();
    messagesElement.replaceChildren();
    messageForm.classList.add("hidden");
}

function showLoggedIn() {
    authPanel.classList.add("hidden");
    chatPanel.classList.remove("hidden");
    currentUserElement.textContent =
        `Logged in as ${state.user.username} (ID: ${state.user.id})`;

    connectSocket();
    loadConversations();
}

function connectSocket() {
    if (state.socket) {
        state.socket.disconnect();
    }

    state.socket = io({
        auth: {
            token: state.token,
        },
    });

    state.socket.on("connect", () => {
        showStatus("Connected to real-time chat.");
    });

    state.socket.on("connect_error", (error) => {
        showStatus(`Socket connection error: ${error.message}`);
    });

    state.socket.on("room_error", (error) => {
        showStatus(error.message);
    });

    state.socket.on("message_error", (error) => {
        showStatus(error.message);
    });

    state.socket.on("receive_message", (message) => {
        if (Number(message.conversation_id) === state.activeConversationId) {
            renderMessage(message);
        }
    });
}

function renderMessage(message) {
    const item = document.createElement("div");
    item.className = "message";

    if (Number(message.sender_id) === state.user.id) {
        item.classList.add("mine");
    }

    const content = document.createElement("div");
    content.textContent = message.content;

    const details = document.createElement("small");
    const sentAt = message.created_at
        ? new Date(message.created_at).toLocaleString()
        : "Just now";

    details.textContent = `User ${message.sender_id} · ${sentAt}`;

    item.append(content, details);
    messagesElement.append(item);
    messagesElement.scrollTop = messagesElement.scrollHeight;
}

function renderConversations(conversations) {
    conversationsElement.replaceChildren();

    conversations.forEach((conversation) => {
        const button = document.createElement("button");

        button.textContent = `Conversation ${conversation.id}`;

        if (conversation.id === state.activeConversationId) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => {
            openConversation(conversation.id);
        });

        conversationsElement.append(button);
    });
}

async function loadConversations() {
    try {
        const data = await apiRequest("/api/conversations");

        renderConversations(data.conversations);
    } catch (error) {
        showStatus(error.message);
    }
}

async function openConversation(conversationId) {
    try {
        const data = await apiRequest(
            `/api/conversations/${conversationId}/messages`
        );

        state.activeConversationId = Number(conversationId);
        chatTitleElement.textContent = `Conversation ${conversationId}`;
        messagesElement.replaceChildren();

        data.messages.forEach(renderMessage);
        messageForm.classList.remove("hidden");

        renderConversations(
            (await apiRequest("/api/conversations")).conversations
        );

        state.socket.emit("join_conversation", state.activeConversationId);

        showStatus(`Joined conversation ${conversationId}.`);
    } catch (error) {
        showStatus(error.message);
    }
}

document
    .getElementById("register-form")
    .addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const user = await apiRequest("/api/users", {
                method: "POST",
                body: JSON.stringify({
                    username: document.getElementById("register-username").value,
                    email: document.getElementById("register-email").value,
                    password: document.getElementById("register-password").value,
                }),
            });

            showStatus(
                `Account created. Your user ID is ${user.user.id}. You can now log in.`
            );

            event.target.reset();
        } catch (error) {
            showStatus(error.message);
        }
    });

document
    .getElementById("login-form")
    .addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const result = await apiRequest("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: document.getElementById("login-email").value,
                    password: document.getElementById("login-password").value,
                }),
            });

            saveSession(result.token, result.user);
            event.target.reset();
            showLoggedIn();
            showStatus("Logged in successfully.");
        } catch (error) {
            showStatus(error.message);
        }
    });

document
    .getElementById("conversation-form")
    .addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const otherUserId = Number(
                document.getElementById("other-user-id").value
            );

            const result = await apiRequest("/api/conversations", {
                method: "POST",
                body: JSON.stringify({
                    userId: otherUserId,
                }),
            });

            event.target.reset();
            await loadConversations();
            await openConversation(result.conversation.id);

            showStatus("Conversation created.");
        } catch (error) {
            showStatus(error.message);
        }
    });

messageForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const contentElement = document.getElementById("message-content");
    const content = contentElement.value.trim();

    if (!state.activeConversationId || !content) {
        return;
    }

    state.socket.emit("send_message", {
        conversationId: state.activeConversationId,
        content,
    });

    contentElement.value = "";
});

document.getElementById("logout-button").addEventListener("click", () => {
    clearSession();
    showLoggedOut();
    showStatus("Logged out.");
});

document.getElementById("show-register").addEventListener("click", () => {
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("register-form").classList.remove("hidden");
    showStatus("Create an account to get started.");
});

document.getElementById("show-login").addEventListener("click", () => {
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
    showStatus("Log in to continue.");
});

if (state.token && state.user) {
    showLoggedIn();
    showStatus("Welcome back.");
} else {
    showLoggedOut();
}