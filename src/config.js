import fs from "node:fs/promises";
import "dotenv/config";

export async function loadConfig() {
  const raw = await fs.readFile("config/servers.json", "utf8");
  const json = JSON.parse(raw);

  const servers = Array.isArray(json.servers)
    ? json.servers.filter((s) => s && s.enabled && s.endpoint)
    : [];

  const locales = String(process.env.DISCOVERY_LOCALES || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID || "",
    searchMode: (process.env.SEARCH_MODE || "discovery").toLowerCase(),
    discoveryLimit: Math.max(1, Number(process.env.DISCOVERY_LIMIT || 200)),
    requestTimeout: Math.max(1000, Number(process.env.REQUEST_TIMEOUT || 7000)),
    maxResults: Math.max(1, Number(process.env.MAX_RESULTS || 50)),
    refreshSeconds: Math.max(15, Number(process.env.CACHE_REFRESH_SECONDS || 60)),
    locales,
    requestDelayMs: Math.max(0, Number(process.env.REQUEST_DELAY_MS || 100)),
    servers
  };
}
