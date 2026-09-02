import {
  searchServers,
  getServerByEndpoint
} from "fivem-server-api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizePlayer(p) {
  return {
    id: Number(p?.id ?? p?.serverId ?? 0),
    name: String(p?.name ?? "Unknown"),
    ping: Number(p?.ping ?? 0),
    identifiers: Array.isArray(p?.identifiers) ? p.identifiers : []
  };
}

function normalizeServer(raw) {
  if (!raw) return null;

  const data = raw.Data ?? raw.data ?? raw;
  const endpointId = raw.EndPoint ?? raw.endpoint ?? data.EndPoint ?? null;

  const players = Array.isArray(data.players)
    ? data.players.map(normalizePlayer)
    : [];

  const endpoint =
    Array.isArray(data.connectEndPoints) && data.connectEndPoints.length
      ? data.connectEndPoints[0]
      : endpointId;

  const projectName = data.vars?.sv_projectName;
  const hostname = data.hostname ?? projectName ?? "Unknown FiveM Server";

  return {
    id: endpointId ? String(endpointId) : null,
    name: String(hostname),
    endpoint: endpoint ? String(endpoint) : null,
    players,
    clients: Number(data.clients ?? players.length ?? 0),
    maxClients: Number(data.svMaxclients ?? data.sv_maxclients ?? 0),
    locale: String(data.vars?.locale ?? ""),
    gametype: String(data.gametype ?? ""),
    mapname: String(data.mapname ?? ""),
    joinUrl: endpointId ? `https://cfx.re/join/${endpointId}` : null
  };
}

export async function fetchConfiguredServer(server, options = {}) {
  const timeout = options.timeout ?? 7000;

  try {
    const raw = await getServerByEndpoint(server.endpoint, { timeout });
    const normalized = normalizeServer(raw);

    if (!normalized) throw new Error("Invalid Cfx.re server response");

    normalized.name = server.name || normalized.name;
    return { ...normalized, source: "configured", online: true };
  } catch (error) {
    return {
      id: server.endpoint,
      name: server.name || server.endpoint,
      endpoint: server.endpoint,
      players: [],
      clients: 0,
      maxClients: 0,
      locale: "",
      gametype: "",
      mapname: "",
      joinUrl: null,
      source: "configured",
      online: false,
      error: error?.message || "Request failed"
    };
  }
}

export async function discoverServers({
  limit = 100,
  timeout = 7000,
  locales = [],
  delayMs = 0
} = {}) {
  const localeList = locales.filter(Boolean);
  const result = [];

  // v1.6.1 exposes searchServers() for Cfx.re server discovery.
  // A single locale can be passed to the API; multiple locales are filtered below.
  const rawServers = localeList.length === 1
    ? await searchServers({ locale: localeList[0] }, limit, timeout, 0)
    : await searchServers({}, limit, timeout, 0);

  for (const raw of rawServers ?? []) {
    const server = normalizeServer(raw);
    if (!server) continue;

    if (
      localeList.length > 1 &&
      server.locale &&
      !localeList.includes(server.locale)
    ) {
      continue;
    }

    result.push({ ...server, source: "discovery", online: true });

    if (delayMs > 0) await sleep(delayMs);
  }

  return result;
}

export function findPlayers(servers, term) {
  const q = String(term).trim().toLocaleLowerCase();
  if (!q) return [];

  const matches = [];

  for (const server of servers ?? []) {
    for (const player of server.players ?? []) {
      if (!String(player.name).toLocaleLowerCase().includes(q)) continue;

      matches.push({
        serverId: server.id,
        serverName: server.name,
        serverEndpoint: server.endpoint,
        playerId: player.id,
        playerName: player.name,
        ping: player.ping,
        joinUrl: server.joinUrl,
        locale: server.locale,
        source: server.source
      });
    }
  }

  return matches;
}
