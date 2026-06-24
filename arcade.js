const ARCADE_VERSION = "20260625-chatplus1";
const SOLO_GAMES = new Set(["reflex", "memory", "runner", "aim", "cipher"]);

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

function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }

  callback();
}

function setArcadeStatus(text, isError = false) {
  if (!arcadeStatus) {
    return;
  }

  arcadeStatus.textContent = text;
  arcadeStatus.dataset.state = isError ? "error" : "ok";
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
  return /user_wallets|shop_items|user_inventory|game_scores|game_duels|tic_tac_toe_games|user_missions|user_achievements|user_notifications|function|schema|permission|wallet/i.test(message);
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

  walletPoints.textContent = String(wallet.points || 0);
  walletLevel.textContent = String(level);
  walletXp.textContent = String(xp);
  walletStreak.textContent = String(wallet.streak || 0);

  if (walletProgress) {
    walletProgress.style.width = `${progress}%`;
  }

  if (walletProgressText) {
    walletProgressText.textContent = `${Math.max(0, xp - start)} / ${next - start} XP vers niveau ${level + 1}`;
  }
}

async function loadWallet() {
  const { data, error } = await arcadeClient.rpc("get_my_wallet");

  if (error) {
    throw error;
  }

  renderWallet(data);
  return data;
}

async function loadShop() {
  const [{ data: items, error: itemError }, { data: inventory, error: inventoryError }] = await Promise.all([
    arcadeClient
      .from("shop_items")
      .select("item_key,name,description,price,item_type,payload,sort_order")
      .order("sort_order", { ascending: true }),
    arcadeClient
      .from("user_inventory")
      .select("item_key,quantity,equipped,acquired_at")
      .order("acquired_at", { ascending: false })
  ]);

  if (itemError || inventoryError) {
    throw itemError || inventoryError;
  }

  renderShop(items || [], inventory || []);
  renderInventory(items || [], inventory || []);
}

function renderShop(items, inventory) {
  shopList.replaceChildren();

  if (!items.length) {
    shopList.textContent = "Boutique vide.";
    return;
  }

  const owned = new Map(inventory.map((item) => [item.item_key, item]));

  items.forEach((item) => {
    const row = createElement("div", "shop-item");
    const title = createElement("strong", "", item.name);
    const description = createElement("small", "", item.description);
    const price = createElement("small", "", `${item.price} RIP coins`);
    const isOwned = owned.has(item.item_key);
    const buy = createButton(isOwned ? "Possede" : "Acheter", () => purchaseItem(item.item_key), "game-button secondary");
    buy.disabled = isOwned;

    row.append(title, description, price, buy);
    shopList.append(row);
  });
}

function canEquip(item) {
  return item && ["name_style", "avatar_frame", "theme"].includes(item.item_type);
}

function renderInventory(items, inventory) {
  inventoryList.replaceChildren();

  if (!inventory.length) {
    inventoryList.textContent = "Aucun item.";
    return;
  }

  const itemByKey = new Map(items.map((item) => [item.item_key, item]));

  inventory.forEach((entry) => {
    const item = itemByKey.get(entry.item_key);
    const row = createElement("div", "inventory-item");
    row.append(
      createElement("strong", "", item ? item.name : entry.item_key),
      createElement("small", "", `Quantite : ${entry.quantity}${entry.equipped ? " / equipe" : ""}`)
    );

    if (canEquip(item)) {
      const equip = createButton(entry.equipped ? "Equipe" : "Equiper", () => equipItem(entry.item_key), "game-button secondary");
      equip.disabled = Boolean(entry.equipped);
      row.append(equip);
    }

    inventoryList.append(row);
  });
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
    const { data, error } = await arcadeClient.rpc("purchase_shop_item", {
      shop_key: itemKey
    });

    if (error) {
      throw error;
    }

    renderWallet(data);
    await Promise.all([loadShop(), loadMissions()]);
    setArcadeStatus("Achat valide.");
  } catch (error) {
    console.error("Erreur achat:", error);
    setArcadeStatus(String(error && error.message || "").includes("item_already_owned") ? "Objet deja possede." : schemaMissing(error) ? "Relance le SQL Supabase pour la boutique." : "Achat impossible.", true);
  }
}

async function equipItem(itemKey) {
  try {
    setArcadeStatus("Equipement en cours...");
    const { data, error } = await arcadeClient.rpc("equip_shop_item", {
      shop_key: itemKey
    });

    if (error) {
      throw error;
    }

    applyProfileCosmetics(data);
    await refreshAuthProfile();
    await loadShop();
    setArcadeStatus("Cosmetique equipe.");
  } catch (error) {
    console.error("Erreur equipement:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour l'equipement." : "Equipement impossible.", true);
  }
}

async function claimDaily() {
  try {
    dailyButton.disabled = true;
    setArcadeStatus("Claim daily...");
    const { data, error } = await arcadeClient.rpc("claim_daily_reward");

    if (error) {
      throw error;
    }

    renderWallet(data);
    await loadMissions();
    setArcadeStatus("Daily reward ajoute.");
  } catch (error) {
    console.error("Erreur daily:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour les points." : "Daily deja claim ou indisponible.", true);
  } finally {
    dailyButton.disabled = false;
  }
}

async function loadMissions() {
  if (!missionList) {
    return;
  }

  const { data, error } = await arcadeClient.rpc("get_my_missions");

  if (error) {
    throw error;
  }

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
    const { data, error } = await arcadeClient.rpc("claim_mission", {
      mission_key_input: missionKey
    });

    if (error) {
      throw error;
    }

    renderWallet(data);
    await loadMissions();
    setArcadeStatus("Mission claim.");
  } catch (error) {
    console.error("Erreur mission:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour les missions." : "Mission non disponible.", true);
  }
}

async function loadLeaderboard(gameKey = "reflex") {
  const { data, error } = await arcadeClient
    .from("game_scores")
    .select("user_id,game_key,score,reward_points,created_at")
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .limit(8);

  if (error) {
    throw error;
  }

  const userIds = [...new Set((data || []).map((score) => score.user_id))];
  let profiles = [];

  if (userIds.length) {
    const profileResult = await arcadeClient
      .from("profiles")
      .select("id,pseudo")
      .in("id", userIds);
    profiles = profileResult.data || [];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  leaderboardList.replaceChildren();

  if (!data || !data.length) {
    leaderboardList.textContent = "Pas encore de score.";
    return;
  }

  data.forEach((score, index) => {
    const profile = profileById.get(score.user_id);
    const row = createElement("div", "leaderboard-item");
    row.append(
      createElement("strong", "", `${index + 1}. ${profile ? profile.pseudo : "Player"}`),
      createElement("small", "", `${score.score} pts jeu / +${score.reward_points} coins`)
    );
    leaderboardList.append(row);
  });
}

async function awardSoloGame(gameKey, score) {
  if (!SOLO_GAMES.has(gameKey)) {
    return;
  }

  try {
    const { data, error } = await arcadeClient.rpc("complete_solo_game", {
      game_key_input: gameKey,
      score_input: Math.max(0, Math.round(score))
    });

    if (error) {
      throw error;
    }

    renderWallet(data);
    await Promise.all([loadLeaderboard(gameKey), loadMissions()]);
    setArcadeStatus(`Score envoye : ${Math.round(score)}.`);
  } catch (error) {
    console.error("Erreur score:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour les scores." : "Score non enregistre.", true);
  }
}

function finishGame(gameKey, score, message) {
  setArcadeScore(score);
  arcadeControls.replaceChildren(
    createButton("Rejouer", () => startGame(gameKey)),
    createButton("Fermer", closeArcade, "game-button secondary")
  );
  arcadeStage.replaceChildren(createElement("p", "game-message", `${message} Score : ${score}`));
  awardSoloGame(gameKey, score);
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
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour les duels." : "Creation duel impossible.", true);
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
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour le morpion." : "Creation morpion impossible.", true);
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
  } else if (gameKey === "duel") {
    startDuelGame();
  } else if (gameKey === "ttt") {
    startTttGame();
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
  bindArcadeLaunchers();

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeArcade);
  });

  if (dailyButton) {
    dailyButton.addEventListener("click", claimDaily);
  }

  if (leaderboardGame) {
    leaderboardGame.addEventListener("change", () => loadLeaderboard(leaderboardGame.value).catch(() => null));
  }

  try {
    await loadWallet();
    await loadShop();
    await loadMissions();
    await loadLeaderboard(leaderboardGame ? leaderboardGame.value : "reflex");
    setArcadeStatus(`Arcade ${ARCADE_VERSION} prete.`);
  } catch (error) {
    console.error("Erreur arcade:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour activer points/boutique/jeux." : "Arcade indisponible.", true);
  }
}

onReady(() => {
  initArcade().catch((error) => {
    console.error("Erreur arcade init:", error);
    setArcadeStatus("Erreur arcade.", true);
  });
});
