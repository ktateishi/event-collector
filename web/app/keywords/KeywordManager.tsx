"use client";

import { useState, type FormEvent } from "react";
import type { Keyword } from "@/lib/keywords";

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
    <div>
      <form onSubmit={handleAdd}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="キーワードを入力"
          aria-label="キーワード"
        />
        <button type="submit" disabled={pending}>
          追加
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <ul>
        {keywords.map((k) => (
          <li key={k.id}>
            {k.keyword}
            <button type="button" onClick={() => handleDelete(k.id)}>
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
