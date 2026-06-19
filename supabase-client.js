(function () {
  const SDK_URL = "https://esm.sh/@supabase/supabase-js@2";
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

  window.RipSupabase = {
    getClient,
    getConfig,
    isConfigured,
    normalizeProjectUrl
  };
}());
