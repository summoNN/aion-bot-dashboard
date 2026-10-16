import { Check, CircleAlert, LoaderCircle } from "lucide-react";

export function StatusPill({ status, label }: { status: "success" | "warning" | "neutral"; label: string }) {
  const Icon = status === "success" ? Check : status === "warning" ? CircleAlert : LoaderCircle;
  return <span className={`pill ${status}`}><Icon size={12} />{label}</span>;
}
