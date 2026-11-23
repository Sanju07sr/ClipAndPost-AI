import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config";
import type { Job, JobOptions, Stage } from "./types";

// Jobs live in memory for fast polling and are mirrored to
// DATA_DIR/jobs/<id>/job.json so they survive restarts.

const JOBS_DIR = path.join(config.dataDir, "jobs");

type Store = { jobs: Map<string, Job>; loaded: boolean };
const g = globalThis as unknown as { __clipStore?: Store };
const store: Store = (g.__clipStore ??= { jobs: new Map(), loaded: false });

export const JOB_ID_RE = /^[a-z0-9]{12}$/;

export function jobDir(id: string) {
  if (!JOB_ID_RE.test(id)) throw new Error("Invalid job id");
  return path.join(JOBS_DIR, id);
}

function load() {
  if (store.loaded) return;
  store.loaded = true;
  if (!fs.existsSync(JOBS_DIR)) return;
  for (const id of fs.readdirSync(JOBS_DIR)) {
    if (!JOB_ID_RE.test(id)) continue;
    const file = path.join(JOBS_DIR, id, "job.json");
    try {
      const job = JSON.parse(fs.readFileSync(file, "utf8")) as Job;
      // A job that was running when the server stopped can't resume.
      if (job.status === "running" || job.status === "queued") {
        job.status = "error";
        job.error = "The server restarted while this job was running. Please start it again.";
        job.message = job.error;
      }
      for (const c of job.clips) {
        if (c.upload && !c.uploads) c.uploads = { youtube: c.upload };
        delete c.upload;
      }
      store.jobs.set(id, job);
    } catch {
      /* ignore unreadable job folders */
    }
  }
}

function persist(job: Job) {
  const dir = jobDir(job.id);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, "job.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify(job, null, 2));
  fs.renameSync(tmp, path.join(dir, "job.json"));
}

const STAGES: Stage[] = [
  { id: "metadata", label: "Reading video", status: "pending" },
  { id: "transcript", label: "Fetching transcript", status: "pending" },
  { id: "moments", label: "Finding best moments", status: "pending" },
  { id: "download", label: "Downloading footage", status: "pending" },
  { id: "render", label: "Rendering Shorts", status: "pending" },
];

export function createJob(options: JobOptions): Job {
  load();
  const id = crypto.randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "0").slice(0, 12);
  const now = new Date().toISOString();
  const job: Job = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "queued",
    options,
    stages: STAGES.map((s) => ({ ...s })),
    progress: 0,
    message: "Waiting in queue…",
    clips: [],
    log: [],
  };
  store.jobs.set(id, job);
  persist(job);
  return job;
}

export function getJob(id: string): Job | undefined {
  load();
  return store.jobs.get(id);
}

export function listJobs(limit = 12): Job[] {
  load();
  return [...store.jobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function updateJob(id: string, fn: (job: Job) => void): Job {
  const job = getJob(id);
  if (!job) throw new Error(`Job ${id} not found`);
  fn(job);
  job.updatedAt = new Date().toISOString();
  persist(job);
  return job;
}

export function deleteJob(id: string) {
  load();
  store.jobs.delete(id);
  fs.rmSync(jobDir(id), { recursive: true, force: true });
}
