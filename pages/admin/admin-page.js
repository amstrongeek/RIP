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

function renderHeaderAccount(user) {
  document.querySelectorAll("[data-header-account]").forEach((element) => {
    element.href = PAGE_ROUTES.account;
    element.title = user && user.pseudo ? `Profil de ${user.pseudo}` : "Ouvrir mon profil";
  });

  document.querySelectorAll("[data-header-name]").forEach((element) => {
    element.textContent = user && user.pseudo ? user.pseudo : "Compte";
  });

  document.querySelectorAll("[data-header-avatar]").forEach((element) => {
    if (user) {
      setAvatar(element, user);
      return;
    }

    element.replaceChildren();
    element.removeAttribute("data-avatar-frame");
    element.style.removeProperty("--avatar-color");
    element.textContent = "?";
  });
}

function applyProfile(user) {
  if (!user) {
    return;
  }

  document.body.dataset.profileTheme = user.profileTheme || "default";
  renderHeaderAccount(user);
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
  renderHeaderAccount(user);

  document.querySelectorAll("[data-auth-visible]").forEach((element) => {
    const rule = element.getAttribute("data-auth-visible");
    if (rule === "admin") {
      element.hidden = !isAdmin;
      return;
    }
    element.hidden = (rule === "guest" && user) || (rule === "user" && !user);
  });
}

const PAGE_ROUTES = {
  home: "../home/home.html",
  chat: "../chat/chat.html",
  dashboard: "../dashboard/dashboard.html",
  arcade: "../arcade/arcade.html",
  shop: "../shop/shop.html",
  leaderboards: "../leaderboards/leaderboards.html",
  achievements: "../achievements/achievements.html",
  notifications: "../notifications/notifications.html",
  account: "../account/account-profile.html",
  login: "../login/login.html",
  signup: "../signup/signup.html",
  admin: "../admin/admin.html"
};

const MAIN_NAV_ITEMS = [
  { href: PAGE_ROUTES.home, label: "Accueil" },
  { href: PAGE_ROUTES.chat, label: "Tchat" },
  { href: PAGE_ROUTES.dashboard, label: "Dashboard" },
  { href: PAGE_ROUTES.arcade, label: "Arcade" },
  { href: PAGE_ROUTES.shop, label: "Boutique" },
  { href: PAGE_ROUTES.leaderboards, label: "Classements" },
  { href: PAGE_ROUTES.achievements, label: "Succes" },
  { href: PAGE_ROUTES.admin, label: "Admin", auth: "admin", hidden: true }
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
  document.querySelectorAll("[data-nav-toggle]").forEach((button, index) => {
    const header = button.closest(".site-header");
    const nav = header ? header.querySelector("[data-main-nav]") : document.querySelector("[data-main-nav]");

    if (!nav) {
      return;
    }

    if (!nav.id) {
      nav.id = `main-navigation-${index + 1}`;
    }

    button.setAttribute("aria-controls", nav.id);
    nav.dataset.open = "false";

    const close = () => {
      nav.dataset.open = "false";
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    };

    const open = () => {
      nav.dataset.open = "true";
      button.setAttribute("aria-expanded", "true");
      document.body.classList.add("nav-open");
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (nav.dataset.open === "true") {
        close();
        return;
      }

      open();
    });

    nav.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");

      if (link) {
        const target = link.getAttribute("target");
        const href = link.href;

        if (routePath(href) === routePath(window.location.href)) {
          event.preventDefault();
          close();
          return;
        }

        if (!target || target === "_self") {
          event.preventDefault();
          window.location.href = href;
        }
        return;
      }

      event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
      if (nav.dataset.open !== "true") {
        return;
      }

      if (nav.contains(event.target) || button.contains(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      close();
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.dataset.open === "true") {
        close();
        button.focus();
      }
    });
  });
}

function routePath(value) {
  const url = new URL(value, window.location.href);
  return url.pathname.replace(/\/index\.html$/, "/");
}

function markCurrentNavigation() {
  const current = routePath(window.location.href);
  document.querySelectorAll("[data-main-nav] a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && routePath(href) === current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
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
        window.location.href = PAGE_ROUTES.account;
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
        window.location.href = PAGE_ROUTES.dashboard;
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
      window.location.href = PAGE_ROUTES.login;
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
  await bindProfileShareCard(user);

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

function safeStat(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function statLabel(gameKey) {
  const labels = {
    aim: "Aim",
    cipher: "Code",
    dungeon: "Dungeon",
    memory: "Memory",
    platformer: "Platformer",
    puzzle: "Puzzle",
    reflex: "Reflex",
    rpg: "RPG",
    runner: "Runner",
    snake: "Snake",
    space: "Space",
    tycoon: "Tycoon"
  };
  return labels[gameKey] || gameKey || "--";
}

function profileStatsFallback(user) {
  return {
    profile: user,
    wallet: {
      points: 0,
      total_points: 0,
      xp: 0,
      level: 1,
      streak: 0
    },
    stats: {
      messages_count: 0,
      games_count: 0,
      inventory_count: 0,
      achievements_unlocked: 0,
      achievements_total: 0,
      best_score: 0,
      best_game: "--",
      total_rewards: 0
    },
    recent_scores: []
  };
}

function renderShareStats(statsData) {
  const data = statsData || profileStatsFallback(window.RipAuth && window.RipAuth.currentUser());
  const stats = data.stats || {};
  const wallet = data.wallet || {};
  const bestGame = statLabel(stats.best_game);

  const values = {
    "[data-share-level]": wallet.level || 1,
    "[data-share-points]": wallet.points || 0,
    "[data-share-xp]": wallet.xp || 0,
    "[data-share-streak]": wallet.streak || 0,
    "[data-share-messages]": stats.messages_count || 0,
    "[data-share-games]": stats.games_count || 0,
    "[data-share-inventory]": stats.inventory_count || 0,
    "[data-share-achievements]": `${stats.achievements_unlocked || 0}/${stats.achievements_total || 0}`,
    "[data-share-best-score]": stats.best_score || 0,
    "[data-share-best-game]": bestGame,
    "[data-share-total-rewards]": stats.total_rewards || 0
  };

  Object.entries(values).forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = String(value);
    });
  });
}

function drawPixelCard(canvas, user, statsData) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const data = statsData || profileStatsFallback(user);
  const stats = data.stats || {};
  const wallet = data.wallet || {};
  const pseudo = user.pseudo || "Player";

  context.imageSmoothingEnabled = false;
  context.fillStyle = "#101014";
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 28) {
    context.strokeStyle = "rgba(255,255,255,0.045)";
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y < height; y += 28) {
    context.strokeStyle = "rgba(255,255,255,0.045)";
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255,59,189,0.32)");
  gradient.addColorStop(0.5, "rgba(57,255,136,0.14)");
  gradient.addColorStop(1, "rgba(255,220,94,0.26)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "#050506";
  context.lineWidth = 18;
  context.strokeRect(9, 9, width - 18, height - 18);
  context.strokeStyle = "#39ff88";
  context.lineWidth = 5;
  context.strokeRect(28, 28, width - 56, height - 56);

  context.fillStyle = "#050506";
  context.fillRect(50, 56, width - 100, 96);
  context.fillStyle = "#ffdc5e";
  context.font = "24px 'Press Start 2P', monospace";
  context.fillText("RIP #TUFF PLAYER CARD", 74, 95);
  context.fillStyle = "#c6c6d6";
  context.font = "15px 'Press Start 2P', monospace";
  context.fillText("CARTE DE STATS OFFICIELLE", 76, 130);

  context.fillStyle = user.avatarColor || "#39ff88";
  context.fillRect(70, 190, 132, 132);
  context.fillStyle = "#050506";
  context.fillRect(82, 202, 108, 108);
  context.fillStyle = user.avatarColor || "#39ff88";
  context.font = "68px 'Press Start 2P', monospace";
  context.fillText(pseudo.slice(0, 1).toUpperCase(), 112, 286);

  context.fillStyle = "#f8f8f2";
  context.font = "34px 'Press Start 2P', monospace";
  context.fillText(pseudo.slice(0, 18), 236, 218);
  context.fillStyle = "#39ff88";
  context.font = "18px 'Press Start 2P', monospace";
  context.fillText((user.title || "Nouveau joueur").slice(0, 28), 238, 260);
  context.fillStyle = "#ffdc5e";
  context.fillText(`NIVEAU ${safeStat(wallet.level, 1)}  /  ${safeStat(wallet.points)} COINS`, 238, 304);

  const cards = [
    ["XP", safeStat(wallet.xp)],
    ["STREAK", safeStat(wallet.streak)],
    ["MESSAGES", safeStat(stats.messages_count)],
    ["PARTIES", safeStat(stats.games_count)],
    ["SUCCES", `${safeStat(stats.achievements_unlocked)}/${safeStat(stats.achievements_total)}`],
    ["INVENTAIRE", safeStat(stats.inventory_count)],
    ["BEST", safeStat(stats.best_score)],
    ["JEU", statLabel(stats.best_game).toUpperCase().slice(0, 10)]
  ];

  cards.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = 70 + col * 225;
    const y = 380 + row * 126;
    context.fillStyle = "#1c1c28";
    context.fillRect(x, y, 194, 92);
    context.strokeStyle = "#050506";
    context.lineWidth = 5;
    context.strokeRect(x, y, 194, 92);
    context.fillStyle = "#ffdc5e";
    context.font = "13px 'Press Start 2P', monospace";
    context.fillText(label, x + 16, y + 32);
    context.fillStyle = "#f8f8f2";
    context.font = "22px 'Press Start 2P', monospace";
    context.fillText(String(value).slice(0, 11), x + 16, y + 70);
  });

  context.fillStyle = "#050506";
  context.fillRect(70, 660, width - 140, 68);
  context.fillStyle = "#39ff88";
  context.font = "16px 'Press Start 2P', monospace";
  context.fillText(`TOTAL REWARDS: ${safeStat(stats.total_rewards)} RIP COINS`, 92, 704);
  context.fillStyle = "#c6c6d6";
  context.font = "12px 'Press Start 2P', monospace";
  context.fillText(`rip-tuff.gg / ${new Date().toLocaleDateString("fr-FR")}`, 646, 704);
}

function shareText(user, statsData) {
  const data = statsData || profileStatsFallback(user);
  const stats = data.stats || {};
  const wallet = data.wallet || {};

  return [
    `RIP #TUFF - ${user.pseudo || "Player"}`,
    `Niveau ${safeStat(wallet.level, 1)} / ${safeStat(wallet.points)} coins / ${safeStat(wallet.xp)} XP`,
    `Best score: ${safeStat(stats.best_score)} sur ${statLabel(stats.best_game)}`,
    `Succes: ${safeStat(stats.achievements_unlocked)}/${safeStat(stats.achievements_total)} / Inventaire: ${safeStat(stats.inventory_count)}`,
    `Messages: ${safeStat(stats.messages_count)} / Parties: ${safeStat(stats.games_count)} / Rewards: ${safeStat(stats.total_rewards)}`
  ].join("\n");
}

async function bindProfileShareCard(user) {
  const panel = document.querySelector("[data-profile-share]");
  const canvas = document.querySelector("[data-share-card-canvas]");
  const downloadButton = document.querySelector("[data-share-download]");
  const copyButton = document.querySelector("[data-share-copy]");
  const status = document.querySelector("[data-share-status]");

  if (!panel || !canvas || !downloadButton || !user) {
    return;
  }

  let statsData = profileStatsFallback(user);

  try {
    if (window.RipData && typeof window.RipData.getProfileCardStats === "function") {
      statsData = await window.RipData.getProfileCardStats();
    }
  } catch (error) {
    console.error("Stats carte profil:", error);
    if (status) {
      status.textContent = "Stats partielles : verifie supabase-chat.sql.";
      status.dataset.state = "error";
    }
  }

  renderShareStats(statsData);
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready.catch(() => null);
  }
  drawPixelCard(canvas, user, statsData);

  downloadButton.addEventListener("click", () => {
    drawPixelCard(canvas, user, statsData);
    const link = document.createElement("a");
    const cleanPseudo = String(user.pseudo || "player").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    link.download = `rip-tuff-card-${cleanPseudo}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareText(user, statsData));
        if (status) {
          status.textContent = "Stats copiees.";
          status.dataset.state = "ok";
        }
      } catch (error) {
        console.error("Copie stats profil:", error);
        if (status) {
          status.textContent = "Copie impossible dans ce navigateur.";
          status.dataset.state = "error";
        }
      }
    });
  }

  if (status && !status.textContent) {
    status.textContent = "Carte prete.";
    status.dataset.state = "ok";
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

      window.location.href = PAGE_ROUTES.login;
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
  bindBugForm();
  await updateAuthVisibility();
  bindSignupForm();
  bindLoginForm();
  await bindAccountPage();
  bindProfileForm();
  bindLogoutButtons();
});
