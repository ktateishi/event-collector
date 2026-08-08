import type { ReactNode } from "react";

export const metadata = {
  title: "event_collector",
  description: "見逃したくないイベント情報を毎日収集する",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
