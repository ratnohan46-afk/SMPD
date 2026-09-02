import "dotenv/config";
import { loadConfig } from "./config.js";
import { loadCache, saveCache } from "./cache.js";
import { discoverServers, fetchConfiguredServer } from "./fivem.js";
import { createClient, registerCommands } from "./discord.js";

const config = await loadConfig();

if (!config.token) throw new Error("DISCORD_TOKEN belum diisi.");
if (!config.clientId) throw new Error("CLIENT_ID belum diisi.");

const cached = await loadCache();
const state = {
  servers: cached.servers || [],
  updatedAt: cached.updatedAt || null,
  refreshing: false
};

async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;

  try {
    let servers = [];

    if (config.searchMode === "configured") {
      for (const server of config.servers) {
        servers.push(await fetchConfiguredServer(server, {
          timeout: config.requestTimeout
        }));
      }
    } else {
      servers = await discoverServers({
        limit: config.discoveryLimit,
        timeout: config.requestTimeout,
        locales: config.locales,
        delayMs: config.requestDelayMs
      });
    }

    if (servers.length > 0) {
      state.servers = servers;
      state.updatedAt = new Date().toISOString();
      await saveCache(servers);
      console.log(`Finder refresh OK: ${servers.length} server.`);
    } else {
      console.warn("Finder refresh menghasilkan 0 server; cache lama dipertahankan.");
    }
  } catch (error) {
    console.error("Finder refresh gagal; cache lama dipertahankan:", error?.message || error);
  } finally {
    state.refreshing = false;
  }
}

await refresh();

const client = createClient(config, state);
await registerCommands(config);
await client.login(config.token);

setInterval(() => {
  refresh().catch((error) => console.error("Refresh loop error:", error));
}, config.refreshSeconds * 1000);
