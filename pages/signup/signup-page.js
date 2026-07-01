(function () {
  const form = document.querySelector("#signup-form");
  const message = document.querySelector("#signup-message");

  function setMessage(text, type = "") {
    message.textContent = text;
    message.dataset.state = type;
  }

  function errorMessage(error) {
    const code = String(error && (error.code || error.message || error.cause && error.cause.message) || "");
    const messages = {
      "missing-fields": "Complete tous les champs.",
      "pseudo-invalid": "Le pseudo doit contenir 3 a 20 lettres, chiffres, tirets ou underscores.",
      "email-invalid": "Adresse email invalide.",
      "password-weak": "Le mot de passe ne respecte pas toutes les conditions.",
      "password-mismatch": "Les mots de passe ne correspondent pas.",
      "terms-required": "Accepte la creation du compte pour continuer."
    };
    if (messages[code]) return messages[code];
    if (/already registered|already exists/i.test(code)) return "Un compte existe deja avec cet email.";
    if (/Failed to fetch|NetworkError/i.test(code)) return "Supabase est inaccessible.";
    return "Inscription impossible pour le moment.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    const data = Object.fromEntries(new FormData(form));
    data.accept = form.elements.accept.checked;
    button.disabled = true;
    setMessage("Creation du compte...");

    try {
      const result = await window.RipAuth.register(data);
      if (result.needsEmailConfirmation) {
        setMessage("Compte cree. Confirme ton email puis connecte-toi.", "success");
        form.reset();
        button.disabled = false;
        return;
      }
      setMessage("Compte cree. Redirection vers le casino...", "success");
      window.setTimeout(() => {
        window.location.href = "../home/home.html";
      }, 450);
    } catch (error) {
      console.error("Inscription:", error);
      setMessage(errorMessage(error), "error");
      button.disabled = false;
    }
  });
}());
