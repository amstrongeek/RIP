(function () {
  const SDK_URL = "https://esm.sh/@supabase/supabase-js@2";
  const PROFILE_SELECT = "id,pseudo,email,title,status,bio,website,avatar_color,avatar_url,avatar_frame,profile_theme,name_style,name_color_a,name_color_b,active_badge,created_at,updated_at,last_seen";
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
      const error = new Error("supabase-config-missing");
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

  async function getUserProfile(userId) {
    if (!userId) return null;
    const client = await getClient();
    const response = await client
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (!response.error) return response.data;

    const fallback = await client
      .from("profiles")
      .select("id,pseudo,email,created_at")
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    return fallback.data;
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
    if (error) throw error;
    return data;
  }

  async function getWallet() {
    const client = await getClient();
    const { data, error } = await client.rpc("get_my_wallet");
    if (error) throw error;
    return data;
  }

  window.RipSupabase = {
    getClient,
    getConfig,
    isConfigured,
    normalizeProjectUrl
  };

  window.RipData = {
    getUserProfile,
    getWallet,
    updateUserProfile
  };
}());
