import { searchServers, getServerByEndpoint } from "fivem-server-api";

function normalizeServer(server) {
  const endpoint =
    server.endpoint ||
    server.EndPoint ||
    server.address ||
    server.connectEndPoints?.[0];

  return {
    name: server.name || server.hostname || "Unknown Server",
    endpoint,
    players: []
  };
}

async function fetchPlayers(server, timeout = 15000) {
  if (!server.endpoint) return [];

  let endpoint = server.endpoint;

  if (endpoint.includes("://")) {
    endpoint = endpoint.split("://")[1];
  }

  endpoint = endpoint.replace(/\/+$/, "");

  if (
    endpoint.includes("localhost") ||
    endpoint.startsWith("127.") ||
    endpoint.startsWith("0.0.0.0")
  ) {
    return [];
  }

  const url = `http://${endpoint}/players.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FiveM-Player-Finder"
      }
    });

    if (!response.ok) return [];

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((p) => ({
      id: p.id,
      name: p.name || "Unknown",
      ping: Number.isFinite(Number(p.ping))
        ? Number(p.ping)
        : null
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverServers({
  limit = 25,
  timeout = 15000,
  locales = "id-ID"
} = {}) {
  const result = await searchServers({
    limit,
    locale: locales
  });

  const rawServers = result?.Data || result?.data || [];

  const servers = rawServers
    .map(normalizeServer)
    .filter((s) => s.endpoint);

  const output = [];

  for (const server of servers) {
    const players = await fetchPlayers(server, timeout);

    output.push({
      ...server,
      players
    });
  }

  return output;
}

export async function fetchConfiguredServer(server, {
  timeout = 15000
} = {}) {
  try {
    const endpoint = server.endpoint;

    const info = await getServerByEndpoint(endpoint, timeout);

    const normalized = normalizeServer({
      ...info,
      name: server.name || info?.name || info?.hostname,
      endpoint
    });

    normalized.players = await fetchPlayers(normalized, timeout);

    return normalized;
  } catch (error) {
    console.error(
      `Gagal mengambil server ${server.name || server.endpoint}:`,
      error?.message || error
    );

    return {
      name: server.name || server.endpoint,
      endpoint: server.endpoint,
      players: []
    };
  }
}

export function findPlayers(servers, term) {
  const query = term.toLowerCase();

  const results = [];

  for (const server of servers || []) {
    for (const player of server.players || []) {
      const name = String(player.name || "");

      if (!name.toLowerCase().includes(query)) continue;

      results.push({
        serverName: server.name,
        playerId: player.id,
        playerName: name,
        ping: Number.isFinite(Number(player.ping))
          ? Number(player.ping)
          : null
      });
    }
  }

  return results;
}
