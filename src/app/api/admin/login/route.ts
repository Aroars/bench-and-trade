import { connection } from "next/server";
import { cookies } from "next/headers";
import { adminCookie, adminPasswordConfigured, passwordMatches } from "@/lib/admin-auth";

export async function POST(request: Request) {
  await connection();
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const back = new URL("/admin", request.url);

  if (!adminPasswordConfigured() || !passwordMatches(password)) {
    back.searchParams.set("error", "1");
    return Response.redirect(back, 303);
  }

  const cookie = adminCookie();
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
  return Response.redirect(new URL("/admin", request.url), 303);
}
