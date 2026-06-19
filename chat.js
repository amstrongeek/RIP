const DEFAULT_ROOM_ID = "00000000-0000-4000-8000-000000000001";
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_LIMIT = 120;
const TYPING_TTL = 2600;
const PROFILE_SELECT = "id,pseudo,title,status,bio,website,avatar_color,avatar_url,name_style,name_color_a,name_color_b,created_at,last_seen";

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
const modalBio = document.querySelector("[data-modal-bio]");
const modalWebsite = document.querySelector("[data-modal-website]");
const modalStatus = document.querySelector("[data-modal-status]");
const modalCreated = document.querySelector("[data-modal-created]");
const modalAddFriend = document.querySelector("[data-modal-add-friend]");
const modalDm = document.querySelector("[data-modal-dm]");
const modalCloseButtons = document.querySelectorAll("[data-profile-close]");

let client = null;
let currentUser = null;
let currentRoom = null;
let chatChannel = null;
let allMessages = [];
let rooms = [];
let roomLabels = new Map();
let friendProfiles = [];
let profileCache = new Map();
let activeProfile = null;
let typingUsers = new Map();
let typingTimeout = null;
let lastTypingSentAt = 0;

function loadFreshAuthScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `auth.js?v=20260619-discord1-${Date.now()}`;
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
  return /room_id|chat_rooms|room_members|friend_requests|invite_code|avatar_url|name_style|name_color|storage|bucket|column|schema|relationship/i.test(message);
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
    throw error;
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
  const profile = profileCache.get(String(message.user_id));
  const pseudoText = profile ? profile.pseudo : message.pseudo;

  if (currentUser && message.user_id === currentUser.id) {
    item.classList.add("is-own");
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

async function upsertMessage(message) {
  if (!currentRoom || message.room_id !== currentRoom.id) {
    return;
  }

  if (allMessages.some((candidate) => candidate.id === message.id)) {
    return;
  }

  allMessages = [...allMessages, message].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  await loadProfiles([message.user_id]);
  renderMessages();
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

  rooms.forEach((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-button";
    button.dataset.active = currentRoom && room.id === currentRoom.id ? "true" : "false";
    button.append(createStackedLabel(roomDisplayName(room), kindLabel(room.kind)));
    button.addEventListener("click", () => selectRoom(room.id));
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

  currentRoom = rooms.find((room) => currentRoom && room.id === currentRoom.id)
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
    .select("id,room_id,user_id,pseudo,content,created_at")
    .eq("room_id", currentRoom.id)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error) {
    throw error;
  }

  allMessages = [...(data || [])].reverse();
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

async function selectRoom(roomId) {
  const room = rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    return;
  }

  currentRoom = room;
  setStatus("Chargement du salon...", "");
  setChatEnabled(false);
  renderRooms();
  updateCurrentRoomHeader();

  try {
    await loadMessages();
    await switchRealtimeChannel();
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
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", closeProfileModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProfileModal();
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

  profileCache.set(currentUser.id, {
    id: currentUser.id,
    pseudo: currentUser.pseudo,
    title: currentUser.title,
    status: currentUser.status,
    bio: currentUser.bio,
    website: currentUser.website,
    avatar_color: currentUser.avatarColor,
    avatar_url: currentUser.avatarUrl,
    name_style: currentUser.nameStyle,
    name_color_a: currentUser.nameColorA,
    name_color_b: currentUser.nameColorB,
    created_at: currentUser.createdAt,
    last_seen: currentUser.lastSeen
  });
  syncSelfPanel();

  client = await window.RipSupabase.getClient();
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
      room_id: currentRoom.id,
      user_id: currentUser.id,
      pseudo: currentUser.pseudo,
      content
    });

    if (error) {
      console.error("Erreur envoi:", error);
      setStatus(schemaHelp(error) ? "Relance le SQL Supabase" : "Envoi impossible", "error");
      setChatEnabled(true);
      return;
    }

    input.value = "";
    syncCharCount();
    setStatus(`Salon : ${roomDisplayName(currentRoom)}`, "success");
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
