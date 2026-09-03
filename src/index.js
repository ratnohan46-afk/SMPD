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
      config.servers.map((server) =>
        fetchConfiguredServer(server, {
          timeout: config.requestTimeout
        })
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
        console.error(
          "Discovery gagal:",
          error?.message || error
        );
      }
    }

    const map = new Map();

    for (const server of [...discovered, ...configured]) {
      const key =
        server.id ||
        server.endpoint ||
        server.name;

      if (!key) continue;

      map.set(key, server);
    }

    state.servers = [...map.values()];
    state.updatedAt = new Date().toISOString();

    await saveCache(state.servers);

    // ==============================
    // PLAYER DIAGNOSTIC
    // ==============================

    const totalPlayers = state.servers.reduce(
      (total, server) =>
        total + (Array.isArray(server.players)
          ? server.players.length
          : 0),
      0
    );

    const serversWithPlayers = state.servers.filter(
      (server) =>
        Array.isArray(server.players) &&
        server.players.length > 0
    ).length;

    const serversWithoutPlayers =
      state.servers.length - serversWithPlayers;

    console.log(
      `Finder refresh OK: ${state.servers.length} server | ` +
      `${totalPlayers} players.`
    );

    console.log(
      `[PLAYERS] ${serversWithPlayers} server memiliki player | ` +
      `${serversWithoutPlayers} server tidak memiliki player`
    );

    console.log(
      `[INDEX] ${state.servers.length} server | ` +
      `${totalPlayers} players`
    );
  } catch (error) {
    console.error(
      "Finder refresh gagal; cache lama dipertahankan:",
      error?.message || error
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
  console.error(
    "Gagal register slash commands:",
    error
  );
  process.exit(1);
}

await client.login(config.token);

setInterval(() => {
  refreshIndex().catch((error) => {
    console.error(
      "Refresh error:",
      error?.message || error
    );
  });
}, config.refreshSeconds * 1000);
