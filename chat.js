const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_LIMIT = 80;

const statusElement = document.querySelector("[data-chat-status]");
const setupBox = document.querySelector("[data-chat-setup]");
const loginBox = document.querySelector("[data-chat-login]");
const messagesElement = document.querySelector("[data-chat-messages]");
const form = document.querySelector("[data-chat-form]");
const input = document.querySelector("#chat-message");

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

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function createMessageElement(message) {
  const item = document.createElement("li");
  item.className = "chat-message";
  item.dataset.messageId = String(message.id);

  const meta = document.createElement("div");
  meta.className = "chat-message-meta";

  const pseudo = document.createElement("strong");
  pseudo.textContent = message.pseudo;

  const time = document.createElement("time");
  time.dateTime = message.created_at;
  time.textContent = formatDate(message.created_at);

  const content = document.createElement("p");
  content.textContent = message.content;

  meta.append(pseudo, time);
  item.append(meta, content);

  return item;
}

function renderMessages(messages) {
  messagesElement.replaceChildren();

  if (!messages.length) {
    const empty = document.createElement("li");
    empty.className = "chat-empty";
    empty.textContent = "Aucun message pour le moment.";
    messagesElement.append(empty);
    return;
  }

  messages.forEach((message) => {
    messagesElement.append(createMessageElement(message));
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function appendMessage(message) {
  const existing = messagesElement.querySelector(`[data-message-id="${message.id}"]`);

  if (existing) {
    return;
  }

  messagesElement.querySelector(".chat-empty")?.remove();
  messagesElement.append(createMessageElement(message));
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function validConfig(config) {
  return Boolean(
    config
    && typeof config.url === "string"
    && config.url.startsWith("https://")
    && typeof config.anonKey === "string"
    && config.anonKey.length > 20
  );
}

async function loadMessages(client) {
  const { data, error } = await client
    .from("chat_messages")
    .select("id,pseudo,content,created_at")
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error) {
    throw error;
  }

  renderMessages([...(data || [])].reverse());
}

async function startChat() {
  if (!window.RipAuth) {
    setStatus("Auth introuvable", "error");
    setChatEnabled(false);
    return;
  }

  const user = window.RipAuth.currentUser();

  if (!user) {
    loginBox.hidden = false;
    setStatus("Connecte-toi", "error");
    setChatEnabled(false);
    renderMessages([]);
    return;
  }

  const config = window.RIP_SUPABASE;

  if (!validConfig(config)) {
    setupBox.hidden = false;
    setStatus("Supabase a configurer", "error");
    setChatEnabled(false);
    renderMessages([]);
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(config.url, config.anonKey);

  setStatus("Connexion au salon...", "");
  setChatEnabled(false);

  try {
    await loadMessages(client);
    setChatEnabled(true);
    setStatus(`Connecte : ${user.pseudo}`, "success");
  } catch (error) {
    setStatus("Erreur de chargement", "error");
    setChatEnabled(false);
    return;
  }

  client
    .channel("rip-chat-room")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages"
      },
      (payload) => appendMessage(payload.new)
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStatus(`En ligne : ${user.pseudo}`, "success");
      }
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
      user_id: user.id,
      pseudo: user.pseudo,
      content
    });

    if (error) {
      setStatus("Envoi impossible", "error");
      setChatEnabled(true);
      return;
    }

    input.value = "";
    setStatus(`En ligne : ${user.pseudo}`, "success");
    setChatEnabled(true);
    input.focus();
  });
}

setChatEnabled(false);
startChat();
