const CONSENT_KEY = "rip.ads.consent.v2";

const FORMATS = {
  leaderboard: {
    width: 468,
    height: 60,
    key: "97d73c025c23583543634121efa38e7e"
  },
  mobile: {
    width: 320,
    height: 50,
    key: "b6686da78709d799ada876c072a55666"
  },
  rectangle: {
    width: 300,
    height: 250,
    key: "a6baa55d5961e65a9b7a8b3e4c4faddc"
  },
  skyscraper: {
    width: 160,
    height: 300,
    key: "d455c3542ff08a4376cd270956e90058"
  },
  tower: {
    width: 160,
    height: 600,
    key: "9b095156bd29cb3713334893ae9bd4c6"
  }
};

function getConsent() {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "refused" ? value : null;
  } catch {
    return null;
  }
}

function frameDocument(format) {
  const options = JSON.stringify({
    key: format.key,
    format: "iframe",
    height: format.height,
    width: format.width,
    params: {}
  });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="origin"><base target="_blank"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}body{display:grid;place-items:center}</style></head><body><script>window.atOptions=${options};</script><script src="https://www.highperformanceformat.com/${format.key}/invoke.js"></script></body></html>`;
}

function nativeFrameDocument() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="origin"><base target="_blank"><style>*{box-sizing:border-box}html,body{width:100%;min-height:100%;margin:0;overflow:hidden;background:transparent}</style></head><body><script async data-cfasync="false" src="https://pl30166472.effectivecpmnetwork.com/182e0d905f831b98d55d8c931d3f101d/invoke.js"></script><div id="container-182e0d905f831b98d55d8c931d3f101d"></div></body></html>`;
}

function onclickFrameDocument() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="origin"><base target="_blank"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent}body{display:grid;place-items:center;padding:4px}button{width:100%;height:42px;border:2px solid #050506;background:#ffdc5e;box-shadow:3px 3px 0 #050506;color:#050506;cursor:pointer;font:700 10px "Courier New",monospace}button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #050506}</style></head><body><button type="button">OUVRIR UN SPONSOR</button><script src="https://pl30166473.effectivecpmnetwork.com/0d/10/b4/0d10b40d051b1989e12243cc0c705f99.js"></script></body></html>`;
}

function createAdFrame(slotName) {
  const requested = slotName === "responsive"
    ? (window.matchMedia("(max-width: 600px)").matches ? "mobile" : "leaderboard")
    : slotName;
  const isNative = requested === "native";
  const isOnclick = requested === "onclick";
  const format = FORMATS[requested];
  if (!isNative && !isOnclick && !format) return null;

  const frame = document.createElement("iframe");
  frame.className = `ad-frame ad-frame-${requested}`;
  frame.title = isOnclick ? "Lien sponsorise" : "Contenu publicitaire";
  frame.loading = "lazy";
  frame.referrerPolicy = "origin";
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");
  frame.width = String(isNative ? 720 : isOnclick ? 260 : format.width);
  frame.height = String(isNative ? 280 : isOnclick ? 52 : format.height);
  frame.srcdoc = isNative
    ? nativeFrameDocument()
    : isOnclick
      ? onclickFrameDocument()
      : frameDocument(format);
  return frame;
}

function hasHiddenContainer(slot, section) {
  let element = slot.parentElement;
  while (element && element !== document.body) {
    if (element !== section && element.hidden) return true;
    element = element.parentElement;
  }
  return false;
}

function renderSlots(consent) {
  document.querySelectorAll("[data-ad-slot]").forEach((slot) => {
    const section = slot.closest("[data-ad-section]");
    if (consent !== "accepted") {
      if (section) section.hidden = true;
      slot.replaceChildren();
      delete slot.dataset.loaded;
      return;
    }

    if (section) section.hidden = false;
    if (hasHiddenContainer(slot, section)) {
      if (section) section.hidden = true;
      slot.replaceChildren();
      delete slot.dataset.loaded;
      return;
    }
    if (slot.dataset.loaded === "true") return;
    const frame = createAdFrame(slot.dataset.adSlot);
    if (!frame) return;
    slot.replaceChildren(frame);
    slot.dataset.loaded = "true";
  });
}

function removeConsentPrompt() {
  document.querySelector("[data-ad-consent]")?.remove();
}

function saveConsent(value) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Ads can still follow the choice for the current page when storage is blocked.
  }
  removeConsentPrompt();
  renderSlots(value);
}

function showConsentPrompt() {
  removeConsentPrompt();
  const prompt = document.createElement("aside");
  prompt.className = "ad-consent";
  prompt.dataset.adConsent = "";
  prompt.setAttribute("aria-label", "Choix des publicites");
  prompt.innerHTML = `
    <div>
      <strong>Publicites partenaires</strong>
      <p>Les annonces financent le site. Elles sont chargees uniquement avec ton accord et peuvent utiliser des cookies.</p>
    </div>
    <div class="ad-consent-actions">
      <button type="button" data-ad-refuse>Refuser</button>
      <button type="button" data-ad-accept>Accepter</button>
    </div>`;
  prompt.querySelector("[data-ad-refuse]").addEventListener("click", () => saveConsent("refused"));
  prompt.querySelector("[data-ad-accept]").addEventListener("click", () => saveConsent("accepted"));
  document.body.append(prompt);
}

export function initializeAds() {
  const consent = getConsent();
  renderSlots(consent);
  if (!consent) showConsentPrompt();

  document.querySelectorAll("[data-ad-settings]").forEach((button) => {
    button.addEventListener("click", showConsentPrompt);
  });
}

export function refreshAds() {
  renderSlots(getConsent());
}
