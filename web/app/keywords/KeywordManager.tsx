"use client";

import { useState, type FormEvent } from "react";
import type { Keyword } from "@/lib/keywords";
import { EmptyState } from "@/components/EmptyState";

export function KeywordManager({ initialKeywords }: { initialKeywords: Keyword[] }) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: input }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "登録に失敗しました");
        return;
      }

      setKeywords((prev) => [body.keyword, ...prev]);
      setInput("");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/keywords/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "削除に失敗しました");
      return;
    }

    setKeywords((prev) => prev.filter((k) => k.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="キーワードを入力"
          aria-label="キーワード"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          追加
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {keywords.length === 0 ? (
        <EmptyState
          title="登録済みのキーワードがありません"
          description="上のフォームからキーワードを追加すると、収集対象になります。"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {keywords.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {k.keyword}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(k.id)}
                className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
