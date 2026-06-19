(function () {
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
      createdAt: (profile && profile.created_at) || authUser.created_at || new Date().toISOString()
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

    const { data, error } = await supabase
      .from("profiles")
      .select("id,pseudo,email,created_at")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      throw authError("profile-load-failed", error);
    }

    return data;
  }

  async function saveProfile(supabase, authUser, pseudo) {
    const { data, error } = await supabase
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

    if (error) {
      throw authError("profile-save-failed", error);
    }

    return data;
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
    cachedUser = publicUser(sessionUser, profile);
    dispatchAuthChange();
    return cachedUser;
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
    register
  };
}());
