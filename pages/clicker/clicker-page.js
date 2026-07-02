import {
  buyClickerUpgrade,
  getClickerState,
  submitClickerTaps
} from "../../src/services/clicker-service.js?v=20260702-clicker1";
import { casinoAudio } from "../../src/services/casino-audio-service.js?v=20260702-audio2";
import { initializeAds, refreshAds } from "../../src/services/ad-service.js?v=20260702-clicker1";

const state = {
  user: null,
  payload: null,
  queuedTaps: 0,
  syncing: false,
  flushTimer: 0,
  refreshTimer: 0,
  buying: ""
};

function query(selector) {
  return document.querySelector(selector);
}

function formatPoints(value) {
  return new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.trunc(Number(value) || 0)));
}

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  query("[data-toast-stack]").append(item);
  window.setTimeout(() => item.remove(), 3600);
}

function setSync(message, type = "") {
  const element = query("[data-sync-state]");
  element.textContent = message;
  element.dataset.state = type;
}

function errorMessage(error) {
  const message = String(error && (error.message || error.details || error.code) || "");
  if (/clicker_get_state|clicker_tap|clicker_buy_upgrade|PGRST202|Could not find the function/i.test(message)) {
    return "La migration Pulse Forge doit etre appliquee dans Supabase.";
  }
  if (/not_enough_points/i.test(message)) return "Solde insuffisant pour cette amelioration.";
  if (/clicker_upgrade_max/i.test(message)) return "Cette amelioration est deja au maximum.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Supabase est momentanement inaccessible.";
  return message ? `Action impossible : ${message.slice(0, 120)}` : "Action impossible.";
}

function renderAuth() {
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
  avatar.style.background = state.user.avatarColor || "#39ff88";
  if (state.user.avatarUrl) {
    const image = document.createElement("img");
    image.src = state.user.avatarUrl;
    image.alt = "";
    avatar.append(image);
  } else {
    avatar.textContent = String(state.user.pseudo || "P").slice(0, 1).toUpperCase();
  }
}

function displayWallet() {
  if (!state.payload) return 0;
  const wallet = Number(state.payload.wallet?.points || 0);
  const clickPower = Number(state.payload.clicker?.points_per_click || 1);
  return wallet + state.queuedTaps * clickPower;
}

function renderWallet() {
  query("[data-wallet-points]").textContent = formatPoints(displayWallet());
}

function renderUpgrade(key, upgrade) {
  const card = query(`[data-upgrade-card="${key}"]`);
  if (!card || !upgrade) return;
  const atMax = Number(upgrade.level) >= Number(upgrade.max_level);
  const cost = Number(upgrade.cost || 0);
  card.dataset.max = String(atMax);
  card.querySelector("[data-upgrade-level]").textContent = formatPoints(upgrade.level);
  card.querySelector("[data-upgrade-max]").textContent = formatPoints(upgrade.max_level);
  card.querySelector("[data-upgrade-cost]").textContent = atMax ? "MAX" : formatPoints(cost);
  const button = card.querySelector("[data-buy-upgrade]");
  button.disabled = Boolean(state.buying) || atMax || cost > Number(state.payload.wallet?.points || 0);
}

function renderPayload(payload, options = {}) {
  if (!payload) return;
  state.payload = payload;
  const clicker = payload.clicker || {};

  renderWallet();
  query("[data-stat-per-click]").textContent = formatPoints(clicker.points_per_click);
  query("[data-stat-per-second]").textContent = formatPoints(clicker.points_per_second);
  query("[data-stat-total-clicks]").textContent = formatPoints(clicker.total_clicks);
  query("[data-stat-rate]").textContent = formatPoints(clicker.max_clicks_per_second);
  query("[data-level-power]").textContent = formatPoints(clicker.power_level);
  query("[data-level-reactor]").textContent = formatPoints(clicker.reactor_level);
  query("[data-level-combo]").textContent = formatPoints(clicker.combo_level);
  query("[data-total-earned]").textContent = `${formatPoints(clicker.total_earned)} POINTS GENERES`;
  query("[data-combo-progress]").textContent = formatPoints(clicker.combo_progress);
  query("[data-combo-target]").textContent = formatPoints(clicker.combo_target);

  const comboMeter = query("[data-combo-meter]");
  comboMeter.max = Math.max(1, Number(clicker.combo_target || 1));
  comboMeter.value = Math.min(comboMeter.max, Number(clicker.combo_progress || 0));

  Object.entries(payload.upgrades || {}).forEach(([key, upgrade]) => renderUpgrade(key, upgrade));
  setSync("SYNCHRONISE", "ready");

  if (options.showPassive && Number(payload.passive_claimed || 0) > 0) {
    toast(`Reacteur autonome : +${formatPoints(payload.passive_claimed)} points.`);
  }
}

function createClickEffect(event) {
  const effects = query("[data-click-effects]");
  const bounds = effects.getBoundingClientRect();
  const effect = document.createElement("span");
  effect.className = "click-pop";
  effect.textContent = `+${formatPoints(state.payload?.clicker?.points_per_click || 1)}`;
  effect.style.left = `${Math.max(24, Math.min(bounds.width - 24, event.clientX - bounds.left))}px`;
  effect.style.top = `${Math.max(60, Math.min(bounds.height - 30, event.clientY - bounds.top))}px`;
  effects.append(effect);
  window.setTimeout(() => effect.remove(), 800);
}

function scheduleFlush() {
  window.clearTimeout(state.flushTimer);
  state.flushTimer = window.setTimeout(flushTaps, 420);
}

async function flushTaps() {
  if (state.syncing || !state.user || state.queuedTaps < 1) return;
  const count = Math.min(50, state.queuedTaps);
  state.queuedTaps -= count;
  state.syncing = true;
  setSync("SYNCHRONISATION", "");

  try {
    const payload = await submitClickerTaps(count);
    renderPayload(payload);
    const action = payload.last_action || {};
    if (Number(action.combo_hits || 0) > 0) {
      casinoAudio.play("win");
      toast(`COMBO x${formatPoints(action.combo_hits)} : +${formatPoints(action.earned)} points.`);
    }
  } catch (error) {
    console.error("Clicker taps:", error);
    setSync("ERREUR", "error");
    toast(errorMessage(error), "error");
  } finally {
    state.syncing = false;
    renderWallet();
    if (state.queuedTaps > 0) scheduleFlush();
  }
}

function pulse(event) {
  if (!state.user || !state.payload) return;
  state.queuedTaps += 1;
  renderWallet();
  createClickEffect(event);

  const button = query("[data-reactor-button]");
  button.classList.add("is-pulsing");
  window.setTimeout(() => button.classList.remove("is-pulsing"), 90);
  if (state.queuedTaps % 2 === 1) casinoAudio.play("click");
  scheduleFlush();
}

async function waitForSync() {
  while (state.syncing) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

async function buyUpgrade(key) {
  if (!state.user || state.buying) return;
  await flushTaps();
  await waitForSync();
  state.buying = key;
  Object.entries(state.payload?.upgrades || {}).forEach(([upgradeKey, upgrade]) => renderUpgrade(upgradeKey, upgrade));
  setSync("INSTALLATION", "");

  try {
    const payload = await buyClickerUpgrade(key);
    renderPayload(payload);
    casinoAudio.play("boost");
    toast(`${key.toUpperCase()} ameliore pour ${formatPoints(payload.upgrade_cost)} points.`);
  } catch (error) {
    console.error("Clicker upgrade:", error);
    setSync("ERREUR", "error");
    toast(errorMessage(error), "error");
  } finally {
    state.buying = "";
    Object.entries(state.payload?.upgrades || {}).forEach(([upgradeKey, upgrade]) => renderUpgrade(upgradeKey, upgrade));
  }
}

async function refreshClicker(showPassive = false) {
  if (!state.user || state.syncing || state.queuedTaps > 0) return;
  setSync("CONNEXION", "");
  try {
    renderPayload(await getClickerState(), { showPassive });
  } catch (error) {
    console.error("Clicker state:", error);
    setSync("MIGRATION REQUISE", "error");
    toast(errorMessage(error), "error");
  }
}

function bindAccount() {
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
    await flushTaps();
    await window.RipAuth.logout();
    window.location.href = "../home/home.html";
  });
}

function bindAudio() {
  const menu = query("[data-audio-menu]");
  const panel = query("[data-audio-panel]");
  const sfx = query("[data-sfx-toggle]");
  const music = query("[data-music-toggle]");
  const volume = query("[data-volume-control]");
  const output = query("[data-volume-output]");

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    panel.hidden = true;
    menu.setAttribute("aria-expanded", "false");
  });

  sfx.setAttribute("aria-pressed", String(casinoAudio.sfxEnabled));
  music.setAttribute("aria-pressed", String(casinoAudio.musicEnabled));
  sfx.addEventListener("click", () => {
    sfx.setAttribute("aria-pressed", String(casinoAudio.setSfx(!casinoAudio.sfxEnabled)));
  });
  music.addEventListener("click", async () => {
    music.setAttribute("aria-pressed", String(await casinoAudio.setMusic(!casinoAudio.musicEnabled)));
  });
  volume.value = String(Math.round(casinoAudio.volume * 100));
  output.textContent = `${volume.value}%`;
  volume.addEventListener("input", () => {
    const value = Math.max(0, Math.min(100, Number(volume.value) || 0));
    casinoAudio.setVolume(value / 100);
    output.textContent = `${value}%`;
  });
}

function bindClicker() {
  query("[data-reactor-button]").addEventListener("click", pulse);
  document.querySelectorAll("[data-buy-upgrade]").forEach((button) => {
    button.addEventListener("click", () => buyUpgrade(button.dataset.buyUpgrade));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushTaps();
    else refreshClicker(true);
  });
}

async function initialize() {
  bindAccount();
  bindAudio();
  bindClicker();

  try {
    await window.RipAuth.ready();
    state.user = window.RipAuth.currentUser();
  } catch (error) {
    console.error("Clicker auth:", error);
  }

  renderAuth();
  initializeAds();
  if (state.user) {
    await refreshClicker(true);
    state.refreshTimer = window.setInterval(() => refreshClicker(false), 30000);
  }
}

document.addEventListener("rip-auth-change", async (event) => {
  state.user = event.detail || null;
  renderAuth();
  refreshAds();
  if (state.user) await refreshClicker(true);
});

initialize().catch((error) => {
  console.error("Pulse Forge:", error);
  setSync("ERREUR", "error");
  toast(errorMessage(error), "error");
});
