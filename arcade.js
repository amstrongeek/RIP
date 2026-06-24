const ARCADE_VERSION = "20260624-arcade1";
const SOLO_GAMES = new Set(["reflex", "memory", "runner"]);

const walletPoints = document.querySelector("[data-wallet-points]");
const walletLevel = document.querySelector("[data-wallet-level]");
const walletXp = document.querySelector("[data-wallet-xp]");
const walletStreak = document.querySelector("[data-wallet-streak]");
const dailyButton = document.querySelector("[data-daily-reward]");
const arcadeStatus = document.querySelector("[data-arcade-status]");
const shopList = document.querySelector("[data-shop-list]");
const inventoryList = document.querySelector("[data-inventory-list]");
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
let duelPoll = null;
let duelDoneSeen = false;

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

function clearGameRuntime() {
  gameTimers.forEach((timer) => {
    window.clearTimeout(timer);
    window.clearInterval(timer);
  });
  gameTimers = [];

  gameCleanups.forEach((cleanup) => cleanup());
  gameCleanups = [];

  if (duelPoll) {
    window.clearInterval(duelPoll);
    duelPoll = null;
  }

  activeDuel = null;
  duelDoneSeen = false;
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
    const timer = window.setTimeout(resolve, ms);
    gameTimers.push(timer);
  });
}

function schemaMissing(error) {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  return /user_wallets|shop_items|user_inventory|game_scores|game_duels|function|schema|permission|wallet/i.test(message);
}

function renderWallet(wallet) {
  if (!wallet) {
    return;
  }

  walletPoints.textContent = String(wallet.points || 0);
  walletLevel.textContent = String(wallet.level || 1);
  walletXp.textContent = String(wallet.xp || 0);
  walletStreak.textContent = String(wallet.streak || 0);
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
    const buy = createButton(owned.has(item.item_key) ? "Racheter" : "Acheter", () => purchaseItem(item.item_key), "game-button secondary");

    row.append(title, description, price, buy);
    shopList.append(row);
  });
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
      createElement("small", "", `Quantite : ${entry.quantity}`)
    );
    inventoryList.append(row);
  });
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
    await loadShop();
    setArcadeStatus("Achat valide.");
  } catch (error) {
    console.error("Erreur achat:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour la boutique." : "Achat impossible.", true);
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
    setArcadeStatus("Daily reward ajoute.");
  } catch (error) {
    console.error("Erreur daily:", error);
    setArcadeStatus(schemaMissing(error) ? "Relance le SQL Supabase pour les points." : "Daily deja claim ou indisponible.", true);
  } finally {
    dailyButton.disabled = false;
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
    await loadLeaderboard(gameKey);
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
    const timer = window.setTimeout(() => {
      waiting = true;
      readyAt = performance.now();
      pad.classList.add("is-ready");
      pad.textContent = "GO";
    }, delay);
    gameTimers.push(timer);
  };

  pad.addEventListener("click", () => {
    if (!round) {
      nextRound();
      return;
    }

    if (!waiting) {
      score = Math.max(0, score - 120);
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
    const timer = window.setTimeout(nextRound, 700);
    gameTimers.push(timer);
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
      await sleep(420);
      tiles[index].classList.remove("is-lit");
      await sleep(150);
    }

    accepting = true;
    setArcadeStatus(`Memory round ${round}. Reproduis la sequence.`);
  }

  function handlePick(index) {
    if (!accepting) {
      return;
    }

    tiles[index].classList.add("is-picked");
    window.setTimeout(() => tiles[index].classList.remove("is-picked"), 140);

    if (sequence[cursor] !== index) {
      accepting = false;
      finishGame("memory", score, "Mauvaise case.");
      return;
    }

    cursor += 1;

    if (cursor === sequence.length) {
      score += round * 120;
      round += 1;
      const timer = window.setTimeout(showRound, 600);
      gameTimers.push(timer);
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
      obstacles.push({ lane: Math.floor(Math.random() * lanes), row: 0 });
    }

    if (obstacles.some((obstacle) => obstacle.row === rows - 1 && obstacle.lane === lane)) {
      end();
      return;
    }

    draw();
    speed = Math.max(120, speed - 2);
    const timer = window.setTimeout(step, speed);
    gameTimers.push(timer);
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
      loadLeaderboard("reflex").catch(() => null);
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
  } else if (gameKey === "duel") {
    startDuelGame();
  }
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

  arcadeClient = await window.RipSupabase.getClient();

  document.querySelectorAll("[data-open-game]").forEach((button) => {
    button.addEventListener("click", () => startGame(button.getAttribute("data-open-game")));
  });

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
