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
} from "../services/platform-service.js";

const state = {
  context: null
};

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
    setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Succes non disponible.", true);
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
    setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Notification indisponible.", true);
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
      action.href = game.implemented ? "arcade.html" : "#";
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
  state.context = await getPlatformContext();
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

  try {
    const [wallet, missions, scores, shop, messages, achievements, notifications] = await Promise.all([
      getWallet(context.client),
      getMissions(context.client),
      getRecentScores(context.client, context.user.id),
      getShop(context.client),
      getMessageStats(context.client, context.user.id),
      getAchievements(context.client),
      getNotifications(context.client, 6)
    ]);

    renderWallet(wallet);
    renderMissions(missions);
    renderRecentScores(scores);
    renderShopSummary(shop);
    renderAchievements(achievements);
    renderNotifications(notifications);
    text("[data-platform-message-count]", String(messages));
    text("[data-platform-games-count]", String(scores.length));
    setStatus("Dashboard synchronise.");
    toast("Dashboard charge.", "success");
  } catch (error) {
    console.error("Dashboard error:", error);
    setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Dashboard indisponible.", true);
  }
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
      setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Classement indisponible.", true);
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

  try {
    const [wallet, missions, shop, achievements, notifications] = await Promise.all([
      getWallet(context.client),
      getMissions(context.client),
      getShop(context.client),
      getAchievements(context.client),
      getNotifications(context.client, 6)
    ]);

    renderWallet(wallet);
    renderMissions(missions);
    renderShopSummary(shop);
    renderAchievements(achievements);
    renderNotifications(notifications);
    setStatus("Plateforme synchronisee.");
  } catch (error) {
    console.error("Platform stats error:", error);
    setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Stats indisponibles.", true);
  }
}


async function initAchievementsPage() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  try {
    const [wallet, achievements, notifications] = await Promise.all([
      getWallet(context.client),
      getAchievements(context.client),
      getNotifications(context.client, 8)
    ]);
    renderWallet(wallet);
    renderAchievements(achievements);
    renderNotifications(notifications);
    setStatus("Succes synchronises.");
  } catch (error) {
    console.error("Achievements page error:", error);
    setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Succes indisponibles.", true);
  }
}

async function initNotificationsPage() {
  const context = await requirePlatform();

  if (!context) {
    return;
  }

  try {
    const [wallet, notifications, achievements] = await Promise.all([
      getWallet(context.client),
      getNotifications(context.client, 30),
      getAchievements(context.client)
    ]);
    renderWallet(wallet);
    renderNotifications(notifications);
    renderAchievements(achievements);
    setStatus("Notifications synchronisees.");
  } catch (error) {
    console.error("Notifications page error:", error);
    setStatus(schemaMissing(error) ? "Relance le SQL Supabase." : "Notifications indisponibles.", true);
  }
}
function markActiveNav() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach((link) => {
    const target = link.getAttribute("href");
    if (target === current) {
      link.setAttribute("aria-current", "page");
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