(function () {
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#login-message");

  function setMessage(text, type = "") {
    message.textContent = text;
    message.dataset.state = type;
  }

  function errorMessage(error) {
    const code = String(error && (error.code || error.message) || "");
    if (/invalid-login|Invalid login credentials/i.test(code)) return "Email ou mot de passe incorrect.";
    if (/missing-fields/i.test(code)) return "Complete les deux champs.";
    if (/Failed to fetch|NetworkError/i.test(code)) return "Supabase est inaccessible.";
    return "Connexion impossible pour le moment.";
  }

  function destination() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^\.\.\/(home|casino)\/[a-z-]+\.html(?:\?.*)?$/.test(next)
      ? next
      : "../home/home.html";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    button.disabled = true;
    setMessage("Connexion en cours...");

    try {
      await window.RipAuth.login(data.get("email"), data.get("password"));
      setMessage("Connexion reussie.", "success");
      window.setTimeout(() => {
        window.location.href = destination();
      }, 350);
    } catch (error) {
      console.error("Connexion:", error);
      setMessage(errorMessage(error), "error");
      button.disabled = false;
    }
  });

  window.RipAuth.ready().then(() => {
    if (window.RipAuth.currentUser()) window.location.href = destination();
  }).catch(() => null);
}());
