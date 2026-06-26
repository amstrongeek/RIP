import { GAME_CATALOG } from "../data/games.js";
import { ACHIEVEMENT_CATALOG } from "../data/achievements.js";

export { ACHIEVEMENT_CATALOG, GAME_CATALOG };

export function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }

  callback();
}

export function xpForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return Math.pow(safeLevel - 1, 2) * 120;
}

export function walletProgress(wallet) {
  const level = wallet && wallet.level ? wallet.level : 1;
  const xp = wallet && wallet.xp ? wallet.xp : 0;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);

  return {
    current: Math.max(0, xp - start),
    needed: Math.max(1, next - start),
    percent: Math.max(0, Math.min(100, ((xp - start) / Math.max(1, next - start)) * 100)),
    nextLevel: level + 1
  };
}

export function formatDate(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function gameLabel(key) {
  const game = GAME_CATALOG.find((candidate) => candidate.key === key);
  return game ? game.shortTitle : key;
}

export async function getPlatformContext() {
  const configured = Boolean(window.RipSupabase && window.RipSupabase.isConfigured());

  if (!configured || !window.RipAuth) {
    return {
      configured,
      client: null,
      user: null
    };
  }

  await window.RipAuth.ready();
  const user = window.RipAuth.currentUser();

  if (!user) {
    return {
      configured,
      client: null,
      user: null
    };
  }

  const client = await window.RipSupabase.getClient();
  return { configured, client, user };
}

export async function getPlatformHealth(client) {
  const { data, error } = await client.rpc("get_platform_health");

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getWallet(client) {
  if (window.RipData) {
    return window.RipData.getWallet();
  }

  const { data, error } = await client.rpc("get_my_wallet");

  if (error) {
    throw error;
  }

  return data;
}

export async function getMissions(client) {
  if (window.RipData) {
    return window.RipData.getMissions();
  }

  const { data, error } = await client.rpc("get_my_missions");

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getShop(client) {
  if (window.RipData) {
    return window.RipData.getShopData();
  }

  const [itemsResult, inventoryResult] = await Promise.all([
    client
      .from("shop_items")
      .select("item_key,name,description,price,item_type,payload,sort_order,rarity,category,equip_slot")
      .order("sort_order", { ascending: true }),
    client
      .from("user_inventory")
      .select("item_key,quantity,equipped,acquired_at")
      .order("acquired_at", { ascending: false })
  ]);

  if (itemsResult.error || inventoryResult.error) {
    throw itemsResult.error || inventoryResult.error;
  }

  return {
    items: itemsResult.data || [],
    inventory: inventoryResult.data || []
  };
}

export async function getRecentScores(client, userId, limit = 6) {
  if (window.RipData) {
    return window.RipData.getRecentScores(userId, limit);
  }

  const { data, error } = await client
    .from("game_scores")
    .select("game_key,score,reward_points,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}


export async function getAchievements(client) {
  if (window.RipData) {
    return window.RipData.getAchievements();
  }

  const { data, error } = await client.rpc("get_my_achievements");

  if (error) {
    throw error;
  }

  return data || [];
}

export async function claimAchievement(client, achievementKey) {
  if (window.RipData) {
    return window.RipData.claimAchievement(achievementKey);
  }

  const { data, error } = await client.rpc("claim_achievement", {
    achievement_key_input: achievementKey
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getNotifications(client, limit = 20) {
  if (window.RipData) {
    return window.RipData.getNotifications(limit);
  }

  const { data, error } = await client.rpc("get_my_notifications", {
    limit_count: limit
  });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function markNotificationRead(client, notificationId) {
  if (window.RipData) {
    return window.RipData.markNotificationRead(notificationId);
  }

  const { data, error } = await client.rpc("mark_notification_read", {
    notification_id: notificationId
  });

  if (error) {
    throw error;
  }

  return data;
}
export async function getLeaderboard(client, gameKey = "reflex", limit = 10) {
  if (window.RipData) {
    return window.RipData.getLeaderboard(gameKey, limit);
  }

  const { data, error } = await client
    .from("game_scores")
    .select("user_id,game_key,score,reward_points,created_at")
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const userIds = [...new Set((data || []).map((score) => score.user_id))];
  let profiles = [];

  if (userIds.length) {
    const profileResult = await client
      .from("profiles")
      .select("id,pseudo,avatar_color,avatar_url,name_style,name_color_a,name_color_b,active_badge")
      .in("id", userIds);
    profiles = profileResult.data || [];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return (data || []).map((score, index) => ({
    ...score,
    rank: index + 1,
    profile: profileById.get(score.user_id) || null
  }));
}

export async function getMessageStats(client, userId) {
  if (window.RipData) {
    return window.RipData.getMessageStats(userId);
  }

  const { count, error } = await client
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return count || 0;
}

export function schemaMissing(error) {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  return /profiles|avatar|storage|user_wallets|shop_items|user_inventory|game_scores|game_settings|admin_roles|admin_logs|user_missions|user_achievements|user_notifications|tic_tac_toe_games|bug_reports|function|schema|permission|column|policy/i.test(message);
}
