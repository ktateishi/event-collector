import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-base font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
