const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  const decoded = withoutTags.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g,
    (match) => ENTITIES[match]
  );

  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * Gemini groundingChunksのvertexaisearch中継URLは302で本物のURLへリダイレクトする。
 * Locationヘッダを読んで本物のURLを取り出す。リダイレクトしない/失敗した場合は
 * 元のURLをそのまま返す（呼び出し側でのfetch失敗時にnullになるだけなので安全）。
 */
export async function resolveGroundingUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const location = res.headers.get("location");
    return location ?? url;
  } catch {
    return url;
  }
}

function extractMetaContent(html: string, key: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const propMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    if (!propMatch || propMatch[1].toLowerCase() !== key) {
      continue;
    }

    const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch) {
      return contentMatch[1];
    }
  }

  return undefined;
}

/**
 * og:image（なければtwitter:image）を実ページのHTMLから抽出する。
 * イベントカードの背景画像として、Geminiに書かせず実在するページの画像のみを使う
 * （URL幻覚を防ぐ既存方針と同じ理由）。相対URLはページの実URLを基準に解決する。
 */
export function extractOgImage(html: string, baseUrl: string): string | undefined {
  const raw = extractMetaContent(html, "og:image") ?? extractMetaContent(html, "twitter:image");

  if (!raw) {
    return undefined;
  }

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export async function fetchPageText(
  url: string,
  maxChars = 8000
): Promise<{ url: string; text: string; imageUrl?: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept-Language": "ja",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const text = htmlToText(html).slice(0, maxChars);
    const imageUrl = extractOgImage(html, res.url);

    return { url: res.url, text, imageUrl };
  } catch {
    return null;
  }
}
