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
    "profile-load-failed": "Profil introuvable. Relance le SQL Supabase puis reessaie.",
    "profile-save-failed": "Profil impossible a enregistrer. Relance le SQL Supabase puis reessaie.",
    "profile-update-failed": "Profil impossible a mettre a jour. Relance le SQL Supabase puis reessaie.",
    "avatar-too-large": "Image trop lourde. Maximum : 2 Mo.",
    "avatar-type-invalid": "Format invalide. Utilise PNG, JPG, WEBP ou GIF.",
    "avatar-upload-failed": "Photo impossible a envoyer. Relance le SQL Supabase puis reessaie.",
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

  document.body.classList.toggle("is-authenticated", Boolean(user));

  document.querySelectorAll("[data-auth-visible]").forEach((element) => {
    const rule = element.getAttribute("data-auth-visible");
    element.hidden = (rule === "guest" && user) || (rule === "user" && !user);
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
        window.location.href = "index.html";
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

  const form = document.querySelector("#profile-form");
  const bioInput = document.querySelector("#profile-bio");
  const bioCounter = document.querySelector("[data-profile-bio-count]");
  const statsMessages = document.querySelector("[data-account-messages]");
  const statsLastMessage = document.querySelector("[data-account-last-message]");

  if (form) {
    form.elements.pseudo.value = user.pseudo || "";
    form.elements.title.value = user.title || "";
    form.elements.status.value = user.status || "En ligne";
    form.elements.avatarColor.value = user.avatarColor || "#39ff88";
    form.elements.nameStyle.value = user.nameStyle || "solid";
    form.elements.nameColorA.value = user.nameColorA || "#39ff88";
    form.elements.nameColorB.value = user.nameColorB || "#ffdc5e";
    form.elements.website.value = user.website || "";
    form.elements.bio.value = user.bio || "";
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

  await updateAuthVisibility();
  bindSignupForm();
  bindLoginForm();
  await bindAccountPage();
  bindProfileForm();
  bindLogoutButtons();
});
