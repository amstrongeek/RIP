import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const publicEntries = ["index.html", "404.html", "assets", "pages", "shared", "src"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of publicEntries) {
  await cp(resolve(root, entry), resolve(output, entry), { recursive: true });
}

await writeFile(resolve(output, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
`, "utf8");

console.log(`Static build ready: ${publicEntries.length} allowlisted entries copied to dist.`);
