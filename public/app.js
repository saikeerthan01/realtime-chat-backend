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
const currentAvatarElement = document.getElementById("current-avatar");
const conversationsElement = document.getElementById("conversations");
const messagesElement = document.getElementById("messages");
const chatTitleElement = document.getElementById("chat-title");
const chatSubtitleElement = document.getElementById("chat-subtitle");
const chatEmptyElement = document.getElementById("chat-empty");
const messageForm = document.getElementById("message-form");
const connectionElement = document.getElementById("connection-status");
const connectionLabelElement = document.getElementById("connection-label");
const backButton = document.getElementById("back-button");

let statusTimer = null;

/* ---------- UI helpers ---------- */

function showStatus(message, type = "info") {
    statusElement.textContent = message;
    statusElement.className = `visible ${type}`;

    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        statusElement.classList.remove("visible");
    }, type === "error" ? 7000 : 4500);
}

function setConnectionState(connectionState) {
    const labels = {
        connecting: "Connecting",
        connected: "Connected",
        offline: "Offline",
    };

    connectionElement.dataset.state = connectionState;
    connectionLabelElement.textContent = labels[connectionState];
}

function updateChatView() {
    const hasActive = state.activeConversationId !== null;

    chatEmptyElement.classList.toggle("hidden", hasActive);
    messagesElement.classList.toggle("hidden", !hasActive);
    messageForm.classList.toggle("hidden", !hasActive);
    chatPanel.classList.toggle("chat-open", hasActive);

    if (!hasActive) {
        chatTitleElement.textContent = "Choose a conversation";
        chatSubtitleElement.textContent = "Private chat by ID";
    }
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.append(helper);
        helper.select();

        let copied = false;
        try {
            copied = document.execCommand("copy");
        } catch (copyError) {
            copied = false;
        }

        helper.remove();
        return copied;
    }
}

function renderCurrentUser() {
    currentUserElement.replaceChildren();

    const name = document.createElement("span");
    name.className = "profile-name";
    name.textContent = state.user.username;

    const row = document.createElement("span");
    row.className = "chat-id-row";

    const label = document.createElement("span");
    label.className = "chat-id-label";
    label.append("Your Chat ID: ");

    const idValue = document.createElement("b");
    idValue.textContent = state.user.id;
    label.append(idValue);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-btn";
    copyButton.title = "Copy your Chat ID";
    copyButton.setAttribute("aria-label", "Copy your Chat ID");
    copyButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="9" y="9" width="11" height="11" rx="2"/>' +
        '<path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';

    copyButton.addEventListener("click", async () => {
        const copied = await copyText(String(state.user.id));

        if (copied) {
            showStatus("Your Chat ID was copied.", "success");
        } else {
            showStatus("Could not copy. Your Chat ID is " + state.user.id + ".", "error");
        }
    });

    row.append(label, copyButton);
    currentUserElement.append(name, row);

    currentAvatarElement.textContent = String(state.user.username || "?").charAt(0);
}

/* ---------- API ---------- */

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

/* ---------- Session ---------- */

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
    currentUserElement.replaceChildren();
    conversationsElement.replaceChildren();
    messagesElement.replaceChildren();
    updateChatView();
}

function showLoggedIn() {
    authPanel.classList.add("hidden");
    chatPanel.classList.remove("hidden");

    renderCurrentUser();
    updateChatView();
    connectSocket();
    loadConversations();
}

/* ---------- Socket ---------- */

function connectSocket() {
    if (state.socket) {
        state.socket.disconnect();
    }

    setConnectionState("connecting");

    state.socket = io({
        auth: {
            token: state.token,
        },
    });

    state.socket.on("connect", () => {
        setConnectionState("connected");
        showStatus("Connected to real-time chat.", "success");
    });

    state.socket.on("disconnect", () => {
        setConnectionState("offline");
    });

    state.socket.on("connect_error", (error) => {
        setConnectionState("offline");
        showStatus(`Socket connection error: ${error.message}`, "error");
    });

    state.socket.on("room_error", (error) => {
        showStatus(error.message, "error");
    });

    state.socket.on("message_error", (error) => {
        showStatus(error.message, "error");
    });

    state.socket.on("receive_message", (message) => {
        if (Number(message.conversation_id) === state.activeConversationId) {
            renderMessage(message);
        }
    });
}

/* ---------- Rendering ---------- */

function renderMessage(message) {
    const placeholder = messagesElement.querySelector(".thread-empty");

    if (placeholder) {
        placeholder.remove();
    }

    const isMine = Number(message.sender_id) === state.user.id;

    const item = document.createElement("div");
    item.className = "message";

    if (isMine) {
        item.classList.add("mine");
    }

    const content = document.createElement("div");
    content.textContent = message.content;

    const details = document.createElement("small");
    const sentAt = message.created_at
        ? new Date(message.created_at).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
          })
        : "Just now";

    details.textContent = isMine
        ? `You · ${sentAt}`
        : `User ${message.sender_id} · ${sentAt}`;

    item.append(content, details);
    messagesElement.append(item);
    messagesElement.scrollTop = messagesElement.scrollHeight;
}

function renderConversations(conversations) {
    conversationsElement.replaceChildren();

    if (!conversations.length) {
        const empty = document.createElement("div");
        empty.className = "list-empty";

        const title = document.createElement("strong");
        title.textContent = "No conversations yet";

        empty.append(title, "Start a private chat with someone's Chat ID.");
        conversationsElement.append(empty);
        return;
    }

    conversations.forEach((conversation) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "convo";

        const avatar = document.createElement("span");
        avatar.className = "avatar soft";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = "#";

        const text = document.createElement("span");

        const title = document.createElement("span");
        title.className = "convo-title";
        title.textContent = `Conversation ${conversation.id}`;

        const sub = document.createElement("span");
        sub.className = "convo-sub";
        sub.textContent = "Private chat";

        text.append(title, sub);
        button.append(avatar, text);

        if (conversation.id === state.activeConversationId) {
            button.classList.add("active");
            button.setAttribute("aria-current", "true");
        }

        button.addEventListener("click", () => {
            openConversation(conversation.id);
        });

        conversationsElement.append(button);
    });
}

/* ---------- Data loading ---------- */

async function loadConversations() {
    try {
        const data = await apiRequest("/api/conversations");

        renderConversations(data.conversations);
    } catch (error) {
        showStatus(error.message, "error");
    }
}

async function openConversation(conversationId) {
    try {
        const data = await apiRequest(
            `/api/conversations/${conversationId}/messages`
        );

        state.activeConversationId = Number(conversationId);
        chatTitleElement.textContent = `Conversation ${conversationId}`;
        chatSubtitleElement.textContent = "Private chat by ID";
        messagesElement.replaceChildren();

        updateChatView();

        if (!data.messages.length) {
            const empty = document.createElement("p");
            empty.className = "thread-empty";
            empty.textContent = "No messages yet. Say hello!";
            messagesElement.append(empty);
        }

        data.messages.forEach(renderMessage);

        renderConversations(
            (await apiRequest("/api/conversations")).conversations
        );

        state.socket.emit("join_conversation", state.activeConversationId);

        showStatus(`Joined conversation ${conversationId}.`, "success");

        document.getElementById("message-content").focus({ preventScroll: true });
    } catch (error) {
        showStatus(error.message, "error");
    }
}

/* ---------- Events ---------- */

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
                `Account created. Your Chat ID is ${user.user.id}. You can now log in.`,
                "success"
            );

            event.target.reset();

            document.getElementById("register-form").classList.add("hidden");
            document.getElementById("login-form").classList.remove("hidden");
        } catch (error) {
            showStatus(error.message, "error");
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
            showStatus("Logged in successfully.", "success");
        } catch (error) {
            showStatus(error.message, "error");
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

            showStatus("Conversation created.", "success");
        } catch (error) {
            showStatus(error.message, "error");
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

backButton.addEventListener("click", () => {
    state.activeConversationId = null;
    messagesElement.replaceChildren();
    updateChatView();
    loadConversations();
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