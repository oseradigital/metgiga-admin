import type { ReactNode } from "react";

// For things like the "About 10 minutes" pill on the welcome screen, and
// later status pills ("Connected", "Not connected", "Signed").
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "copper" | "success";
}) {
  const tones = {
    neutral: "bg-midnight/5 text-midnight",
    copper: "bg-copper/10 text-copper-text",
    success: "bg-copper/10 text-copper-text",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
