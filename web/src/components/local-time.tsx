"use client";

import { useEffect, useState } from "react";

export function LocalTime({ value, showZone = false }: { value: string | null; showZone?: boolean }) {
  const [formatted, setFormatted] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    const frame = window.requestAnimationFrame(() => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimeZone(zone);
      setFormatted(new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  if (!value) return <>No upcoming run</>;
  if (!formatted) return <>Detecting local time…</>;
  return <>{formatted}{showZone && timeZone ? ` · ${timeZone}` : ""}</>;
}

export function LocalTimezone() {
  const [timeZone, setTimeZone] = useState<string | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <>{timeZone || "your local timezone"}</>;
}
