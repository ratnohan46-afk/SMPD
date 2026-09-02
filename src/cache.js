import fs from "node:fs/promises";
import path from "node:path";

const cachePath = path.resolve("data/cache.json");

export async function saveCache(servers) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        servers
      },
      null,
      2
    ),
    "utf8"
  );
}

export async function loadCache() {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.servers) ? parsed : { servers: [] };
  } catch {
    return { servers: [] };
  }
}
