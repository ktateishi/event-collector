"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExcludeButton({
  eventId,
  label = "不要",
  className,
  redirectAfter,
}: {
  eventId: string;
  label?: string;
  className?: string;
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    // EventRowではカード全体がLinkのため、カード遷移を止める
    e.preventDefault();
    e.stopPropagation();

    if (pending) return;
    setPending(true);

    try {
      const res = await fetch(`/api/events/${eventId}/exclude`, { method: "POST" });
      if (res.ok) {
        if (redirectAfter) {
          router.push(redirectAfter);
        } else {
          router.refresh();
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={
        className ??
        "rounded-md px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      }
    >
      {label}
    </button>
  );
}
