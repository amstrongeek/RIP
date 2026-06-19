const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_LIMIT = 120;
const TYPING_TTL = 2600;

const statusElement = document.querySelector("[data-chat-status]");
const setupBox = document.querySelector("[data-chat-setup]");
const loginBox = document.querySelector("[data-chat-login]");
const messagesElement = document.querySelector("[data-chat-messages]");
const form = document.querySelector("[data-chat-form]");
const input = document.querySelector("#chat-message");
const searchInput = document.querySelector("[data-chat-search]");
const onlineList = document.querySelector("[data-online-list]");
const onlineCount = document.querySelector("[data-online-count]");
const messageCount = document.querySelector("[data-message-count]");
const resultCount = document.querySelector("[data-result-count]");
const typingLine = document.querySelector("[data-typing-line]");
const charCount = document.querySelector("[data-char-count]");
const autoscrollInput = document.querySelector("[data-autoscroll]");
const compactInput = document.querySelector("[data-compact-chat]");
const clearViewButton = document.querySelector("[data-clear-chat-view]");

let currentUser = null;
let chatChannel = null;
let allMessages = [];
let typingUsers = new Map();
let typingTimeout = null;
let lastTypingSentAt = 0;

function loadFreshAuthScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `auth.js?v=20260619-social1-${Date.now()}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

async function ensureFreshAuth() {
  if (window.RipAuth && typeof window.RipAuth.ready === "function") {
    return true;
  }

  setStatus("Mise a jour auth...", "");

  try {
    await loadFreshAuthScript();
  } catch (error) {
    console.error("Auth cache reload failed:", error);
  }

  return Boolean(window.RipAuth && typeof window.RipAuth.ready === "function");
}

function setStatus(text, type = "") {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = text;
  statusElement.dataset.state = type;
}

function setChatEnabled(enabled) {
  if (!form || !input) {
    return;
  }

  form.querySelector("button[type='submit']").disabled = !enabled;
  input.disabled = !enabled;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function avatarLetter(pseudo) {
  return String(pseudo || "?").slice(0, 1).toUpperCase();
}

function colorFromString(value) {
  const colors = ["#39ff88", "#ffdc5e", "#7dd3fc", "#ff5b7f", "#c084fc", "#fb923c"];
  let hash = 0;

  for (const char of String(value || "player")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return colors[hash % colors.length];
}

function filteredMessages() {
  const query = escapeSearch(searchInput && searchInput.value);

  if (!query) {
    return allMessages;
  }

  return allMessages.filter((message) => {
    return `${message.pseudo} ${message.content}`.toLowerCase().includes(query);
  });
}

function updateCounters(visibleMessages) {
  if (messageCount) {
    messageCount.textContent = String(allMessages.length);
  }

  if (resultCount) {
    resultCount.textContent = String(visibleMessages.length);
  }
}

function createMessageElement(message) {
  const item = document.createElement("li");
  item.className = "chat-message";
  item.dataset.messageId = String(message.id);

  if (currentUser && message.user_id === currentUser.id) {
    item.classList.add("is-own");
  }

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = avatarLetter(message.pseudo);
  avatar.style.setProperty("--avatar-color", message.user_id === (currentUser && currentUser.id)
    ? currentUser.avatarColor || "#39ff88"
    : colorFromString(message.pseudo));

  const body = document.createElement("div");
  body.className = "message-body";

  const meta = document.createElement("div");
  meta.className = "chat-message-meta";

  const pseudo = document.createElement("strong");
  pseudo.textContent = message.pseudo;

  const time = document.createElement("time");
  time.dateTime = message.created_at;
  time.textContent = formatTime(message.created_at);

  const copyButton = document.createElement("button");
  copyButton.className = "message-copy";
  copyButton.type = "button";
  copyButton.textContent = "Copier";
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(`${message.pseudo}: ${message.content}`);
      copyButton.textContent = "Copie";
      window.setTimeout(() => {
        copyButton.textContent = "Copier";
      }, 1200);
    } catch (error) {
      copyButton.textContent = "Erreur";
    }
  });

  const content = document.createElement("p");
  content.textContent = message.content;

  meta.append(pseudo, time, copyButton);
  body.append(meta, content);
  item.append(avatar, body);

  return item;
}

function renderMessages() {
  const visibleMessages = filteredMessages();
  messagesElement.replaceChildren();

  if (!visibleMessages.length) {
    const empty = document.createElement("li");
    empty.className = "chat-empty";
    empty.textContent = allMessages.length ? "Aucun message ne correspond." : "Aucun message pour le moment.";
    messagesElement.append(empty);
    updateCounters(visibleMessages);
    return;
  }

  visibleMessages.forEach((message) => {
    messagesElement.append(createMessageElement(message));
  });

  updateCounters(visibleMessages);

  if (!autoscrollInput || autoscrollInput.checked) {
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }
}

function upsertMessage(message) {
  if (allMessages.some((candidate) => candidate.id === message.id)) {
    return;
  }

  allMessages = [...allMessages, message].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  renderMessages();
}

function renderOnlineUsers() {
  if (!onlineList || !onlineCount || !chatChannel) {
    return;
  }

  const state = chatChannel.presenceState();
  const users = Object.values(state)
    .flat()
    .filter(Boolean)
    .reduce((items, presence) => {
      if (!items.some((item) => item.userId === presence.userId)) {
        items.push(presence);
      }

      return items;
    }, [])
    .sort((a, b) => String(a.pseudo).localeCompare(String(b.pseudo)));

  onlineCount.textContent = String(users.length);
  onlineList.replaceChildren();

  if (!users.length) {
    const item = document.createElement("li");
    item.textContent = "Aucun joueur";
    onlineList.append(item);
    return;
  }

  users.forEach((user) => {
    const item = document.createElement("li");
    const dot = document.createElement("span");
    const name = document.createElement("strong");
    const title = document.createElement("small");

    dot.className = "online-dot";
    dot.style.setProperty("--avatar-color", user.avatarColor || colorFromString(user.pseudo));
    name.textContent = user.pseudo;
    title.textContent = user.title || user.status || "En ligne";

    item.append(dot, name, title);
    onlineList.append(item);
  });
}

function renderTypingLine() {
  if (!typingLine || !currentUser) {
    return;
  }

  const now = Date.now();
  const active = [...typingUsers.values()]
    .filter((item) => item.userId !== currentUser.id && now - item.at < TYPING_TTL)
    .map((item) => item.pseudo);

  if (!active.length) {
    typingLine.textContent = "";
    return;
  }

  typingLine.textContent = active.length === 1
    ? `${active[0]} ecrit...`
    : `${active.length} joueurs ecrivent...`;
}

async function loadMessages(client) {
  const { data, error } = await client
    .from("chat_messages")
    .select("id,user_id,pseudo,content,created_at")
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error) {
    throw error;
  }

  allMessages = [...(data || [])].reverse();
  renderMessages();
}

function bindLocalControls() {
  if (searchInput) {
    searchInput.addEventListener("input", renderMessages);
  }

  if (compactInput) {
    compactInput.addEventListener("change", () => {
      document.body.classList.toggle("chat-compact", compactInput.checked);
    });
  }

  if (clearViewButton) {
    clearViewButton.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
      }

      renderMessages();
    });
  }

  document.querySelectorAll("[data-quick-message]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!input || input.disabled) {
        return;
      }

      input.value = button.getAttribute("data-quick-message");
      input.focus();
      syncCharCount();
      sendTypingSignal();
    });
  });

  if (input) {
    input.addEventListener("input", () => {
      syncCharCount();
      sendTypingSignal();
    });
  }
}

function syncCharCount() {
  if (charCount && input) {
    charCount.textContent = String(input.value.length);
  }
}

function sendTypingSignal() {
  if (!chatChannel || !currentUser) {
    return;
  }

  const now = Date.now();

  if (now - lastTypingSentAt < 900) {
    return;
  }

  lastTypingSentAt = now;
  chatChannel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      userId: currentUser.id,
      pseudo: currentUser.pseudo,
      at: now
    }
  });
}

function startTypingCleaner() {
  window.clearInterval(typingTimeout);
  typingTimeout = window.setInterval(renderTypingLine, 900);
}

async function startChat() {
  if (!window.RipSupabase || !window.RipSupabase.isConfigured()) {
    setupBox.hidden = false;
    setStatus("Supabase a configurer", "error");
    setChatEnabled(false);
    allMessages = [];
    renderMessages();
    return;
  }

  const hasFreshAuth = await ensureFreshAuth();

  if (!hasFreshAuth) {
    setStatus("Auth a mettre a jour", "error");
    setChatEnabled(false);
    return;
  }

  await window.RipAuth.ready();
  currentUser = window.RipAuth.currentUser();

  if (!currentUser) {
    loginBox.hidden = false;
    setStatus("Connecte-toi", "error");
    setChatEnabled(false);
    allMessages = [];
    renderMessages();
    return;
  }

  const client = await window.RipSupabase.getClient();

  setStatus("Connexion au salon...", "");
  setChatEnabled(false);

  try {
    await loadMessages(client);
    bindLocalControls();
    setChatEnabled(true);
    setStatus(`Connecte : ${currentUser.pseudo}`, "success");
  } catch (error) {
    console.error("Erreur Supabase:", error);
    setStatus("Erreur de chargement", "error");
    setChatEnabled(false);
    return;
  }

  chatChannel = client.channel("rip-chat-room", {
    config: {
      broadcast: { self: false },
      presence: { key: currentUser.id }
    }
  });

  chatChannel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages"
      },
      (payload) => upsertMessage(payload.new)
    )
    .on("presence", { event: "sync" }, renderOnlineUsers)
    .on("presence", { event: "join" }, renderOnlineUsers)
    .on("presence", { event: "leave" }, renderOnlineUsers)
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      typingUsers.set(payload.userId, payload);
      renderTypingLine();
    })
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") {
        return;
      }

      await chatChannel.track({
        userId: currentUser.id,
        pseudo: currentUser.pseudo,
        title: currentUser.title,
        status: currentUser.status,
        avatarColor: currentUser.avatarColor,
        onlineAt: new Date().toISOString()
      });

      renderOnlineUsers();
      startTypingCleaner();
      setStatus(`En ligne : ${currentUser.pseudo}`, "success");
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = input.value.trim();

    if (!content) {
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      setStatus("Message trop long", "error");
      return;
    }

    setChatEnabled(false);

    const { error } = await client.from("chat_messages").insert({
      user_id: currentUser.id,
      pseudo: currentUser.pseudo,
      content
    });

    if (error) {
      console.error("Erreur envoi:", error);
      setStatus("Envoi impossible", "error");
      setChatEnabled(true);
      return;
    }

    input.value = "";
    syncCharCount();
    setStatus(`En ligne : ${currentUser.pseudo}`, "success");
    setChatEnabled(true);
    input.focus();
  });
}

setChatEnabled(false);
syncCharCount();
startChat().catch((error) => {
  console.error("Erreur tchat:", error);
  setStatus("Erreur tchat", "error");
  setChatEnabled(false);
});
