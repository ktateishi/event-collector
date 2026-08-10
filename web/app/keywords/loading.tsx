export default function Loading() {
  return (
    <main className="flex animate-pulse flex-col gap-6">
      <div className="h-7 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-10 rounded-md bg-slate-200 dark:bg-slate-800" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-11 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </main>
  );
}
