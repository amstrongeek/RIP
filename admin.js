const statusElement = document.querySelector("[data-admin-status]");
const blockedBox = document.querySelector("[data-admin-blocked]");
const shell = document.querySelector("[data-admin-shell]");
const statsBox = document.querySelector("[data-admin-stats]");
const usersBox = document.querySelector("[data-admin-users]");
const logsBox = document.querySelector("[data-admin-logs]");

let client = null;

function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }

  callback();
}

function setStatus(message, error = false) {
  if (!statusElement) {
    return;
  }
  statusElement.textContent = message;
  statusElement.dataset.state = error ? "error" : "ok";
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

function formData(form) {
  return Object.fromEntries(new FormData(form));
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

async function rpc(name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw error;
  }
  return data;
}

async function refreshStats() {
  const stats = await rpc("admin_get_stats");
  statsBox.replaceChildren();
  Object.entries(stats || {}).forEach(([key, value]) => {
    const card = createElement("article", "stat-card");
    card.append(createElement("span", "", key), createElement("strong", "", String(value)));
    statsBox.append(card);
  });
}

async function refreshUsers() {
  const users = await rpc("admin_get_users");
  usersBox.replaceChildren();

  if (!users.length) {
    usersBox.textContent = "Aucun utilisateur.";
    return;
  }

  users.forEach((user) => {
    const row = createElement("div", "admin-row");
    row.append(
      createElement("strong", "", user.pseudo || "Player"),
      createElement("small", "", user.user_id),
      createElement("small", "", `${user.points || 0} coins / ${user.xp || 0} XP / niveau ${user.level || 1}`),
      createElement("small", "", `${user.inventory_count || 0} items / ${user.email || ""}`)
    );
    usersBox.append(row);
  });
}

async function refreshLogs() {
  const logs = await rpc("admin_get_logs", { limit_count: 50 });
  logsBox.replaceChildren();

  if (!logs.length) {
    logsBox.textContent = "Aucun log.";
    return;
  }

  logs.forEach((log) => {
    const row = createElement("div", "admin-row");
    row.append(
      createElement("strong", "", log.action),
      createElement("small", "", new Date(log.created_at).toLocaleString("fr-FR")),
      createElement("small", "", JSON.stringify(log.payload || {}))
    );
    logsBox.append(row);
  });
}

async function refreshAll() {
  await Promise.all([refreshStats(), refreshUsers(), refreshLogs()]);
  setStatus("Admin pret.");
}

function bindForm(selector, handler) {
  const form = document.querySelector(selector);
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    setStatus("Action admin...");

    try {
      await handler(formData(form));
      await refreshAll();
      form.reset();
      setStatus("Action admin executee.");
    } catch (error) {
      console.error("Admin error:", error);
      setStatus("Action admin refusee ou SQL pas encore relance.", true);
    } finally {
      submit.disabled = false;
    }
  });
}

function bindAdminForms() {
  document.querySelector("[data-admin-refresh]")?.addEventListener("click", () => {
    refreshAll().catch((error) => {
      console.error("Admin refresh:", error);
      setStatus("Refresh impossible.", true);
    });
  });

  bindForm("[data-wallet-form]", (data) => rpc("admin_set_wallet", {
    target_user: data.user_id,
    points_input: numberOrNull(data.points),
    xp_input: numberOrNull(data.xp),
    level_input: numberOrNull(data.level)
  }));

  bindForm("[data-grant-form]", (data) => rpc("admin_grant_item", {
    target_user: data.user_id,
    shop_key: data.item_key
  }));

  bindForm("[data-item-form]", (data) => rpc("admin_upsert_shop_item", {
    item_key_input: data.item_key,
    name_input: data.name,
    description_input: data.description,
    price_input: numberOrNull(data.price) || 0,
    item_type_input: data.item_type,
    payload_input: JSON.parse(data.payload || "{}"),
    rarity_input: data.rarity,
    category_input: data.category,
    equip_slot_input: data.equip_slot,
    active_input: true
  }));

  bindForm("[data-announcement-form]", (data) => rpc("admin_send_announcement", {
    body_text: data.body
  }));

  bindForm("[data-delete-message-form]", (data) => rpc("admin_delete_message", {
    message_id: Number(data.message_id)
  }));

  bindForm("[data-game-enabled-form]", (data) => rpc("admin_set_game_enabled", {
    game_key_input: data.game_key,
    enabled_input: data.enabled === "true"
  }));

  bindForm("[data-game-balance-form]", (data) => rpc("admin_set_game_balance", {
    game_key_input: data.game_key,
    score_cap_input: numberOrNull(data.score_cap),
    reward_min_input: numberOrNull(data.reward_min),
    reward_max_input: numberOrNull(data.reward_max),
    cooldown_seconds_input: numberOrNull(data.cooldown)
  }));
}

async function initAdmin() {
  if (!window.RipSupabase || !window.RipSupabase.isConfigured() || !window.RipAuth) {
    setStatus("Supabase requis.", true);
    return;
  }

  await window.RipAuth.ready();
  if (!window.RipAuth.currentUser()) {
    setStatus("Connexion requise.", true);
    window.location.href = "connexion.html";
    return;
  }

  client = await window.RipSupabase.getClient();
  const isAdmin = await rpc("is_admin");

  if (!isAdmin) {
    blockedBox.hidden = false;
    shell.hidden = true;
    setStatus("Acces refuse.", true);
    return;
  }

  blockedBox.hidden = true;
  shell.hidden = false;
  bindAdminForms();
  await refreshAll();
}

onReady(() => {
  initAdmin().catch((error) => {
    console.error("Admin init:", error);
    setStatus("Admin indisponible. Relance le SQL Supabase.", true);
  });
});
