export default function Loading() {
  return (
    <main className="flex animate-pulse flex-col gap-6">
      <div className="h-7 w-48 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </main>
  );
}
