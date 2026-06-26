import {
  GAME_CATALOG,
  claimAchievement,
  getAchievements,
  getNotifications,
  formatDate,
  gameLabel,
  getLeaderboard,
  getMessageStats,
  getMissions,
  markNotificationRead,
  getPlatformContext,
  getRecentScores,
  getShop,
  getWallet,
  onReady,
  schemaMissing,
  walletProgress
} from "../../src/services/platform-data-service.js";

const state = {
  context: null
};

function ensureGateBox(selector, title, body, actionHref, actionLabel) {
  let box = document.querySelector(selector);

  if (box) {
    return box;
  }

  const shell = document.querySelector(".platform-shell");
  const hero = document.querySelector(".platform-hero");

  if (!shell || !hero) {
    return null;
  }

  box = createElement("div", "setup-box");
  box.hidden = true;
  box.setAttribute(selector.slice(1, -1), "");
  box.append(createElement("strong", "", title), createElement("p", "", body));

  if (actionHref && actionLabel) {
    const action = createElement("a", "button primary", actionLabel);
    action.href = actionHref;
    box.append(action);
  }

  shell.insertBefore(box, hero);
  return box;
}

function text(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function show(selector, visible) {
  document.querySelectorAll(selector).forEach((element) => {
    element.hidden = !visible;
  });
}

function createElement(tag, className, content) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (content !== undefined) {
    element.textContent = content;
  }

  return element;
}

function setStatus(message, error = false) {
  document.querySelectorAll("[data-platform-status]").forEach((element) => {
    element.textContent = message;
    element.dataset.state = error ? "error" : "ok";
  });
}

function platformErrorMessage(error, fallback) {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  const shortMessage = message ? message.slice(0, 180) : "";

  if (/NetworkError|Failed to fetch|fetch resource|Load failed|TypeError/i.test(message)) {
    return "Supabase inaccessible depuis le navigateur. Verifie reseau, VPN, bloqueur ou etat Supabase.";
  }

  if (/Could not find the function|function .* does not exist|PGRST202/i.test(message)) {
    return "RPC Supabase manquante : applique supabase-chat.sql complet.";
  }

  if (/relation .* does not exist|table .* does not exist|42P01/i.test(message)) {
    return "Table Supabase manquante : applique supabase-chat.sql complet.";
  }

  if (/column .* does not exist|42703/i.test(message)) {
    return "Colonne Supabase manquante : migration incomplete.";
  }

  if (/permission denied|not authorized|42501|row-level security|violates row-level security|policy/i.test(message)) {
    return "Permission Supabase refusee : verifie grants/RLS.";
  }

  if (/relationship|foreign key|PGRST200/i.test(message)) {
    return "Relation Supabase manquante ou cache PostgREST pas encore recharge.";
  }

  if (schemaMissing(error)) {
    return shortMessage ? `Erreur schema Supabase : ${shortMessage}` : "Erreur schema Supabase.";
  }

  return shortMessage ? `${fallback} ${shortMessage}` : fallback;
}

function settledValue(result, fallback) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function settledErrors(results) {
  return results.filter((result) => result.status === "rejected").map((result) => result.reason);
}

function toast(message, type = "info") {
  let stack = document.querySelector("[data-toast-stack]");

  if (!stack) {
    stack = createElement("div", "toast-stack");
    stack.dataset.toastStack = "";
    document.body.append(stack);
  }

  const item = createElement("div", `toast ${type}`, message);
  stack.append(item);
  window.setTimeout(() => item.remove(), 4200);
}

function renderAvatar(element, user) {
  if (!element || !user) {
    return;
  }

  element.replaceChildren();
  element.style.setProperty("--avatar-color", user.avatarColor || user.avatar_color || "#39ff88");
  element.dataset.avatarFrame = user.avatarFrame || user.avatar_frame || "none";

  const avatarUrl = user.avatarUrl || user.avatar_url;
  const pseudo = user.pseudo || "Player";

  if (avatarUrl) {
    const image = document.createElement("img");
    image.src = avatarUrl;
    image.alt = `Avatar de ${pseudo}`;
    image.loading = "lazy";
    element.append(image);
    return;
  }

  element.textContent = pseudo.slice(0, 1).toUpperCase();
}

function renderProfile(user) {
  if (!user) {
    return;
  }

  text("[data-platform-name]", user.pseudo || "Player");
  text("[data-platform-title]", user.title || "Nouveau joueur");
  text("[data-platform-status-text]", user.status || "En ligne");
  text("[data-platform-badge]", user.activeBadge || user.active_badge || "");
  document.body.dataset.profileTheme = user.profileTheme || user.profile_theme || "default";

  document.querySelectorAll("[data-platform-name]").forEach((element) => {
    element.classList.add("display-name");
    element.dataset.nameStyle = user.nameStyle || user.name_style || "solid";
    element.style.setProperty("--name-color-a", user.nameColorA || user.name_color_a || "#39ff88");
    element.style.setProperty("--name-color-b", user.nameColorB || user.name_color_b || "#ffdc5e");
  });

  document.querySelectorAll("[data-platform-avatar]").forEach((element) => renderAvatar(element, user));
}

function renderWallet(wallet) {
  if (!wallet) {
    return;
  }

  const progress = walletProgress(wallet);
  text("[data-platform-points]", String(wallet.points || 0));
  text("[data-platform-level]", String(wallet.level || 1));
  text("[data-platform-xp]", String(wallet.xp || 0));
  text("[data-platform-streak]", String(wallet.streak || 0));
  text("[data-platform-xp-next]", `${progress.current} / ${progress.needed} XP vers niveau ${progress.nextLevel}`);
  document.querySelectorAll("[data-platform-xp-bar]").forEach((element) => {
    element.style.width = `${progress.percent}%`;
  });
}

function renderMissions(missions) {
  document.querySelectorAll("[data-platform-missions]").forEach((list) => {
    list.replaceChildren();

    if (!missions.length) {
      list.textContent = "Aucune mission chargee.";
      return;
    }

    missions.slice(0, 6).forEach((mission) => {
      const progress = Number(mission.progress_value || 0);
      const goal = Number(mission.goal_value || 1);
      const item = createElement("article", "mission-card");
      const title = createElement("strong", "", mission.label_text);
      const meta = createElement("span", "", `${Math.min(progress, goal)} / ${goal} - ${mission.reward_points} coins`);
      const bar = createElement("span", "mission-progress");
      const fill = createElement("span");
      fill.style.width = `${Math.max(0, Math.min(100, (progress / Math.max(1, goal)) * 100))}%`;
      bar.append(fill);
      item.dataset.state = mission.claimed ? "claimed" : progress >= goal ? "ready" : "locked";
      item.append(title, meta, bar);
      list.append(item);
    });
  });
}


function renderAchievements(achievements) {
  document.querySelectorAll("[data-platform-achievements]").forEach((list) => {
    const limit = Number(list.dataset.limit || achievements.length || 0);
    const visible = limit ? achievements.slice(0, limit) : achievements;
    list.replaceChildren();

    if (!visible.length) {
      list.textContent = "Aucun succes charge.";
      return;
    }

    visible.forEach((achievement) => {
      const progress = Number(achievement.progress_value || 0);
      const goal = Number(achievement.goal_value || 1);
      const ready = progress >= goal;
      const unlocked = Boolean(achievement.unlocked);
      const card = createElement("article", "achievement-card");
      card.dataset.state = unlocked ? "unlocked" : ready ? "ready" : "locked";

      const icon = createElement("span", "achievement-icon", achievement.icon_text || "OK");
      const body = createElement("div", "achievement-body");
      body.append(
        createElement("strong", "", achievement.title_text),
        createElement("p", "", achievement.description_text),
        createElement("small", "", `${Math.min(progress, goal)} / ${goal} - reward ${achievement.reward_points} coins`)
      );

      const bar = createElement("span", "mission-progress");
      const fill = createElement("span");
      fill.style.width = `${Math.max(0, Math.min(100, (progress / Math.max(1, goal)) * 100))}%`;
      bar.append(fill);
      body.append(bar);

      if (unlocked) {
        body.append(createElement("small", "achievement-state", `Debloque le ${formatDate(achievement.unlocked_at)}`));
      } else if (ready) {
        const claim = createElement("button", "game-button", "Claim");
        claim.type = "button";
        claim.addEventListener("click", () => claimAchievementFromUi(achievement.achievement_key));
        body.append(claim);
      } else {
        body.append(createElement("small", "achievement-state", "Verrouille"));
      }

      card.append(icon, body);
      list.append(card);
    });
  });

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  text("[data-platform-achievements-count]", String(unlockedCount));
  text("[data-platform-achievements-total]", String(achievements.length));
}

function renderNotifications(notifications) {
  document.querySelectorAll("[data-platform-notifications]").forEach((list) => {
    const limit = Number(list.dataset.limit || notifications.length || 0);
    const visible = limit ? notifications.slice(0, limit) : notifications;
    list.replaceChildren();

    if (!visible.length) {
      list.textContent = "Aucune notification.";
      return;
    }

    visible.forEach((notification) => {
      const card = createElement("article", "notification-card");
      card.dataset.state = notification.read_at ? "read" : "unread";
      card.append(
        createElement("span", "tag", notification.kind || "system"),
        createElement("strong", "", notification.title),
        createElement("p", "", notification.body || ""),
        createElement("small", "", formatDate(notification.created_at))
      );

      if (!notification.read_at) {
        const read = createElement("button", "game-button secondary", "Lu");
        read.type = "button";
        read.addEventListener("click", () => markNotificationFromUi(notification.id));
        card.append(read);
      }

      list.append(card);
    });
  });

  const unread = notifications.filter((notification) => !notification.read_at).length;
  text("[data-platform-notifications-count]", String(unread));
}

async function reloadAchievementsAndNotifications() {
  if (!state.context) {
    return;
  }

  const [achievements, notifications] = await Promise.all([
    getAchievements(state.context.client),
    getNotifications(state.context.client, 20)
  ]);
  renderAchievements(achievements);
  renderNotifications(notifications);
}

async function claimAchievementFromUi(achievementKey) {
  if (!state.context) {
    return;
  }

  try {
    setStatus("Claim succes...");
    const wallet = await claimAchievement(state.context.client, achievementKey);
    renderWallet(wallet);
    await reloadAchievementsAndNotifications();
    toast("Succes debloque.", "success");
    setStatus("Succes synchronises.");
  } catch (error) {
    console.error("Achievement claim error:", error);
    setStatus(platformErrorMessage(error, "Succes non disponible."), true);
  }
}

async function markNotificationFromUi(notificationId) {
  if (!state.context) {
    return;
  }

  try {
    await markNotificationRead(state.context.client, notificationId);
    const notifications = await getNotifications(state.context.client, 20);
    renderNotifications(notifications);
    setStatus("Notification lue.");
  } catch (error) {
    console.error("Notification read error:", error);
    setStatus(platformErrorMessage(error, "Notification indisponible."), true);
  }
}
function renderRecentScores(scores) {
  document.querySelectorAll("[data-platform-activity]").forEach((list) => {
    list.replaceChildren();

    if (!scores.length) {
      list.append(createElement("li", "", "Aucune partie recente."));
      return;
    }

    scores.forEach((score) => {
      const item = createElement("li");
      item.append(
        createElement("strong", "", gameLabel(score.game_key)),
        createElement("span", "", `${score.score} score / +${score.reward_points} coins`),
        createElement("small", "", formatDate(score.created_at))
      );
      list.append(item);
    });
  });
}

function renderGameCards(container, games, launchable = false) {
  container.replaceChildren();

  games.forEach((game) => {
    const card = createElement("article", "game-card");
    card.dataset.gameCard = "";
    card.dataset.category = game.category;
    card.dataset.mode = game.mode;
    card.dataset.title = `${game.title} ${game.description}`.toLowerCase();

    const head = createElement("div", "game-card-head");
    head.append(
      createElement("span", "tag", game.category),
      createElement("span", "tag secondary", game.mode)
    );

    const title = createElement("h3", "", game.title);
    const description = createElement("p", "", game.description);
    const meta = createElement("div", "game-meta");
    meta.append(
      createElement("span", "", game.difficulty),
      createElement("span", "", game.reward)
    );

    const action = document.createElement(game.implemented && launchable ? "button" : "a");
    action.className = game.implemented ? "button primary full" : "button secondary full";
    action.textContent = game.implemented ? "Jouer" : "Bientot";

    if (game.implemented && launchable) {
      action.type = "button";
      action.dataset.openGame = game.key;
    } else {
      action.href = game.implemented ? "../arcade/arcade.html" : "#";
      if (!game.implemented) {
        action.setAttribute("aria-disabled", "true");
      }
    }

    card.append(head, title, description, meta, action);
    container.append(card);
  });
}

function initGameCatalog() {
  document.querySelectorAll("[data-game-grid]").forEach((container) => {
    const launchable = container.dataset.launchable === "true";
    renderGameCards(container, GAME_CATALOG, launchable);
  });

  const search = document.querySelector("[data-game-search]");
  const filters = document.querySelectorAll("[data-game-filter]");

  function applyFilters() {
    const query = String(search && search.value || "").trim().toLowerCase();
    const active = document.querySelector("[data-game-filter][data-active='true']");
    const category = active ? active.dataset.gameFilter : "tous";

    document.querySelectorAll("[data-game-card]").forEach((card) => {
      const matchesText = !query || card.dataset.title.includes(query);
      const matchesCategory = category === "tous" || card.dataset.category === category || card.dataset.mode === category;
      card.hidden = !(matchesText && matchesCategory);
    });
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      filters.forEach((candidate) => {
        candidate.dataset.active = String(candidate === button);
      });
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener("input", applyFilters);
  }

  applyFilters();
}

function renderShopSummary(shop) {
  text("[data-platform-inventory-count]", String(shop.inventory.length));
  text("[data-platform-shop-count]", String(shop.items.length));
}

function renderLeaderboardRows(rows) {
  document.querySelectorAll("[data-platform-leaderboard]").forEach((list) => {
    list.replaceChildren();

    if (!rows.length) {
      list.textContent = "Aucun score pour ce jeu.";
      return;
    }

    rows.forEach((row) => {
      const item = createElement("article", "leaderboard-row");
      item.dataset.rank = String(row.rank);
      item.append(
        createElement("strong", "", `#${row.rank}`),
        createElement("span", "", row.profile ? row.profile.pseudo : "Player"),
        createElement("span", "", `${row.score} pts`),
        createElement("small", "", `+${row.reward_points} coins`)
      );
      list.append(item);
    });
  });
}

async function requirePlatform() {
  ensureGateBox("[data-platform-setup]", "Configuration Supabase manquante", "Ajoute ton URL et ta cle publique dans shared/supabase/public-config.js. Si une table manque, applique le fichier supabase-chat.sql complet dans Supabase.");
  ensureGateBox("[data-platform-login]", "Connexion requise", "Connecte-toi pour synchroniser ton profil, tes points, ton inventaire, tes scores et le tchat.", "../login/login.html", "Se connecter");

  try {
    state.context = await getPlatformContext();
  } catch (error) {
    console.error("Platform context error:", error);
    show("[data-platform-setup]", false);
    show("[data-platform-login]", false);
    setStatus(platformErrorMessage(error, "Session Supabase indisponible."), true);
    return null;
  }

  const { configured, user } = state.context;

  if (!configured) {
    show("[data-platform-setup]", true);
    setStatus("Supabase non configure.", true);
    return null;
  }

  if (!user) {
    show("[data-platform-login]", true);
    setStatus("Connexion requise.", true);
    return null;
  }

  show("[data-platform-setup]", false);
  show("[data-platform-login]", false);
  renderProfile(user);
  return state.context;
}

async function initDashboard() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  const results = await Promise.allSettled([
    getWallet(context.client),
    getMissions(context.client),
    getRecentScores(context.client, context.user.id),
    getShop(context.client),
    getMessageStats(context.client, context.user.id),
    getAchievements(context.client),
    getNotifications(context.client, 6)
  ]);
  const [wallet, missions, scores, shop, messages, achievements, notifications] = results;

  renderWallet(settledValue(wallet, null));
  renderMissions(settledValue(missions, []));
  renderRecentScores(settledValue(scores, []));
  renderShopSummary(settledValue(shop, { items: [], inventory: [] }));
  renderAchievements(settledValue(achievements, []));
  renderNotifications(settledValue(notifications, []));
  text("[data-platform-message-count]", String(settledValue(messages, 0)));
  text("[data-platform-games-count]", String(settledValue(scores, []).length));

  const errors = settledErrors(results);
  if (errors.length) {
    console.error("Dashboard partial errors:", errors);
    setStatus(platformErrorMessage(errors[0], "Dashboard partiellement charge."), true);
    return;
  }

  setStatus("Dashboard synchronise.");
  toast("Dashboard charge.", "success");
}

async function initLeaderboards() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  const select = document.querySelector("[data-platform-leaderboard-game]");

  async function load() {
    try {
      setStatus("Chargement classement...");
      const rows = await getLeaderboard(context.client, select ? select.value : "reflex", 10);
      renderLeaderboardRows(rows);
      setStatus("Classement synchronise.");
    } catch (error) {
      console.error("Leaderboard error:", error);
      setStatus(platformErrorMessage(error, "Classement indisponible."), true);
    }
  }

  if (select) {
    select.addEventListener("change", load);
  }

  await load();
}

async function initSharedStats() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  const results = await Promise.allSettled([
    getWallet(context.client),
    getMissions(context.client),
    getShop(context.client),
    getAchievements(context.client),
    getNotifications(context.client, 6)
  ]);
  const [wallet, missions, shop, achievements, notifications] = results;

  renderWallet(settledValue(wallet, null));
  renderMissions(settledValue(missions, []));
  renderShopSummary(settledValue(shop, { items: [], inventory: [] }));
  renderAchievements(settledValue(achievements, []));
  renderNotifications(settledValue(notifications, []));

  const errors = settledErrors(results);
  if (errors.length) {
    console.error("Platform partial errors:", errors);
    setStatus(platformErrorMessage(errors[0], "Plateforme partiellement chargee."), true);
    return;
  }

  setStatus("Plateforme synchronisee.");
}


async function initAchievementsPage() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  const results = await Promise.allSettled([
    getWallet(context.client),
    getAchievements(context.client),
    getNotifications(context.client, 8)
  ]);
  const [wallet, achievements, notifications] = results;
  renderWallet(settledValue(wallet, null));
  renderAchievements(settledValue(achievements, []));
  renderNotifications(settledValue(notifications, []));

  const errors = settledErrors(results);
  if (errors.length) {
    console.error("Achievements partial errors:", errors);
    setStatus(platformErrorMessage(errors[0], "Succes partiellement charges."), true);
    return;
  }

  setStatus("Succes synchronises.");
}

async function initNotificationsPage() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  const results = await Promise.allSettled([
    getWallet(context.client),
    getNotifications(context.client, 30),
    getAchievements(context.client)
  ]);
  const [wallet, notifications, achievements] = results;
  renderWallet(settledValue(wallet, null));
  renderNotifications(settledValue(notifications, []));
  renderAchievements(settledValue(achievements, []));

  const errors = settledErrors(results);
  if (errors.length) {
    console.error("Notifications partial errors:", errors);
    setStatus(platformErrorMessage(errors[0], "Notifications partiellement chargees."), true);
    return;
  }

  setStatus("Notifications synchronisees.");
}
function routePath(value) {
  const url = new URL(value, window.location.href);
  return url.pathname.replace(/\/index\.html$/, "/");
}

function markActiveNav() {
  const current = routePath(window.location.href);
  document.querySelectorAll(".nav a").forEach((link) => {
    const target = link.getAttribute("href");
    if (target && routePath(target) === current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

onReady(() => {
  markActiveNav();
  initGameCatalog();

  const page = document.body.dataset.platformPage;

  if (page === "dashboard") {
    initDashboard();
  } else if (page === "leaderboards") {
    initLeaderboards();
  } else if (page === "arcade" || page === "shop") {
    initSharedStats();
  } else if (page === "achievements") {
    initAchievementsPage();
  } else if (page === "notifications") {
    initNotificationsPage();
  }
});
