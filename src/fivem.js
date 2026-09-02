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

  // Server private tidak bisa diakses langsung.
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

  if (!playersUrl) {
    return server;
  }

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

    // C
