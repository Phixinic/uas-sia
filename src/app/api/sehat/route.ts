import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Healthcheck Docker: 200 bila aplikasi dan database bisa dijangkau. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
