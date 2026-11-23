import { spawn } from "node:child_process";

export interface RunResult {
  stdout: string;
  stderr: string;
}

export class CommandError extends Error {
  constructor(
    message: string,
    public stderr: string,
    public code: number | null,
  ) {
    super(message);
  }
}

/**
 * Run a command without a shell (arguments are never interpreted), collecting
 * output. `onLine` receives stderr+stdout lines as they arrive for progress.
 */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; onLine?: (line: string) => void; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;
    if (opts.timeoutMs) {
      timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs);
    }
    const feed = (chunk: string) => {
      if (!opts.onLine) return;
      for (const line of chunk.split(/[\r\n]+/)) if (line.trim()) opts.onLine(line);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      stdout += d;
      feed(d);
    });
    child.stderr.on("data", (d: string) => {
      // Keep memory bounded for very chatty tools.
      stderr = (stderr + d).slice(-200_000);
      feed(d);
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
      reject(
        new CommandError(
          missing ? `"${cmd}" is not installed or not on PATH` : `${cmd} failed: ${err.message}`,
          "",
          null,
        ),
      );
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const tail = stderr.trim().split("\n").slice(-6).join("\n");
        reject(new CommandError(`${cmd} exited with code ${code}: ${tail}`, stderr, code));
      }
    });
  });
}
