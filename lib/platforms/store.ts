import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

// Saved logins for social platforms, one owner-only JSON file each.

const dir = () => path.join(config.dataDir, "connections");

export function loadConnection<T>(name: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir(), `${name}.json`), "utf8")) as T;
  } catch {
    return null;
  }
}

export function saveConnection(name: string, data: unknown) {
  fs.mkdirSync(dir(), { recursive: true });
  const file = path.join(dir(), `${name}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}

export function removeConnection(name: string) {
  fs.rmSync(path.join(dir(), `${name}.json`), { force: true });
}

/** Wait helper for polling upload status. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
