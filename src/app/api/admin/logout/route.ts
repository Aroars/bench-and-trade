import { connection } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  await connection();
  const jar = await cookies();
  jar.set("bt_admin", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return Response.redirect(new URL("/admin", request.url), 303);
}
