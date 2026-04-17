import { z } from 'zod';
import { defineTool } from './types.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const searchVideosInputSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  maxResults: z.number().min(1).max(50).optional().default(10).describe('Number of results (1-50, default 10)'),
  order: z.enum(['relevance', 'date', 'viewCount', 'rating']).optional().default('relevance').describe('Sort order'),
  publishedAfter: z.string().optional().describe('Filter videos published after this date (ISO 8601, e.g., 2024-01-01T00:00:00Z)'),
});

interface VideoSearchResult {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface SearchVideosResult {
  query: string;
  count: number;
  videos: VideoSearchResult[];
}

export const searchVideosTool = defineTool({
  name: 'search_videos',
  title: 'Search YouTube Videos',
  description: 'Search for videos across all of YouTube. Use for discovering content on any topic.',
  inputSchema: searchVideosInputSchema,
  outputSchema: {
    query: z.string(),
    count: z.number(),
    videos: z.array(z.object({
      videoId: z.string(),
      title: z.string(),
      description: z.string(),
      channelId: z.string(),
      channelTitle: z.string(),
      publishedAt: z.string(),
      thumbnailUrl: z.string(),
    })),
  },
  annotations: {
    title: 'Search YouTube Videos',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (args, context) => {
    // Read API key from header (client-provided) or fallback to providerToken (server config)
    const apiKey = context.authHeaders?.['x-youtube-api-key'] ?? context.providerToken;
    
    if (!apiKey) {
      return {
        content: [{ type: 'text', text: 'YouTube API key required. Pass via X-YouTube-Api-Key header.' }],
        isError: true,
      };
    }

    const { query, maxResults, order, publishedAfter } = args;

    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('order', order);
    
    if (publishedAfter) {
      searchUrl.searchParams.set('publishedAfter', publishedAfter);
    }

    const response = await fetch(searchUrl.toString(), {
      signal: context.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        content: [{ type: 'text', text: `YouTube API error: ${response.status} - ${error}` }],
        isError: true,
      };
    }

    const data = await response.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          channelId: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: { medium?: { url: string }; default?: { url: string } };
        };
      }>;
    };

    const videos: VideoSearchResult[] = data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
    }));

    const result: SearchVideosResult = {
      query,
      count: videos.length,
      videos,
    };

    const textOutput = videos.length > 0
      ? videos.map((v, i) => 
          `${i + 1}. ${v.title}\n   Channel: ${v.channelTitle}\n   ID: ${v.videoId} | ${v.publishedAt}`
        ).join('\n\n')
      : 'No videos found';

    return {
      content: [{ type: 'text', text: `Found ${videos.length} videos for "${query}":\n\n${textOutput}` }],
      structuredContent: result,
    };
  },
});
