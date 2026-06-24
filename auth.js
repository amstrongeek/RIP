(function () {
  const PROFILE_SELECT = "id,pseudo,email,title,status,bio,website,avatar_color,avatar_url,avatar_frame,profile_theme,name_style,name_color_a,name_color_b,created_at,updated_at,last_seen";
  const AVATAR_BUCKET = "avatars";
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
  const AVATAR_EXTENSIONS = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  let readyPromise = null;
  let cachedUser = null;
  let authSubscription = null;

  function authError(code, cause) {
    const error = new Error(code);
    error.code = code;
    error.cause = cause;
    return error;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizePseudo(pseudo) {
    return String(pseudo || "").trim();
  }

  function passwordScore(password) {
    const value = String(password || "");
    let score = 0;

    if (value.length >= 12) {
      score += 1;
    }

    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
      score += 1;
    }

    if (/\d/.test(value)) {
      score += 1;
    }

    if (/[^A-Za-z0-9]/.test(value)) {
      score += 1;
    }

    return score;
  }

  function validateRegistration(input) {
    const pseudo = normalizePseudo(input.pseudo);
    const email = normalizeEmail(input.email);
    const password = String(input.password || "");
    const confirm = String(input.confirm || "");

    if (!pseudo || !email || !password || !confirm) {
      throw authError("missing-fields");
    }

    if (!/^[A-Za-z0-9_-]{3,20}$/.test(pseudo)) {
      throw authError("pseudo-invalid");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw authError("email-invalid");
    }

    if (passwordScore(password) < 4) {
      throw authError("password-weak");
    }

    if (password !== confirm) {
      throw authError("password-mismatch");
    }

    if (!input.accept) {
      throw authError("terms-required");
    }

    return { pseudo, email, password };
  }

  function publicUser(authUser, profile) {
    if (!authUser) {
      return null;
    }

    const metadataPseudo = normalizePseudo(authUser.user_metadata && authUser.user_metadata.pseudo);

    return {
      id: authUser.id,
      pseudo: normalizePseudo(profile && profile.pseudo) || metadataPseudo || "Player",
      email: authUser.email || (profile && profile.email) || "",
      title: (profile && profile.title) || "Nouveau joueur",
      status: (profile && profile.status) || "En ligne",
      bio: (profile && profile.bio) || "",
      website: (profile && profile.website) || "",
      avatarColor: (profile && profile.avatar_color) || "#39ff88",
      avatarUrl: (profile && profile.avatar_url) || "",
      avatarFrame: (profile && profile.avatar_frame) || "none",
      profileTheme: (profile && profile.profile_theme) || "default",
      nameStyle: (profile && profile.name_style) || "solid",
      nameColorA: (profile && profile.name_color_a) || "#39ff88",
      nameColorB: (profile && profile.name_color_b) || "#ffdc5e",
      createdAt: (profile && profile.created_at) || authUser.created_at || new Date().toISOString(),
      updatedAt: (profile && profile.updated_at) || null,
      lastSeen: (profile && profile.last_seen) || null
    };
  }

  function dispatchAuthChange() {
    document.dispatchEvent(
      new CustomEvent("rip-auth-change", {
        detail: cachedUser
      })
    );
  }

  async function getSupabase() {
    if (!window.RipSupabase) {
      throw authError("supabase-config-missing");
    }

    return window.RipSupabase.getClient();
  }

  async function fetchProfile(supabase, authUser) {
    if (!authUser) {
      return null;
    }

    const response = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", authUser.id)
      .maybeSingle();

    if (!response.error) {
      return response.data;
    }

    const fallback = await supabase
      .from("profiles")
      .select("id,pseudo,email,created_at")
      .eq("id", authUser.id)
      .maybeSingle();

    if (fallback.error) {
      throw authError("profile-load-failed", fallback.error);
    }

    return fallback.data;
  }

  async function saveProfile(supabase, authUser, pseudo) {
    const response = await supabase
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          pseudo: normalizePseudo(pseudo) || "Player",
          email: authUser.email || "",
          title: "Nouveau joueur",
          status: "En ligne",
          avatar_color: "#39ff88",
          avatar_url: "",
          avatar_frame: "none",
          profile_theme: "default",
          name_style: "solid",
          name_color_a: "#39ff88",
          name_color_b: "#ffdc5e"
        },
        { onConflict: "id" }
      )
      .select(PROFILE_SELECT)
      .single();

    if (!response.error) {
      return response.data;
    }

    const fallback = await supabase
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          pseudo: normalizePseudo(pseudo) || "Player",
          email: authUser.email || ""
        },
        { onConflict: "id" }
      )
      .select("id,pseudo,email,created_at")
      .single();

    if (fallback.error) {
      throw authError("profile-save-failed", fallback.error);
    }

    return fallback.data;
  }

  async function ensureProfile(supabase, authUser, pseudo) {
    const profile = await fetchProfile(supabase, authUser);

    if (profile) {
      return profile;
    }

    return saveProfile(
      supabase,
      authUser,
      pseudo || (authUser.user_metadata && authUser.user_metadata.pseudo)
    );
  }

  async function refreshUser(sessionUser) {
    if (!sessionUser) {
      cachedUser = null;
      dispatchAuthChange();
      return null;
    }

    const supabase = await getSupabase();
    const profile = await ensureProfile(supabase, sessionUser);
    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", sessionUser.id);
    cachedUser = publicUser(sessionUser, profile);
    dispatchAuthChange();
    return cachedUser;
  }

  function validateProfile(input) {
    const pseudo = normalizePseudo(input.pseudo);
    const title = String(input.title || "Nouveau joueur").trim().slice(0, 32);
    const status = String(input.status || "En ligne").trim().slice(0, 32);
    const bio = String(input.bio || "").trim().slice(0, 240);
    const website = String(input.website || "").trim().slice(0, 120);
    const avatarColor = String(input.avatarColor || "#39ff88").trim();
    const avatarUrl = String(input.avatarUrl || "").trim().slice(0, 500);
    const nameStyle = String(input.nameStyle || "solid").trim();
    const nameColorA = String(input.nameColorA || "#39ff88").trim();
    const nameColorB = String(input.nameColorB || "#ffdc5e").trim();

    if (!/^[A-Za-z0-9_-]{3,20}$/.test(pseudo)) {
      throw authError("pseudo-invalid");
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(avatarColor)) {
      throw authError("avatar-invalid");
    }

    if (!["solid", "gradient", "rainbow"].includes(nameStyle)) {
      throw authError("name-style-invalid");
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(nameColorA) || !/^#[0-9A-Fa-f]{6}$/.test(nameColorB)) {
      throw authError("avatar-invalid");
    }

    if (website && !/^https:\/\/[^\s]+$/i.test(website)) {
      throw authError("website-invalid");
    }

    if (avatarUrl && !/^https:\/\/[^\s]+$/i.test(avatarUrl)) {
      throw authError("avatar-invalid");
    }

    return {
      pseudo,
      title,
      status,
      bio,
      website,
      avatarColor,
      avatarUrl,
      nameStyle,
      nameColorA,
      nameColorB
    };
  }

  async function ready() {
    if (readyPromise) {
      return readyPromise;
    }

    readyPromise = (async () => {
      if (!window.RipSupabase || !window.RipSupabase.isConfigured()) {
        cachedUser = null;
        return null;
      }

      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw authError("session-load-failed", error);
      }

      if (!authSubscription) {
        const subscriptionResult = supabase.auth.onAuthStateChange((event, session) => {
          window.setTimeout(() => {
            if (!session || event === "SIGNED_OUT") {
              cachedUser = null;
              dispatchAuthChange();
              return;
            }

            refreshUser(session.user).catch(() => {
              cachedUser = publicUser(session.user, null);
              dispatchAuthChange();
            });
          }, 0);
        });

        authSubscription = subscriptionResult.data.subscription;
      }

      return refreshUser(data.session && data.session.user);
    })();

    return readyPromise;
  }

  async function register(input) {
    const data = validateRegistration(input);
    const supabase = await getSupabase();

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          pseudo: data.pseudo
        }
      }
    });

    if (error) {
      throw authError("signup-failed", error);
    }

    if (!authData.session) {
      cachedUser = null;
      return {
        email: data.email,
        needsEmailConfirmation: true
      };
    }

    const profile = await ensureProfile(supabase, authData.user, data.pseudo);
    cachedUser = publicUser(authData.user, profile);
    dispatchAuthChange();
    return cachedUser;
  }

  async function login(emailInput, passwordInput) {
    const email = normalizeEmail(emailInput);
    const password = String(passwordInput || "");

    if (!email || !password) {
      throw authError("missing-fields");
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      throw authError("invalid-login", error);
    }

    const profile = await ensureProfile(supabase, data.user);
    cachedUser = publicUser(data.user, profile);
    dispatchAuthChange();
    return cachedUser;
  }

  async function updateProfile(input) {
    const profile = validateProfile(input);
    const supabase = await getSupabase();
    const { data: authData, error: userError } = await supabase.auth.getUser();

    if (userError || !authData.user) {
      throw authError("invalid-login", userError);
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        pseudo: profile.pseudo,
        title: profile.title,
        status: profile.status,
        bio: profile.bio,
        website: profile.website,
        avatar_color: profile.avatarColor,
        avatar_url: profile.avatarUrl || (cachedUser && cachedUser.avatarUrl) || "",
        name_style: profile.nameStyle,
        name_color_a: profile.nameColorA,
        name_color_b: profile.nameColorB,
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      })
      .eq("id", authData.user.id)
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      throw authError("profile-update-failed", error);
    }

    await supabase.auth.updateUser({
      data: {
        pseudo: profile.pseudo
      }
    });

    cachedUser = publicUser(authData.user, data);
    dispatchAuthChange();
    return cachedUser;
  }

  async function uploadAvatar(file) {
    if (!file || !file.size) {
      return "";
    }

    const extension = AVATAR_EXTENSIONS[file.type];

    if (!extension) {
      throw authError("avatar-type-invalid");
    }

    if (file.size > MAX_AVATAR_SIZE) {
      throw authError("avatar-too-large");
    }

    const supabase = await getSupabase();
    const { data: authData, error: userError } = await supabase.auth.getUser();

    if (userError || !authData.user) {
      throw authError("invalid-login", userError);
    }

    const path = `${authData.user.id}/avatar.${extension}`;
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true
      });

    if (error) {
      throw authError("avatar-upload-failed", error);
    }

    const { data } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    return data.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : "";
  }

  async function stats() {
    const user = currentUser();

    if (!user) {
      return {
        messageCount: 0,
        lastMessageAt: null
      };
    }

    const supabase = await getSupabase();
    const [{ count }, { data: lastMessages }] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("chat_messages")
        .select("created_at,content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
    ]);

    return {
      messageCount: count || 0,
      lastMessageAt: lastMessages && lastMessages[0] ? lastMessages[0].created_at : null,
      lastMessage: lastMessages && lastMessages[0] ? lastMessages[0].content : ""
    };
  }

  async function refresh() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw authError("session-load-failed", error);
    }

    return refreshUser(data.user);
  }

  async function logout() {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    cachedUser = null;
    dispatchAuthChange();
  }

  function currentUser() {
    return cachedUser;
  }

  window.RipAuth = {
    currentUser,
    login,
    logout,
    passwordScore,
    ready,
    register,
    stats,
    uploadAvatar,
    updateProfile
  };
}());
