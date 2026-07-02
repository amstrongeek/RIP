const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "cbc7fd8ae9e29bd57d41f00a014d4d57";
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`;

if (!apiToken) {
  console.log("Cloudflare API token unavailable; keeping the existing workers.dev configuration.");
  process.exit(0);
}

async function cloudflareRequest(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  return { ok: response.ok && payload.success, payload };
}

const current = await cloudflareRequest("GET");
if (current.ok && current.payload.result?.subdomain) {
  console.log(`workers.dev account subdomain ready: ${current.payload.result.subdomain}.workers.dev`);
  process.exit(0);
}

const candidates = ["rip-louisspain45", "rip-cbc7fd8a"];
let lastErrors = [];

for (const subdomain of candidates) {
  const created = await cloudflareRequest("PUT", { subdomain });
  if (created.ok) {
    console.log(`Registered workers.dev account subdomain: ${subdomain}.workers.dev`);
    process.exit(0);
  }
  lastErrors = created.payload.errors || [];
}

const details = lastErrors.map((error) => error.message).filter(Boolean).join("; ");
throw new Error(`Unable to register a workers.dev account subdomain${details ? `: ${details}` : "."}`);
