import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  clearAuthCookies(response);
  return response;
}
