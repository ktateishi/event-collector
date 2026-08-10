type SiteUrlEnv = {
  SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  [key: string]: string | undefined;
};

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * LINE通知等のリンク生成に使うベースURLを決める。
 * SITE_URLを明示設定すればそれを優先し、なければVercelが自動で提供する
 * 本番ドメインのシステム変数にフォールバックする（追加設定不要）。
 */
export function getSiteUrl(env: SiteUrlEnv = process.env): string {
  if (env.SITE_URL) {
    return stripTrailingSlash(env.SITE_URL);
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:3000";
}
