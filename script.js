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
    "crypto-unavailable": "Ouvre le site en HTTPS ou localhost pour utiliser Web Crypto.",
    "pseudo-invalid": "Pseudo invalide : 3 a 20 caracteres, lettres, chiffres, tiret ou underscore.",
    "email-invalid": "Email invalide.",
    "email-exists": "Un compte existe deja avec cet email.",
    "password-weak": "Mot de passe trop faible.",
    "password-mismatch": "Les mots de passe ne correspondent pas.",
    "terms-required": "Tu dois confirmer que le compte est local a ce navigateur.",
    "missing-fields": "Remplis tous les champs.",
    "invalid-login": "Email ou mot de passe incorrect."
  };

  return messages[error && error.code] || "Action impossible pour le moment.";
}

function updateAuthVisibility() {
  const auth = window.RipAuth;
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
    setMessage(message, "Creation du compte...", null);

    try {
      await window.RipAuth.register(data);
      setMessage(message, "Compte cree. Redirection...", "success");
      setTimeout(() => {
        window.location.href = "compte.html";
      }, 650);
    } catch (error) {
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
    setMessage(message, "Verification...", null);

    try {
      await window.RipAuth.login(data.email, data.password);
      setMessage(message, "Connexion reussie. Redirection...", "success");
      setTimeout(() => {
        window.location.href = "compte.html";
      }, 650);
    } catch (error) {
      setMessage(message, humanAuthError(error), "error");
      submit.disabled = false;
    }
  });
}

function bindAccountPage() {
  const page = document.querySelector("[data-protected-page]");

  if (!page || !window.RipAuth) {
    return;
  }

  const user = window.RipAuth.currentUser();
  const message = document.querySelector("#account-message");

  if (!user) {
    setMessage(message, "Connecte-toi d'abord. Redirection...", "error");
    setTimeout(() => {
      window.location.href = "connexion.html";
    }, 900);
    return;
  }

  const createdAt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(user.createdAt));

  document.querySelectorAll("[data-account-pseudo]").forEach((element) => {
    element.textContent = user.pseudo;
  });

  document.querySelectorAll("[data-account-email]").forEach((element) => {
    element.textContent = user.email;
  });

  document.querySelectorAll("[data-account-created]").forEach((element) => {
    element.textContent = createdAt;
  });
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => {
      if (window.RipAuth) {
        window.RipAuth.logout();
      }

      window.location.href = "connexion.html";
    });
  });
}

onReady(() => {
  const yearElement = document.querySelector("#year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  updateAuthVisibility();
  bindSignupForm();
  bindLoginForm();
  bindAccountPage();
  bindLogoutButtons();
});
