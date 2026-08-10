import type { ReactNode } from "react";

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
