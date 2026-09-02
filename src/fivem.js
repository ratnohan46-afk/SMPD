import { searchServers, getServerByEndpoint } from "fivem-server-api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizePlayer(player) {
  return {
    id: Number(player?.id ?? player?.serverId ?? 0),
    name: String(player?.name ?? "Unknown"),
    ping: Number(player?.ping ?? 0),
    identifiers: Array.isArray(player?.identifiers) ? player.identifiers : []
  };
}

function normalizeServer(raw) {
  if (!raw) return null;

  const data = raw.Data ?? raw.data ?? raw;
  const serverId = raw.EndPoint ?? raw.endpoint ?? data.EndPoint ?? null;

  const players = Array.isArray(data.players)
    ? data.players.map(normalizePlayer)
    : [];

  const endpoint =
    Array.isArray(data.connectEndPoints) && data.connectEndPoints.length > 0
      ? data.connectEndPoints[0]
      : serverId;

  const hostname =
    data.hostname ??
    data.vars?.sv_projectName ??
    "Unknown FiveM Server";

  return {
    id: serverId ? String(serverId) : null,
    name: String(hostname),
    endpoint: endpoint ? String(endpoint) : null,
    players,
    clients: Number(data.clients ?? players.length ?? 0),
    maxClients: Number(data.svMaxclients ?? data.sv_maxclients ?? 0),
    locale: String(data.vars?.locale ?? ""),
    gametype: String(data.gametype ?? ""),
    mapname: String(data.mapname ?? ""),
    joinUrl: serverId ? `https://cfx.re/join/${serverId}` : null
  };
}

export async function fetchConfiguredServer(server, options = {}) {
  const timeout = options.timeout ?? 15000;

  try {
    const raw = await getServerByEndpoint(server.endpoint, timeout);
    const normalized = normalizeServer(raw);

    if (!normalized) {
      throw new Error("Invalid Cfx.re server response");
    }

    normalized.name = server.name || normalized.name;

    return {
      ...normalized,
      source: "configured",
      online: true
    };
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

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "FiveM-Player-Finder/1.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildPlayersUrl(endpoint) {
  if (!endpoint) return null;

  let value = String(endpoint).trim();

  if (!value) return null;

  if (
    value.includes("private-placeholder.cfx.re") ||
    value.includes("private-placeholder")
  ) {
    return null;
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }

  try {
    const url = new URL(value);

    url.pathname = "/players.json";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

async function fetchPlayersForServer(server, timeoutMs) {
  const playersUrl = buildPlayersUrl(server.endpoint);

  if (!playersUrl) return server;

  try {
    const data = await fetchJson(playersUrl, timeoutMs);

    const players = Array.isArray(data)
      ? data.map(normalizePlayer)
      : Array.isArray(data?.players)
        ? data.players.map(normalizePlayer)
        : [];

    return {
      ...server,
      players,
      clients: players.length
    };
  } catch (firstError) {
    if (playersUrl.startsWith("http://")) {
      try {
        const httpsUrl = playersUrl.replace(
          /^http:\/\//i,
          "https://"
        );

        const data = await fetchJson(httpsUrl, timeoutMs);

        const players = Array.isArray(data)
          ? data.map(normalizePlayer)
          : Array.isArray(data?.players)
            ? data.players.map(normalizePlayer)
            : [];

        return {
          ...server,
          players,
          clients: players.length
        };
      } catch {
        // Gunakan data discovery jika players.json tidak tersedia.
      }
    }

    return {
      ...server,
      players: Array.isArray(server.players)
        ? server.players
        : [],
      playerFetchError:
        firstError?.message ||
        "players.json unavailable"
    };
  }
}

async function enrichPlayers(
  servers,
  {
    timeout = 10000,
    concurrency = 8,
    delayMs = 100
  } = {}
) {
  const result = new Array(servers.length);

  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;

      if (index >= servers.length) {
        return;
      }

      const server = servers[index];

      result[index] = await fetchPlayersForServer(
        server,
        timeout
      );

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  const workerCount = Math.min(
    Math.max(1, Number(concurrency) || 1),
    servers.length || 1
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker()
    )
  );

  return result.filter(Boolean);
}

export async function discoverServers({
  limit = 100,
  timeout = 30000,
  locales = [],
  delayMs = 100
} = {}) {
  const localeList = locales.filter(Boolean);
  const result = [];

  const rawServers =
    localeList.length === 1
      ? await searchServers(
          { locale: localeList[0] },
          limit,
          timeout,
          0
        )
      : await searchServers(
          {},
          limit,
          timeout,
          0
        );

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

    result.push({
      ...server,
      source: "discovery",
      online: true
    });
  }

  if (result.length === 0) {
    return result;
  }

  return enrichPlayers(
    result,
    {
      timeout: Math.max(
        3000,
        Math.min(
          Number(timeout) || 10000,
          15000
        )
      ),
      concurrency: 8,
      delayMs
    }
  );
}

export function findPlayers(servers, term) {
  const query = String(term)
    .trim()
    .toLocaleLowerCase();

  if (!query) {
    return [];
  }

  const matches = [];

  for (const server of servers ?? []) {
    for (const player of server.players ?? []) {
      if (
        !String(player.name)
          .toLocaleLowerCase()
          .includes(query)
      ) {
        continue;
      }

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
