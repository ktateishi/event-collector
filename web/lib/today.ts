const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 任意の日時（ISO文字列 または Date）を、JST（UTC+9）基準の日付（YYYY-MM-DD）に変換する。
 *
 * `someIsoString.slice(0, 10)`（タイムスタンプに含まれるUTC日付をそのまま使う）を
 * 各所で使っていたが、収集Cronは毎日07:00 JST（= UTC 22:00、前日日付）に実行されるため、
 * JSTの07:00〜09:00の間はUTC日付とJST日付がずれる。「今日」の計算だけJST化しても、
 * DBに保存された`created_at`（UTC）をそのままsliceして比較すると同じズレが再発する
 * （2026-08-12に`todayInJst()`を導入した際に見落とし、2026-08-13に実際の通知漏れとして発覚）。
 * 「今日」の判定・「イベントがいつ作られたか」の判定は必ずこの関数を通して揃える。
 */
export function dateInJst(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST基準の「今日」の日付（YYYY-MM-DD）を返す。詳細はdateInJstのコメント参照 */
export function todayInJst(now: Date = new Date()): string {
  return dateInJst(now);
}
