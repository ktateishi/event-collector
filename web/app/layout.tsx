import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata = {
  title: "event_collector",
  description: "見逃したくないイベント情報を毎日収集する",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Nav />
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </body>
    </html>
  );
}
