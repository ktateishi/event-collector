export type YoutubeResult = {
  title: string;
  description: string;
  channel: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string;
};

// 収集パイプラインの他ソース（12件/キーワード上限）と比べて肥大化しすぎないよう抑える
const MAX_RESULTS = 5;

export async function searchYoutube(apiKey: string, query: string): Promise<YoutubeResult[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", String(MAX_RESULTS));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`YouTube検索に失敗しました (status ${res.status})`);
  }

  const body = await res.json();
  const items = Array.isArray(body.items) ? body.items : [];

  return items.map(
    (item: {
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails?: { high?: { url: string }; default?: { url: string } };
      };
    }) => ({
      title: item.snippet.title,
      description: item.snippet.description,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? "",
    })
  );
}

export type ExtractionPage = { url: string; text: string; imageUrl?: string };

/**
 * YouTube検索結果をGemini抽出パイプラインの「ページ」形式に変換する。
 * 動画ページ自体をfetchしてHTMLスクレイピングするのではなく、YouTube Data APIが
 * 返す構造化データ（タイトル・概要欄・サムネイル）をそのまま使う。動画ページの
 * 実HTMLは大部分がJSで描画されるため、素朴なfetch+タグ除去では概要欄が
 * 拾えないことが多く、構造化データを使う方が確実（URL自体は実在するYouTube URL
 * なので、他ソースと同様「実在確認済みURLのみ使う」方針とも矛盾しない）。
 */
export function youtubeResultsToPages(results: YoutubeResult[]): ExtractionPage[] {
  return results.map((result) => ({
    url: result.url,
    text: `${result.title}\n${result.description}`,
    imageUrl: result.thumbnailUrl || undefined,
  }));
}
