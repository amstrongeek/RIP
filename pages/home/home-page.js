import {
  activateCasinoBoost,
  claimWelcomeBonus,
  getCasinoBoosts,
  getCasinoHealth,
  getCasinoLiveFeed,
  playInstantGame
} from "../../src/services/casino-service.js";
import { casinoAudio } from "../../src/services/casino-audio-service.js?v=20260702-audio2";
import { initializeAds } from "../../src/services/ad-service.js?v=20260702-ads1";

const EURO_PER_POINT = 0.0001;
const ADVANCED_GAMES = new Set(["blackjack", "ladder"]);
const SYMBOLS = {
  comet: "COMETE",
  moon: "LUNE",
  star: "ETOILE",
  crown: "COURONNE",
  seven: "7",
  diamond: "DIAMANT"
};

const GAMES = {
  roulette: {
    maxMultiplier: 36,
    title: "Cosmic Roulette",
    kicker: "Roulette serveur",
    description: "Rouge ou noir paie x2. Un numero exact paie x36.",
    choices: [
      { label: "Rouge", value: "red", className: "red-choice" },
      { label: "Noir", value: "black", className: "black-choice" }
    ]
  },
  slots: {
    maxMultiplier: 20,
    title: "Nebula Slots",
    kicker: "Trois rouleaux",
    description: "Deux symboles identiques paient x1.5. Trois symboles peuvent atteindre x20."
  },
  baccarat: {
    maxMultiplier: 8,
    title: "Mini Baccarat",
    kicker: "Le plus proche de neuf",
    description: "Choisis le joueur, la banque ou une egalite.",
    choices: [
      { label: "Joueur x2", value: "player" },
      { label: "Banque x1.95", value: "banker" },
      { label: "Egalite x8", value: "tie" }
    ]
  },
  dice: {
    maxMultiplier: 5,
    title: "Star Dice",
    kicker: "Deux des",
    description: "Parie sur une somme inferieure a sept, superieure a sept, ou sept exact.",
    choices: [
      { label: "Moins de 7", value: "under" },
      { label: "7 exact x5", value: "seven" },
      { label: "Plus de 7", value: "over" }
    ]
  },
  coin: {
    maxMultiplier: 1.9,
    title: "Quantum Coin",
    kicker: "Pile ou face",
    description: "Un lancer serveur instantane. Le bon cote paie x1.9.",
    choices: [
      { label: "Face", value: "heads" },
      { label: "Pile", value: "tails" }
    ]
  },
  wheel: {
    maxMultiplier: 5,
    title: "Lucky Orbit",
    kicker: "Roue cosmique",
    description: "Vingt segments et un multiplicateur pouvant atteindre x5."
  },
  mines: {
    maxMultiplier: 3,
    title: "Asteroid Mines",
    kicker: "Trois cases a choisir",
    description: "Selectionne exactement trois cases. Si aucune ne contient une mine, tu gagnes x3."
  },
  poker: {
    maxMultiplier: 25,
    title: "Three Card Poker",
    kicker: "Main automatique",
    description: "Trois cartes sans remise. Paire, couleur, suite, brelan ou suite couleur."
  }
};

const state = {
  user: null,
  wallet: null,
  gameKey: "",
  selectedValue: "",
  selectedType: "",
  selectedMines: new Set(),
  busy: false,
  boosts: null,
  lastWager: Number(window.localStorage.getItem("rip.casino.last-wager") || 10)
};

const BOOSTS = {
  shield: { name: "Bouclier", badge: "50%", description: "Rembourse la moitie de la prochaine mise perdante." },
  turbo: { name: "Turbo", badge: "+10%", description: "Ajoute 10% au prochain retour gagnant." },
  free_bet: { name: "Mise libre", badge: "FREE", description: "Rembourse la mise du prochain tirage." }
};

function query(selector) {
  return document.querySelector(selector);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatPoints(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function formatEuro(points) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(points || 0) * EURO_PER_POINT);
}

function setStatus(message, type = "ok") {
  const element = query("[data-casino-status]");
  element.textContent = message;
  element.dataset.state = type;
}

function toast(message, type = "success") {
  const item = createElement("div", `toast ${type}`, message);
  query("[data-toast-stack]").append(item);
  window.setTimeout(() => item.remove(), 3600);
}

function errorMessage(error) {
  const message = String(error && (error.message || error.details || error.code) || "");
  if (/casino_get_health|casino_play_boosted|casino_claim_welcome_bonus|PGRST202|Could not find the function/i.test(message)) {
    return "La migration Casino doit etre appliquee dans Supabase.";
  }
  if (/not_enough_points/i.test(message)) return "Tu n'as pas assez de points pour cette mise.";
  if (/casino_minimum_bet/i.test(message)) return "La mise minimum est de 10 points.";
  if (/casino_invalid_choice/i.test(message)) return "Choix incomplet ou invalide.";
  if (/casino_boost_already_active/i.test(message)) return "Un boost est deja arme.";
  if (/casino_boost_empty/i.test(message)) return "Ce boost est epuise.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Supabase est momentanement inaccessible.";
  return message ? `Action impossible : ${message.slice(0, 120)}` : "Action impossible.";
}

function renderWallet(wallet) {
  state.wallet = wallet || state.wallet || { points: 0 };
  const points = Number(state.wallet.points || 0);
  query("[data-wallet-points]").textContent = formatPoints(points);
  query("[data-wallet-euro]").textContent = `~${formatEuro(points)}`;
}

function renderAccount() {
  document.querySelectorAll("[data-auth-only]").forEach((element) => {
    element.hidden = !state.user;
  });
  document.querySelectorAll("[data-guest-only]").forEach((element) => {
    element.hidden = Boolean(state.user);
  });

  if (!state.user) return;

  query("[data-account-name]").textContent = state.user.pseudo || "Compte";
  query("[data-menu-name]").textContent = state.user.pseudo || "Compte";
  query("[data-menu-email]").textContent = state.user.email || "";

  const avatar = query("[data-account-avatar]");
  avatar.replaceChildren();
  avatar.style.setProperty("--avatar", state.user.avatarColor || "#39ff88");
  if (state.user.avatarUrl) {
    const image = document.createElement("img");
    image.src = state.user.avatarUrl;
    image.alt = "";
    avatar.append(image);
  } else {
    avatar.textContent = String(state.user.pseudo || "P").slice(0, 1).toUpperCase();
  }
}

function renderBoosts(data = state.boosts) {
  state.boosts = data;
  const list = query("[data-boost-list]");
  if (!list || !data) return;
  const inventory = data.inventory || {};
  const progress = data.progress || {};
  list.replaceChildren();

  Object.entries(BOOSTS).forEach(([key, config]) => {
    const button = createElement("button", "boost-card");
    button.type = "button";
    button.dataset.boost = key;
    button.dataset.active = String(progress.active_boost === key);
    button.disabled = Boolean(progress.active_boost) || Number(inventory[key] || 0) < 1;
    button.title = config.description;
    button.append(
      createElement("span", "boost-badge", config.badge),
      createElement("strong", "", config.name),
      createElement("small", "", progress.active_boost === key ? "ARME" : `x${Number(inventory[key] || 0)}`)
    );
    button.addEventListener("click", () => activateBoost(key));
    list.append(button);
  });

  const modulo = Number(progress.rounds_played || 0) % 8;
  const nextReward = modulo === 0 ? 8 : 8 - modulo;
  query("[data-boost-progress]").textContent = `${formatPoints(progress.rounds_played)} parties · serie ${formatPoints(progress.win_streak)} · boost dans ${nextReward}`;
}

async function activateBoost(key) {
  try {
    renderBoosts(await activateCasinoBoost(key));
    await casinoAudio.play("boost");
    toast(`${BOOSTS[key].name} arme pour le prochain tirage eligible.`);
  } catch (error) {
    toast(errorMessage(error), "error");
  }
}

function renderLiveFeed(rounds) {
  const track = query("[data-live-feed]");
  if (!track) return;
  track.replaceChildren();
  if (!rounds || !rounds.length) {
    track.append(createElement("span", "", "Aucun gain public pour le moment."));
    return;
  }
  rounds.forEach((round) => {
    track.append(createElement(
      "span",
      "live-win",
      `${round.pseudo} · ${GAMES[round.game_key]?.title || round.game_key} · +${formatPoints(Number(round.payout) - Number(round.wager))}`
    ));
  });
}

async function loadCasino() {
  if (!state.user) {
    setStatus("Connecte-toi pour recevoir 10 000 points gratuits et jouer.", "ok");
    return;
  }

  try {
    const walletBefore = await window.RipData.getWallet();
    renderWallet(walletBefore);

    const health = await getCasinoHealth();
    if (!health || !health.ready) throw new Error("casino_schema_incomplete");

    const walletAfter = await claimWelcomeBonus();
    renderWallet(walletAfter);
    if (Number(walletAfter.points || 0) - Number(walletBefore.points || 0) >= 10000) {
      toast("Bonus de bienvenue : +10 000 points.");
    }
    const [boosts, feed] = await Promise.all([getCasinoBoosts(), getCasinoLiveFeed(12)]);
    renderBoosts(boosts);
    renderLiveFeed(feed);
    setStatus("Casino pret · 10 jeux · matchmaking public · points virtuels.", "ok");
  } catch (error) {
    console.error("Initialisation casino:", error);
    setStatus(errorMessage(error), "error");
  }
}

function bindAccountMenu() {
  const button = query("[data-account-button]");
  const menu = query("[data-account-menu]");

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });

  query("[data-logout]").addEventListener("click", async () => {
    await window.RipAuth.logout();
    window.location.reload();
  });
}

function choiceButton(choice) {
  const button = createElement("button", `choice-button ${choice.className || ""}`, choice.label);
  button.type = "button";
  button.dataset.value = choice.value;
  button.dataset.selected = String(state.selectedValue === choice.value && state.selectedType !== "number");
  button.addEventListener("click", () => {
    casinoAudio.play("click");
    state.selectedValue = choice.value;
    state.selectedType = state.gameKey === "roulette" ? "color" : "value";
    renderChoices();
    renderPotential();
  });
  return button;
}

function renderChoices() {
  const zone = query("[data-choice-zone]");
  const config = GAMES[state.gameKey];
  zone.replaceChildren();

  if (config.choices) {
    const grid = createElement("div", "choice-grid");
    config.choices.forEach((choice) => grid.append(choiceButton(choice)));
    zone.append(grid);
  }

  if (state.gameKey === "roulette") {
    const numberInput = createElement("input", "roulette-number");
    numberInput.type = "number";
    numberInput.min = "0";
    numberInput.max = "36";
    numberInput.placeholder = "Numero de 0 a 36";
    if (state.selectedType === "number") numberInput.value = state.selectedValue;
    numberInput.addEventListener("input", () => {
      if (numberInput.value !== "") {
        state.selectedType = "number";
        state.selectedValue = numberInput.value;
        zone.querySelectorAll(".choice-button").forEach((button) => {
          button.dataset.selected = "false";
        });
        renderPotential();
      }
    });
    zone.append(numberInput);
  }

  if (state.gameKey === "mines") {
    const grid = createElement("div", "mine-grid");
    for (let cell = 0; cell < 16; cell += 1) {
      const button = createElement("button", "mine-cell", String(cell + 1));
      button.type = "button";
      button.dataset.selected = String(state.selectedMines.has(cell));
      button.addEventListener("click", () => {
        casinoAudio.play("click");
        if (state.selectedMines.has(cell)) {
          state.selectedMines.delete(cell);
        } else if (state.selectedMines.size < 3) {
          state.selectedMines.add(cell);
        } else {
          toast("Choisis exactement trois cases.", "error");
        }
        renderChoices();
      });
      grid.append(button);
    }
    zone.append(grid);
  }

  if (!config.choices && state.gameKey !== "mines") {
    zone.append(createElement("p", "dialog-hint", "Aucun choix supplementaire : le serveur effectue le tirage."));
  }
}

function selectedMultiplier() {
  if (state.gameKey === "roulette") return state.selectedType === "number" ? 36 : 2;
  if (state.gameKey === "baccarat") return { player: 2, banker: 1.95, tie: 8 }[state.selectedValue] || 2;
  if (state.gameKey === "dice") return state.selectedValue === "seven" ? 5 : 2;
  return GAMES[state.gameKey]?.maxMultiplier || 1;
}

function renderPotential() {
  const wager = Math.max(0, Number(query("#game-wager")?.value || 0));
  const output = query("[data-potential-payout]");
  if (output) output.textContent = `${formatPoints(Math.floor(wager * selectedMultiplier()))} points`;
}

function setWager(value) {
  const input = query("#game-wager");
  if (!input) return;
  const wallet = Number(state.wallet?.points || 0);
  input.value = String(Math.max(10, Math.min(Math.trunc(Number(value) || 10), Math.max(10, wallet))));
  renderPotential();
}

function setStage(mode, result = null) {
  const stage = query("[data-game-stage]");
  const core = query("[data-stage-core]");
  const label = query("[data-stage-label]");
  if (!stage || !core || !label) return;
  stage.dataset.game = state.gameKey;
  stage.dataset.state = mode;
  core.replaceChildren();

  if (mode === "idle") {
    core.textContent = GAMES[state.gameKey]?.title?.slice(0, 3).toUpperCase() || "RIP";
    label.textContent = "Configure ta mise";
    return;
  }
  if (mode === "spinning") {
    core.append(...["?", "?", "?"].map((value) => createElement("span", "stage-tile", value)));
    label.textContent = "Le serveur effectue le tirage...";
    return;
  }

  const outcome = result?.outcome || {};
  let values = ["RIP"];
  if (result?.game_key === "roulette") values = [String(outcome.number)];
  if (result?.game_key === "slots") values = (outcome.reels || []).map((item) => (SYMBOLS[item] || item).slice(0, 3));
  if (result?.game_key === "baccarat") values = [`P${outcome.player}`, `B${outcome.banker}`];
  if (result?.game_key === "dice") values = (outcome.dice || []).map(String);
  if (result?.game_key === "coin") values = [outcome.side === "heads" ? "FACE" : "PILE"];
  if (result?.game_key === "wheel") values = [`x${outcome.multiplier}`];
  if (result?.game_key === "mines") values = [outcome.safe ? "SAFE" : "MINE"];
  if (result?.game_key === "poker") values = outcome.cards || [];
  core.append(...values.map((value) => createElement("span", "stage-tile", value)));
  label.textContent = Number(result?.payout || 0) > Number(result?.wager || 0) ? "GAIN CONFIRME" : "TIRAGE TERMINE";
}

function celebrate() {
  const layer = createElement("div", "celebration-layer");
  layer.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 32; index += 1) {
    const particle = createElement("span", "");
    particle.style.setProperty("--x", `${(index * 47) % 100}%`);
    particle.style.setProperty("--delay", `${(index % 8) * 45}ms`);
    particle.style.setProperty("--color", ["#39ff88", "#ff3cb4", "#ffe54d", "#57dfff"][index % 4]);
    layer.append(particle);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 1800);
}

function openGame(gameKey) {
  if (ADVANCED_GAMES.has(gameKey)) {
    const tab = gameKey === "ladder" ? "ladder" : "blackjack";
    window.location.href = `../casino/casino.html?game=${tab}`;
    return;
  }

  const config = GAMES[gameKey];
  if (!config) return;

  state.gameKey = gameKey;
  state.selectedMines.clear();
  state.selectedType = "";
  state.selectedValue = "";
  if (config.choices && config.choices.length) {
    state.selectedValue = config.choices[0].value;
    state.selectedType = gameKey === "roulette" ? "color" : "value";
  }

  query("[data-dialog-kicker]").textContent = config.kicker;
  query("[data-dialog-title]").textContent = config.title;
  query("[data-dialog-description]").textContent = config.description;
  query("[data-game-result]").hidden = true;
  query("[data-game-form]").hidden = !state.user;
  query("[data-dialog-login]").hidden = Boolean(state.user);
  renderChoices();
  setWager(state.lastWager);
  setStage("idle");

  const dialog = query("[data-game-dialog]");
  dialog.showModal();
  document.body.classList.add("dialog-open");
}

function closeDialog() {
  const dialog = query("[data-game-dialog]");
  if (dialog.open) dialog.close();
  document.body.classList.remove("dialog-open");
}

function buildChoice() {
  if (state.gameKey === "mines") {
    if (state.selectedMines.size !== 3) throw new Error("casino_invalid_choice");
    return { cells: [...state.selectedMines].sort((a, b) => a - b) };
  }
  if (["slots", "wheel", "poker"].includes(state.gameKey)) return {};
  if (!state.selectedValue) throw new Error("casino_invalid_choice");
  if (state.gameKey === "roulette") return { type: state.selectedType, value: state.selectedValue };
  return { value: state.selectedValue };
}

function resultText(result) {
  const outcome = result.outcome || {};
  if (result.game_key === "roulette") return `Numero ${outcome.number} · ${outcome.color}`;
  if (result.game_key === "slots") return (outcome.reels || []).map((symbol) => SYMBOLS[symbol] || symbol).join(" · ");
  if (result.game_key === "baccarat") return `Joueur ${outcome.player} · Banque ${outcome.banker} · ${outcome.winner}`;
  if (result.game_key === "dice") return `Des ${(outcome.dice || []).join(" + ")} = ${outcome.sum}`;
  if (result.game_key === "coin") return outcome.side === "heads" ? "FACE" : "PILE";
  if (result.game_key === "wheel") return `Segment ${outcome.segment} · multiplicateur x${outcome.multiplier}`;
  if (result.game_key === "mines") return outcome.safe
    ? "Tes trois cases sont sures."
    : `Mine touchee. Mines : ${(outcome.mines || []).map((cell) => Number(cell) + 1).join(", ")}`;
  if (result.game_key === "poker") return `${(outcome.cards || []).join(" · ")} · ${String(outcome.hand || "high").replaceAll("_", " ")}`;
  return "Tirage termine.";
}

function renderResult(result) {
  const panel = query("[data-game-result]");
  panel.replaceChildren();
  panel.hidden = false;
  panel.dataset.result = Number(result.payout || 0) > Number(result.wager || 0) ? "win" : "lose";

  const title = Number(result.payout || 0) > 0
    ? `Retour : ${formatPoints(result.payout)} points`
    : "Aucun gain sur ce tirage";
  panel.append(
    createElement("strong", "", title),
    createElement("p", "", resultText(result))
  );
  if (result.boost_used) {
    panel.append(createElement("p", "result-boost", `${BOOSTS[result.boost_used]?.name || "Boost"} · +${formatPoints(result.boost_bonus)} points`));
  }
  if (result.boost_awarded) {
    panel.append(createElement("p", "result-award", `Nouveau boost : ${BOOSTS[result.boost_awarded]?.name || result.boost_awarded}`));
  }
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

async function submitGame(event) {
  event.preventDefault();
  if (state.busy || !state.user) return;

  const wager = Number(new FormData(event.currentTarget).get("wager"));
  if (!Number.isSafeInteger(wager) || wager < 10) {
    toast("La mise minimum est de 10 points.", "error");
    return;
  }
  if (wager > Number(state.wallet && state.wallet.points || 0)) {
    toast("Solde insuffisant.", "error");
    return;
  }

  let choice;
  try {
    choice = buildChoice();
  } catch (error) {
    toast("Complete ton choix avant de lancer.", "error");
    return;
  }

  state.busy = true;
  state.lastWager = wager;
  window.localStorage.setItem("rip.casino.last-wager", String(wager));
  const button = query("[data-play-button]");
  button.disabled = true;
  button.textContent = "Tirage...";
  setStage("spinning");
  casinoAudio.play(state.gameKey);

  try {
    const [result] = await Promise.all([
      playInstantGame(state.gameKey, wager, choice),
      wait(state.gameKey === "slots" ? 1150 : 850)
    ]);
    setStage("reveal", result);
    renderResult(result);
    renderWallet(result.wallet);
    const won = Number(result.payout || 0) > Number(result.wager || 0);
    casinoAudio.play(won ? "win" : "lose");
    if (won) celebrate();
    const [boosts, feed] = await Promise.all([getCasinoBoosts(), getCasinoLiveFeed(12)]);
    renderBoosts(boosts);
    renderLiveFeed(feed);
  } catch (error) {
    console.error("Jeu casino:", error);
    toast(errorMessage(error), "error");
    setStage("idle");
  } finally {
    state.busy = false;
    button.disabled = false;
    button.textContent = "Relancer";
  }
}

function bindGames() {
  document.querySelectorAll("[data-open-game]").forEach((button) => {
    button.addEventListener("click", () => {
      casinoAudio.play("click");
      openGame(button.dataset.openGame);
    });
  });

  query("[data-dialog-close]").addEventListener("click", closeDialog);
  query("[data-game-dialog]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDialog();
  });
  query("[data-game-dialog]").addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
  });
  query("[data-game-form]").addEventListener("submit", submitGame);
  query("#game-wager").addEventListener("input", renderPotential);
  query("[data-wager-all]").addEventListener("click", () => {
    casinoAudio.play("bet");
    setWager(Number(state.wallet?.points || 10));
  });
  document.querySelectorAll("[data-wager-value]").forEach((button) => {
    button.addEventListener("click", () => {
      casinoAudio.play("bet");
      setWager(button.dataset.wagerValue);
    });
  });
  document.querySelectorAll("[data-wager-ratio]").forEach((button) => {
    button.addEventListener("click", () => {
      casinoAudio.play("bet");
      setWager(Number(state.wallet?.points || 0) * Number(button.dataset.wagerRatio));
    });
  });
  query("[data-wager-repeat]").addEventListener("click", () => {
    casinoAudio.play("bet");
    setWager(state.lastWager);
  });
}

function bindAudio() {
  const menu = query("[data-audio-menu]");
  const panel = query("[data-audio-panel]");
  const sfx = query("[data-sfx-toggle]");
  const music = query("[data-music-toggle]");
  const volume = query("[data-volume-control]");
  const output = query("[data-volume-output]");

  const close = () => {
    panel.hidden = true;
    menu.setAttribute("aria-expanded", "false");
  };
  const renderVolume = () => {
    const percent = Math.round(casinoAudio.volume * 100);
    volume.value = String(percent);
    output.textContent = `${percent}%`;
  };

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
    if (open) casinoAudio.play("click");
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  sfx.setAttribute("aria-pressed", String(casinoAudio.sfxEnabled));
  sfx.addEventListener("click", async () => {
    const enabled = casinoAudio.setSfx(!casinoAudio.sfxEnabled);
    sfx.setAttribute("aria-pressed", String(enabled));
    if (enabled) await casinoAudio.play("click");
  });
  music.addEventListener("click", async () => {
    const enabled = await casinoAudio.setMusic(!casinoAudio.musicEnabled);
    music.setAttribute("aria-pressed", String(enabled));
  });
  volume.addEventListener("input", () => {
    const percent = Math.max(0, Math.min(100, Number(volume.value) || 0));
    casinoAudio.setVolume(percent / 100);
    output.textContent = `${percent}%`;
  });
  volume.addEventListener("change", () => casinoAudio.play("click"));
  renderVolume();
}

async function initialize() {
  query("#year").textContent = String(new Date().getFullYear());
  bindAccountMenu();
  bindGames();
  bindAudio();
  initializeAds();

  try {
    await window.RipAuth.ready();
    state.user = window.RipAuth.currentUser();
  } catch (error) {
    console.error("Session:", error);
  }

  renderAccount();
  await loadCasino();
}

document.addEventListener("rip-auth-change", (event) => {
  state.user = event.detail || null;
  renderAccount();
});

initialize().catch((error) => {
  console.error("Accueil casino:", error);
  setStatus(errorMessage(error), "error");
});
