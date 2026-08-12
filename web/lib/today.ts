const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * JST（UTC+9）基準の「今日」の日付（YYYY-MM-DD）を返す。
 *
 * `new Date().toISOString().slice(0, 10)`（UTC基準）を各所で使っていたが、
 * 収集Cronは毎日07:00 JST（= UTC 22:00、前日日付）に実行されるため、
 * JSTの07:00〜09:00の間はUTC日付とJST日付がずれ、「今日収集したイベント」の
 * 判定が1日ずれるバグがあった（2026-08-12発覚。LINE通知の対象0件になる等）。
 */
export function todayInJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
