const DEFAULT_ROOM_ID = "00000000-0000-4000-8000-000000000001";
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_LIMIT = 120;
const TYPING_TTL = 2600;
const PROFILE_SELECT = "id,pseudo,title,status,bio,website,avatar_color,avatar_url,avatar_frame,profile_theme,name_style,name_color_a,name_color_b,active_badge,created_at,last_seen";
const APP_VERSION = "20260625-arcadev4";
const STORAGE_PREFIX = "rip-chat";
const THEMES = ["default", "blue", "pink", "gold"];

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
const replyPreview = document.querySelector("[data-reply-preview]");
const replyLabel = document.querySelector("[data-reply-label]");
const replyCancelButton = document.querySelector("[data-reply-cancel]");
const autoscrollInput = document.querySelector("[data-autoscroll]");
const compactInput = document.querySelector("[data-compact-chat]");
const clearViewButton = document.querySelector("[data-clear-chat-view]");
const roomFilterInput = document.querySelector("[data-room-filter]");
const roomList = document.querySelector("[data-room-list]");
const createRoomForm = document.querySelector("[data-create-room-form]");
const joinRoomForm = document.querySelector("[data-join-room-form]");
const findFriendForm = document.querySelector("[data-find-friend-form]");
const friendResults = document.querySelector("[data-friend-results]");
const friendRequests = document.querySelector("[data-friend-requests]");
const friendList = document.querySelector("[data-friend-list]");
const currentRoomName = document.querySelector("[data-current-room-name]");
const currentRoomKind = document.querySelector("[data-current-room-kind]");
const currentRoomCode = document.querySelector("[data-current-room-code]");
const selfAvatar = document.querySelector("[data-self-avatar]");
const selfName = document.querySelector("[data-self-name]");
const selfStatus = document.querySelector("[data-self-status]");
const selfProfileButton = document.querySelector("[data-open-self-profile]");
const profileModal = document.querySelector("[data-profile-modal]");
const modalAvatar = document.querySelector("[data-modal-avatar]");
const modalName = document.querySelector("[data-modal-name]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalBadge = document.querySelector("[data-modal-badge]");
const modalBio = document.querySelector("[data-modal-bio]");
const modalWebsite = document.querySelector("[data-modal-website]");
const modalStatus = document.querySelector("[data-modal-status]");
const modalCreated = document.querySelector("[data-modal-created]");
const modalAddFriend = document.querySelector("[data-modal-add-friend]");
const modalDm = document.querySelector("[data-modal-dm]");
const modalCloseButtons = document.querySelectorAll("[data-profile-close]");
const soundAlertInput = document.querySelector("[data-sound-alert]");
const pauseChatInput = document.querySelector("[data-pause-chat]");
const themeCycleButton = document.querySelector("[data-theme-cycle]");
const focusButton = document.querySelector("[data-toggle-focus]");
const leftToggleButton = document.querySelector("[data-toggle-left]");
const rightToggleButton = document.querySelector("[data-toggle-right]");
const largeTextButton = document.querySelector("[data-toggle-large-text]");
const copyRoomCodeButton = document.querySelector("[data-copy-room-code]");
const refreshChatButton = document.querySelector("[data-refresh-chat]");
const exportChatButton = document.querySelector("[data-export-chat]");
const scrollBottomButton = document.querySelector("[data-scroll-bottom]");
const featureStatus = document.querySelector("[data-feature-status]");

let client = null;
let currentUser = null;
let currentRoom = null;
let chatChannel = null;
let globalChannel = null;
let allMessages = [];
let rooms = [];
let roomLabels = new Map();
let friendProfiles = [];
let profileCache = new Map();
let activeProfile = null;
let typingUsers = new Map();
let typingTimeout = null;
let lastTypingSentAt = 0;
let unreadByRoom = new Map();
let favoriteRooms = new Set();
let queuedMessages = [];
let isPaused = false;
let currentTheme = "default";
let controlsBound = false;
let activeReplyMessage = null;
let mutedUsers = new Set();

function loadFreshAuthScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `auth.js?v=${APP_VERSION}-${Date.now()}`;
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

  const submit = form.querySelector("button[type='submit']");

  if (submit) {
    submit.disabled = !enabled;
  }

  input.disabled = !enabled;
}

function setBoxMessage(container, text) {
  if (!container) {
    return;
  }

  container.textContent = text;
}

function storageKey(name) {
  return `${STORAGE_PREFIX}:${name}`;
}

function readStorage(name, fallback = "") {
  try {
    return window.localStorage.getItem(storageKey(name)) || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(name, value) {
  try {
    window.localStorage.setItem(storageKey(name), value);
  } catch (error) {
    console.warn("Storage indisponible:", error);
  }
}

function readStorageJson(name, fallback) {
  try {
    const raw = window.localStorage.getItem(storageKey(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorageJson(name, value) {
  try {
    window.localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch (error) {
    console.warn("Storage JSON indisponible:", error);
  }
}

function setFeatureStatus(text) {
  if (featureStatus) {
    featureStatus.textContent = text;
  }
}

function playNotifySound() {
  if (!soundAlertInput || !soundAlertInput.checked || !window.AudioContext) {
    return;
  }

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.value = 740;
  gain.gain.value = 0.035;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.07);
}

function savePreferences() {
  writeStorage("theme", currentTheme);
  writeStorage("sound", soundAlertInput && soundAlertInput.checked ? "1" : "0");
  writeStorage("paused", pauseChatInput && pauseChatInput.checked ? "1" : "0");
  writeStorage("compact", compactInput && compactInput.checked ? "1" : "0");
  writeStorage("largeText", document.body.classList.contains("large-chat-text") ? "1" : "0");
  writeStorage("hideLeft", document.body.classList.contains("hide-left-sidebar") ? "1" : "0");
  writeStorage("hideRight", document.body.classList.contains("hide-right-sidebar") ? "1" : "0");
}

function applyTheme(theme) {
  currentTheme = THEMES.includes(theme) ? theme : "default";
  if (currentTheme === "default") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.dataset.theme = currentTheme;
  }
}

function loadPreferences() {
  applyTheme(readStorage("theme", "default"));
  favoriteRooms = new Set(readStorageJson("favorites", []));
  mutedUsers = new Set(readStorageJson("mutedUsers", []));

  if (soundAlertInput) {
    soundAlertInput.checked = readStorage("sound") === "1";
  }

  if (pauseChatInput) {
    pauseChatInput.checked = readStorage("paused") === "1";
    isPaused = pauseChatInput.checked;
  }

  if (compactInput) {
    compactInput.checked = readStorage("compact") === "1";
    document.body.classList.toggle("chat-compact", compactInput.checked);
  }

  document.body.classList.toggle("large-chat-text", readStorage("largeText") === "1");
  document.body.classList.toggle("hide-left-sidebar", readStorage("hideLeft") === "1");
  document.body.classList.toggle("hide-right-sidebar", readStorage("hideRight") === "1");
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

function normalizeRoomName(value) {
  return String(value || "").trim().slice(0, 40);
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

function createStackedLabel(primaryText, secondaryText) {
  const label = document.createElement("span");
  const primary = document.createElement("strong");
  const secondary = document.createElement("small");

  primary.textContent = primaryText;
  secondary.textContent = secondaryText;
  label.append(primary, secondary);

  return label;
}

function profileValue(profile, snakeName, camelName, fallback = "") {
  if (!profile) {
    return fallback;
  }

  return profile[snakeName] || profile[camelName] || fallback;
}

function applyNameStyle(element, profile, fallbackPseudo = "Player") {
  if (!element) {
    return;
  }

  element.textContent = profileValue(profile, "pseudo", "pseudo", fallbackPseudo);
  element.classList.add("display-name");
  element.dataset.nameStyle = profileValue(profile, "name_style", "nameStyle", "solid");
  element.style.setProperty("--name-color-a", profileValue(profile, "name_color_a", "nameColorA", "#39ff88"));
  element.style.setProperty("--name-color-b", profileValue(profile, "name_color_b", "nameColorB", "#ffdc5e"));
}

function applyAvatar(element, profile, fallbackPseudo = "?") {
  if (!element) {
    return;
  }

  const pseudo = profileValue(profile, "pseudo", "pseudo", fallbackPseudo);
  const avatarUrl = profileValue(profile, "avatar_url", "avatarUrl", "");

  element.replaceChildren();
  element.style.setProperty("--avatar-color", profileValue(profile, "avatar_color", "avatarColor", colorFromString(pseudo)));
  element.dataset.avatarFrame = profileValue(profile, "avatar_frame", "avatarFrame", "none");

  if (avatarUrl) {
    const image = document.createElement("img");
    image.src = avatarUrl;
    image.alt = `Avatar de ${pseudo}`;
    image.loading = "lazy";
    element.append(image);
    return;
  }

  element.textContent = avatarLetter(pseudo);
}

function formatShortDate(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function sameDay(a, b) {
  const first = new Date(a);
  const second = new Date(b);
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function appendLinkedText(container, text) {
  appendMarkdownText(container, text);
}
function saveMutedUsers() {
  writeStorageJson("mutedUsers", [...mutedUsers]);
}

function messageById(messageId) {
  return allMessages.find((message) => String(message.id) === String(messageId)) || null;
}

function setReplyTarget(message) {
  activeReplyMessage = message || null;

  if (!replyPreview || !replyLabel) {
    return;
  }

  if (!activeReplyMessage) {
    replyPreview.hidden = true;
    replyLabel.textContent = "Reponse";
    return;
  }

  replyPreview.hidden = false;
  replyLabel.textContent = `Reponse a ${activeReplyMessage.pseudo}: ${activeReplyMessage.content.slice(0, 80)}`;
  input.focus();
}

function toggleMuteUser(userId, pseudo) {
  const key = String(userId || "");

  if (!key) {
    return;
  }

  if (mutedUsers.has(key)) {
    mutedUsers.delete(key);
    setFeatureStatus(`${pseudo || "Joueur"} demute localement.`);
  } else {
    mutedUsers.add(key);
    setFeatureStatus(`${pseudo || "Joueur"} mute localement.`);
  }

  saveMutedUsers();
  renderMessages();
}

function appendMarkdownText(container, text) {
  const pattern = /(https?:\/\/[^\s]+)|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      container.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const token = match[0];

    if (token.startsWith("http")) {
      const link = document.createElement("a");
      link.className = "message-link";
      link.href = token;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = token;
      container.append(link);
    } else if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      container.append(code);
    } else if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      container.append(strong);
    } else if (token.startsWith("*")) {
      const em = document.createElement("em");
      em.textContent = token.slice(1, -1);
      container.append(em);
    }

    lastIndex = match.index + token.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    container.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function reactionSummary(message) {
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const grouped = new Map();

  reactions.forEach((reaction) => {
    const emoji = reaction.emoji || reaction.reaction || "";

    if (!emoji) {
      return;
    }

    if (!grouped.has(emoji)) {
      grouped.set(emoji, {
        count: 0,
        mine: false
      });
    }

    const entry = grouped.get(emoji);
    entry.count += 1;
    entry.mine = entry.mine || Boolean(currentUser && reaction.user_id === currentUser.id);
  });

  return grouped;
}

async function loadMessageExtras(messages) {
  const ids = (messages || []).map((message) => message.id).filter(Boolean);

  if (!ids.length) {
    return;
  }

  try {
    const { data, error } = await client
      .from("message_reactions")
      .select("message_id,user_id,emoji,created_at")
      .in("message_id", ids);

    if (error) {
      throw error;
    }

    const byMessage = new Map();
    (data || []).forEach((reaction) => {
      const key = String(reaction.message_id);
      if (!byMessage.has(key)) {
        byMessage.set(key, []);
      }
      byMessage.get(key).push(reaction);
    });

    messages.forEach((message) => {
      message.reactions = byMessage.get(String(message.id)) || [];
    });
  } catch (error) {
    console.warn("Reactions indisponibles:", error);
  }
}

async function toggleReaction(message, emoji) {
  if (!message || !currentUser) {
    return;
  }

  try {
    const existing = (message.reactions || []).find((reaction) => reaction.user_id === currentUser.id && reaction.emoji === emoji);

    if (existing) {
      const { error } = await client
        .from("message_reactions")
        .delete()
        .eq("message_id", message.id)
        .eq("user_id", currentUser.id)
        .eq("emoji", emoji);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await client
        .from("message_reactions")
        .insert({
          message_id: message.id,
          user_id: currentUser.id,
          emoji
        });

      if (error) {
        throw error;
      }
    }

    await loadMessageExtras(allMessages);
    renderMessages();
  } catch (error) {
    console.error("Erreur reaction:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Reaction impossible", "error");
  }
}

async function reportMessage(message) {
  if (!message || !currentUser) {
    return;
  }

  try {
    const { error } = await client
      .from("message_reports")
      .insert({
        message_id: message.id,
        reporter_id: currentUser.id,
        reason: "Signalement utilisateur"
      });

    if (error) {
      throw error;
    }

    setFeatureStatus("Message signale.");
  } catch (error) {
    console.error("Erreur signalement:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Signalement impossible", "error");
  }
}
function draftKey(roomId) {
  return `draft:${roomId || "none"}`;
}

function saveDraft() {
  if (currentRoom && input) {
    writeStorage(draftKey(currentRoom.id), input.value);
  }
}

function restoreDraft() {
  if (currentRoom && input) {
    input.value = readStorage(draftKey(currentRoom.id), "");
    syncCharCount();
  }
}

function clearDraft() {
  if (currentRoom) {
    writeStorage(draftKey(currentRoom.id), "");
  }
}

function kindLabel(kind) {
  const labels = {
    public: "public",
    private: "prive",
    dm: "dm"
  };

  return labels[kind] || kind;
}

function roomDisplayName(room) {
  if (!room) {
    return "Salon";
  }

  return roomLabels.get(room.id) || room.name;
}

function schemaHelp(error) {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  return /room_id|chat_rooms|room_members|friend_requests|invite_code|avatar_url|name_style|name_color|message_reactions|message_reports|reply_to_id|storage|bucket|column|schema|relationship/i.test(message);
}

async function loadProfiles(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  const missing = ids.filter((id) => !profileCache.has(id));

  if (!missing.length) {
    return;
  }

  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_SELECT)
    .in("id", missing);

  if (error) {
    const fallback = await client
      .from("profiles")
      .select("id,pseudo,title,status,avatar_color,created_at,last_seen")
      .in("id", missing);

    if (fallback.error) {
      throw fallback.error;
    }

    (fallback.data || []).forEach((profile) => {
      profileCache.set(profile.id, profile);
    });
    setFeatureStatus("Profils charges en mode compatible. Relance le SQL pour les PP.");
    return;
  }

  (data || []).forEach((profile) => {
    profileCache.set(profile.id, profile);
  });
}

async function getProfile(userId) {
  if (!userId) {
    return null;
  }

  await loadProfiles([userId]);
  return profileCache.get(String(userId)) || null;
}

function syncSelfPanel() {
  if (!currentUser) {
    return;
  }

  document.body.dataset.profileTheme = currentUser.profileTheme || "default";
  applyAvatar(selfAvatar, currentUser, currentUser.pseudo);
  applyNameStyle(selfName, currentUser, currentUser.pseudo);

  if (selfStatus) {
    selfStatus.textContent = currentUser.status || currentUser.title || "En ligne";
  }
}

function closeProfileModal() {
  if (!profileModal) {
    return;
  }

  activeProfile = null;
  profileModal.hidden = true;
  profileModal.setAttribute("aria-hidden", "true");
}

function renderProfileModal(profile) {
  if (!profileModal || !profile) {
    return;
  }

  activeProfile = profile;
  applyAvatar(modalAvatar, profile, profile.pseudo);
  applyNameStyle(modalName, profile, profile.pseudo);

  if (modalTitle) {
    modalTitle.textContent = profile.title || "Nouveau joueur";
  }

  if (modalBadge) {
    const badge = profile.active_badge || profile.activeBadge || "";
    modalBadge.hidden = !badge;
    modalBadge.textContent = badge ? `Badge ${badge}` : "";
  }

  if (modalBio) {
    modalBio.textContent = profile.bio || "Aucune bio.";
  }

  if (modalWebsite) {
    if (profile.website) {
      modalWebsite.hidden = false;
      modalWebsite.href = profile.website;
      modalWebsite.textContent = profile.website.replace(/^https:\/\//, "");
    } else {
      modalWebsite.hidden = true;
      modalWebsite.removeAttribute("href");
    }
  }

  if (modalStatus) {
    modalStatus.textContent = profile.status || "En ligne";
  }

  if (modalCreated) {
    modalCreated.textContent = formatShortDate(profile.created_at);
  }

  const isSelf = currentUser && profile.id === currentUser.id;

  if (modalAddFriend) {
    modalAddFriend.hidden = isSelf;
  }

  if (modalDm) {
    modalDm.hidden = isSelf;
  }

  profileModal.hidden = false;
  profileModal.setAttribute("aria-hidden", "false");
}

async function openProfile(userId) {
  try {
    const profile = currentUser && userId === currentUser.id
      ? {
          id: currentUser.id,
          pseudo: currentUser.pseudo,
          title: currentUser.title,
          status: currentUser.status,
          bio: currentUser.bio,
          website: currentUser.website,
          avatar_color: currentUser.avatarColor,
          avatar_url: currentUser.avatarUrl,
    avatar_frame: currentUser.avatarFrame,
    profile_theme: currentUser.profileTheme,
          name_style: currentUser.nameStyle,
          name_color_a: currentUser.nameColorA,
          name_color_b: currentUser.nameColorB,
          created_at: currentUser.createdAt
        }
      : await getProfile(userId);

    if (profile) {
      renderProfileModal(profile);
    }
  } catch (error) {
    console.error("Erreur profil public:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Profil inaccessible", "error");
  }
}

function filteredMessages() {
  const query = escapeSearch(searchInput && searchInput.value);
  const visible = allMessages.filter((message) => !mutedUsers.has(String(message.user_id)));

  if (!query) {
    return visible;
  }

  return visible.filter((message) => {
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

function updateTitle() {
  const totalUnread = [...unreadByRoom.values()].reduce((sum, value) => sum + value, 0);
  document.title = totalUnread ? `(${totalUnread}) RIP | Tchat` : "RIP | Tchat";
}

function incrementUnread(roomId) {
  if (!roomId || currentRoom && currentRoom.id === roomId) {
    return;
  }

  unreadByRoom.set(roomId, (unreadByRoom.get(roomId) || 0) + 1);
  renderRooms();
  updateTitle();
  playNotifySound();
}

function removeMessage(messageId) {
  allMessages = allMessages.filter((message) => String(message.id) !== String(messageId));
  renderMessages();
}

function markRoomRead(roomId) {
  if (!roomId) {
    return;
  }

  unreadByRoom.delete(roomId);
  renderRooms();
  updateTitle();
}

function createMessageElement(message) {
  const item = document.createElement("li");
  item.className = "chat-message";
  item.dataset.messageId = String(message.id);
  const profile = profileCache.get(String(message.user_id));
  const pseudoText = profile ? profile.pseudo : message.pseudo;
  const ownPseudo = currentUser ? currentUser.pseudo.toLowerCase() : "";

  if (currentUser && message.user_id === currentUser.id) {
    item.classList.add("is-own");
  }

  if (ownPseudo && message.content.toLowerCase().includes(`@${ownPseudo}`)) {
    item.classList.add("is-mentioned");
  }

  if (message.content.startsWith("* ")) {
    item.classList.add("is-action");
  }

  const avatar = document.createElement("button");
  avatar.type = "button";
  avatar.className = "message-avatar";
  avatar.addEventListener("click", () => openProfile(message.user_id));
  applyAvatar(avatar, profile, pseudoText);

  const body = document.createElement("div");
  body.className = "message-body";

  const meta = document.createElement("div");
  meta.className = "chat-message-meta";

  const pseudo = document.createElement("button");
  pseudo.type = "button";
  pseudo.className = "name-button";
  pseudo.addEventListener("click", () => openProfile(message.user_id));
  applyNameStyle(pseudo, profile, pseudoText);

  const time = document.createElement("time");
  time.dateTime = message.created_at;
  time.textContent = formatTime(message.created_at);
  time.title = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(message.created_at));

  const actions = document.createElement("span");
  actions.className = "message-actions";

  const replyButton = document.createElement("button");
  replyButton.className = "message-copy";
  replyButton.type = "button";
  replyButton.textContent = "Repondre";
  replyButton.addEventListener("click", () => setReplyTarget(message));
  actions.append(replyButton);

  const reactButton = document.createElement("button");
  reactButton.className = "message-copy";
  reactButton.type = "button";
  reactButton.textContent = "GG";
  reactButton.addEventListener("click", () => toggleReaction(message, "GG"));
  actions.append(reactButton);

  const reportButton = document.createElement("button");
  reportButton.className = "message-copy";
  reportButton.type = "button";
  reportButton.textContent = "Signaler";
  reportButton.addEventListener("click", () => reportMessage(message));
  actions.append(reportButton);

  const muteButton = document.createElement("button");
  muteButton.className = "message-copy";
  muteButton.type = "button";
  muteButton.textContent = mutedUsers.has(String(message.user_id)) ? "Demute" : "Mute";
  muteButton.addEventListener("click", () => toggleMuteUser(message.user_id, pseudoText));
  actions.append(muteButton);

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

  actions.append(copyButton);

  if (currentUser && message.user_id === currentUser.id) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "message-copy";
    deleteButton.type = "button";
    deleteButton.textContent = "Suppr";
    deleteButton.addEventListener("click", async () => {
      const { error } = await client
        .from("chat_messages")
        .delete()
        .eq("id", message.id)
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("Erreur suppression:", error);
        setStatus("Suppression impossible", "error");
        return;
      }

      removeMessage(message.id);
      setFeatureStatus("Message supprime.");
    });
    actions.append(deleteButton);
  }

  const content = document.createElement("p");
  appendLinkedText(content, message.content);

  const replyTo = message.reply_to_id ? messageById(message.reply_to_id) : null;
  if (replyTo) {
    const reply = document.createElement("button");
    reply.type = "button";
    reply.className = "message-reply-context";
    reply.textContent = `Reponse a ${replyTo.pseudo}: ${replyTo.content.slice(0, 90)}`;
    reply.addEventListener("click", () => {
      const target = messagesElement.querySelector(`[data-message-id="${replyTo.id}"]`);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.classList.add("is-mentioned");
        window.setTimeout(() => target.classList.remove("is-mentioned"), 1300);
      }
    });
    body.append(reply);
  }

  const reactionBar = document.createElement("div");
  reactionBar.className = "reaction-bar";
  const reactions = reactionSummary(message);
  ["GG", "+1", "OK", "RIP"].forEach((emoji) => {
    const summary = reactions.get(emoji);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reaction-pill";
    button.dataset.active = summary && summary.mine ? "true" : "false";
    button.textContent = `${emoji}${summary ? ` ${summary.count}` : ""}`;
    button.addEventListener("click", () => toggleReaction(message, emoji));
    reactionBar.append(button);
  });

  meta.append(pseudo, time, actions);
  body.append(meta, content, reactionBar);
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

  visibleMessages.forEach((message, index) => {
    const previous = visibleMessages[index - 1];

    if (!previous || !sameDay(previous.created_at, message.created_at)) {
      const separator = document.createElement("li");
      separator.className = "day-separator";
      separator.textContent = formatShortDate(message.created_at);
      messagesElement.append(separator);
    }

    messagesElement.append(createMessageElement(message));
  });

  updateCounters(visibleMessages);

  if (!autoscrollInput || autoscrollInput.checked) {
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }
}

async function upsertMessage(message) {
  if (!currentRoom || message.room_id !== currentRoom.id) {
    return;
  }

  if (allMessages.some((candidate) => candidate.id === message.id)) {
    return;
  }

  if (isPaused && (!currentUser || message.user_id !== currentUser.id)) {
    queuedMessages.push(message);
    setFeatureStatus(`${queuedMessages.length} message(s) en attente. Decoche Pause live.`);
    return;
  }

  allMessages = [...allMessages, message].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  await loadMessageExtras(allMessages);
  await loadProfiles([message.user_id]);
  renderMessages();
}

async function flushQueuedMessages() {
  const queued = queuedMessages;
  queuedMessages = [];

  for (const message of queued) {
    await upsertMessage(message);
  }

  setFeatureStatus(queued.length ? `${queued.length} message(s) ajoutes.` : "Pause live desactivee.");
}

function renderRooms() {
  if (!roomList) {
    return;
  }

  roomList.replaceChildren();

  if (!rooms.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.disabled = true;
    empty.textContent = "Aucun salon";
    roomList.append(empty);
    return;
  }

  const filter = escapeSearch(roomFilterInput && roomFilterInput.value);
  const visibleRooms = rooms
    .filter((room) => !filter || `${roomDisplayName(room)} ${kindLabel(room.kind)}`.toLowerCase().includes(filter))
    .sort((a, b) => {
      const favoriteDelta = Number(favoriteRooms.has(b.id)) - Number(favoriteRooms.has(a.id));

      if (favoriteDelta) {
        return favoriteDelta;
      }

      return String(roomDisplayName(a)).localeCompare(String(roomDisplayName(b)));
    });

  if (!visibleRooms.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.disabled = true;
    empty.textContent = "Aucun resultat";
    roomList.append(empty);
    return;
  }

  visibleRooms.forEach((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-button";
    button.dataset.active = currentRoom && room.id === currentRoom.id ? "true" : "false";
    button.dataset.favorite = favoriteRooms.has(room.id) ? "true" : "false";
    button.dataset.unread = String(unreadByRoom.get(room.id) || 0);
    button.append(createStackedLabel(roomDisplayName(room), kindLabel(room.kind)));
    button.addEventListener("click", () => selectRoom(room.id));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();

      if (favoriteRooms.has(room.id)) {
        favoriteRooms.delete(room.id);
        setFeatureStatus("Salon retire des favoris.");
      } else {
        favoriteRooms.add(room.id);
        setFeatureStatus("Salon ajoute aux favoris.");
      }

      writeStorageJson("favorites", [...favoriteRooms]);
      renderRooms();
    });
    roomList.append(button);
  });
}

function updateCurrentRoomHeader() {
  if (!currentRoom || !currentRoomName || !currentRoomKind || !currentRoomCode) {
    return;
  }

  currentRoomName.textContent = roomDisplayName(currentRoom);
  currentRoomKind.textContent = kindLabel(currentRoom.kind);

  if (currentRoom.kind === "private" && currentRoom.invite_code) {
    currentRoomCode.hidden = false;
    currentRoomCode.textContent = `code: ${currentRoom.invite_code}`;
  } else {
    currentRoomCode.hidden = true;
    currentRoomCode.textContent = "";
  }
}

async function loadRooms() {
  const { data, error } = await client
    .from("chat_rooms")
    .select("id,name,kind,owner_id,invite_code,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  rooms = data || [];

  if (!rooms.some((room) => room.id === DEFAULT_ROOM_ID)) {
    rooms.unshift({
      id: DEFAULT_ROOM_ID,
      name: "General",
      kind: "public",
      owner_id: null,
      invite_code: "general"
    });
  }

  await loadRoomLabels();

  const lastRoomId = readStorage("lastRoom");
  currentRoom = rooms.find((room) => currentRoom && room.id === currentRoom.id)
    || rooms.find((room) => room.id === lastRoomId)
    || rooms.find((room) => room.id === DEFAULT_ROOM_ID)
    || rooms[0];

  renderRooms();
  updateCurrentRoomHeader();
}

async function loadRoomLabels() {
  roomLabels = new Map();

  const dmIds = rooms
    .filter((room) => room.kind === "dm")
    .map((room) => room.id);

  if (!dmIds.length) {
    return;
  }

  const { data: members, error } = await client
    .from("room_members")
    .select("room_id,user_id")
    .in("room_id", dmIds)
    .neq("user_id", currentUser.id);

  if (error) {
    throw error;
  }

  const userIds = [...new Set((members || []).map((member) => member.user_id))];

  if (!userIds.length) {
    return;
  }

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id,pseudo")
    .in("id", userIds);

  if (profileError) {
    throw profileError;
  }

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  (members || []).forEach((member) => {
    const profile = profilesById.get(member.user_id);

    if (profile) {
      roomLabels.set(member.room_id, `DM ${profile.pseudo}`);
    }
  });
}

async function loadMessages() {
  const { data, error } = await client
    .from("chat_messages")
    .select("id,room_id,user_id,pseudo,content,reply_to_id,created_at")
    .eq("room_id", currentRoom.id)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error) {
    throw error;
  }

  allMessages = [...(data || [])].reverse();
  await loadMessageExtras(allMessages);
  await loadProfiles(allMessages.map((message) => message.user_id));
  renderMessages();
}

async function switchRealtimeChannel() {
  if (chatChannel) {
    await client.removeChannel(chatChannel);
    chatChannel = null;
  }

  typingUsers = new Map();
  renderTypingLine();

  chatChannel = client.channel(`rip-room-${currentRoom.id}`, {
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
        table: "chat_messages",
        filter: `room_id=eq.${currentRoom.id}`
      },
      (payload) => {
        upsertMessage(payload.new).catch((error) => {
          console.error("Erreur message temps reel:", error);
        });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${currentRoom.id}`
      },
      (payload) => removeMessage(payload.old.id)
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
        avatarUrl: currentUser.avatarUrl,
        nameStyle: currentUser.nameStyle,
        nameColorA: currentUser.nameColorA,
        nameColorB: currentUser.nameColorB,
        roomId: currentRoom.id,
        onlineAt: new Date().toISOString()
      });

      renderOnlineUsers();
      startTypingCleaner();
      setStatus(`En ligne : ${currentUser.pseudo}`, "success");
    });
}

function switchGlobalChannel() {
  if (globalChannel) {
    return;
  }

  globalChannel = client
    .channel("rip-all-rooms")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages"
      },
      (payload) => {
        if (!currentRoom || payload.new.room_id !== currentRoom.id) {
          incrementUnread(payload.new.room_id);
        }
      }
    )
    .subscribe();
}

async function selectRoom(roomId) {
  const room = rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    return;
  }

  saveDraft();
  setReplyTarget(null);
  currentRoom = room;
  writeStorage("lastRoom", room.id);
  markRoomRead(room.id);
  setStatus("Chargement du salon...", "");
  setChatEnabled(false);
  renderRooms();
  updateCurrentRoomHeader();

  try {
    await loadMessages();
    await switchRealtimeChannel();
    restoreDraft();
    setChatEnabled(true);
    setStatus(`Salon : ${roomDisplayName(currentRoom)}`, "success");
  } catch (error) {
    console.error("Erreur salon:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Salon inaccessible", "error");
  }
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
    const avatar = document.createElement("button");
    const name = document.createElement("button");
    const title = document.createElement("small");

    avatar.type = "button";
    avatar.className = "online-avatar";
    avatar.addEventListener("click", () => openProfile(user.userId));
    applyAvatar(avatar, user, user.pseudo);

    name.type = "button";
    name.className = "name-button";
    name.addEventListener("click", () => openProfile(user.userId));
    applyNameStyle(name, user, user.pseudo);

    title.textContent = user.title || user.status || "En ligne";

    item.append(avatar, name, title);
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

async function loadFriends() {
  const { data, error } = await client
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at,updated_at")
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    if (schemaHelp(error)) {
      setBoxMessage(friendList, "Relance le SQL pour activer les amis.");
      return;
    }

    throw error;
  }

  const accepted = (data || []).filter((request) => request.status === "accepted");
  const incoming = (data || []).filter((request) => request.status === "pending" && request.receiver_id === currentUser.id);
  const friendIds = [...new Set(
    accepted.map((request) => request.sender_id === currentUser.id ? request.receiver_id : request.sender_id)
  )];
  const incomingIds = [...new Set(incoming.map((request) => request.sender_id))];
  let incomingProfiles = new Map();

  friendProfiles = [];

  if (friendIds.length) {
    const { data: profiles } = await client
      .from("profiles")
      .select(PROFILE_SELECT)
      .in("id", friendIds);

    friendProfiles = profiles || [];
  }

  if (incomingIds.length) {
    const { data: profiles } = await client
      .from("profiles")
      .select(PROFILE_SELECT)
      .in("id", incomingIds);

    incomingProfiles = new Map((profiles || []).map((profile) => [profile.id, profile]));
  }

  renderFriendRequests(incoming, incomingProfiles);
  renderFriendList();
}

function createProfileRow(profile, secondaryText) {
  profileCache.set(profile.id, profile);

  const item = document.createElement("div");
  item.className = "social-item profile-social-item";

  const avatar = document.createElement("button");
  avatar.type = "button";
  avatar.className = "social-avatar";
  avatar.addEventListener("click", () => openProfile(profile.id));
  applyAvatar(avatar, profile, profile.pseudo);

  const label = document.createElement("button");
  label.type = "button";
  label.className = "social-profile-label name-button";
  label.addEventListener("click", () => openProfile(profile.id));

  const name = document.createElement("strong");
  applyNameStyle(name, profile, profile.pseudo);

  const secondary = document.createElement("small");
  secondary.textContent = secondaryText || profile.title || profile.status || "Joueur";

  label.append(name, secondary);
  item.append(avatar, label);

  return item;
}

function renderFriendRequests(requests, profilesById = new Map()) {
  if (!friendRequests) {
    return;
  }

  friendRequests.replaceChildren();

  if (!requests.length) {
    friendRequests.textContent = "Aucune demande.";
    return;
  }

  requests.forEach((request) => {
    const profile = profilesById.get(request.sender_id);
    const item = profile
      ? createProfileRow(profile, profile.title || profile.status || "Veut t'ajouter")
      : document.createElement("div");

    if (!profile) {
      item.className = "social-item";
      item.append(createStackedLabel("Demande recue", "Veut t'ajouter"));
    }

    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accepter";
    accept.addEventListener("click", () => answerFriendRequest(request.id, "accepted"));

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Refuser";
    reject.addEventListener("click", () => answerFriendRequest(request.id, "rejected"));

    item.append(accept, reject);
    friendRequests.append(item);
  });
}

function renderFriendList() {
  if (!friendList) {
    return;
  }

  friendList.replaceChildren();

  if (!friendProfiles.length) {
    friendList.textContent = "Aucun ami.";
    return;
  }

  friendProfiles.forEach((profile) => {
    const item = createProfileRow(profile, profile.title || profile.status || "Ami");

    const dm = document.createElement("button");
    dm.type = "button";
    dm.textContent = "DM";
    dm.addEventListener("click", () => openDirectMessage(profile.id));

    item.append(dm);
    friendList.append(item);
  });
}

function renderFriendSearchResults(profiles) {
  if (!friendResults) {
    return;
  }

  friendResults.replaceChildren();

  if (!profiles.length) {
    friendResults.textContent = "Aucun joueur trouve.";
    return;
  }

  profiles.forEach((profile) => {
    const item = createProfileRow(profile, profile.title || profile.status || "Joueur");

    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Ajouter";
    add.addEventListener("click", () => sendFriendRequest(profile.id));

    item.append(add);
    friendResults.append(item);
  });
}

async function answerFriendRequest(id, status) {
  const { error } = await client
    .from("friend_requests")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    setStatus("Action ami impossible", "error");
    return;
  }

  setStatus(status === "accepted" ? "Ami ajoute" : "Demande refusee", "success");
  await loadFriends();
}

async function sendFriendRequest(receiverId) {
  const { error } = await client
    .from("friend_requests")
    .insert({
      sender_id: currentUser.id,
      receiver_id: receiverId
    });

  if (error) {
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Demande deja envoyee", "error");
    return;
  }

  setStatus("Demande envoyee", "success");
  setBoxMessage(friendResults, "Demande envoyee.");
  await loadFriends();
}

async function openDirectMessage(friendId) {
  const { data, error } = await client.rpc("create_or_get_dm", {
    friend_id: friendId
  });

  if (error) {
    console.error("Erreur DM:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "DM impossible", "error");
    return;
  }

  await loadRooms();
  await selectRoom(data);
}

async function createRoom(name, kind) {
  const roomName = normalizeRoomName(name);

  if (roomName.length < 2) {
    setStatus("Nom de salon trop court", "error");
    return;
  }

  const { data, error } = await client
    .from("chat_rooms")
    .insert({
      name: roomName,
      kind,
      owner_id: currentUser.id
    })
    .select("id,name,kind,owner_id,invite_code,created_at")
    .single();

  if (error) {
    console.error("Erreur creation salon:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Creation impossible", "error");
    return;
  }

  const { error: memberError } = await client
    .from("room_members")
    .insert({
      room_id: data.id,
      user_id: currentUser.id,
      role: "owner"
    });

  if (memberError) {
    console.error("Erreur membre salon:", memberError);
  }

  await loadRooms();
  await selectRoom(data.id);
}

async function joinRoom(code) {
  const cleanCode = String(code || "").trim().toLowerCase();

  if (!cleanCode) {
    return;
  }

  const { data, error } = await client.rpc("join_room_by_code", {
    room_code: cleanCode
  });

  if (error) {
    console.error("Erreur rejoindre salon:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Code invalide", "error");
    return;
  }

  await loadRooms();
  await selectRoom(data);
}

function bindLocalControls() {
  if (controlsBound) {
    return;
  }

  controlsBound = true;

  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", closeProfileModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProfileModal();

      if (searchInput && searchInput.value) {
        searchInput.value = "";
        renderMessages();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && form) {
      event.preventDefault();
      form.requestSubmit();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  if (selfProfileButton) {
    selfProfileButton.addEventListener("click", () => {
      if (currentUser) {
        openProfile(currentUser.id);
      }
    });
  }

  if (modalAddFriend) {
    modalAddFriend.addEventListener("click", async () => {
      if (activeProfile) {
        await sendFriendRequest(activeProfile.id);
      }
    });
  }

  if (modalDm) {
    modalDm.addEventListener("click", async () => {
      if (activeProfile) {
        await openDirectMessage(activeProfile.id);
        closeProfileModal();
      }
    });
  }

  if (replyCancelButton) {
    replyCancelButton.addEventListener("click", () => setReplyTarget(null));
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderMessages);
  }

  if (roomFilterInput) {
    roomFilterInput.addEventListener("input", renderRooms);
  }

  if (compactInput) {
    compactInput.addEventListener("change", () => {
      document.body.classList.toggle("chat-compact", compactInput.checked);
      savePreferences();
    });
  }

  if (soundAlertInput) {
    soundAlertInput.addEventListener("change", () => {
      savePreferences();
      setFeatureStatus(soundAlertInput.checked ? "Son active." : "Son desactive.");
    });
  }

  if (pauseChatInput) {
    pauseChatInput.addEventListener("change", async () => {
      isPaused = pauseChatInput.checked;
      savePreferences();

      if (!isPaused) {
        await flushQueuedMessages();
      } else {
        setFeatureStatus("Pause live activee.");
      }
    });
  }

  if (clearViewButton) {
    clearViewButton.addEventListener("click", () => {
      if (replyCancelButton) {
    replyCancelButton.addEventListener("click", () => setReplyTarget(null));
  }

  if (searchInput) {
        searchInput.value = "";
      }

      renderMessages();
    });
  }

  if (themeCycleButton) {
    themeCycleButton.addEventListener("click", () => {
      const nextTheme = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
      applyTheme(nextTheme);
      savePreferences();
      setFeatureStatus(`Theme : ${nextTheme}.`);
    });
  }

  if (focusButton) {
    focusButton.addEventListener("click", () => {
      document.body.classList.toggle("is-focus-mode");
      setFeatureStatus(document.body.classList.contains("is-focus-mode") ? "Mode focus active." : "Mode focus coupe.");
    });
  }

  if (leftToggleButton) {
    leftToggleButton.addEventListener("click", () => {
      document.body.classList.toggle("hide-left-sidebar");
      savePreferences();
      setFeatureStatus("Colonne salons basculee.");
    });
  }

  if (rightToggleButton) {
    rightToggleButton.addEventListener("click", () => {
      document.body.classList.toggle("hide-right-sidebar");
      savePreferences();
      setFeatureStatus("Colonne membres basculee.");
    });
  }

  if (largeTextButton) {
    largeTextButton.addEventListener("click", () => {
      document.body.classList.toggle("large-chat-text");
      savePreferences();
      setFeatureStatus("Taille du texte changee.");
    });
  }

  if (copyRoomCodeButton) {
    copyRoomCodeButton.addEventListener("click", async () => {
      if (!currentRoom) {
        return;
      }

      await navigator.clipboard.writeText(currentRoom.invite_code || "general");
      setFeatureStatus("Code salon copie.");
    });
  }

  if (refreshChatButton) {
    refreshChatButton.addEventListener("click", async () => {
      if (!currentRoom) {
        return;
      }

      await loadMessages();
      setFeatureStatus("Messages recharges.");
    });
  }

  if (exportChatButton) {
    exportChatButton.addEventListener("click", () => {
      const lines = filteredMessages().map((message) => {
        return `[${formatTime(message.created_at)}] ${message.pseudo}: ${message.content}`;
      });
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rip-${roomDisplayName(currentRoom).replace(/[^a-z0-9_-]+/gi, "-")}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setFeatureStatus("Export cree.");
    });
  }

  if (scrollBottomButton) {
    scrollBottomButton.addEventListener("click", () => {
      messagesElement.scrollTop = messagesElement.scrollHeight;
      scrollBottomButton.hidden = true;
    });
  }

  if (messagesElement) {
    messagesElement.addEventListener("scroll", () => {
      if (!scrollBottomButton) {
        return;
      }

      const distance = messagesElement.scrollHeight - messagesElement.clientHeight - messagesElement.scrollTop;
      scrollBottomButton.hidden = distance < 140;
    });
  }

  if (createRoomForm) {
    createRoomForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(createRoomForm));
      await createRoom(data.name, data.kind);
      createRoomForm.reset();
    });
  }

  if (joinRoomForm) {
    joinRoomForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(joinRoomForm));
      await joinRoom(data.code);
      joinRoomForm.reset();
    });
  }

  if (findFriendForm) {
    findFriendForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(findFriendForm));
      const query = String(data.query || "").trim();

      if (query.length < 2) {
        setBoxMessage(friendResults, "Tape au moins 2 caracteres.");
        return;
      }

      const { data: profiles, error } = await client
        .from("profiles")
        .select(PROFILE_SELECT)
        .ilike("pseudo", `%${query}%`)
        .neq("id", currentUser.id)
        .limit(8);

      if (error) {
        setBoxMessage(friendResults, "Recherche impossible.");
        return;
      }

      renderFriendSearchResults(profiles || []);
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
      saveDraft();
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

async function handleCommand(rawContent) {
  const content = rawContent.trim();

  if (!content.startsWith("/")) {
    return content;
  }

  const [command, ...args] = content.slice(1).split(/\s+/);
  const rest = args.join(" ").trim();

  switch ((command || "").toLowerCase()) {
    case "help":
      setFeatureStatus("Commandes : /me /clear /shrug /tableflip /roll /coin /general /rooms /theme");
      return null;
    case "clear":
      allMessages = [];
      renderMessages();
      setFeatureStatus("Vue locale nettoyee.");
      return null;
    case "shrug":
      return `${rest || ""} ¯\\_(ツ)_/¯`.trim();
    case "tableflip":
      return `${rest || ""} (╯°□°）╯︵ ┻━┻`.trim();
    case "roll":
      return `🎲 ${currentUser.pseudo} lance un de : ${Math.ceil(Math.random() * 6)}`;
    case "coin":
      return `🪙 ${Math.random() > 0.5 ? "Pile" : "Face"}`;
    case "me":
      return `* ${currentUser.pseudo} ${rest || "fait une action"}`;
    case "general":
      await selectRoom(DEFAULT_ROOM_ID);
      return null;
    case "rooms":
      renderRooms();
      setFeatureStatus(`${rooms.length} salon(s) charges.`);
      return null;
    case "theme": {
      const nextTheme = rest && THEMES.includes(rest) ? rest : THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
      applyTheme(nextTheme);
      savePreferences();
      setFeatureStatus(`Theme : ${nextTheme}.`);
      return null;
    }
    default:
      setFeatureStatus(`Commande inconnue : /${command}`);
      return null;
  }
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

  profileCache.set(currentUser.id, {
    id: currentUser.id,
    pseudo: currentUser.pseudo,
    title: currentUser.title,
    status: currentUser.status,
    bio: currentUser.bio,
    website: currentUser.website,
    avatar_color: currentUser.avatarColor,
    avatar_url: currentUser.avatarUrl,
    avatar_frame: currentUser.avatarFrame,
    profile_theme: currentUser.profileTheme,
    name_style: currentUser.nameStyle,
    name_color_a: currentUser.nameColorA,
    name_color_b: currentUser.nameColorB,
    created_at: currentUser.createdAt,
    last_seen: currentUser.lastSeen
  });
  syncSelfPanel();

  client = await window.RipSupabase.getClient();
  loadPreferences();
  switchGlobalChannel();
  setStatus("Connexion au salon...", "");
  setChatEnabled(false);

  try {
    await loadRooms();
    bindLocalControls();
    await loadFriends();
    await selectRoom(currentRoom.id);
  } catch (error) {
    console.error("Erreur initialisation tchat:", error);
    setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Erreur tchat", "error");
    setChatEnabled(false);
  }
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentRoom) {
      return;
    }

    let content = input.value.trim();

    if (!content) {
      return;
    }

    content = await handleCommand(content);

    if (!content) {
      input.value = "";
      clearDraft();
      syncCharCount();
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      setStatus("Message trop long", "error");
      return;
    }

    setChatEnabled(false);

    const { data, error } = await client
      .from("chat_messages")
      .insert({
        room_id: currentRoom.id,
        user_id: currentUser.id,
        pseudo: currentUser.pseudo,
        content,
        reply_to_id: activeReplyMessage ? activeReplyMessage.id : null
      })
      .select("id,room_id,user_id,pseudo,content,reply_to_id,created_at")
      .single();

    if (error) {
      console.error("Erreur envoi:", error);
      setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Envoi impossible", "error");
      setChatEnabled(true);
      return;
    }

    input.value = "";
    setReplyTarget(null);
    clearDraft();
    syncCharCount();
    if (data) {
      await upsertMessage(data);
    } else {
      await loadMessages();
    }
    setStatus(`Salon : ${roomDisplayName(currentRoom)}`, "success");
    setChatEnabled(true);
    input.focus();
  });
}

document.addEventListener("rip-auth-change", (event) => {
  if (!event.detail || !currentUser || event.detail.id !== currentUser.id) {
    return;
  }

  currentUser = event.detail;
  profileCache.set(currentUser.id, {
    id: currentUser.id,
    pseudo: currentUser.pseudo,
    title: currentUser.title,
    status: currentUser.status,
    bio: currentUser.bio,
    website: currentUser.website,
    avatar_color: currentUser.avatarColor,
    avatar_url: currentUser.avatarUrl,
    avatar_frame: currentUser.avatarFrame,
    profile_theme: currentUser.profileTheme,
    name_style: currentUser.nameStyle,
    name_color_a: currentUser.nameColorA,
    name_color_b: currentUser.nameColorB,
    created_at: currentUser.createdAt,
    last_seen: currentUser.lastSeen
  });
  syncSelfPanel();
  renderMessages();
});

setChatEnabled(false);
syncCharCount();
startChat().catch((error) => {
  console.error("Erreur tchat:", error);
  setStatus("Erreur tchat", "error");
  setChatEnabled(false);
});
