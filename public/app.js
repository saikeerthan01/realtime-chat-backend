const state = {
    token: localStorage.getItem("chat_token"),
    user: JSON.parse(localStorage.getItem("chat_user") || "null"),
    socket: null,
    activeConversationId: null,
    activePersonId: null,
    users: [],
    usersById: new Map(),
    search: "",
};

const statusElement = document.getElementById("status");
const authPanel = document.getElementById("auth-panel");
const chatPanel = document.getElementById("chat-panel");
const currentUserElement = document.getElementById("current-user");
const currentAvatarElement = document.getElementById("current-avatar");
const usersListElement = document.getElementById("users-list");
const peopleCountElement = document.getElementById("people-count");
const userSearchElement = document.getElementById("user-search");
const messagesElement = document.getElementById("messages");
const chatTitleElement = document.getElementById("chat-title");
const chatSubtitleElement = document.getElementById("chat-subtitle");
const chatEmptyElement = document.getElementById("chat-empty");
const messageForm = document.getElementById("message-form");
const connectionElement = document.getElementById("connection-status");
const connectionLabelElement = document.getElementById("connection-label");
const backButton = document.getElementById("back-button");

let statusTimer = null;
let openingPersonId = null;

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
        chatSubtitleElement.textContent = "Pick someone from the people list";
    }
}

function renderCurrentUser() {
    currentUserElement.replaceChildren();

    const name = document.createElement("span");
    name.className = "profile-name";
    name.textContent = state.user.username;

    const hint = document.createElement("span");
    hint.className = "chat-id-label";
    hint.textContent = "Signed in";

    currentUserElement.append(name, hint);
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

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        // The server returns 401 (no token) or 403 "Invalid or expired token".
        // Tokens last 1 hour, so send the person back to log in instead of
        // leaving them on a screen where every request fails.
        const tokenRejected =
            response.status === 401 ||
            (response.status === 403 &&
                data.message === "Invalid or expired token");

        if (state.token && tokenRejected) {
            clearSession();
            showLoggedOut();
            throw new Error("Your session expired. Please log in again.");
        }

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
    state.activePersonId = null;
    state.users = [];
    state.usersById = new Map();
    state.search = "";

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
    usersListElement.replaceChildren();
    messagesElement.replaceChildren();
    userSearchElement.value = "";
    peopleCountElement.textContent = "";
    updateChatView();
}

function showLoggedIn() {
    authPanel.classList.add("hidden");
    chatPanel.classList.remove("hidden");

    renderCurrentUser();
    updateChatView();
    connectSocket();
    loadUsers();
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

        // After a reconnect, rejoin the open conversation's room.
        if (state.activeConversationId !== null) {
            state.socket.emit("join_conversation", state.activeConversationId);
        }
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

function personName(userId) {
    const person = state.usersById.get(Number(userId));
    return person ? person.username : `User ${userId}`;
}

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
        : `${personName(message.sender_id)} · ${sentAt}`;

    item.append(content, details);
    messagesElement.append(item);
    messagesElement.scrollTop = messagesElement.scrollHeight;
}

function renderUsers() {
    usersListElement.replaceChildren();

    const query = state.search.trim().toLowerCase();
    const visible = state.users.filter((person) =>
        String(person.username).toLowerCase().includes(query)
    );

    peopleCountElement.textContent = state.users.length
        ? `${state.users.length} registered`
        : "";

    if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "list-empty";

        const title = document.createElement("strong");
        title.textContent = state.users.length
            ? "No matching people"
            : "No other users yet";

        empty.append(
            title,
            state.users.length
                ? "Try a different name."
                : "When someone else registers, they will show up here."
        );
        usersListElement.append(empty);
        return;
    }

    visible.forEach((person) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "person";
        button.disabled = openingPersonId === person.id;

        if (person.id === state.activePersonId) {
            button.classList.add("active");
            button.setAttribute("aria-current", "true");
        }

        const avatar = document.createElement("span");
        avatar.className = "avatar soft";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = String(person.username || "?").charAt(0);

        const text = document.createElement("span");
        text.className = "person-text";

        const name = document.createElement("span");
        name.className = "person-name";
        name.textContent = person.username;

        const sub = document.createElement("span");
        sub.className = "person-sub";
        sub.textContent = "Tap to message";

        text.append(name, sub);
        button.append(avatar, text);

        button.addEventListener("click", () => {
            startChatWith(person);
        });

        usersListElement.append(button);
    });
}

/* ---------- Data loading ---------- */

async function loadUsers() {
    try {
        const data = await apiRequest("/api/users");
        const list = Array.isArray(data.users) ? data.users : [];

        state.users = list
            .filter((person) => Number(person.id) !== Number(state.user.id))
            .map((person) => ({ id: Number(person.id), username: person.username }));

        state.usersById = new Map(state.users.map((person) => [person.id, person]));

        renderUsers();
    } catch (error) {
        usersListElement.replaceChildren();

        const empty = document.createElement("div");
        empty.className = "list-empty";

        const title = document.createElement("strong");
        title.textContent = "Couldn't load people";

        empty.append(title, error.message);
        usersListElement.append(empty);

        showStatus(error.message, "error");
    }
}

async function startChatWith(person) {
    if (openingPersonId !== null) {
        return;
    }

    openingPersonId = person.id;
    renderUsers();

    try {
        // Same endpoint and body the app already used; the id now comes
        // from the person you tapped instead of a typed number.
        const result = await apiRequest("/api/conversations", {
            method: "POST",
            body: JSON.stringify({
                userId: person.id,
            }),
        });

        await openConversation(result.conversation.id, person);
    } catch (error) {
        showStatus(error.message, "error");
    } finally {
        openingPersonId = null;
        renderUsers();
    }
}

async function openConversation(conversationId, person) {
    const data = await apiRequest(
        `/api/conversations/${conversationId}/messages`
    );

    state.activeConversationId = Number(conversationId);
    state.activePersonId = person ? person.id : null;

    chatTitleElement.textContent = person
        ? person.username
        : `Conversation ${conversationId}`;
    chatSubtitleElement.textContent = "Private conversation";
    messagesElement.replaceChildren();

    updateChatView();

    if (!data.messages.length) {
        const empty = document.createElement("p");
        empty.className = "thread-empty";
        empty.textContent = person
            ? `No messages yet. Say hello to ${person.username}!`
            : "No messages yet. Say hello!";
        messagesElement.append(empty);
    }

    data.messages.forEach(renderMessage);

    state.socket.emit("join_conversation", state.activeConversationId);

    document.getElementById("message-content").focus({ preventScroll: true });
}

/* ---------- Events ---------- */

userSearchElement.addEventListener("input", () => {
    state.search = userSearchElement.value;
    renderUsers();
});

document
    .getElementById("register-form")
    .addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            await apiRequest("/api/users", {
                method: "POST",
                body: JSON.stringify({
                    username: document.getElementById("register-username").value,
                    email: document.getElementById("register-email").value,
                    password: document.getElementById("register-password").value,
                }),
            });

            showStatus("Account created. You can now log in.", "success");

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
    state.activePersonId = null;
    messagesElement.replaceChildren();
    updateChatView();
    renderUsers();
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