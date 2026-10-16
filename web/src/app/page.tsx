import { Overview } from "@/components/overview";
import { getBotState } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getBotState();
  return <Overview data={result.data} error={result.error} />;
}
