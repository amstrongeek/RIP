function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }

  callback();
}

function setMessage(element, text, type) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = "form-message";

  if (type) {
    element.classList.add(type);
  }
}

function humanAuthError(error) {
  const messages = {
    "supabase-config-missing": "Supabase n'est pas encore configure.",
    "pseudo-invalid": "Pseudo invalide : 3 a 20 caracteres, lettres, chiffres, tiret ou underscore.",
    "email-invalid": "Email invalide.",
    "signup-failed": "Inscription impossible. Verifie l'email ou reessaie plus tard.",
    "profile-load-failed": "Session OK, mais le profil Supabase ne charge pas. Verifie la table profiles et la RPC update_my_profile.",
    "profile-save-failed": "Profil impossible a creer. Verifie la table profiles et les policies Supabase.",
    "profile-update-failed": "Profil impossible a mettre a jour. Verifie la RPC update_my_profile dans Supabase.",
    "avatar-too-large": "Image trop lourde. Maximum : 2 Mo.",
    "avatar-type-invalid": "Format invalide. Utilise PNG, JPG, WEBP ou GIF.",
    "avatar-upload-failed": "Photo impossible a envoyer. Verifie le bucket avatars et ses policies Supabase.",
    "avatar-invalid": "Couleur avatar invalide.",
    "name-style-invalid": "Style de pseudo invalide.",
    "website-invalid": "Le lien doit commencer par https://",
    "password-weak": "Mot de passe trop faible.",
    "password-mismatch": "Les mots de passe ne correspondent pas.",
    "terms-required": "Tu dois accepter la creation d'un compte Supabase.",
    "missing-fields": "Remplis tous les champs.",
    "invalid-login": "Email ou mot de passe incorrect, ou email pas encore confirme.",
    "session-load-failed": "Session Supabase impossible a charger."
  };

  return messages[error && error.code] || "Action impossible pour le moment.";
}

function humanSupabaseError(error, fallback = "Action Supabase impossible.") {
  const message = String(error && (error.message || error.details || error.hint || error.code) || "");
  const shortMessage = message ? message.slice(0, 180) : "";

  if (/NetworkError|Failed to fetch|fetch resource|Load failed|TypeError/i.test(message)) {
    return "Supabase inaccessible depuis ton navigateur. Verifie reseau, VPN, bloqueur ou etat Supabase.";
  }

  if (/Could not find the function|function .* does not exist|PGRST202/i.test(message)) {
    return "RPC Supabase manquante : le fichier supabase-chat.sql complet n'a pas ete applique.";
  }

  if (/permission denied|not authorized|42501|row-level security|violates row-level security/i.test(message)) {
    return "Permission Supabase refusee. Verifie les grants/RLS du SQL.";
  }

  if (/relation .* does not exist|table .* does not exist|42P01/i.test(message)) {
    return "Table Supabase manquante : le fichier supabase-chat.sql complet n'a pas ete applique.";
  }

  if (/column .* does not exist|42703/i.test(message)) {
    return "Colonne Supabase manquante. La migration SQL n'est pas complete.";
  }

  if (/admin_required/i.test(message)) {
    return "Ton compte n'a pas le role admin/owner.";
  }

  if (/bug_cooldown/i.test(message)) {
    return "Attends une minute avant de renvoyer un bug.";
  }

  return shortMessage ? `${fallback} ${shortMessage}` : fallback;
}

function formatShortDate(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatRelativeDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return "maintenant";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} h`;
  }

  return formatShortDate(value);
}

function setAvatar(element, user) {
  if (!element || !user) {
    return;
  }

  element.replaceChildren();
  element.style.setProperty("--avatar-color", user.avatarColor || "#39ff88");
  element.dataset.avatarFrame = user.avatarFrame || "none";

  if (user.avatarUrl) {
    const image = document.createElement("img");
    image.src = user.avatarUrl;
    image.alt = `Avatar de ${user.pseudo || "joueur"}`;
    image.loading = "lazy";
    element.append(image);
    return;
  }

  element.textContent = (user.pseudo || "?").slice(0, 1).toUpperCase();
}

function applyNameStyle(element, user) {
  if (!element || !user) {
    return;
  }

  element.textContent = user.pseudo || "Player";
  element.classList.add("display-name");
  element.dataset.nameStyle = user.nameStyle || "solid";
  element.style.setProperty("--name-color-a", user.nameColorA || "#39ff88");
  element.style.setProperty("--name-color-b", user.nameColorB || "#ffdc5e");
}

function applyProfile(user) {
  if (!user) {
    return;
  }

  document.body.dataset.profileTheme = user.profileTheme || "default";
  document.querySelectorAll("[data-profile-avatar]").forEach((element) => setAvatar(element, user));

  document.querySelectorAll("[data-account-pseudo]").forEach((element) => {
    applyNameStyle(element, user);
  });

  document.querySelectorAll("[data-account-title]").forEach((element) => {
    element.textContent = user.title || "Nouveau joueur";
  });

  document.querySelectorAll("[data-account-status]").forEach((element) => {
    element.textContent = user.status || "En ligne";
  });

  document.querySelectorAll("[data-account-badge]").forEach((element) => {
    const badge = user.activeBadge || user.active_badge || "";
    element.hidden = !badge;
    element.textContent = badge ? `Badge ${badge}` : "";
  });

  document.querySelectorAll("[data-account-badge-separator]").forEach((element) => {
    element.hidden = !(user.activeBadge || user.active_badge);
  });

  document.querySelectorAll("[data-account-email]").forEach((element) => {
    element.textContent = user.email;
  });

  document.querySelectorAll("[data-account-created]").forEach((element) => {
    element.textContent = formatShortDate(user.createdAt);
  });

  document.querySelectorAll("[data-account-bio]").forEach((element) => {
    element.textContent = user.bio || "Ajoute une bio pour presenter ton univers.";
  });

  document.querySelectorAll("[data-account-website]").forEach((element) => {
    if (user.website) {
      element.hidden = false;
      element.href = user.website;
      element.textContent = user.website.replace(/^https:\/\//, "");
      return;
    }

    element.hidden = true;
    element.removeAttribute("href");
  });
}

async function updateAuthVisibility() {
  const auth = window.RipAuth;

  if (auth && auth.ready) {
    try {
      await auth.ready();
    } catch (error) {
      console.error("Erreur auth:", error);
    }
  }

  const user = auth ? auth.currentUser() : null;
  let isAdmin = false;

  if (user && window.RipSupabase && window.RipSupabase.isConfigured()) {
    try {
      isAdmin = window.RipData && typeof window.RipData.isAdmin === "function"
        ? await window.RipData.isAdmin()
        : false;
    } catch (error) {
      isAdmin = false;
    }
  }

  document.body.classList.toggle("is-authenticated", Boolean(user));

  document.querySelectorAll("[data-auth-visible]").forEach((element) => {
    const rule = element.getAttribute("data-auth-visible");
    if (rule === "admin") {
      element.hidden = !isAdmin;
      return;
    }
    element.hidden = (rule === "guest" && user) || (rule === "user" && !user);
  });
}

const MAIN_NAV_ITEMS = [
  { href: "index.html", label: "Accueil" },
  { href: "chat.html", label: "Tchat" },
  { href: "dashboard.html", label: "Dashboard" },
  { href: "arcade.html", label: "Arcade" },
  { href: "boutique.html", label: "Boutique" },
  { href: "classements.html", label: "Classements" },
  { href: "succes.html", label: "Succes" },
  { href: "notifications.html", label: "Notifs" },
  { href: "supabase-config.html", label: "Config Supabase" },
  { href: "https://discord.gg/9j5Nxuk2sH", label: "Discord", external: true },
  { href: "connexion.html", label: "Connexion", auth: "guest" },
  { href: "inscription.html", label: "Inscription", auth: "guest" },
  { href: "compte.html", label: "Profil", auth: "user" },
  { href: "admin.html", label: "Admin", auth: "admin", hidden: true }
];

function normalizeNavigation() {
  document.querySelectorAll("[data-main-nav]").forEach((nav) => {
    nav.replaceChildren();
    nav.dataset.open = "false";

    MAIN_NAV_ITEMS.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;

      if (item.external) {
        link.target = "_blank";
        link.rel = "noreferrer";
      }

      if (item.auth) {
        link.dataset.authVisible = item.auth;
      }

      if (item.hidden) {
        link.hidden = true;
      }

      nav.append(link);
    });
  });
}

function bindNavigationMenu() {
  document.querySelectorAll("[data-nav-toggle]").forEach((button) => {
    const nav = button.parentElement ? button.parentElement.querySelector("[data-main-nav]") : document.querySelector("[data-main-nav]");

    if (!nav) {
      return;
    }

    const close = () => {
      nav.dataset.open = "false";
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = nav.dataset.open !== "true";
      nav.dataset.open = String(open);
      button.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    });

    nav.addEventListener("click", (event) => {
      event.stopPropagation();

      if (event.target.closest("a")) {
        close();
      }
    });

    document.addEventListener("click", () => {
      if (nav.dataset.open === "true") {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.dataset.open === "true") {
        close();
      }
    });
  });
}

function markCurrentNavigation() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-main-nav] a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function bindSupabaseConfigPage() {
  const page = document.querySelector("[data-supabase-config-page]");

  if (!page) {
    return;
  }

  const config = window.RipSupabase ? window.RipSupabase.getConfig() : { url: "", anonKey: "" };
  const tableNames = [
    "profiles",
    "chat_rooms",
    "room_members",
    "chat_messages",
    "message_reactions",
    "message_reports",
    "friend_requests",
    "user_wallets",
    "point_ledger",
    "shop_items",
    "user_inventory",
    "game_scores",
    "game_duels",
    "tic_tac_toe_games",
    "user_missions",
    "user_achievements",
    "user_notifications",
    "game_settings",
    "admin_roles",
    "admin_logs",
    "bug_reports"
  ];
  const snippet = `window.RIP_SUPABASE = {
  url: "${config.url || "https://TON-PROJET.supabase.co"}",
  // Cle publique anon/publishable uniquement. Jamais service_role ou sb_secret.
  anonKey: "${config.anonKey || "TON_ANON_KEY"}"
};`;

  document.querySelectorAll("[data-config-url]").forEach((element) => {
    element.textContent = config.url || "Non configure";
  });

  document.querySelectorAll("[data-config-key]").forEach((element) => {
    element.textContent = config.anonKey || "Non configure";
  });

  document.querySelectorAll("[data-config-tables]").forEach((element) => {
    element.textContent = tableNames.join(", ");
  });

  document.querySelectorAll("[data-config-code]").forEach((element) => {
    element.textContent = snippet;
  });

  document.querySelectorAll("[data-copy-config]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(snippet);
        button.textContent = "Copie";
        window.setTimeout(() => {
          button.textContent = "Copier";
        }, 1800);
      } catch (error) {
        console.error("Copie config:", error);
        button.textContent = "Copie impossible";
      }
    });
  });
}

function bindBugForm() {
  const form = document.querySelector("[data-bug-form]");

  if (!form) {
    return;
  }

  const message = document.querySelector("[data-bug-message]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.RipSupabase || !window.RipSupabase.isConfigured()) {
      setMessage(message, "Supabase requis pour enregistrer le bug.", "error");
      return;
    }

    const submit = form.querySelector("button[type='submit']");
    const data = Object.fromEntries(new FormData(form));
    submit.disabled = true;
    setMessage(message, "Envoi du signalement...", null);

    try {
      await window.RipData.submitBugReport({
        title: data.title,
        body: data.body,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent
      });

      form.reset();
      setMessage(message, "Bug envoye. Merci.", "success");
    } catch (error) {
      console.error("Bug report:", error);
      setMessage(message, humanSupabaseError(error, "Bug non envoye pour le moment."), "error");
    } finally {
      submit.disabled = false;
    }
  });
}

function bindSignupForm() {
  const form = document.querySelector("#signup-form");

  if (!form || !window.RipAuth) {
    return;
  }

  const message = document.querySelector("#signup-message");
  const passwordInput = document.querySelector("#signup-password");
  const meter = document.querySelector("[data-password-meter]");

  if (passwordInput && meter) {
    passwordInput.addEventListener("input", () => {
      const score = window.RipAuth.passwordScore(passwordInput.value);
      meter.setAttribute("data-score", String(score));
      meter.style.width = score === 1 ? "20%" : "";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector("button[type='submit']");
    const data = Object.fromEntries(new FormData(form));
    data.accept = Boolean(form.querySelector("#signup-accept:checked"));

    submit.disabled = true;
    setMessage(message, "Creation du compte Supabase...", null);

    try {
      const result = await window.RipAuth.register(data);

      if (result.needsEmailConfirmation) {
        setMessage(message, "Compte cree. Confirme ton email, puis connecte-toi.", "success");
        form.reset();
        submit.disabled = false;
        return;
      }

      setMessage(message, "Compte cree. Redirection...", "success");
      setTimeout(() => {
        window.location.href = "compte.html";
      }, 650);
    } catch (error) {
      console.error("Erreur inscription:", error);
      setMessage(message, humanAuthError(error), "error");
      submit.disabled = false;
    }
  });
}

function bindLoginForm() {
  const form = document.querySelector("#login-form");

  if (!form || !window.RipAuth) {
    return;
  }

  const message = document.querySelector("#login-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector("button[type='submit']");
    const data = Object.fromEntries(new FormData(form));

    submit.disabled = true;
    setMessage(message, "Verification Supabase...", null);

    try {
      await window.RipAuth.login(data.email, data.password);
      setMessage(message, "Connexion reussie. Redirection...", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 650);
    } catch (error) {
      console.error("Erreur connexion:", error);
      setMessage(message, humanAuthError(error), "error");
      submit.disabled = false;
    }
  });
}

async function bindAccountPage() {
  const page = document.querySelector("[data-protected-page]");

  if (!page || !window.RipAuth) {
    return;
  }

  const message = document.querySelector("#account-message");

  try {
    await window.RipAuth.ready();
  } catch (error) {
    console.error("Erreur compte:", error);
  }

  const user = window.RipAuth.currentUser();

  if (!user) {
    setMessage(message, "Connecte-toi d'abord. Redirection...", "error");
    setTimeout(() => {
      window.location.href = "connexion.html";
    }, 900);
    return;
  }

  applyProfile(user);

  if (window.RipAuth.profileError && window.RipAuth.profileError()) {
    setMessage(message, humanAuthError(window.RipAuth.profileError()), "error");
  }

  const form = document.querySelector("#profile-form");
  const bioInput = document.querySelector("#profile-bio");
  const bioCounter = document.querySelector("[data-profile-bio-count]");
  const statsMessages = document.querySelector("[data-account-messages]");
  const statsLastMessage = document.querySelector("[data-account-last-message]");

  if (form) {
    if (form.elements.pseudo) {
      form.elements.pseudo.value = user.pseudo || "";
    }

    if (form.elements.status) {
      form.elements.status.value = user.status || "En ligne";
    }

    if (form.elements.website) {
      form.elements.website.value = user.website || "";
    }

    if (form.elements.bio) {
      form.elements.bio.value = user.bio || "";
    }
  }

  if (bioInput && bioCounter) {
    const syncBioCount = () => {
      bioCounter.textContent = String(bioInput.value.length);
    };

    syncBioCount();
    bioInput.addEventListener("input", syncBioCount);
  }

  if (window.RipAuth.stats) {
    try {
      const stats = await window.RipAuth.stats();

      if (statsMessages) {
        statsMessages.textContent = String(stats.messageCount);
      }

      if (statsLastMessage) {
        statsLastMessage.textContent = formatRelativeDate(stats.lastMessageAt);
      }
    } catch (error) {
      console.error("Erreur stats:", error);
    }
  }
}

function bindProfileForm() {
  const form = document.querySelector("#profile-form");

  if (!form || !window.RipAuth || !window.RipAuth.updateProfile) {
    return;
  }

  const message = document.querySelector("#account-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector("button[type='submit']");
    const data = Object.fromEntries(new FormData(form));
    const avatarInput = form.elements.avatarFile;
    const avatarFile = avatarInput && avatarInput.files ? avatarInput.files[0] : null;

    submit.disabled = true;
    setMessage(message, avatarFile && avatarFile.size ? "Upload de la photo..." : "Sauvegarde du profil...", null);

    try {
      if (avatarFile && avatarFile.size) {
        data.avatarUrl = await window.RipAuth.uploadAvatar(avatarFile);
        setMessage(message, "Sauvegarde du profil...", null);
      }

      const user = await window.RipAuth.updateProfile(data);
      applyProfile(user);
      document.dispatchEvent(new CustomEvent("rip-profile-saved", { detail: user }));
      if (avatarInput) {
        avatarInput.value = "";
      }
      setMessage(message, "Profil sauvegarde.", "success");
    } catch (error) {
      console.error("Erreur profil:", error);
      setMessage(message, humanAuthError(error), "error");
    } finally {
      submit.disabled = false;
    }
  });
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;

      if (window.RipAuth) {
        await window.RipAuth.logout();
      }

      window.location.href = "connexion.html";
    });
  });
}

onReady(async () => {
  const yearElement = document.querySelector("#year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  document.addEventListener("rip-auth-change", updateAuthVisibility);

  normalizeNavigation();
  markCurrentNavigation();
  bindNavigationMenu();
  bindSupabaseConfigPage();
  bindBugForm();
  await updateAuthVisibility();
  bindSignupForm();
  bindLoginForm();
  await bindAccountPage();
  bindProfileForm();
  bindLogoutButtons();
});
