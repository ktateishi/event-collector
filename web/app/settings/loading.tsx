export default function Loading() {
  return (
    <main className="flex animate-pulse flex-col gap-6">
      <div className="h-7 w-24 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-10 w-64 rounded-md bg-slate-200 dark:bg-slate-800" />
    </main>
  );
}
