import { NextResponse } from "next/server";
import { allStatuses } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(allStatuses());
}
