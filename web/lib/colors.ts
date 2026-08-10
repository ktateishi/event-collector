import { UNCATEGORIZED_LABEL } from "./events";

/**
 * キーワード別カテゴリの配色パレット。文字列のハッシュ値でパレットの
 * インデックスを決めるため、同じキーワードは常に同じ色になる。
 */
const CATEGORY_PALETTE = [
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
] as const;

const UNCATEGORIZED_CLASS =
  "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function categoryColorClass(keyword: string): string {
  if (keyword === UNCATEGORIZED_LABEL) {
    return UNCATEGORIZED_CLASS;
  }

  return CATEGORY_PALETTE[hashString(keyword) % CATEGORY_PALETTE.length];
}
