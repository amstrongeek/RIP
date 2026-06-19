(function () {
  const USERS_KEY = "rip.users.v1";
  const SESSION_KEY = "rip.session.v1";
  const ITERATIONS = 210000;
  const HASH_BITS = 256;
  const encoder = new TextEncoder();

  function authError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function ensureCrypto() {
    if (!window.crypto || !window.crypto.subtle) {
      throw authError("crypto-unavailable");
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return window.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function randomBytes(length) {
    ensureCrypto();

    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
  }

  function randomToken(length) {
    return bytesToBase64(randomBytes(length))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizePseudo(pseudo) {
    return String(pseudo || "").trim();
  }

  function readUsers() {
    try {
      const users = JSON.parse(window.localStorage.getItem(USERS_KEY) || "[]");
      return Array.isArray(users) ? users : [];
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async function hashPassword(password, saltBase64, iterations) {
    ensureCrypto();

    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: base64ToBytes(saltBase64),
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      HASH_BITS
    );

    return bytesToBase64(new Uint8Array(bits));
  }

  function constantTimeEqual(base64A, base64B) {
    const a = base64ToBytes(base64A);
    const b = base64ToBytes(base64B);
    const maxLength = Math.max(a.length, b.length);
    let diff = a.length ^ b.length;

    for (let index = 0; index < maxLength; index += 1) {
      diff |= (a[index] || 0) ^ (b[index] || 0);
    }

    return diff === 0;
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

  function publicUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      pseudo: user.pseudo,
      email: user.email,
      createdAt: user.createdAt
    };
  }

  function setSession(user) {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: user.id,
        issuedAt: Date.now(),
        token: randomToken(32)
      })
    );
  }

  function currentUser() {
    try {
      const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null");
      const users = readUsers();
      const user = users.find((candidate) => candidate.id === session.userId);
      return publicUser(user);
    } catch (error) {
      return null;
    }
  }

  async function register(input) {
    const data = validateRegistration(input);
    const users = readUsers();

    if (users.some((user) => user.email === data.email)) {
      throw authError("email-exists");
    }

    const salt = bytesToBase64(randomBytes(16));
    const hash = await hashPassword(data.password, salt, ITERATIONS);
    const user = {
      id: randomToken(16),
      pseudo: data.pseudo,
      email: data.email,
      createdAt: new Date().toISOString(),
      password: {
        algorithm: "PBKDF2-SHA256",
        iterations: ITERATIONS,
        salt,
        hash
      }
    };

    writeUsers([...users, user]);
    setSession(user);
    return publicUser(user);
  }

  async function login(emailInput, passwordInput) {
    const email = normalizeEmail(emailInput);
    const password = String(passwordInput || "");

    if (!email || !password) {
      throw authError("missing-fields");
    }

    const users = readUsers();
    const user = users.find((candidate) => candidate.email === email);

    if (!user) {
      throw authError("invalid-login");
    }

    const hash = await hashPassword(password, user.password.salt, user.password.iterations || ITERATIONS);

    if (!constantTimeEqual(hash, user.password.hash)) {
      throw authError("invalid-login");
    }

    setSession(user);
    return publicUser(user);
  }

  function logout() {
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  window.RipAuth = {
    currentUser,
    login,
    logout,
    passwordScore,
    register
  };
}());
