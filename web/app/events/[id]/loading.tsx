export default function Loading() {
  return (
    <main className="flex animate-pulse flex-col gap-6">
      <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-8 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
    </main>
  );
}
