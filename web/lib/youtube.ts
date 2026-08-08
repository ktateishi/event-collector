export type YoutubeResult = {
  title: string;
  channel: string;
  publishedAt: string;
  url: string;
};

export async function searchYoutube(apiKey: string, query: string): Promise<YoutubeResult[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`YouTube検索に失敗しました (status ${res.status})`);
  }

  const body = await res.json();
  const items = Array.isArray(body.items) ? body.items : [];

  return items.map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string } }) => ({
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}
