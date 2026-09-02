import { searchServers, getServerByEndpoint } from "fivem-server-api";

function cleanEndpoint(value) {
  if (!value || typeof value !== "string") return null;

  let endpoint = value.trim();

  if (endpoint.includes("://")) {
    endpoint = endpoint.split("://")[1];
  }

  endpoint = endpoint.split("/")[0].trim().replace(/\/+$/, "");

  if (!endpoint) return null;
  if (endpoint.includes("private-placeholder.cfx.re")) return null;
  if (endpoint.includes("localhost")) return null;
  if (endpoint.startsWith("127.")) return null;
  if (endpoint.startsWith("0.0.0.0")) return null;

  return endpoint;
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];

  return players.map((p) => ({
    id: p?.id ?? "?",
    name: String(p?.name ?? "Unknown"),
    ping: Number.isFinite(Number(p?.ping)) ? Number(p.ping) : null
  }));
}

function normalizeServer(result) {
  const data = result?.Data || result?.data || result || {};

  const endpoint =
    cleanEndpoint(data.connectEndPoints?.[0]) ||
    cleanEndpoint(result?.EndPoint) ||
    cleanEndpoint(result?.endpoint);

  return {
    name: String(
      data.hostname ||
      data.vars?.sv_projectName ||
      result?.name ||
      result?.hostname ||
      "Unknown Server"
    ),
    endpoint,
    players: normalizePlayers(data.players),
    clients: Number.isFinite(Number(data.clients))
      ? Number(data.clients)
      : 0,
    maxClients: Number.isFinite(Number(data.svMaxclients))
      ? Number(data.svMaxclients)
      : 0
  };
}

async function getJson(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SMPD-FiveM-Finder/1.0"
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPlayers(server, timeout) {
  const endpoint = cleanEndpoint(server?.endpoint);
  if (!endpoint) return server?.players || [];

  const urls = [
    `http://${endpoint}/players.json`,
    `https://${endpoint}/players.json`
  ];

  for (const url of urls) {
    const data = await getJson(url, timeout);

    if (Array.isArray(data)) {
      return normalizePlayers(data);
    }
  }

  return server?.players || [];
}

async function refreshServer(server, timeout) {
  const players = await fetchPlayers(server, timeout);

  return {
    ...server,
    players,
    clients: players.length || server.clients || 0
  };
}

async function mapConcurrent(items, worker, concurrency = 8) {
  const results = new Array(items.length);
  let next = 0;

  async function runner() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;

      try {
        results[index] = await worker(items[index]);
      } catch {
        results[index] = items[index];
      }
    }
  }

  const count = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: count }, () => runner())
  );

  return results;
}

export async function discoverServers({
  limit = 25,
  timeout = 15000
} = {}) {
  const safeLimit = Math.max(1, Number(limit) || 25);
  const safeTimeout = Math.max(5000, Number(timeout) || 15000);

  /*
   * IMPORTANT:
   * fivem-server-api 1.6.1 returns an ARRAY from searchServers().
   * The previous implementation incorrectly treated the result
   * as { Data: ... }, which can produce zero discovered servers.
   *
   * We intentionally do NOT pass DISCOVERY_LOCALES here.
   * Discovery already worked before; player lookup is performed
   * separately below.
   */
  let rawServers = [];

  try {
    rawServers = await searchServers(
      {},
      safeLimit,
      safeTimeout,
      0
    );
  } catch (error) {
    console.error(
      "FiveM discovery gagal:",
      error?.message || error
    );
    return [];
  }

  if (!Array.isArray(rawServers)) {
    console.warn("FiveM discovery mengembalikan data yang bukan array.");
    return [];
  }

  const servers = rawServers
    .map(normalizeServer)
    .filter((server) => server.endpoint);

  if (!servers.length) {
    console.warn(
      `FiveM discovery mendapatkan ${rawServers.length} server, ` +
      "tetapi tidak ada endpoint publik yang bisa digunakan."
    );
    return [];
  }

  /*
   * Do not fetch all servers sequentially.
   * Eight requests are processed concurrently so startup/refresh
   * remains practical on Helipod.
   */
  return mapConcurrent(
    servers,
    (server) => refreshServer(server, safeTimeout),
    8
  );
}

export async function fetchConfiguredServer(
  server,
  { timeout = 15000 } = {}
) {
  const endpoint = cleanEndpoint(
    server?.endpoint ||
    server?.address ||
    server?.ip
  );

  if (!endpoint) {
    return {
      name: server?.name || "Unknown Server",
      endpoint: null,
      players: []
    };
  }

  try {
    const result = await getServerByEndpoint(
      endpoint,
      timeout
    );

    const normalized = normalizeServer({
      ...(result || {}),
      EndPoint: result?.EndPoint || endpoint,
      name:
        server?.name ||
        result?.Data?.hostname ||
        result?.name
    });

    normalized.players = await fetchPlayers(
      normalized,
      timeout
    );

    normalized.clients = normalized.players.length;

    return normalized;
  } catch (error) {
    console.error(
      `Configured server gagal: ${server?.name || endpoint}:`,
      error?.message || error
    );

    return {
      name: server?.name || endpoint,
      endpoint,
      players: []
    };
  }
}

export function findPlayers(servers, term) {
  const query = String(term || "").trim().toLowerCase();

  if (!query) return [];

  const results = [];

  for (const server of servers || []) {
    for (const player of server?.players || []) {
      const name = String(player?.name || "");

      if (!name.toLowerCase().includes(query)) continue;

      results.push({
        serverName: server?.name || "Unknown Server",
        playerId: player?.id ?? "?",
        playerName: name,
        ping: Number.isFinite(Number(player?.ping))
          ? Number(player.ping)
          : null
      });
    }
  }

  return results;
}
