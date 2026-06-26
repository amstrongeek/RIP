import {
  createLocalRoom,
  finishLocalRoom,
  joinLocalRoom,
  listLocalRooms,
  setLocalReady
} from "../../src/services/game-room-service.js";

const ARCADE_VERSION = "20260626-supabase-fix3";
const SOLO_GAMES = new Set(["reflex", "memory", "runner", "aim", "cipher", "snake", "puzzle", "rpg", "dungeon", "tycoon", "space", "platformer"]);

const walletPoints = document.querySelector("[data-wallet-points]");
const walletLevel = document.querySelector("[data-wallet-level]");
const walletXp = document.querySelector("[data-wallet-xp]");
const walletStreak = document.querySelector("[data-wallet-streak]");
const walletProgress = document.querySelector("[data-wallet-progress]");
const walletProgressText = document.querySelector("[data-wallet-progress-text]");
const dailyButton = document.querySelector("[data-daily-reward]");
const arcadeStatus = document.querySelector("[data-arcade-status]");
const shopList = document.querySelector("[data-shop-list]");
const inventoryList = document.querySelector("[data-inventory-list]");
const missionList = document.querySelector("[data-mission-list]");
const leaderboardList = document.querySelector("[data-leaderboard-list]");
const leaderboardGame = document.querySelector("[data-leaderboard-game]");
const localRoomForm = document.querySelector("[data-local-room-form]");
const localRoomJoinForm = document.querySelector("[data-local-room-join-form]");
const localRoomList = document.querySelector("[data-local-room-list]");
const arcadeModal = document.querySelector("[data-arcade-modal]");
const arcadeTitle = document.querySelector("[data-arcade-title]");
const arcadeScore = document.querySelector("[data-arcade-score]");
const arcadeStage = document.querySelector("[data-arcade-stage]");
const arcadeControls = document.querySelector("[data-arcade-controls]");
const closeButtons = document.querySelectorAll("[data-arcade-close]");

let arcadeClient = null;
let arcadeUser = null;
let gameTimers = [];
let gameCleanups = [];
let activeDuel = null;
let activeTtt = null;
let duelPoll = null;
let tttPoll = null;
let duelDoneSeen = false;
let tttDoneSeen = false;
let arcadeLaunchersBound = false;
let lastShopItems = [];
let lastInventory = [];
let equippedItemsBySlot = new Map();
const shopState = {
  category: "all",
  rarity: "all",
  query: ""
};

function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }

  callback();
}

function setArcadeStatus(text, isError = false) {
  document.querySelectorAll("[data-arcade-status]").forEach((element) => {
    element.textContent = text;
    element.dataset.state = isError ? "error" : "ok";
  });
}

function setArcadeScore(value) {
  if (arcadeScore) {
    arcadeScore.textContent = String(value);
  }
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createButton(text, handler, className = "game-button") {
  const button = createElement("button", className, text);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function addTimer(id, interval = false) {
  gameTimers.push({ id, interval });
  return id;
}

function clearGameRuntime() {
  gameTimers.forEach((timer) => {
    if (timer.interval) {
      window.clearInterval(timer.id);
      return;
    }

    window.clearTimeout(timer.id);
  });
  gameTimers = [];

  gameCleanups.forEach((cleanup) => cleanup());
  gameCleanups = [];

  if (duelPoll) {
    window.clearInterval(duelPoll);
    duelPoll = null;
  }

  if (tttPoll) {
    window.clearInterval(tttPoll);
    tttPoll = null;
  }

  activeDuel = null;
  activeTtt = null;
  duelDoneSeen = false;
  tttDoneSeen = false;
}

function openArcade(title) {
  clearGameRuntime();
  arcadeTitle.textContent = title;
  setArcadeScore(0);
  arcadeStage.replaceChildren();
  arcadeControls.replaceChildren();
  arcadeModal.hidden = false;
  arcadeModal.setAttribute("aria-hidden", "false");
}

function closeArcade() {
  clearGameRuntime();
  arcadeModal.hidden = true;
  arcadeModal.setAttribute("aria-hidden", "true");
}

function sleep(ms) {
  return new Promise((resolve) => {
    addTimer(window.setTimeout(resolve, ms));
  });
}

function schemaMissing(error) {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  return /profiles|avatar|storage|user_wallets|shop_items|user_inventory|game_scores|game_settings|admin_roles|admin_logs|game_duels|tic_tac_toe_games|user_missions|user_achievements|user_notifications|bug_reports|function|schema|permission|policy|column|wallet/i.test(message);
}

function arcadeErrorMessage(error, fallback = "Arcade indisponible.") {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  const shortMessage = message ? message.slice(0, 180) : "";

  if (/NetworkError|Failed to fetch|fetch resource|Load failed|TypeError/i.test(message)) {
    return "Supabase inaccessible depuis le navigateur. Verifie reseau, VPN, bloqueur ou etat Supabase.";
  }

  if (/Could not find the function|function .* does not exist|PGRST202/i.test(message)) {
    return "RPC Supabase manquante : applique le fichier supabase-chat.sql complet.";
  }

  if (/relation .* does not exist|table .* does not exist|42P01/i.test(message)) {
    return "Table Supabase manquante : applique le fichier supabase-chat.sql complet.";
  }

  if (/column .* does not exist|42703/i.test(message)) {
    return "Colonne Supabase manquante : migration SQL incomplete.";
  }

  if (/permission denied|not authorized|42501|row-level security|violates row-level security|policy/i.test(message)) {
    return "Permission Supabase refusee : verifie les grants/RLS.";
  }

  if (/item_already_owned/i.test(message)) {
    return "Objet deja possede.";
  }

  return shortMessage ? `${fallback} ${shortMessage}` : fallback;
}

function xpForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return Math.pow(safeLevel - 1, 2) * 120;
}

function renderWallet(wallet) {
  if (!wallet) {
    return;
  }

  const level = wallet.level || 1;
  const xp = wallet.xp || 0;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const progress = Math.max(0, Math.min(100, ((xp - start) / Math.max(1, next - start)) * 100));

  if (walletPoints) {
    walletPoints.textContent = String(wallet.points || 0);
  }

  if (walletLevel) {
    walletLevel.textContent = String(level);
  }

  if (walletXp) {
    walletXp.textContent = String(xp);
  }

  if (walletStreak) {
    walletStreak.textContent = String(wallet.streak || 0);
  }

  if (walletProgress) {
    walletProgress.style.width = `${progress}%`;
  }

  if (walletProgressText) {
    walletProgressText.textContent = `${Math.max(0, xp - start)} / ${next - start} XP vers niveau ${level + 1}`;
  }
}

async function loadWallet() {
  if (window.RipData) {
    const wallet = await window.RipData.getWallet();
    renderWallet(wallet);
    return wallet;
  }

  const { data, error } = await arcadeClient.rpc("get_my_wallet");

  if (error) {
    throw error;
  }

  renderWallet(data);
  return data;
}

async function loadShop() {
  if (!shopList && !inventoryList) {
    return;
  }

  const shop = window.RipData
    ? await window.RipData.getShopData()
    : null;
  const items = shop ? shop.items : null;
  const inventory = shop ? shop.inventory : null;

  if (!shop) {
    const [{ data: fallbackItems, error: itemError }, { data: fallbackInventory, error: inventoryError }] = await Promise.all([
      arcadeClient
        .from("shop_items")
        .select("item_key,name,description,price,item_type,payload,sort_order,rarity,category,equip_slot")
        .order("sort_order", { ascending: true }),
      arcadeClient
        .from("user_inventory")
        .select("item_key,quantity,equipped,acquired_at")
        .order("acquired_at", { ascending: false })
    ]);

    if (itemError || inventoryError) {
      throw itemError || inventoryError;
    }

    lastShopItems = fallbackItems || [];
    lastInventory = fallbackInventory || [];
  } else {
    lastShopItems = items || [];
    lastInventory = inventory || [];
  }

  syncEquippedItems(lastShopItems, lastInventory);
  ensureShopFilters();
  renderShop(lastShopItems, lastInventory);
  renderInventory(lastShopItems, lastInventory);
}

function normalizeItemPayload(item) {
  if (!item || !item.payload) {
    return {};
  }

  if (typeof item.payload !== "string") {
    return item.payload;
  }

  try {
    return JSON.parse(item.payload || "{}");
  } catch (error) {
    return {};
  }
}

function syncEquippedItems(items, inventory) {
  equippedItemsBySlot = new Map();
  const itemByKey = new Map(items.map((item) => [item.item_key, item]));

  inventory.forEach((entry) => {
    if (!entry.equipped) {
      return;
    }

    const item = itemByKey.get(entry.item_key);
    if (!item) {
      return;
    }

    const slot = item.equip_slot || item.item_type;
    equippedItemsBySlot.set(slot, item);
  });
}

function getEquippedSkin(gameKey) {
  const item = equippedItemsBySlot.get(`skin_${gameKey}`);
  const payload = normalizeItemPayload(item);
  return payload.skin || "default";
}

function itemRarityLabel(rarity) {
  const labels = {
    common: "Commun",
    rare: "Rare",
    epic: "Epique",
    legendary: "Legendaire"
  };
  return labels[rarity] || "Commun";
}

function ensureShopFilters() {
  if (!shopList || document.querySelector("[data-shop-filters]")) {
    return;
  }

  const filters = createElement("div", "shop-filters");
  filters.dataset.shopFilters = "";

  const search = createElement("input", "panel-search");
  search.type = "search";
  search.placeholder = "Rechercher item...";
  search.addEventListener("input", () => {
    shopState.query = search.value.trim().toLowerCase();
    renderShop(lastShopItems, lastInventory);
  });

  const category = createElement("select", "panel-search");
  [
    ["all", "Toutes categories"],
    ["name", "Pseudos"],
    ["avatar", "Avatars"],
    ["theme", "Themes"],
    ["badge", "Badges"],
    ["title", "Titres"],
    ["skin", "Skins jeux"]
  ].forEach(([value, label]) => {
    const option = createElement("option", "", label);
    option.value = value;
    category.append(option);
  });
  category.addEventListener("change", () => {
    shopState.category = category.value;
    renderShop(lastShopItems, lastInventory);
  });

  const rarity = createElement("select", "panel-search");
  [
    ["all", "Toutes raretes"],
    ["common", "Commun"],
    ["rare", "Rare"],
    ["epic", "Epique"],
    ["legendary", "Legendaire"]
  ].forEach(([value, label]) => {
    const option = createElement("option", "", label);
    option.value = value;
    rarity.append(option);
  });
  rarity.addEventListener("change", () => {
    shopState.rarity = rarity.value;
    renderShop(lastShopItems, lastInventory);
  });

  filters.append(search, category, rarity);
  shopList.before(filters);
}

function createItemPreview(item) {
  const preview = createElement("div", "shop-preview");
  const payload = normalizeItemPayload(item);
  preview.dataset.rarity = item.rarity || "common";
  preview.dataset.type = item.item_type || "cosmetic";

  if (item.item_type === "name_style") {
    preview.classList.add("display-name");
    preview.dataset.nameStyle = payload.name_style || "solid";
    preview.style.setProperty("--name-color-a", payload.name_color_a || "#39ff88");
    preview.style.setProperty("--name-color-b", payload.name_color_b || "#ffdc5e");
    preview.textContent = "RIP";
  } else if (item.item_type === "avatar_frame") {
    preview.dataset.avatarFrame = payload.frame || "none";
    preview.textContent = "A";
  } else if (item.item_type === "theme") {
    preview.textContent = "THEME";
  } else if (item.item_type === "badge") {
    preview.textContent = payload.badge || "BADGE";
  } else if (item.item_type === "title") {
    preview.textContent = payload.title || "TITLE";
  } else if (item.item_type === "game_skin") {
    preview.textContent = (payload.game || "SKIN").slice(0, 5).toUpperCase();
  } else {
    preview.textContent = "ITEM";
  }

  return preview;
}

function renderShop(items, inventory) {
  if (!shopList) {
    return;
  }

  shopList.replaceChildren();

  const owned = new Map(inventory.map((item) => [item.item_key, item]));
  const visibleItems = items.filter((item) => {
    const text = `${item.name} ${item.description} ${item.item_key}`.toLowerCase();
    const category = item.category || "cosmetic";
    const rarity = item.rarity || "common";
    return (!shopState.query || text.includes(shopState.query))
      && (shopState.category === "all" || category === shopState.category)
      && (shopState.rarity === "all" || rarity === shopState.rarity);
  });

  if (!visibleItems.length) {
    shopList.textContent = "Boutique vide.";
    return;
  }

  visibleItems.forEach((item) => {
    const row = createElement("div", "shop-item");
    row.dataset.rarity = item.rarity || "common";
    const title = createElement("strong", "", item.name);
    const description = createElement("small", "", item.description);
    const meta = createElement("div", "shop-meta");
    meta.append(
      createElement("span", "tag", itemRarityLabel(item.rarity)),
      createElement("span", "tag", item.category || item.item_type),
      createElement("span", "tag", `${item.price} coins`)
    );
    const isOwned = owned.has(item.item_key);
    const buy = createButton(isOwned ? "Possede" : "Acheter", () => purchaseItem(item.item_key), "game-button secondary");
    buy.disabled = isOwned;

    row.append(createItemPreview(item), title, description, meta, buy);
    shopList.append(row);
  });
}

function canEquip(item) {
  return item && ["name_style", "avatar_frame", "theme", "badge", "title", "avatar_color", "game_skin"].includes(item.item_type);
}

function renderInventory(items, inventory) {
  if (!inventoryList) {
    return;
  }

  inventoryList.replaceChildren();

  if (!inventory.length) {
    inventoryList.textContent = "Aucun item.";
    return;
  }

  const itemByKey = new Map(items.map((item) => [item.item_key, item]));

  inventory.forEach((entry) => {
    const item = itemByKey.get(entry.item_key);
    const row = createElement("div", "inventory-item");
    if (item) {
      row.dataset.rarity = item.rarity || "common";
    }
    row.append(
      item ? createItemPreview(item) : createElement("div", "shop-preview", "?"),
      createElement("strong", "", item ? item.name : entry.item_key),
      createElement("small", "", `Quantite : ${entry.quantity}${entry.equipped ? " / equipe" : ""}${item && item.equip_slot ? ` / slot ${item.equip_slot}` : ""}`)
    );

    if (canEquip(item)) {
      const equip = createButton(entry.equipped ? "Equipe" : "Equiper", () => equipItem(entry.item_key), "game-button secondary");
      equip.disabled = Boolean(entry.equipped);
      row.append(equip);
    }

    inventoryList.append(row);
  });
}

function renderLocalRooms() {
  if (!localRoomList) {
    return;
  }

  const rooms = listLocalRooms();
  localRoomList.replaceChildren();

  if (!rooms.length) {
    localRoomList.textContent = "Aucun salon local.";
    return;
  }

  rooms.forEach((room) => {
    const row = createElement("div", "local-room-item");
    const players = room.players.map((player) => `${player.ready ? "OK " : ""}${player.pseudo}`).join(", ");
    row.append(
      createElement("strong", "", `${room.code} / ${room.gameKey}`),
      createElement("small", "", `Etat : ${room.status}`),
      createElement("small", "", players || "Aucun joueur")
    );

    const actions = createElement("div", "mini-actions");
    actions.append(
      createButton("Pret", () => {
        setLocalReady(room.code, arcadeUser, true);
        renderLocalRooms();
      }, "game-button secondary"),
      createButton("Terminer", () => {
        finishLocalRoom(room.code);
        renderLocalRooms();
      }, "game-button secondary")
    );
    row.append(actions);
    localRoomList.append(row);
  });
}

function bindLocalRooms() {
  if (localRoomForm) {
    localRoomForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const game = new FormData(localRoomForm).get("game") || "snake";
      const room = createLocalRoom(String(game), arcadeUser);
      setArcadeStatus(`Salon local cree : ${room.code}. Simulation locale, pas encore Socket.IO.`);
      renderLocalRooms();
    });
  }

  if (localRoomJoinForm) {
    localRoomJoinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = new FormData(localRoomJoinForm).get("code");

      try {
        const room = joinLocalRoom(code, arcadeUser);
        setArcadeStatus(`Salon local rejoint : ${room.code}.`);
        renderLocalRooms();
      } catch (error) {
        setArcadeStatus("Salon local introuvable.", true);
      }
    });
  }

  renderLocalRooms();
}

function applyProfileCosmetics(profile) {
  if (!profile) {
    return;
  }

  const nameStyle = profile.name_style || profile.nameStyle || "solid";
  const colorA = profile.name_color_a || profile.nameColorA || "#39ff88";
  const colorB = profile.name_color_b || profile.nameColorB || "#ffdc5e";
  const avatarFrame = profile.avatar_frame || profile.avatarFrame || "none";
  const theme = profile.profile_theme || profile.profileTheme || "default";

  document.querySelectorAll("[data-self-name]").forEach((element) => {
    element.dataset.nameStyle = nameStyle;
    element.style.setProperty("--name-color-a", colorA);
    element.style.setProperty("--name-color-b", colorB);
  });

  document.querySelectorAll("[data-self-avatar], [data-profile-avatar]").forEach((element) => {
    element.dataset.avatarFrame = avatarFrame;
  });

  document.querySelectorAll("[data-account-title], [data-platform-title]").forEach((element) => {
    element.textContent = profile.title || "Nouveau joueur";
  });

  document.querySelectorAll("[data-account-badge], [data-platform-badge]").forEach((element) => {
    const badge = profile.active_badge || profile.activeBadge || "";
    element.hidden = !badge;
    element.textContent = badge ? `Badge ${badge}` : "";
  });

  document.querySelectorAll("[data-account-badge-separator]").forEach((element) => {
    element.hidden = !(profile.active_badge || profile.activeBadge);
  });

  document.body.dataset.profileTheme = theme;
}

async function refreshAuthProfile() {
  if (window.RipAuth && typeof window.RipAuth.refresh === "function") {
    const user = await window.RipAuth.refresh();
    arcadeUser = user || arcadeUser;
    applyProfileCosmetics(user);
    return user;
  }

  return null;
}

async function purchaseItem(itemKey) {
  try {
    setArcadeStatus("Achat en cours...");
    const data = window.RipData
      ? await window.RipData.purchaseShopItem(itemKey)
      : (await arcadeClient.rpc("purchase_shop_item", { shop_key: itemKey })).data;

    renderWallet(data);
    await Promise.all([loadShop(), loadMissions()]);
    setArcadeStatus("Achat valide.");
  } catch (error) {
    console.error("Erreur achat:", error);
    setArcadeStatus(arcadeErrorMessage(error, "Achat impossible."), true);
  }
}

async function equipItem(itemKey) {
  try {
    setArcadeStatus("Equipement en cours...");
    const data = window.RipData
      ? await window.RipData.equipShopItem(itemKey)
      : (await arcadeClient.rpc("equip_shop_item", { shop_key: itemKey })).data;

    applyProfileCosmetics(data);
    await refreshAuthProfile();
    await loadShop();
    setArcadeStatus("Cosmetique equipe.");
  } catch (error) {
    console.error("Erreur equipement:", error);
    setArcadeStatus(arcadeErrorMessage(error, "Equipement impossible."), true);
  }
}

async function claimDaily() {
  if (!arcadeClient || !arcadeUser) {
    setArcadeStatus("Connecte-toi pour claim le daily.", true);
    return;
  }

  try {
    dailyButton.disabled = true;
    setArcadeStatus("Claim daily...");
    const data = window.RipData
      ? await window.RipData.claimDailyReward()
      : (await arcadeClient.rpc("claim_daily_reward")).data;

    renderWallet(data);
    await loadMissions();
    setArcadeStatus("Daily reward ajoute.");
  } catch (error) {
    console.error("Erreur daily:", error);
    setArcadeStatus(arcadeErrorMessage(error, "Daily deja claim ou indisponible."), true);
  } finally {
    dailyButton.disabled = false;
  }
}

async function loadMissions() {
  if (!missionList) {
    return;
  }

  const data = window.RipData
    ? await window.RipData.getMissions()
    : (await arcadeClient.rpc("get_my_missions")).data;

  renderMissions(data || []);
}

function renderMissions(missions) {
  missionList.replaceChildren();

  if (!missions.length) {
    missionList.textContent = "Aucune mission.";
    return;
  }

  missions.forEach((mission) => {
    const row = createElement("div", "mission-item");
    const progress = Number(mission.progress_value || 0);
    const goal = Number(mission.goal_value || 1);
    const ready = progress >= goal;
    const title = createElement("strong", "", mission.label_text);
    const meta = createElement("small", "", `${Math.min(progress, goal)} / ${goal} - reward ${mission.reward_points} coins`);
    const bar = createElement("span", "mission-progress");
    const fill = createElement("span");
    fill.style.width = `${Math.max(0, Math.min(100, (progress / Math.max(1, goal)) * 100))}%`;
    bar.append(fill);

    row.append(title, meta, bar);

    if (mission.claimed) {
      row.dataset.state = "claimed";
      row.append(createElement("small", "", "Deja claim."));
    } else if (ready) {
      row.dataset.state = "ready";
      row.append(createButton("Claim", () => claimMission(mission.mission_key), "game-button"));
    } else {
      row.dataset.state = "locked";
      row.append(createElement("small", "", "En cours."));
    }

    missionList.append(row);
  });
}

async function claimMission(missionKey) {
  try {
    setArcadeStatus("Claim mission...");
    const data = window.RipData
      ? await window.RipData.claimMission(missionKey)
      : (await arcadeClient.rpc("claim_mission", { mission_key_input: missionKey })).data;

    renderWallet(data);
    await loadMissions();
    setArcadeStatus("Mission claim.");
  } catch (error) {
    console.error("Erreur mission:", error);
    setArcadeStatus(arcadeErrorMessage(error, "Mission non disponible."), true);
  }
}

async function loadLeaderboard(gameKey = "reflex") {
  if (!leaderboardList) {
    return;
  }

  const data = window.RipData
    ? await window.RipData.getLeaderboard(gameKey, 8)
    : [];
  leaderboardList.replaceChildren();

  if (!data || !data.length) {
    leaderboardList.textContent = "Pas encore de score.";
    return;
  }

  data.forEach((score, index) => {
    const profile = score.profile;
    const row = createElement("div", "leaderboard-item");
    row.append(
      createElement("strong", "", `${index + 1}. ${profile ? profile.pseudo : "Player"}`),
      createElement("small", "", `${score.score} pts jeu / +${score.reward_points} coins`)
    );
    leaderboardList.append(row);
  });
}

async function awardSoloGame(gameKey, score) {
  if (!SOLO_GAMES.has(gameKey) || !arcadeClient || !arcadeUser) {
    return { rewardPoints: 0, xp: 0 };
  }

  try {
    const data = window.RipData
      ? await window.RipData.saveGameResult(gameKey, score)
      : (await arcadeClient.rpc("complete_solo_game", {
          game_key_input: gameKey,
          score_input: Math.max(0, Math.round(score))
        })).data;
    const scoreRow = window.RipData
      ? await window.RipData.getLatestGameReward(arcadeUser.id, gameKey)
      : null;

    const rewardPoints = scoreRow ? Number(scoreRow.reward_points || 0) : 0;
    renderWallet(data);
    await Promise.all([loadLeaderboard(gameKey), loadMissions()]);
    setArcadeStatus(`Score envoye : ${Math.round(score)}.`);
    return { wallet: data, rewardPoints, xp: rewardPoints * 2 };
  } catch (error) {
    console.error("Erreur score:", error);
    setArcadeStatus(arcadeErrorMessage(error, "Score non enregistre."), true);
    return { rewardPoints: 0, xp: 0, error };
  }
}

function finishGame(gameKey, score, message) {
  setArcadeScore(score);
  const result = createElement("div", "game-result");
  result.append(
    createElement("p", "game-message", `${message} Score final : ${score}`),
    createElement("small", "", "Envoi du score a Supabase...")
  );
  arcadeControls.replaceChildren(
    createButton("Rejouer", () => startGame(gameKey)),
    createButton("Fermer", closeArcade, "game-button secondary")
  );
  arcadeStage.replaceChildren(result);
  awardSoloGame(gameKey, score).then((award) => {
    const status = award && !award.error
      ? `+${award.rewardPoints} coins / +${award.xp} XP.`
      : "Score non enregistre.";
    result.append(createElement("strong", "reward-line", status));
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function getBestScore(gameKey) {
  if (!arcadeClient || !arcadeUser) {
    return 0;
  }

  const { data } = await arcadeClient
    .from("game_scores")
    .select("score")
    .eq("user_id", arcadeUser.id)
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? Number(data.score || 0) : 0;
}

function showGameIntro(config, startHandler) {
  openArcade(config.title);
  const box = createElement("div", "game-intro");
  const rules = createElement("ul", "game-rules");
  const best = createElement("small", "game-best", "Meilleur score : chargement...");

  config.rules.forEach((rule) => {
    rules.append(createElement("li", "", rule));
  });

  box.append(
    createElement("h3", "", config.title),
    createElement("p", "game-message", config.description),
    rules,
    best
  );

  arcadeStage.replaceChildren(box);
  arcadeControls.replaceChildren(
    createButton("Jouer", startHandler),
    createButton("Fermer", closeArcade, "game-button secondary")
  );

  getBestScore(config.key)
    .then((score) => {
      best.textContent = `Meilleur score : ${score}`;
    })
    .catch(() => {
      best.textContent = "Meilleur score : indisponible";
    });
}

function createHud() {
  const hud = createElement("div", "game-hud");
  return {
    element: hud,
    set(values) {
      hud.replaceChildren();
      Object.entries(values).forEach(([label, value]) => {
        const item = createElement("span", "", `${label}: ${value}`);
        hud.append(item);
      });
    }
  };
}

function makePauseControl(isPaused, setPaused) {
  return createButton("Pause", () => {
    const next = !isPaused();
    setPaused(next);
  }, "game-button secondary");
}

function startSnakeGame() {
  showGameIntro({
    key: "snake",
    title: "Snake moderne",
    description: "Mange les pixels, recupere les power-ups et evite de toucher ton propre corps.",
    rules: [
      "Fleches ou ZQSD pour tourner.",
      "La vitesse augmente a chaque nourriture.",
      "Les power-ups donnent bonus, slow ou croissance."
    ]
  }, runSnakeGame);
}

function runSnakeGame() {
  openArcade("Snake moderne");
  const size = 17;
  const skin = getEquippedSkin("snake");
  const hud = createHud();
  const board = createElement("div", "snake-board");
  board.dataset.skin = skin;
  board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  const cells = Array.from({ length: size * size }, () => {
    const cell = createElement("span", "snake-cell");
    board.append(cell);
    return cell;
  });

  let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  let dir = { x: 1, y: 0 };
  let nextDir = dir;
  let food = null;
  let power = null;
  let score = 0;
  let speed = 175;
  let running = true;
  let paused = false;

  function occupied(point) {
    return snake.some((part) => part.x === point.x && part.y === point.y);
  }

  function randomFree() {
    let point = { x: randomInt(0, size - 1), y: randomInt(0, size - 1) };
    let guard = 0;
    while (occupied(point) && guard < 200) {
      point = { x: randomInt(0, size - 1), y: randomInt(0, size - 1) };
      guard += 1;
    }
    return point;
  }

  function draw() {
    cells.forEach((cell) => {
      cell.className = "snake-cell";
      cell.textContent = "";
    });

    snake.forEach((part, index) => {
      const cell = cells[part.y * size + part.x];
      cell.classList.add(index === 0 ? "snake-head" : "snake-body");
    });

    if (food) {
      cells[food.y * size + food.x].classList.add("snake-food");
    }

    if (power) {
      const cell = cells[power.y * size + power.x];
      cell.classList.add("snake-power");
      cell.textContent = power.type === "slow" ? "S" : power.type === "grow" ? "G" : "+";
    }

    hud.set({ Score: score, Vitesse: `${Math.round(1000 / speed * 10) / 10}x`, Skin: skin });
    setArcadeScore(score);
  }

  function turn(x, y) {
    if (dir.x + x === 0 && dir.y + y === 0) {
      return;
    }
    nextDir = { x, y };
  }

  function end(reason) {
    running = false;
    finishGame("snake", score, reason);
  }

  function step() {
    if (!running) {
      return;
    }

    if (paused) {
      addTimer(window.setTimeout(step, 120));
      return;
    }

    dir = nextDir;
    const head = snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size || occupied(next)) {
      end("Snake termine.");
      return;
    }

    snake.unshift(next);

    if (food && next.x === food.x && next.y === food.y) {
      score += 120 + snake.length * 4;
      speed = Math.max(78, speed - 5);
      food = randomFree();
      if (!power && Math.random() < 0.32) {
        power = { ...randomFree(), type: ["bonus", "slow", "grow"][randomInt(0, 2)] };
      }
    } else if (power && next.x === power.x && next.y === power.y) {
      score += power.type === "bonus" ? 450 : 250;
      if (power.type === "slow") {
        speed = Math.min(210, speed + 45);
      }
      if (power.type !== "grow") {
        snake.pop();
      }
      power = null;
    } else {
      snake.pop();
    }

    draw();
    addTimer(window.setTimeout(step, speed));
  }

  const keyHandler = (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowup" || key === "z" || key === "w") turn(0, -1);
    if (key === "arrowdown" || key === "s") turn(0, 1);
    if (key === "arrowleft" || key === "q" || key === "a") turn(-1, 0);
    if (key === "arrowright" || key === "d") turn(1, 0);
  };
  document.addEventListener("keydown", keyHandler);
  gameCleanups.push(() => document.removeEventListener("keydown", keyHandler));

  food = randomFree();
  arcadeStage.replaceChildren(hud.element, board);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
  });
  arcadeControls.replaceChildren(
    createButton("Haut", () => turn(0, -1), "game-button secondary"),
    createButton("Gauche", () => turn(-1, 0), "game-button secondary"),
    createButton("Droite", () => turn(1, 0), "game-button secondary"),
    createButton("Bas", () => turn(0, 1), "game-button secondary"),
    pause,
    createButton("Quitter", closeArcade, "game-button secondary")
  );
  draw();
  step();
}

function startPuzzleGame() {
  showGameIntro({
    key: "puzzle",
    title: "Puzzle Slider",
    description: "Remets les cases dans l'ordre avec le moins de mouvements possible.",
    rules: [
      "Choisis une difficulte puis deplace les cases autour du trou.",
      "Le chrono et les mouvements reduisent le score.",
      "3x3 rapide, 4x4 standard, 5x5 expert."
    ]
  }, () => {
    const box = createElement("div", "duel-box");
    box.append(createElement("p", "game-message", "Choisis la taille du puzzle."));
    arcadeStage.replaceChildren(box);
    arcadeControls.replaceChildren(
      createButton("3x3", () => runPuzzleGame(3)),
      createButton("4x4", () => runPuzzleGame(4)),
      createButton("5x5", () => runPuzzleGame(5)),
      createButton("Fermer", closeArcade, "game-button secondary")
    );
  });
}

function runPuzzleGame(size) {
  openArcade(`Puzzle Slider ${size}x${size}`);
  const total = size * size;
  const hud = createHud();
  const grid = createElement("div", "puzzle-grid");
  grid.dataset.skin = getEquippedSkin("puzzle");
  grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  let tiles = Array.from({ length: total }, (_, index) => index);
  let moves = 0;
  let seconds = 0;
  let paused = false;
  let finished = false;

  function neighbors(blank) {
    const x = blank % size;
    const y = Math.floor(blank / size);
    return [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 }
    ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < size && point.y < size)
      .map((point) => point.y * size + point.x);
  }

  function shufflePuzzle() {
    let blank = total - 1;
    for (let index = 0; index < total * 40; index += 1) {
      const options = neighbors(blank);
      const pick = options[randomInt(0, options.length - 1)];
      [tiles[blank], tiles[pick]] = [tiles[pick], tiles[blank]];
      blank = pick;
    }
  }

  function isSolved() {
    return tiles.every((value, index) => value === index);
  }

  function scoreValue() {
    return Math.max(80, Math.round(size * size * 420 - moves * 24 - seconds * 9));
  }

  function render() {
    grid.replaceChildren();
    tiles.forEach((value, index) => {
      const tile = createElement("button", value === total - 1 ? "puzzle-tile empty" : "puzzle-tile", value === total - 1 ? "" : String(value + 1));
      tile.type = "button";
      tile.disabled = paused || finished || value === total - 1;
      tile.addEventListener("click", () => {
        const blank = tiles.indexOf(total - 1);
        if (!neighbors(blank).includes(index)) {
          return;
        }
        [tiles[blank], tiles[index]] = [tiles[index], tiles[blank]];
        moves += 1;
        setArcadeScore(scoreValue());
        if (isSolved()) {
          finished = true;
          finishGame("puzzle", scoreValue(), "Puzzle resolu.");
          return;
        }
        render();
      });
      grid.append(tile);
    });

    hud.set({ Temps: `${seconds}s`, Mouvements: moves, Score: scoreValue() });
  }

  shufflePuzzle();
  const timer = addTimer(window.setInterval(() => {
    if (!paused && !finished) {
      seconds += 1;
      setArcadeScore(scoreValue());
      render();
    }
  }, 1000), true);
  gameCleanups.push(() => window.clearInterval(timer));

  arcadeStage.replaceChildren(hud.element, grid);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
    render();
  });
  arcadeControls.replaceChildren(pause, createButton("Restart", () => runPuzzleGame(size)), createButton("Quitter", closeArcade, "game-button secondary"));
  render();
}

function startRpgGame() {
  showGameIntro({
    key: "rpg",
    title: "Mini RPG",
    description: "Enchaine les combats, gere tes potions et bats le boss.",
    rules: [
      "Attaque pour jouer safe, competence pour burst avec mana.",
      "Les ennemis donnent XP et loot cosmétique local.",
      "Le score depend des ennemis vaincus, de tes PV et du loot."
    ]
  }, runRpgGame);
}

function runRpgGame() {
  openArcade("Mini RPG");
  const hud = createHud();
  const log = createElement("div", "game-log");
  const arena = createElement("div", "rpg-arena");
  const pet = getEquippedSkin("rpg") === "wisp" ? "Wisp actif" : "Aucun pet";
  const enemies = [
    { name: "Slime glitch", hp: 38, atk: 8, xp: 80 },
    { name: "Bandit pixel", hp: 62, atk: 12, xp: 140 },
    { name: "Dragon cache", hp: 120, atk: 18, xp: 320 }
  ];
  let hero = { hp: 120, maxHp: 120, mana: 4, potions: 2 };
  let enemyIndex = 0;
  let enemy = { ...enemies[enemyIndex] };
  let score = 0;
  let xp = 0;
  let loot = [];
  let paused = false;

  function push(text) {
    log.prepend(createElement("p", "", text));
  }

  function render() {
    arena.replaceChildren(
      createElement("strong", "", `Hero ${hero.hp}/${hero.maxHp} HP / Mana ${hero.mana}`),
      createElement("strong", "", `${enemy.name} ${enemy.hp} HP`),
      createElement("small", "", `${pet} / Loot : ${loot.join(", ") || "rien"}`)
    );
    hud.set({ Score: score, XP: xp, Potions: hero.potions });
    setArcadeScore(score);
  }

  function enemyTurn() {
    if (enemy.hp <= 0) {
      return;
    }
    const damage = randomInt(enemy.atk - 3, enemy.atk + 5);
    hero.hp = Math.max(0, hero.hp - damage);
    push(`${enemy.name} inflige ${damage}.`);
    if (hero.hp <= 0) {
      finishGame("rpg", score, "Defaite RPG.");
      return;
    }
    render();
  }

  function defeatEnemy() {
    score += enemy.xp * 3 + hero.hp * 2;
    xp += enemy.xp;
    const drops = ["Fragment neon", "Rune pixel", "Potion vide", "Badge casse"];
    loot.push(drops[randomInt(0, drops.length - 1)]);
    push(`${enemy.name} vaincu. Loot obtenu.`);
    enemyIndex += 1;
    if (enemyIndex >= enemies.length) {
      finishGame("rpg", score + hero.hp * 12 + loot.length * 180, "Boss battu.");
      return;
    }
    enemy = { ...enemies[enemyIndex] };
    hero.mana = Math.min(5, hero.mana + 1);
    render();
  }

  function hit(power) {
    if (paused || hero.hp <= 0) {
      return;
    }
    const damage = power === "skill" ? randomInt(24, 38) : randomInt(12, 22);
    if (power === "skill") {
      if (hero.mana <= 0) {
        push("Pas assez de mana.");
        return;
      }
      hero.mana -= 1;
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    push(`Tu infliges ${damage}.`);
    if (enemy.hp <= 0) {
      defeatEnemy();
      return;
    }
    enemyTurn();
  }

  function potion() {
    if (paused || hero.potions <= 0) {
      return;
    }
    hero.potions -= 1;
    hero.hp = Math.min(hero.maxHp, hero.hp + 42);
    push("Potion utilisee.");
    enemyTurn();
  }

  arcadeStage.replaceChildren(hud.element, arena, log);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
  });
  arcadeControls.replaceChildren(
    createButton("Attaque", () => hit("attack")),
    createButton("Competence", () => hit("skill")),
    createButton("Potion", potion, "game-button secondary"),
    pause,
    createButton("Quitter", closeArcade, "game-button secondary")
  );
  push("Le combat commence.");
  render();
}

function startDungeonGame() {
  showGameIntro({
    key: "dungeon",
    title: "Dungeon Runner",
    description: "Traverse 10 salles avec evenements aleatoires puis bats le boss.",
    rules: [
      "Chaque salle peut contenir monstre, coffre, piege ou sanctuaire.",
      "Garde tes PV pour le boss final.",
      "Le score depend de la profondeur, du loot et des PV restants."
    ]
  }, runDungeonGame);
}

function runDungeonGame() {
  openArcade("Dungeon Runner");
  const hud = createHud();
  const log = createElement("div", "game-log");
  let room = 0;
  let hp = 110;
  let potions = 1;
  let loot = 0;
  let score = 0;
  let paused = false;

  function push(text) {
    log.prepend(createElement("p", "", text));
  }

  function render() {
    hud.set({ Salle: `${room}/10`, HP: hp, Loot: loot, Score: score });
    setArcadeScore(score);
  }

  function end(text) {
    finishGame("dungeon", Math.max(40, score + loot * 120 + hp * 8), text);
  }

  function nextRoom() {
    if (paused || hp <= 0) {
      return;
    }

    room += 1;
    if (room >= 10) {
      const bossDamage = randomInt(28, 52);
      hp -= bossDamage;
      score += 900;
      push(`Boss final. Degats recus : ${bossDamage}.`);
      if (hp <= 0) {
        end("Le boss t'a stoppe.");
      } else {
        end("Donjon termine.");
      }
      return;
    }

    const event = ["monster", "chest", "trap", "shrine"][randomInt(0, 3)];
    if (event === "monster") {
      const damage = randomInt(10, 24);
      hp -= damage;
      score += 260;
      push(`Monstre battu, ${damage} degats recus.`);
    } else if (event === "chest") {
      const gain = randomInt(1, 3);
      loot += gain;
      score += gain * 180;
      push(`Coffre trouve : +${gain} loot.`);
    } else if (event === "trap") {
      const damage = randomInt(8, 28);
      hp -= damage;
      score += 90;
      push(`Piege detecte trop tard : -${damage} HP.`);
    } else {
      hp = Math.min(120, hp + 18);
      potions += Math.random() < 0.35 ? 1 : 0;
      score += 120;
      push("Sanctuaire : soin recu.");
    }

    if (hp <= 0) {
      end("Tu tombes dans le donjon.");
      return;
    }

    render();
  }

  function usePotion() {
    if (paused || potions <= 0) {
      return;
    }
    potions -= 1;
    hp = Math.min(120, hp + 38);
    push("Potion utilisee.");
    render();
  }

  arcadeStage.replaceChildren(hud.element, log);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
  });
  arcadeControls.replaceChildren(
    createButton("Avancer", nextRoom),
    createButton("Potion", usePotion, "game-button secondary"),
    pause,
    createButton("Quitter", closeArcade, "game-button secondary")
  );
  push("Entree du donjon.");
  render();
}

function startTycoonGame() {
  showGameIntro({
    key: "tycoon",
    title: "Tycoon Idle",
    description: "Session courte de gestion: cree des points virtuels, achete des upgrades, encaisse un score plafonne.",
    rules: [
      "Les points tycoon ne sont pas des RIP coins directs.",
      "Seul le score final est envoye a Supabase.",
      "La recompense globale est plafonnee pour eviter les abus."
    ]
  }, runTycoonGame);
}

function runTycoonGame() {
  openArcade("Tycoon Idle");
  const hud = createHud();
  const panel = createElement("div", "tycoon-panel");
  let credits = 0;
  let perSecond = 1;
  let clickPower = 1;
  let upgrades = 0;
  let timeLeft = 90;
  let paused = false;
  let ended = false;

  function scoreValue() {
    return Math.max(20, Math.round(credits * 8 + upgrades * 260 + perSecond * 180 + clickPower * 90));
  }

  function render() {
    panel.replaceChildren(
      createElement("strong", "", `${Math.floor(credits)} credits virtuels`),
      createElement("small", "", `${perSecond}/s / clic +${clickPower} / upgrades ${upgrades}`),
      createElement("small", "", "Ces credits ne sont pas des RIP coins.")
    );
    hud.set({ Temps: `${timeLeft}s`, Score: scoreValue(), Prod: `${perSecond}/s` });
    setArcadeScore(scoreValue());
  }

  function buyGen() {
    const cost = 18 + upgrades * 14;
    if (paused || credits < cost) {
      return;
    }
    credits -= cost;
    perSecond += 1 + Math.floor(upgrades / 4);
    upgrades += 1;
    render();
  }

  function buyClick() {
    const cost = 12 + clickPower * 10;
    if (paused || credits < cost) {
      return;
    }
    credits -= cost;
    clickPower += 1;
    upgrades += 1;
    render();
  }

  function end() {
    if (ended) {
      return;
    }
    ended = true;
    finishGame("tycoon", Math.min(80000, scoreValue()), "Session Tycoon terminee.");
  }

  addTimer(window.setInterval(() => {
    if (paused || ended) {
      return;
    }
    credits += perSecond;
    timeLeft -= 1;
    if (timeLeft <= 0) {
      end();
      return;
    }
    render();
  }, 1000), true);

  arcadeStage.replaceChildren(hud.element, panel);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
  });
  arcadeControls.replaceChildren(
    createButton("Collecter", () => {
      if (!paused) {
        credits += clickPower;
        render();
      }
    }),
    createButton("Upgrade prod", buyGen),
    createButton("Upgrade clic", buyClick),
    pause,
    createButton("Encaisser", end, "game-button secondary")
  );
  render();
}

function startSpaceGame() {
  showGameIntro({
    key: "space",
    title: "Space Shooter",
    description: "Survis aux vagues, recupere les power-ups et detruis le boss.",
    rules: [
      "Fleches/QD pour bouger, espace pour tirer.",
      "Les power-ups reparents ou accelerent le tir.",
      "Le boss arrive apres quelques vagues."
    ]
  }, runSpaceGame);
}

function runSpaceGame() {
  openArcade("Space Shooter");
  const hud = createHud();
  const canvas = createElement("canvas", "game-canvas");
  canvas.width = 520;
  canvas.height = 340;
  const ctx = canvas.getContext("2d");
  const skin = getEquippedSkin("space");
  const keys = new Set();
  let player = { x: 245, y: 292, w: 30, h: 24, hp: 4, cooldown: 0 };
  let bullets = [];
  let enemies = [];
  let powers = [];
  let boss = null;
  let frame = 0;
  let score = 0;
  let paused = false;
  let ended = false;
  let raf = 0;

  function rects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function shoot() {
    if (player.cooldown > 0 || paused || ended) {
      return;
    }
    bullets.push({ x: player.x + player.w / 2 - 3, y: player.y - 8, w: 6, h: 12, vy: -7 });
    player.cooldown = skin === "comet" ? 7 : 10;
  }

  function drawRect(rect, color) {
    ctx.fillStyle = color;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  function end(text) {
    if (ended) {
      return;
    }
    ended = true;
    window.cancelAnimationFrame(raf);
    finishGame("space", score + player.hp * 220, text);
  }

  function loop() {
    if (ended) {
      return;
    }

    raf = window.requestAnimationFrame(loop);
    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffdc5e";
      ctx.fillText("PAUSE", 230, 170);
      return;
    }

    frame += 1;
    player.cooldown = Math.max(0, player.cooldown - 1);
    if (keys.has("arrowleft") || keys.has("q") || keys.has("a")) player.x -= 5;
    if (keys.has("arrowright") || keys.has("d")) player.x += 5;
    if (keys.has(" ")) shoot();
    player.x = clamp(player.x, 0, canvas.width - player.w);

    if (frame % 42 === 0) {
      enemies.push({ x: randomInt(20, canvas.width - 42), y: -24, w: 28, h: 22, hp: 1 + Math.floor(frame / 650), vy: 1.6 + frame / 1600 });
    }
    if (!boss && frame > 1600) {
      boss = { x: 185, y: 22, w: 150, h: 42, hp: 35, vx: 2.2 };
    }

    bullets.forEach((bullet) => {
      bullet.y += bullet.vy;
    });
    enemies.forEach((enemy) => {
      enemy.y += enemy.vy;
    });
    if (boss) {
      boss.x += boss.vx;
      if (boss.x < 10 || boss.x + boss.w > canvas.width - 10) boss.vx *= -1;
      if (frame % 60 === 0) enemies.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h, w: 18, h: 18, hp: 1, vy: 2.6 });
    }

    bullets.forEach((bullet) => {
      enemies.forEach((enemy) => {
        if (enemy.hp > 0 && rects(bullet, enemy)) {
          enemy.hp -= 1;
          bullet.dead = true;
          if (enemy.hp <= 0) {
            score += 120;
            if (Math.random() < 0.12) powers.push({ x: enemy.x, y: enemy.y, w: 18, h: 18, vy: 2, type: Math.random() < 0.5 ? "heal" : "rapid" });
          }
        }
      });
      if (boss && rects(bullet, boss)) {
        boss.hp -= 1;
        bullet.dead = true;
        score += 45;
        if (boss.hp <= 0) {
          score += 2200;
          end("Boss detruit.");
        }
      }
    });

    enemies.forEach((enemy) => {
      if (enemy.hp > 0 && rects(player, enemy)) {
        enemy.hp = 0;
        player.hp -= 1;
      }
    });
    powers.forEach((power) => {
      power.y += power.vy;
      if (rects(player, power)) {
        power.dead = true;
        if (power.type === "heal") player.hp = Math.min(5, player.hp + 1);
        if (power.type === "rapid") player.cooldown = 0;
        score += 220;
      }
    });

    bullets = bullets.filter((bullet) => !bullet.dead && bullet.y > -20);
    enemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.y < canvas.height + 30);
    powers = powers.filter((power) => !power.dead && power.y < canvas.height + 20);

    if (player.hp <= 0) {
      end("Vaisseau detruit.");
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawRect(player, skin === "comet" ? "#ffdc5e" : "#39ff88");
    bullets.forEach((bullet) => drawRect(bullet, "#7dd3fc"));
    enemies.forEach((enemy) => drawRect(enemy, "#ef4444"));
    powers.forEach((power) => drawRect(power, power.type === "heal" ? "#22c55e" : "#f97316"));
    if (boss) drawRect(boss, "#a855f7");

    hud.set({ Score: score, HP: player.hp, Boss: boss ? boss.hp : "non" });
    setArcadeScore(score);
  }

  const keyDown = (event) => {
    keys.add(event.key.toLowerCase());
    if (event.key === " ") event.preventDefault();
  };
  const keyUp = (event) => keys.delete(event.key.toLowerCase());
  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);
  gameCleanups.push(() => {
    document.removeEventListener("keydown", keyDown);
    document.removeEventListener("keyup", keyUp);
    window.cancelAnimationFrame(raf);
  });

  arcadeStage.replaceChildren(hud.element, canvas);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
  });
  arcadeControls.replaceChildren(
    createButton("Gauche", () => player.x -= 18, "game-button secondary"),
    createButton("Tirer", shoot),
    createButton("Droite", () => player.x += 18, "game-button secondary"),
    pause,
    createButton("Quitter", closeArcade, "game-button secondary")
  );
  loop();
}

function startPlatformerGame() {
  showGameIntro({
    key: "platformer",
    title: "Pixel Platformer",
    description: "Cours, saute, recupere des pieces et atteins le portail.",
    rules: [
      "Fleches/QD pour bouger, espace/Z pour sauter.",
      "Les pieces augmentent le score.",
      "Evite les pics et termine avec le plus de PV possible."
    ]
  }, runPlatformerGame);
}

function runPlatformerGame() {
  openArcade("Pixel Platformer");
  const hud = createHud();
  const canvas = createElement("canvas", "game-canvas");
  canvas.width = 560;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  const skin = getEquippedSkin("platformer");
  const player = { x: 30, y: 240, w: 22, h: 30, vx: 0, vy: 0, hp: 3, grounded: false };
  const platforms = [
    { x: 0, y: 290, w: 1400, h: 30 },
    { x: 160, y: 235, w: 120, h: 16 },
    { x: 360, y: 205, w: 110, h: 16 },
    { x: 590, y: 250, w: 140, h: 16 },
    { x: 850, y: 220, w: 150, h: 16 },
    { x: 1120, y: 185, w: 120, h: 16 }
  ];
  const coins = Array.from({ length: 18 }, (_, index) => ({ x: 90 + index * 68, y: 190 - (index % 3) * 30, w: 14, h: 14, got: false }));
  const spikes = [{ x: 300, y: 272, w: 38, h: 18 }, { x: 760, y: 272, w: 42, h: 18 }, { x: 1030, y: 272, w: 50, h: 18 }];
  const goal = { x: 1320, y: 230, w: 32, h: 60 };
  let camera = 0;
  let score = 0;
  let paused = false;
  let ended = false;
  let raf = 0;

  function rects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function end(text) {
    if (ended) return;
    ended = true;
    window.cancelAnimationFrame(raf);
    finishGame("platformer", score + Math.round(player.x) + player.hp * 350, text);
  }

  function jump() {
    if (player.grounded && !paused) {
      player.vy = -11.5;
      player.grounded = false;
    }
  }

  function loop() {
    if (ended) return;
    raf = window.requestAnimationFrame(loop);
    if (paused) return;

    player.vx = 0;
    if (keys.has("arrowleft") || keys.has("q") || keys.has("a")) player.vx = -4;
    if (keys.has("arrowright") || keys.has("d")) player.vx = 4;
    if (keys.has(" ") || keys.has("z") || keys.has("w")) jump();

    player.x += player.vx;
    player.vy += 0.55;
    player.y += player.vy;
    player.grounded = false;

    platforms.forEach((platform) => {
      if (rects(player, platform) && player.vy >= 0 && player.y + player.h - player.vy <= platform.y + 8) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    });

    coins.forEach((coin) => {
      if (!coin.got && rects(player, coin)) {
        coin.got = true;
        score += 180;
      }
    });

    spikes.forEach((spike) => {
      if (rects(player, spike)) {
        player.hp -= 1;
        player.x = Math.max(20, player.x - 90);
        player.y = 230;
        player.vy = 0;
        if (player.hp <= 0) end("Platformer perdu.");
      }
    });

    if (player.y > 360) {
      player.hp -= 1;
      player.x = 30;
      player.y = 230;
      player.vy = 0;
      if (player.hp <= 0) end("Chute finale.");
    }

    if (rects(player, goal)) {
      score += 1800;
      end("Niveau termine.");
      return;
    }

    camera = clamp(player.x - 180, 0, 880);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#07111f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera, 0);
    ctx.fillStyle = "#334155";
    platforms.forEach((platform) => ctx.fillRect(platform.x, platform.y, platform.w, platform.h));
    ctx.fillStyle = "#ffdc5e";
    coins.forEach((coin) => {
      if (!coin.got) ctx.fillRect(coin.x, coin.y, coin.w, coin.h);
    });
    ctx.fillStyle = "#ef4444";
    spikes.forEach((spike) => ctx.fillRect(spike.x, spike.y, spike.w, spike.h));
    ctx.fillStyle = "#7dd3fc";
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.fillStyle = skin === "pixel" ? "#fb7185" : "#39ff88";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.restore();

    hud.set({ Score: score, HP: player.hp, Pieces: coins.filter((coin) => coin.got).length });
    setArcadeScore(score + Math.round(player.x));
  }

  const keyDown = (event) => {
    keys.add(event.key.toLowerCase());
    if (event.key === " ") event.preventDefault();
  };
  const keyUp = (event) => keys.delete(event.key.toLowerCase());
  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);
  gameCleanups.push(() => {
    document.removeEventListener("keydown", keyDown);
    document.removeEventListener("keyup", keyUp);
    window.cancelAnimationFrame(raf);
  });

  arcadeStage.replaceChildren(hud.element, canvas);
  const pause = makePauseControl(() => paused, (value) => {
    paused = value;
    pause.textContent = paused ? "Reprendre" : "Pause";
  });
  arcadeControls.replaceChildren(
    createButton("Gauche", () => {
      if (!paused) player.x = Math.max(0, player.x - 24);
    }, "game-button secondary"),
    createButton("Saut", jump),
    createButton("Droite", () => {
      if (!paused) player.x += 24;
    }, "game-button secondary"),
    pause,
    createButton("Quitter", closeArcade, "game-button secondary")
  );
  loop();
}

function startReflexGame() {
  openArcade("Reflex Blitz");
  let round = 0;
  let score = 0;
  let readyAt = 0;
  let waiting = false;
  const totalRounds = 5;
  const pad = createElement("button", "reflex-pad", "Clique Start");
  pad.type = "button";
  arcadeStage.replaceChildren(pad);

  const nextRound = () => {
    round += 1;

    if (round > totalRounds) {
      finishGame("reflex", score, "Reflex termine.");
      return;
    }

    waiting = false;
    pad.classList.remove("is-ready");
    pad.textContent = `Round ${round}/${totalRounds}... attends le signal`;
    const delay = 850 + Math.random() * 1800;
    addTimer(window.setTimeout(() => {
      waiting = true;
      readyAt = performance.now();
      pad.classList.add("is-ready");
      pad.textContent = "GO";
    }, delay));
  };

  pad.addEventListener("click", () => {
    if (!round) {
      nextRound();
      return;
    }

    if (!waiting) {
      score = Math.max(0, score - 120);
      setArcadeScore(score);
      pad.textContent = "Trop tot. Penalite.";
      return;
    }

    const reaction = performance.now() - readyAt;
    const gained = Math.max(40, Math.round(950 - reaction));
    score += gained;
    setArcadeScore(score);
    waiting = false;
    pad.classList.remove("is-ready");
    pad.textContent = `${Math.round(reaction)} ms / +${gained}`;
    addTimer(window.setTimeout(nextRound, 700));
  });

  arcadeControls.replaceChildren(
    createButton("Start", () => {
      if (!round) {
        nextRound();
      }
    }),
    createButton("Quitter", closeArcade, "game-button secondary")
  );
}

async function startMemoryGame() {
  openArcade("Memory Grid");
  let round = 1;
  let score = 0;
  let sequence = [];
  let cursor = 0;
  let accepting = false;
  const grid = createElement("div", "memory-grid");
  const tiles = Array.from({ length: 16 }, (_, index) => {
    const tile = createElement("button", "memory-tile");
    tile.type = "button";
    tile.addEventListener("click", () => handlePick(index));
    grid.append(tile);
    return tile;
  });

  arcadeStage.replaceChildren(grid);
  arcadeControls.replaceChildren(createButton("Quitter", closeArcade, "game-button secondary"));

  async function showRound() {
    accepting = false;
    cursor = 0;
    sequence.push(Math.floor(Math.random() * tiles.length));
    setArcadeScore(score);

    for (const index of sequence) {
      tiles[index].classList.add("is-lit");
      await sleep(Math.max(180, 430 - round * 12));
      tiles[index].classList.remove("is-lit");
      await sleep(130);
    }

    accepting = true;
    setArcadeStatus(`Memory round ${round}. Reproduis la sequence.`);
  }

  function handlePick(index) {
    if (!accepting) {
      return;
    }

    tiles[index].classList.add("is-picked");
    addTimer(window.setTimeout(() => tiles[index].classList.remove("is-picked"), 140));

    if (sequence[cursor] !== index) {
      accepting = false;
      finishGame("memory", score, "Mauvaise case.");
      return;
    }

    cursor += 1;

    if (cursor === sequence.length) {
      score += round * 120;
      round += 1;
      addTimer(window.setTimeout(showRound, 600));
    }
  }

  await showRound();
}

function startRunnerGame() {
  openArcade("Neon Runner");
  let score = 0;
  let lane = 1;
  let tick = 0;
  let speed = 260;
  let obstacles = [];
  let running = true;
  const rows = 9;
  const lanes = 3;
  const grid = createElement("div", "runner-grid");
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < lanes; col += 1) {
      const cell = createElement("div", "runner-cell");
      grid.append(cell);
      cells.push(cell);
    }
  }

  function draw() {
    cells.forEach((cell) => {
      cell.className = "runner-cell";
      cell.textContent = "";
    });

    obstacles.forEach((obstacle) => {
      if (obstacle.row >= 0 && obstacle.row < rows) {
        const cell = cells[obstacle.row * lanes + obstacle.lane];
        cell.classList.add("runner-obstacle");
        cell.textContent = "X";
      }
    });

    const player = cells[(rows - 1) * lanes + lane];
    player.classList.add("runner-player");
    player.textContent = "A";
  }

  function move(delta) {
    lane = Math.max(0, Math.min(lanes - 1, lane + delta));
    draw();
  }

  function end() {
    running = false;
    finishGame("runner", score, "Crash.");
  }

  function step() {
    if (!running) {
      return;
    }

    tick += 1;
    score += 12;
    setArcadeScore(score);
    obstacles = obstacles
      .map((obstacle) => ({ lane: obstacle.lane, row: obstacle.row + 1 }))
      .filter((obstacle) => obstacle.row < rows);

    if (tick % 2 === 0) {
      const occupied = new Set(obstacles.filter((obstacle) => obstacle.row <= 1).map((obstacle) => obstacle.lane));
      const freeLane = [0, 1, 2].find((candidate) => !occupied.has(candidate));
      obstacles.push({ lane: freeLane === undefined ? Math.floor(Math.random() * lanes) : freeLane, row: 0 });
    }

    if (obstacles.some((obstacle) => obstacle.row === rows - 1 && obstacle.lane === lane)) {
      end();
      return;
    }

    draw();
    speed = Math.max(115, speed - 2);
    addTimer(window.setTimeout(step, speed));
  }

  const keyHandler = (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "q") {
      move(-1);
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      move(1);
    }
  };

  document.addEventListener("keydown", keyHandler);
  gameCleanups.push(() => document.removeEventListener("keydown", keyHandler));

  arcadeStage.replaceChildren(grid);
  arcadeControls.replaceChildren(
    createButton("Gauche", () => move(-1)),
    createButton("Droite", () => move(1)),
    createButton("Quitter", closeArcade, "game-button secondary")
  );
  draw();
  step();
}

function startAimGame() {
  openArcade("Aim Trainer");
  let score = 0;
  let hits = 0;
  let timeLeft = 20;
  let running = true;
  let countdown = null;
  const board = createElement("div", "aim-board");
  const target = createElement("button", "aim-target", "+");
  const timer = createElement("div", "aim-timer", `${timeLeft}s`);
  target.type = "button";
  board.append(target, timer);
  arcadeStage.replaceChildren(board);

  function placeTarget() {
    const rect = board.getBoundingClientRect();
    const size = Math.max(34, 62 - hits * 2);
    target.style.width = `${size}px`;
    target.style.height = `${size}px`;
    target.style.left = `${Math.max(0, Math.random() * (rect.width - size))}px`;
    target.style.top = `${Math.max(0, Math.random() * (rect.height - size))}px`;
  }

  function end() {
    if (!running) {
      return;
    }

    running = false;

    if (countdown) {
      window.clearInterval(countdown);
    }

    finishGame("aim", score, `Aim termine avec ${hits} hits.`);
  }

  board.addEventListener("click", (event) => {
    if (!running) {
      return;
    }

    if (event.target !== target) {
      score = Math.max(0, score - 20);
      setArcadeScore(score);
    }
  });

  target.addEventListener("click", (event) => {
    event.stopPropagation();

    if (!running) {
      return;
    }

    hits += 1;
    score += Math.max(35, 120 - hits * 3);
    setArcadeScore(score);
    placeTarget();
  });

  countdown = addTimer(window.setInterval(() => {
    timeLeft -= 1;
    timer.textContent = `${timeLeft}s`;

    if (timeLeft <= 0) {
      end();
    }
  }, 1000), true);

  arcadeControls.replaceChildren(createButton("Quitter", closeArcade, "game-button secondary"));
  addTimer(window.setTimeout(placeTarget, 80));
}

function generateCipherCode() {
  return Array.from({ length: 4 }, () => String(1 + Math.floor(Math.random() * 6))).join("");
}

function cipherHint(secret, guess) {
  let exact = 0;
  const secretRest = [];
  const guessRest = [];

  for (let index = 0; index < secret.length; index += 1) {
    if (secret[index] === guess[index]) {
      exact += 1;
    } else {
      secretRest.push(secret[index]);
      guessRest.push(guess[index]);
    }
  }

  let misplaced = 0;
  guessRest.forEach((digit) => {
    const found = secretRest.indexOf(digit);

    if (found !== -1) {
      misplaced += 1;
      secretRest.splice(found, 1);
    }
  });

  return { exact, misplaced };
}

function startCipherGame() {
  openArcade("Code Breaker");
  const secret = generateCipherCode();
  let attempts = 0;
  let score = 1000;
  const box = createElement("div", "cipher-box");
  const info = createElement("p", "game-message", "Trouve le code de 4 chiffres entre 1 et 6. Indice : exact / mal place.");
  const form = createElement("form", "cipher-form");
  const input = createElement("input", "panel-search");
  const submit = createButton("Tester", () => null);
  submit.type = "submit";
  const history = createElement("div", "cipher-history");
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = 4;
  input.placeholder = "ex: 1234";
  form.append(input, submit);
  box.append(info, form, history);
  arcadeStage.replaceChildren(box);
  arcadeControls.replaceChildren(createButton("Quitter", closeArcade, "game-button secondary"));
  input.focus();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const guess = input.value.trim();

    if (!/^[1-6]{4}$/.test(guess)) {
      setArcadeStatus("Code invalide : 4 chiffres de 1 a 6.", true);
      return;
    }

    attempts += 1;
    const hint = cipherHint(secret, guess);
    const row = createElement("div", "cipher-row");
    row.append(
      createElement("strong", "", `${attempts}. ${guess}`),
      createElement("small", "", `${hint.exact} exact / ${hint.misplaced} mal place`)
    );
    history.prepend(row);

    if (guess === secret) {
      finishGame("cipher", Math.max(120, score - attempts * 85), "Code casse.");
      return;
    }

    if (attempts >= 8) {
      finishGame("cipher", Math.max(40, Math.round(score / 5)), `Perdu. Le code etait ${secret}.`);
      return;
    }

    input.value = "";
    input.focus();
    setArcadeScore(Math.max(0, score - attempts * 85));
  });
}

function renderDuel(duel) {
  activeDuel = duel;
  setArcadeScore(duel.status === "done" ? 1 : 0);
  arcadeStage.replaceChildren();
  arcadeControls.replaceChildren();

  const box = createElement("div", "duel-box");
  box.append(createElement("div", "duel-code", `Code : ${duel.code}`));

  if (duel.status === "waiting") {
    box.append(createElement("p", "game-message", "Envoie ce code a un ami. Le duel demarre quand il rejoint."));
  } else if (duel.status === "playing") {
    const hasPlayed = duel.host_id === arcadeUser.id ? duel.host_choice : duel.guest_choice;
    box.append(createElement("p", "game-message", hasPlayed ? "Choix envoye. Attente de l'autre joueur." : "Choisis ton coup."));

    if (!hasPlayed) {
      const actions = createElement("div", "duel-actions");
      actions.append(
        createButton("Pierre", () => submitDuelChoice("rock")),
        createButton("Feuille", () => submitDuelChoice("paper")),
        createButton("Ciseaux", () => submitDuelChoice("scissors"))
      );
      box.append(actions);
    }
  } else {
    const result = duel.winner_id
      ? duel.winner_id === arcadeUser.id ? "Victoire. +35 coins." : "Defaite. +5 coins."
      : "Egalite. +8 coins.";
    box.append(createElement("p", "game-message", result));

    if (!duelDoneSeen) {
      duelDoneSeen = true;
      loadWallet().catch(() => null);
      loadMissions().catch(() => null);
    }
  }

  arcadeStage.append(box);
  arcadeControls.append(
    createButton("Refresh", () => refreshDuel()),
    createButton("Fermer", closeArcade, "game-button secondary")
  );
}

async function refreshDuel() {
  if (!activeDuel) {
    return;
  }

  const { data, error } = await arcadeClient
    .from("game_duels")
    .select("*")
    .eq("id", activeDuel.id)
    .single();

  if (error) {
    setArcadeStatus("Duel inaccessible.", true);
    return;
  }

  renderDuel(data);
}

function startDuelPoll() {
  if (duelPoll) {
    window.clearInterval(duelPoll);
  }

  duelPoll = window.setInterval(refreshDuel, 1300);
}

async function createDuel() {
  const { data, error } = await arcadeClient.rpc("create_game_duel");

  if (error) {
    setArcadeStatus(arcadeErrorMessage(error, "Creation duel impossible."), true);
    return;
  }

  renderDuel(data);
  startDuelPoll();
}

async function joinDuel(codeInput) {
  const code = String(codeInput || "").trim();

  if (!code) {
    return;
  }

  const { data, error } = await arcadeClient.rpc("join_game_duel", {
    duel_code: code
  });

  if (error) {
    setArcadeStatus("Code duel invalide.", true);
    return;
  }

  renderDuel(data);
  startDuelPoll();
}

async function submitDuelChoice(choice) {
  if (!activeDuel) {
    return;
  }

  const { data, error } = await arcadeClient.rpc("submit_duel_choice", {
    duel_id: activeDuel.id,
    choice_text: choice
  });

  if (error) {
    setArcadeStatus("Choix impossible.", true);
    return;
  }

  renderDuel(data);
}

function startDuelGame() {
  openArcade("Duel multijoueur");
  const box = createElement("div", "duel-box");
  const input = createElement("input", "panel-search");
  input.type = "text";
  input.maxLength = 6;
  input.placeholder = "Code duel";
  const row = createElement("div", "arcade-controls");
  row.append(
    createButton("Creer duel", createDuel),
    createButton("Rejoindre", () => joinDuel(input.value), "game-button secondary")
  );
  box.append(
    createElement("p", "game-message", "Duel Pierre/Feuille/Ciseaux en ligne. Le gagnant gagne des coins."),
    input,
    row
  );
  arcadeStage.replaceChildren(box);
}

function tttMark(game) {
  return game.host_id === arcadeUser.id ? "X" : "O";
}

function renderTtt(game) {
  activeTtt = game;
  arcadeStage.replaceChildren();
  arcadeControls.replaceChildren();

  const box = createElement("div", "ttt-box");
  box.append(createElement("div", "duel-code", `Morpion : ${game.code}`));

  if (game.status === "waiting") {
    box.append(createElement("p", "game-message", "Envoie ce code a un ami. Tu joues X."));
  }

  if (game.status === "playing") {
    const myTurn = game.turn_id === arcadeUser.id;
    box.append(createElement("p", "game-message", myTurn ? `A toi de jouer (${tttMark(game)}).` : "Tour de l'autre joueur."));
  }

  if (game.status === "done") {
    const text = game.winner_id
      ? game.winner_id === arcadeUser.id ? "Victoire Morpion. +60 coins." : "Defaite Morpion. +15 coins."
      : "Egalite Morpion. +25 coins.";
    box.append(createElement("p", "game-message", text));

    if (!tttDoneSeen) {
      tttDoneSeen = true;
      loadWallet().catch(() => null);
      loadMissions().catch(() => null);
    }
  }

  const board = createElement("div", "ttt-grid");
  const cells = Array.isArray(game.board) ? game.board : [];

  for (let index = 0; index < 9; index += 1) {
    const mark = cells[index] || "";
    const cell = createElement("button", "ttt-cell", mark);
    cell.type = "button";
    cell.disabled = Boolean(mark) || game.status !== "playing" || game.turn_id !== arcadeUser.id;
    cell.addEventListener("click", () => playTttMove(index));
    board.append(cell);
  }

  box.append(board);
  arcadeStage.append(box);
  arcadeControls.append(
    createButton("Refresh", () => refreshTtt()),
    createButton("Fermer", closeArcade, "game-button secondary")
  );
}

async function refreshTtt() {
  if (!activeTtt) {
    return;
  }

  const { data, error } = await arcadeClient
    .from("tic_tac_toe_games")
    .select("*")
    .eq("id", activeTtt.id)
    .single();

  if (error) {
    setArcadeStatus("Morpion inaccessible.", true);
    return;
  }

  renderTtt(data);
}

function startTttPoll() {
  if (tttPoll) {
    window.clearInterval(tttPoll);
  }

  tttPoll = window.setInterval(refreshTtt, 1200);
}

async function createTtt() {
  const { data, error } = await arcadeClient.rpc("create_ttt_game");

  if (error) {
    setArcadeStatus(arcadeErrorMessage(error, "Creation morpion impossible."), true);
    return;
  }

  renderTtt(data);
  startTttPoll();
}

async function joinTtt(codeInput) {
  const code = String(codeInput || "").trim();

  if (!code) {
    return;
  }

  const { data, error } = await arcadeClient.rpc("join_ttt_game", {
    game_code: code
  });

  if (error) {
    setArcadeStatus("Code morpion invalide.", true);
    return;
  }

  renderTtt(data);
  startTttPoll();
}

async function playTttMove(index) {
  if (!activeTtt) {
    return;
  }

  const { data, error } = await arcadeClient.rpc("play_ttt_move", {
    game_id: activeTtt.id,
    cell_index: index
  });

  if (error) {
    setArcadeStatus("Coup impossible.", true);
    return;
  }

  renderTtt(data);
}

function startTttGame() {
  openArcade("Morpion multi");
  const box = createElement("div", "duel-box");
  const input = createElement("input", "panel-search");
  input.type = "text";
  input.maxLength = 6;
  input.placeholder = "Code morpion";
  const row = createElement("div", "arcade-controls");
  row.append(
    createButton("Creer morpion", createTtt),
    createButton("Rejoindre", () => joinTtt(input.value), "game-button secondary")
  );
  box.append(
    createElement("p", "game-message", "Morpion en ligne : X commence, le gagnant prend 60 coins."),
    input,
    row
  );
  arcadeStage.replaceChildren(box);
}

function startGame(gameKey) {
  if (!arcadeUser) {
    setArcadeStatus("Connecte-toi pour jouer.", true);
    return;
  }

  if (gameKey === "reflex") {
    startReflexGame();
  } else if (gameKey === "memory") {
    startMemoryGame().catch((error) => console.error("Memory error:", error));
  } else if (gameKey === "runner") {
    startRunnerGame();
  } else if (gameKey === "aim") {
    startAimGame();
  } else if (gameKey === "cipher") {
    startCipherGame();
  } else if (gameKey === "snake") {
    startSnakeGame();
  } else if (gameKey === "puzzle") {
    startPuzzleGame();
  } else if (gameKey === "rpg") {
    startRpgGame();
  } else if (gameKey === "dungeon") {
    startDungeonGame();
  } else if (gameKey === "tycoon") {
    startTycoonGame();
  } else if (gameKey === "space") {
    startSpaceGame();
  } else if (gameKey === "platformer") {
    startPlatformerGame();
  } else if (gameKey === "duel") {
    startDuelGame();
  } else if (gameKey === "ttt") {
    startTttGame();
  } else {
    setArcadeStatus("Jeu indisponible pour le moment.", true);
  }
}


function bindArcadeLaunchers() {
  if (arcadeLaunchersBound) {
    return;
  }

  arcadeLaunchersBound = true;
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-game]");

    if (!button) {
      return;
    }

    event.preventDefault();
    startGame(button.getAttribute("data-open-game"));
  });
}
async function initArcade() {
  bindArcadeLaunchers();

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeArcade);
  });

  if (dailyButton) {
    dailyButton.addEventListener("click", claimDaily);
  }

  if (!window.RipSupabase || !window.RipSupabase.isConfigured() || !window.RipAuth) {
    setArcadeStatus("Supabase requis pour les points.", true);
    return;
  }

  await window.RipAuth.ready();
  arcadeUser = window.RipAuth.currentUser();

  if (!arcadeUser) {
    setArcadeStatus("Connecte-toi pour activer l'arcade.", true);
    return;
  }

  applyProfileCosmetics(arcadeUser);
  arcadeClient = await window.RipSupabase.getClient();
  bindLocalRooms();

  if (leaderboardGame) {
    leaderboardGame.addEventListener("change", () => loadLeaderboard(leaderboardGame.value).catch(() => null));
  }

  const results = await Promise.allSettled([
    loadWallet(),
    loadShop(),
    loadMissions(),
    loadLeaderboard(leaderboardGame ? leaderboardGame.value : "reflex")
  ]);
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);

  console.info(`Arcade ${ARCADE_VERSION} prete.`);

  if (errors.length) {
    console.error("Arcade partiellement chargee:", errors);
    setArcadeStatus(arcadeErrorMessage(errors[0], "Arcade chargee partiellement."), true);
    return;
  }

  setArcadeStatus("Arcade prete.");
}

onReady(() => {
  initArcade().catch((error) => {
    console.error("Erreur arcade init:", error);
    setArcadeStatus("Erreur arcade.", true);
  });
});
