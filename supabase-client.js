(function () {
  const SDK_URL = "https://esm.sh/@supabase/supabase-js@2";
  const PROFILE_SELECT = "id,pseudo,email,title,status,bio,website,avatar_color,avatar_url,avatar_frame,profile_theme,name_style,name_color_a,name_color_b,active_badge,created_at,updated_at,last_seen";
  const SHOP_SELECT = "item_key,name,description,price,item_type,payload,sort_order,rarity,category,equip_slot,is_active";
  let clientPromise = null;

  function normalizeProjectUrl(url) {
    return String(url || "")
      .trim()
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/+$/, "");
  }

  function getConfig() {
    const config = window.RIP_SUPABASE || {};

    return {
      url: normalizeProjectUrl(config.url),
      anonKey: String(config.anonKey || "").trim()
    };
  }

  function isConfigured() {
    const config = getConfig();

    return Boolean(
      config.url.startsWith("https://")
      && config.url.includes(".supabase.co")
      && config.anonKey.length > 20
      && !config.anonKey.startsWith("sb_secret")
    );
  }

  async function getClient() {
    if (!isConfigured()) {
      const error = new Error("Supabase is not configured");
      error.code = "supabase-config-missing";
      throw error;
    }

    if (!clientPromise) {
      clientPromise = import(SDK_URL).then(({ createClient }) => {
        const config = getConfig();

        return createClient(config.url, config.anonKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
            storageKey: "rip.supabase.auth"
          }
        });
      });
    }

    return clientPromise;
  }

  async function runQuery(queryPromise) {
    const { data, error, count } = await queryPromise;

    if (error) {
      throw error;
    }

    return count !== null && count !== undefined ? { data, count } : data;
  }

  async function getCurrentAuthUser() {
    const client = await getClient();
    const { data, error } = await client.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user || null;
  }

  async function isAdmin() {
    const client = await getClient();
    const { data, error } = await client.rpc("is_admin");

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  async function submitBugReport(report) {
    const client = await getClient();
    const { data, error } = await client.rpc("submit_bug_report", {
      title_input: String(report.title || ""),
      body_input: String(report.body || ""),
      page_url_input: String(report.pageUrl || window.location.href),
      user_agent_input: String(report.userAgent || navigator.userAgent)
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function getUserProfile(userId) {
    if (!userId) {
      return null;
    }

    const client = await getClient();
    try {
      return await runQuery(
        client
          .from("profiles")
          .select(PROFILE_SELECT)
          .eq("id", userId)
          .maybeSingle()
      );
    } catch (error) {
      return runQuery(
        client
          .from("profiles")
          .select("id,pseudo,email,created_at")
          .eq("id", userId)
          .maybeSingle()
      );
    }
  }

  async function getProfiles(userIds, select = PROFILE_SELECT) {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];

    if (!ids.length) {
      return [];
    }

    const client = await getClient();
    try {
      return await runQuery(client.from("profiles").select(select).in("id", ids));
    } catch (error) {
      return runQuery(client.from("profiles").select("id,pseudo,title,status,avatar_color,created_at,last_seen").in("id", ids));
    }
  }

  async function updateUserProfile(profile) {
    const client = await getClient();
    const { data, error } = await client.rpc("update_my_profile", {
      pseudo_input: profile.pseudo,
      status_input: profile.status,
      bio_input: profile.bio,
      website_input: profile.website,
      avatar_url_input: profile.avatarUrl || profile.avatar_url || ""
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function getWallet() {
    const client = await getClient();
    const { data, error } = await client.rpc("get_my_wallet");

    if (error) {
      throw error;
    }

    return data;
  }

  async function getMissions() {
    const client = await getClient();
    const { data, error } = await client.rpc("get_my_missions");

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function getShopData() {
    const client = await getClient();
    let itemsQuery = client
      .from("shop_items")
      .select(SHOP_SELECT)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const inventoryQuery = client
      .from("user_inventory")
      .select("item_key,quantity,equipped,acquired_at")
      .order("acquired_at", { ascending: false });
    let [itemsResult, inventoryResult] = await Promise.all([itemsQuery, inventoryQuery]);

    if (itemsResult.error && /column .* does not exist|42703/i.test(String(itemsResult.error.message || itemsResult.error.code || ""))) {
      itemsQuery = client
        .from("shop_items")
        .select("item_key,name,description,price,item_type,payload,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      itemsResult = await itemsQuery;
    }

    if (itemsResult.error || inventoryResult.error) {
      throw itemsResult.error || inventoryResult.error;
    }

    return {
      items: itemsResult.data || [],
      inventory: inventoryResult.data || []
    };
  }

  async function purchaseShopItem(itemKey) {
    const client = await getClient();
    const { data, error } = await client.rpc("purchase_shop_item", {
      shop_key: itemKey
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function equipShopItem(itemKey) {
    const client = await getClient();
    const { data, error } = await client.rpc("equip_shop_item", {
      shop_key: itemKey
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function claimDailyReward() {
    const client = await getClient();
    const { data, error } = await client.rpc("claim_daily_reward");

    if (error) {
      throw error;
    }

    return data;
  }

  async function claimMission(missionKey) {
    const client = await getClient();
    const { data, error } = await client.rpc("claim_mission", {
      mission_key_input: missionKey
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function saveGameResult(gameKey, score) {
    const client = await getClient();
    const { data, error } = await client.rpc("complete_solo_game", {
      game_key_input: gameKey,
      score_input: Math.max(0, Math.round(Number(score) || 0))
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function getRecentScores(userId, limit = 6) {
    const client = await getClient();
    return runQuery(
      client
        .from("game_scores")
        .select("game_key,score,reward_points,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
  }

  async function getLatestGameReward(userId, gameKey) {
    const client = await getClient();
    return runQuery(
      client
        .from("game_scores")
        .select("reward_points")
        .eq("user_id", userId)
        .eq("game_key", gameKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );
  }

  async function getLeaderboard(gameKey = "reflex", limit = 10) {
    const client = await getClient();
    const rows = await runQuery(
      client
        .from("game_scores")
        .select("user_id,game_key,score,reward_points,created_at")
        .eq("game_key", gameKey)
        .order("score", { ascending: false })
        .limit(limit)
    );
    const profiles = await getProfiles((rows || []).map((score) => score.user_id), "id,pseudo,avatar_color,avatar_url,name_style,name_color_a,name_color_b,active_badge");
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return (rows || []).map((score, index) => ({
      ...score,
      rank: index + 1,
      profile: profileById.get(score.user_id) || null
    }));
  }

  async function getAchievements() {
    const client = await getClient();
    const { data, error } = await client.rpc("get_my_achievements");

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function claimAchievement(achievementKey) {
    const client = await getClient();
    const { data, error } = await client.rpc("claim_achievement", {
      achievement_key_input: achievementKey
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function getNotifications(limit = 20) {
    const client = await getClient();
    const { data, error } = await client.rpc("get_my_notifications", {
      limit_count: limit
    });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function markNotificationRead(notificationId) {
    const client = await getClient();
    const { data, error } = await client.rpc("mark_notification_read", {
      notification_id: notificationId
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function getMessageStats(userId) {
    const client = await getClient();
    const { count, error } = await client
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  async function getUserMessageStats(userId) {
    const client = await getClient();
    const [{ count, error: countError }, { data: lastMessages, error: lastError }] = await Promise.all([
      client
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      client
        .from("chat_messages")
        .select("created_at,content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
    ]);

    if (countError || lastError) {
      throw countError || lastError;
    }

    return {
      messageCount: count || 0,
      lastMessageAt: lastMessages && lastMessages[0] ? lastMessages[0].created_at : null,
      lastMessage: lastMessages && lastMessages[0] ? lastMessages[0].content : ""
    };
  }

  async function getDashboardData(userId) {
    const [wallet, missions, scores, shop, messageCount, achievements, notifications] = await Promise.all([
      getWallet(),
      getMissions(),
      getRecentScores(userId),
      getShopData(),
      getMessageStats(userId),
      getAchievements(),
      getNotifications(6)
    ]);

    return { wallet, missions, scores, shop, messageCount, achievements, notifications };
  }

  window.RipSupabase = {
    getClient,
    getConfig,
    isConfigured,
    normalizeProjectUrl
  };

  window.RipData = {
    claimAchievement,
    claimDailyReward,
    claimMission,
    equipShopItem,
    getAchievements,
    getCurrentAuthUser,
    getDashboardData,
    getLeaderboard,
    getLatestGameReward,
    getMessageStats,
    getUserMessageStats,
    getMissions,
    getNotifications,
    getProfiles,
    getRecentScores,
    getShopData,
    getUserProfile,
    getWallet,
    isAdmin,
    markNotificationRead,
    purchaseShopItem,
    saveGameResult,
    submitBugReport,
    updateUserProfile
  };
}());
