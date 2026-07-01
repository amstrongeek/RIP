import {
  cashOutLadder,
  createBlackjackTable,
  forfeitBlackjack,
  getBlackjackState,
  getCasinoHealth,
  getLadderState,
  hitBlackjack,
  joinBlackjackTable,
  leaveBlackjackTable,
  setBlackjackBet,
  standBlackjack,
  startBlackjack,
  startLadderGame,
  submitLadderGuess
} from "../../src/services/casino-service.js";

const STORAGE_KEYS = {
  blackjack: "rip.casino.blackjack.game",
  ladder: "rip.casino.ladder.game"
};

const NAV_ITEMS = [
  ["../home/home.html", "Accueil"],
  ["../casino/casino.html", "Casino"],
  ["https://discord.gg/9j5Nxuk2sH", "Discord", "external"]
];

const SUITS = {
  H: { symbol: "\u2665", label: "coeur", color: "red" },
  D: { symbol: "\u2666", label: "carreau", color: "red" },
  C: { symbol: "\u2663", label: "trefle", color: "black" },
  S: { symbol: "\u2660", label: "pique", color: "black" }
};

const BLACKJACK_RESULTS = {
  blackjack: "Blackjack",
  win: "Gagne",
  push: "Egalite",
  lose: "Perdu",
  bust: "Depasse 21",
  forfeit: "Abandon"
};

const state = {
  user: null,
  blackjack: null,
  ladder: null,
  busy: false,
  pollTimer: null
};

function query(selector) {
  return document.querySelector(selector);
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

function formatPoints(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("fr-FR").format(number) : "0";
}

function setStatus(message, type = "ok") {
  const status = query("[data-casino-status]");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.dataset.state = type;
}

function toast(message, type = "success") {
  const stack = query("[data-toast-stack]");
  if (!stack) {
    return;
  }
  const item = createElement("div", `toast ${type}`, message);
  stack.append(item);
  window.setTimeout(() => item.remove(), 3800);
}

function casinoError(error, fallback = "Action impossible.") {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");

  if (/casino_get_health|casino_schema_incomplete|casino_create_blackjack|casino_start_ladder|Could not find the function|PGRST202/i.test(message)) {
    return "Migration Casino absente : applique la derniere version de supabase-chat.sql.";
  }
  if (/not_enough_points/i.test(message)) {
    return "Solde insuffisant pour cette mise.";
  }
  if (/casino_minimum_bet/i.test(message)) {
    return "La mise minimum est de 10 RIP coins.";
  }
  if (/blackjack_table_full/i.test(message)) {
    return "Cette table contient deja quatre joueurs.";
  }
  if (/blackjack_game_not_found/i.test(message)) {
    return "Table introuvable, fermee ou deja lancee.";
  }
  if (/blackjack_bets_missing/i.test(message)) {
    return "Chaque joueur doit miser au moins 10 coins avant le depart.";
  }
  if (/blackjack_host_required/i.test(message)) {
    return "Seul le createur de la table peut lancer la partie.";
  }
  if (/blackjack_action_unavailable/i.test(message)) {
    return "Cette main est deja terminee.";
  }
  if (/ladder_cashout_unavailable/i.test(message)) {
    return "Valide au moins une manche avant d'encaisser.";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "Supabase est inaccessible depuis le navigateur.";
  }
  return message ? `${fallback} ${message.slice(0, 130)}` : fallback;
}

function setWallet(points) {
  document.querySelectorAll("[data-wallet-points], [data-header-points]").forEach((element) => {
    element.textContent = formatPoints(points);
  });
  document.querySelectorAll("[data-header-euro]").forEach((element) => {
    element.textContent = `~${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(points || 0) * 0.0001)}`;
  });
}

async function refreshWallet() {
  if (!state.user || !window.RipData) {
    setWallet(0);
    return;
  }

  try {
    const wallet = await window.RipData.getWallet();
    setWallet(wallet && wallet.points);
  } catch (error) {
    console.error("Casino wallet:", error);
  }
}

function routePath(value) {
  return new URL(value, window.location.href).pathname.replace(/\/index\.html$/, "/");
}

async function buildNavigation() {
  const nav = query("[data-main-nav]");
  if (!nav) {
    return;
  }

  nav.replaceChildren();
  NAV_ITEMS.forEach(([href, label, access]) => {
    const link = createElement("a", "", label);
    link.href = href;
    if (access === "external") {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    if (routePath(link.href) === routePath(window.location.href)) {
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  });
}

function bindNavigation() {
  const button = query("[data-nav-toggle]");
  const nav = query("[data-main-nav]");
  if (!button || !nav) {
    return;
  }

  nav.id = "casino-main-navigation";
  nav.dataset.open = "false";
  button.setAttribute("aria-controls", nav.id);

  const close = () => {
    nav.dataset.open = "false";
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = nav.dataset.open !== "true";
    nav.dataset.open = String(open);
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) {
      close();
    }
  });

  document.addEventListener("click", (event) => {
    if (nav.dataset.open === "true" && !nav.contains(event.target) && !button.contains(event.target)) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.dataset.open === "true") {
      close();
      button.focus();
    }
  });
}

function renderHeaderAccount() {
  const user = state.user;
  document.querySelectorAll("[data-auth-visible='guest']").forEach((element) => {
    element.hidden = Boolean(user);
  });
  document.querySelectorAll("[data-auth-visible='user']").forEach((element) => {
    element.hidden = !user;
  });

  if (!user) {
    return;
  }

  const name = query("[data-header-name]");
  const avatar = query("[data-header-avatar]");
  if (name) {
    name.textContent = user.pseudo || "Compte";
  }
  if (!avatar) {
    return;
  }

  avatar.replaceChildren();
  avatar.style.setProperty("--avatar-color", user.avatarColor || "#39ff88");
  if (user.avatarUrl) {
    const image = document.createElement("img");
    image.src = user.avatarUrl;
    image.alt = "";
    avatar.append(image);
  } else {
    avatar.textContent = String(user.pseudo || "P").slice(0, 1).toUpperCase();
  }
}

function bindTabs() {
  document.querySelectorAll("[data-casino-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.casinoTab;
      document.querySelectorAll("[data-casino-tab]").forEach((candidate) => {
        candidate.setAttribute("aria-selected", String(candidate === button));
      });
      document.querySelectorAll("[data-game-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.gamePanel !== selected;
      });
    });
  });
}

function selectRequestedGame() {
  const requested = new URLSearchParams(window.location.search).get("game");
  if (!['blackjack', 'ladder'].includes(requested)) return;
  document.querySelectorAll("[data-casino-tab]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.casinoTab === requested));
  });
  document.querySelectorAll("[data-game-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.gamePanel !== requested;
  });
}

function parseCard(cardCode) {
  const code = String(cardCode || "");
  if (code === "HIDDEN") {
    return { hidden: true };
  }
  const suitCode = code.slice(-1);
  return {
    hidden: false,
    rank: code.slice(0, -1),
    suit: SUITS[suitCode] || SUITS.S
  };
}

function createCard(cardCode) {
  const card = parseCard(cardCode);
  if (card.hidden) {
    const hidden = createElement("span", "playing-card hidden-card");
    hidden.setAttribute("aria-label", "Carte cachee");
    return hidden;
  }

  const element = createElement("span", "playing-card");
  element.dataset.color = card.suit.color;
  element.setAttribute("aria-label", `${card.rank} de ${card.suit.label}`);
  element.append(
    createElement("span", "playing-card-rank", card.rank),
    createElement("span", "playing-card-suit", card.suit.symbol)
  );
  return element;
}

function renderCards(container, cards) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  (cards || []).forEach((card) => container.append(createCard(card)));
}

function actionButton(label, handler, variant = "primary") {
  const button = createElement("button", `button ${variant}`, label);
  button.type = "button";
  button.disabled = state.busy;
  button.addEventListener("click", handler);
  return button;
}

function renderSeat(player, seat, myUserId) {
  if (!player) {
    const empty = createElement("article", "player-seat is-empty", `Place ${seat} libre`);
    return empty;
  }

  const element = createElement("article", "player-seat");
  if (player.user_id === myUserId) {
    element.classList.add("is-me");
  }

  const identity = createElement("div", "seat-player");
  const avatar = createElement("span", "seat-avatar", String(player.pseudo || "P").slice(0, 1).toUpperCase());
  avatar.style.setProperty("--avatar-color", player.avatar_color || "#39ff88");
  if (player.avatar_url) {
    avatar.replaceChildren();
    const image = document.createElement("img");
    image.src = player.avatar_url;
    image.alt = "";
    avatar.append(image);
  }
  identity.append(avatar, createElement("strong", "seat-name", player.pseudo || "Player"));

  const cards = createElement("div", "playing-cards");
  renderCards(cards, player.cards || []);

  const meta = createElement("div", "seat-meta");
  const bet = createElement("span", "", `${formatPoints(player.bet)} coins`);
  const result = createElement("strong", "seat-result");
  result.dataset.result = player.result || "";
  if (player.result) {
    result.textContent = `${BLACKJACK_RESULTS[player.result] || player.result}${Number(player.payout) > 0 ? ` +${formatPoints(player.payout)}` : ""}`;
  } else if ((player.cards || []).length) {
    result.textContent = `${player.total} pts`;
  } else {
    result.textContent = Number(player.bet) >= 10 ? "Mise prete" : "Mise requise";
  }
  meta.append(bet, result);

  element.append(identity, cards, meta);
  return element;
}

function blackjackPhaseLabel(gameStatus) {
  return {
    waiting: "Salon ouvert",
    playing: "Partie en cours",
    done: "Resultats",
    cancelled: "Table fermee"
  }[gameStatus] || "Table";
}

function renderBlackjack() {
  const game = state.blackjack;
  const entry = query("[data-blackjack-entry]");
  const table = query("[data-blackjack-table]");

  entry.hidden = Boolean(game);
  table.hidden = !game;
  if (!game) {
    return;
  }

  query("[data-blackjack-code]").textContent = game.code || "------";
  query("[data-blackjack-phase]").textContent = blackjackPhaseLabel(game.status);
  setWallet(game.wallet_points);

  const dealerTotal = query("[data-dealer-total]");
  dealerTotal.textContent = game.dealer_total === null || game.dealer_total === undefined ? "--" : String(game.dealer_total);
  renderCards(query("[data-dealer-cards]"), game.dealer_cards || []);

  const players = query("[data-blackjack-players]");
  const bySeat = new Map((game.players || []).map((player) => [Number(player.seat), player]));
  players.replaceChildren();
  for (let seat = 1; seat <= 4; seat += 1) {
    players.append(renderSeat(bySeat.get(seat), seat, game.my_user_id));
  }

  const me = (game.players || []).find((player) => player.user_id === game.my_user_id);
  const betForm = query("[data-blackjack-bet-form]");
  betForm.hidden = game.status !== "waiting";
  if (me && game.status === "waiting") {
    betForm.elements.bet.value = Number(me.bet) >= 10 ? String(me.bet) : "10";
  }

  const actions = query("[data-blackjack-actions]");
  actions.replaceChildren();

  if (game.status === "waiting") {
    if (game.is_host) {
      const start = actionButton("Distribuer", () => runBlackjack("Distribution...", () => startBlackjack(game.id)));
      start.disabled = state.busy || !game.can_start;
      actions.append(start);
    }
    actions.append(actionButton(game.is_host ? "Fermer la table" : "Quitter", leaveCurrentBlackjack, "danger"));
  } else if (game.status === "playing" && me && me.hand_state === "playing") {
    actions.append(
      actionButton("Carte", () => runBlackjack("Tirage...", () => hitBlackjack(game.id))),
      actionButton("Rester", () => runBlackjack("Main validee...", () => standBlackjack(game.id)), "secondary"),
      actionButton("Abandonner", () => runBlackjack("Abandon...", () => forfeitBlackjack(game.id)), "danger")
    );
  } else if (game.status === "playing") {
    actions.append(createElement("span", "table-phase", "En attente des autres mains"));
  } else {
    actions.append(actionButton("Nouvelle table", resetBlackjack, "secondary"));
  }
}

async function runBlackjack(progressMessage, action) {
  if (state.busy) {
    return;
  }
  state.busy = true;
  setStatus(progressMessage, "loading");
  renderBlackjack();
  try {
    state.blackjack = await action();
    if (state.blackjack && state.blackjack.id) {
      window.localStorage.setItem(STORAGE_KEYS.blackjack, state.blackjack.id);
      setWallet(state.blackjack.wallet_points);
    }
    setStatus("Table synchronisee.", "ok");
  } catch (error) {
    console.error("Casino blackjack:", error);
    const message = casinoError(error, "Action blackjack impossible.");
    setStatus(message, "error");
    toast(message, "error");
  } finally {
    state.busy = false;
    renderBlackjack();
  }
}

async function leaveCurrentBlackjack() {
  if (!state.blackjack || state.busy) {
    return;
  }
  state.busy = true;
  setStatus("Fermeture de la place...", "loading");
  try {
    await leaveBlackjackTable(state.blackjack.id);
    resetBlackjack();
    await refreshWallet();
    setStatus("Table quittee. Les mises du salon ont ete remboursees.", "ok");
  } catch (error) {
    console.error("Casino leave:", error);
    setStatus(casinoError(error, "Impossible de quitter la table."), "error");
  } finally {
    state.busy = false;
    renderBlackjack();
  }
}

function resetBlackjack() {
  state.blackjack = null;
  window.localStorage.removeItem(STORAGE_KEYS.blackjack);
  renderBlackjack();
}

function bindBlackjack() {
  query("[data-blackjack-create]").addEventListener("click", () => {
    runBlackjack("Creation de la table...", createBlackjackTable);
  });

  query("[data-blackjack-join-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    runBlackjack("Connexion a la table...", () => joinBlackjackTable(code));
  });

  query("[data-blackjack-bet-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.blackjack) {
      return;
    }
    const bet = Number(new FormData(event.currentTarget).get("bet"));
    if (!Number.isSafeInteger(bet) || bet < 10) {
      toast("La mise doit etre un nombre entier superieur ou egal a 10.", "error");
      return;
    }
    runBlackjack("Validation de la mise...", () => setBlackjackBet(state.blackjack.id, bet));
  });

  query("[data-blackjack-copy]").addEventListener("click", async () => {
    if (!state.blackjack) {
      return;
    }
    try {
      await navigator.clipboard.writeText(state.blackjack.code);
      toast("Code de table copie.");
    } catch (error) {
      toast(`Code : ${state.blackjack.code}`);
    }
  });
}

function ladderRoundData(round) {
  return [
    { label: "Rouge / Noir", multiplier: 2 },
    { label: "Plus / Moins", multiplier: 3 },
    { label: "Dedans / Dehors", multiplier: 4 },
    { label: "Couleur", multiplier: 20 }
  ][round - 1];
}

function renderLadderProgress(game) {
  const progress = query("[data-ladder-progress]");
  progress.replaceChildren();
  for (let round = 1; round <= 4; round += 1) {
    const data = ladderRoundData(round);
    const item = createElement("span", "ladder-step");
    let stepState = "pending";
    if (round < Number(game.round_no) || (game.status === "won" && round === 4)) {
      stepState = "done";
    } else if (round === Number(game.round_no) && game.status === "playing") {
      stepState = "active";
    }
    item.dataset.state = stepState;
    item.append(createElement("span", "", data.label), createElement("strong", "", `x${data.multiplier}`));
    progress.append(item);
  }
}

function ladderQuestion(game) {
  if (game.status === "won") {
    return `Jackpot x20 : ${formatPoints(game.payout)} coins verses.`;
  }
  if (game.status === "cashed_out") {
    return `Gain encaisse : ${formatPoints(game.payout)} coins.`;
  }
  if (game.status === "lost") {
    return "Mauvaise reponse. La mise est perdue.";
  }

  if (Number(game.round_no) === 1) {
    return "La premiere carte sera-t-elle rouge ou noire ?";
  }
  if (Number(game.round_no) === 2) {
    return "La prochaine carte sera-t-elle plus haute ou plus basse ? Une egalite perd.";
  }
  if (Number(game.round_no) === 3) {
    return "La prochaine valeur sera-t-elle strictement entre les deux dernieres, ou dehors ?";
  }
  return "Quelle sera la couleur de la prochaine carte ?";
}

function ladderChoice(label, guess) {
  return actionButton(label, () => runLadder("Tirage serveur...", () => submitLadderGuess(state.ladder.id, guess)));
}

function renderLadderActions(game) {
  const actions = query("[data-ladder-actions]");
  actions.replaceChildren();

  if (game.status !== "playing") {
    actions.append(actionButton("Rejouer", resetLadder, "secondary"));
    return;
  }

  const round = Number(game.round_no);
  if (round === 1) {
    actions.append(ladderChoice("Rouge", "red"), ladderChoice("Noir", "black"));
  } else if (round === 2) {
    actions.append(ladderChoice("Plus haute", "higher"), ladderChoice("Plus basse", "lower"));
  } else if (round === 3) {
    actions.append(ladderChoice("Entre les deux", "inside"), ladderChoice("En dehors", "outside"));
  } else {
    actions.append(
      ladderChoice("Coeur", "H"),
      ladderChoice("Carreau", "D"),
      ladderChoice("Trefle", "C"),
      ladderChoice("Pique", "S")
    );
  }

  if (Number(game.current_multiplier) > 1) {
    actions.append(actionButton(
      `Encaisser x${game.current_multiplier}`,
      () => runLadder("Encaissement...", () => cashOutLadder(game.id)),
      "secondary"
    ));
  }
}

function renderLadder() {
  const game = state.ladder;
  const entry = query("[data-ladder-entry]");
  const table = query("[data-ladder-table]");
  entry.hidden = Boolean(game);
  table.hidden = !game;
  if (!game) {
    return;
  }

  setWallet(game.wallet_points);
  renderLadderProgress(game);
  renderCards(query("[data-ladder-cards]"), game.revealed_cards || []);
  query("[data-ladder-question]").textContent = ladderQuestion(game);

  const multiplier = Number(game.current_multiplier || 1);
  const currentValue = game.status === "lost"
    ? 0
    : Number(game.payout) > 0
      ? Number(game.payout)
      : Number(game.wager || 0) * multiplier;
  query("[data-ladder-value]").textContent = `${formatPoints(currentValue)} coins`;
  query("[data-ladder-multiplier]").textContent = `x${multiplier}`;
  renderLadderActions(game);
}

async function runLadder(progressMessage, action) {
  if (state.busy) {
    return;
  }
  state.busy = true;
  setStatus(progressMessage, "loading");
  renderLadder();
  try {
    state.ladder = await action();
    if (state.ladder && state.ladder.id) {
      window.localStorage.setItem(STORAGE_KEYS.ladder, state.ladder.id);
      setWallet(state.ladder.wallet_points);
    }
    setStatus("Tirage valide par le serveur.", "ok");
  } catch (error) {
    console.error("Casino ladder:", error);
    const message = casinoError(error, "Tirage impossible.");
    setStatus(message, "error");
    toast(message, "error");
  } finally {
    state.busy = false;
    renderLadder();
  }
}

function resetLadder() {
  state.ladder = null;
  window.localStorage.removeItem(STORAGE_KEYS.ladder);
  renderLadder();
  refreshWallet();
}

function bindLadder() {
  query("[data-ladder-start-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const wager = Number(new FormData(event.currentTarget).get("wager"));
    if (!Number.isSafeInteger(wager) || wager < 10) {
      toast("La mise doit etre un nombre entier superieur ou egal a 10.", "error");
      return;
    }
    runLadder("Melange du paquet...", () => startLadderGame(wager));
  });
}

async function restoreGames() {
  const blackjackId = window.localStorage.getItem(STORAGE_KEYS.blackjack);
  const ladderId = window.localStorage.getItem(STORAGE_KEYS.ladder);
  const tasks = [];

  if (blackjackId) {
    tasks.push(
      getBlackjackState(blackjackId)
        .then((game) => {
          state.blackjack = game;
        })
        .catch((error) => {
          console.warn("Ancienne table blackjack indisponible:", error);
          window.localStorage.removeItem(STORAGE_KEYS.blackjack);
        })
    );
  }

  if (ladderId) {
    tasks.push(
      getLadderState(ladderId)
        .then((game) => {
          state.ladder = game;
        })
        .catch((error) => {
          console.warn("Ancienne partie x20 indisponible:", error);
          window.localStorage.removeItem(STORAGE_KEYS.ladder);
        })
    );
  }

  await Promise.all(tasks);
  renderBlackjack();
  renderLadder();
}

function startPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
  }

  state.pollTimer = window.setInterval(async () => {
    if (!state.user || state.busy || document.hidden) {
      return;
    }

    const tasks = [];
    if (state.blackjack && ["waiting", "playing"].includes(state.blackjack.status)) {
      tasks.push(
        getBlackjackState(state.blackjack.id).then((game) => {
          state.blackjack = game;
          renderBlackjack();
        })
      );
    }
    if (state.ladder && state.ladder.status === "playing") {
      tasks.push(
        getLadderState(state.ladder.id).then((game) => {
          state.ladder = game;
          renderLadder();
        })
      );
    }
    if (tasks.length) {
      await Promise.allSettled(tasks);
    }
  }, 1800);
}

async function initializeCasino() {
  query("#year").textContent = String(new Date().getFullYear());
  bindNavigation();
  bindTabs();
  selectRequestedGame();
  bindBlackjack();
  bindLadder();

  try {
    await window.RipAuth.ready();
    state.user = window.RipAuth.currentUser();
  } catch (error) {
    console.error("Casino auth:", error);
    state.user = null;
  }

  renderHeaderAccount();
  await buildNavigation();

  const gate = query("[data-auth-gate]");
  const consoleElement = query("[data-casino-console]");
  gate.hidden = Boolean(state.user);
  consoleElement.hidden = !state.user;

  if (!state.user) {
    setStatus("Connecte-toi pour ouvrir le casino.", "error");
    return;
  }

  await refreshWallet();
  try {
    const health = await getCasinoHealth();
    if (!health || !health.ready) {
      throw new Error("casino_schema_incomplete");
    }
    await restoreGames();
    startPolling();
    setStatus("Casino pret. Les tirages sont executes par Supabase.", "ok");
  } catch (error) {
    setStatus(casinoError(error, "Migration Casino absente."), "error");
  }
}

document.addEventListener("rip-auth-change", async (event) => {
  state.user = event.detail || null;
  renderHeaderAccount();
  await buildNavigation();
});

initializeCasino().catch((error) => {
  console.error("Casino init:", error);
  setStatus(casinoError(error, "Initialisation du casino impossible."), "error");
});
