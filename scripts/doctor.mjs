// Checks that the tools ClipForge needs are installed. Run: npm run doctor
import { spawnSync } from "node:child_process";
import fs from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const checks = [
  ["Node.js >= 20", () => Number(process.versions.node.split(".")[0]) >= 20, process.versions.node, true],
  ["yt-dlp", ...tool(process.env.YTDLP_PATH || "yt-dlp", ["--version"]), true],
  ["ffmpeg", ...tool(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]), true],
  ["ffprobe", ...tool(process.env.FFPROBE_PATH || "ffprobe", ["-version"]), true],
  ["deno (recommended by yt-dlp for YouTube)", ...tool("deno", ["--version"]), false],
  [
    "ANTHROPIC_API_KEY (AI moment picking)",
    () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    process.env.ANTHROPIC_API_KEY ? "set" : "not set: built-in picker will be used",
    false,
  ],
];

function tool(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  const ok = r.status === 0;
  return [() => ok, ok ? r.stdout.split("\n")[0].replace(/ Copyright.*/, "") : "not found"];
}

let failed = false;
for (const [name, test, detail, required] of checks) {
  const ok = test();
  if (!ok && required) failed = true;
  console.log(`${ok ? "✔" : required ? "✘" : "!"} ${name.padEnd(44)} ${detail}`);
}
if (failed) {
  console.log("\nInstall the missing tools (see README) and run this again.");
  process.exit(1);
}
console.log("\nAll set. Start the app with: npm run dev");
