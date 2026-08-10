export const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "確実",
  exploratory: "探索",
};

export const CONFIDENCE_CLASS: Record<string, string> = {
  confirmed: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
  exploratory: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
};

export const URGENCY_LABEL = {
  urgent: "まもなく",
  soon: "近日",
} as const;

export const URGENCY_CLASS = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  soon: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
} as const;

export const NEUTRAL_CLASS =
  "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
