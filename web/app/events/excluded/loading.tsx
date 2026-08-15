export default function Loading() {
  return (
    <main className="flex animate-pulse flex-col gap-6">
      <div className="h-7 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </main>
  );
}
