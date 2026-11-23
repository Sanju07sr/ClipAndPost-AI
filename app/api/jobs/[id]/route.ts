import { NextResponse } from "next/server";
import { deleteJob, getJob, JOB_ID_RE } from "@/lib/store";
import { queuePosition } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const job = JOB_ID_RE.test(id) ? getJob(id) : undefined;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job, queuePosition: queuePosition(id) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const job = JOB_ID_RE.test(id) ? getJob(id) : undefined;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status === "running" || job.status === "queued") {
    return NextResponse.json({ error: "Wait for the job to finish before deleting it." }, { status: 409 });
  }
  deleteJob(id);
  return NextResponse.json({ ok: true });
}
