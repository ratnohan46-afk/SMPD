import "dotenv/config";
import { loadConfig } from "./config.js";
import { discoverServers, fetchConfiguredServer } from "./fivem.js";
import { loadCache, saveCache } from "./cache.js";
import { createClient, registerCommands } from "./discord.js";

const config = await loadConfig();

if (!config.token || !config.clientId) {
  console.error("DISCORD_TOKEN dan CLIENT_ID wajib diisi di .env");
  process.exit(1);
}

const cached = await loadCache();

const state = {
  servers: cached.servers || [],
  updatedAt: cached.updatedAt || null,
  refreshing: false
};

async function refreshIndex() {
  if (state.refreshing) return;
  state.refreshing = true;

  try {
    const configured = await Promise.all(
      config.servers.map((s) =>
        fetchConfiguredServer(s, { timeout: config.requestTimeout })
      )
    );

    let discovered = [];

    if (config.searchMode === "discovery") {
      try {
        discovered = await discoverServers({
          limit: config.discoveryLimit,
          timeout: config.requestTimeout,
          locales: config.locales,
          delayMs: config.requestDelayMs
        });
      } catch (error) {
        console.error("Discovery gagal:", error?.message || error);
      }
    }

    const map = new Map();

    for (const server of [...discovered, ...configured]) {
      const key = server.id || server.endpoint || server.name;
      if (!key) continue;
      map.set(key, server);
    }

    state.servers = [...map.values()];
    state.updatedAt = new Date().toISOString();

    await saveCache(state.servers);

    console.log(
      `[INDEX] ${state.servers.length} server | ` +
      `${state.servers.reduce((n, s) => n + (s.players?.length || 0), 0)} players`
    );
  } finally {
    state.refreshing = false;
  }
}

await refreshIndex();

const client = createClient(config, state);

try {
  await registerCommands(config);
  console.log("Slash commands registered.");
} catch (error) {
  console.error("Gagal register slash commands:", error);
  process.exit(1);
}

await client.login(config.token);

setInterval(() => {
  refreshIndex().catch((error) =>
    console.error("Refresh error:", error?.message || error)
  );
}, config.refreshSeconds * 1000);
