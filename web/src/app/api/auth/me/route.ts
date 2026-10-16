import { NextResponse } from "next/server";
import { getSelectedGuildId, getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ user: session?.user ?? null, selectedGuildId: await getSelectedGuildId() });
}
