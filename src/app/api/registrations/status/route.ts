import { connection } from "next/server";
import { isDbConfigured, registrationStatusBySession } from "@/lib/db";

export async function GET(request: Request) {
  await connection();
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return Response.json({ error: "Missing session." }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return Response.json({ error: "Database is not configured." }, { status: 503 });
  }
  const row = await registrationStatusBySession(sessionId);
  if (!row) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({
    status: row.status,
    studentNames: row.studentNames,
  });
}
