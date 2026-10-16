import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  clearAuthCookies(response, new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https");
  return response;
}
