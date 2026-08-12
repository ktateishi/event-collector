"use client";

import { useState, type FormEvent } from "react";

export function SettingsForm({ initialDaysBefore }: { initialDaysBefore: number }) {
  const [savedDaysBefore, setSavedDaysBefore] = useState(initialDaysBefore);
  const [input, setInput] = useState(String(initialDaysBefore));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days_before: Number(input) }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "保存に失敗しました");
        return;
      }

      setSavedDaysBefore(body.setting.days_before);
      setInput(String(body.setting.days_before));
      setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">現在の設定</p>
        <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-500">
          {savedDaysBefore}日前
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label
          htmlFor="days-before"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          何日前にリマインドするか
        </label>
        <div className="flex gap-2">
          <input
            id="days-before"
            type="number"
            min={0}
            step={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          保存しました
        </p>
      )}
    </div>
  );
}
