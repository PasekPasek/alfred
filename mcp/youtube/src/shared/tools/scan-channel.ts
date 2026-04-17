import { z } from 'zod';
import { defineTool } from './types.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const scanChannelInputSchema = z.object({
  channelId: z.string().min(1).describe('YouTube channel ID (e.g., UC...)'),
  maxResults: z.number().min(1).max(50).optional().default(10).describe('Number of videos to fetch (1-50, default 10)'),
});

interface VideoItem {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface ScanChannelResult {
  channelId: string;
  videoCount: number;
  videos: VideoItem[];
}

export const scanChannelTool = defineTool({
  name: 'scan_channel',
  title: 'Scan YouTube Channel',
  description: 'Get information about the latest videos from a YouTube channel based on channel ID',
  inputSchema: scanChannelInputSchema,
  outputSchema: {
    channelId: z.string().describe('The channel ID'),
    videoCount: z.number().describe('Number of videos returned'),
    videos: z.array(z.object({
      videoId: z.string(),
      title: z.string(),
      description: z.string(),
      publishedAt: z.string(),
      thumbnailUrl: z.string(),
    })).describe('List of latest videos'),
  },
  annotations: {
    title: 'Scan YouTube Channel',
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

    const { channelId, maxResults } = args;

    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('channelId', channelId);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));

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
          publishedAt: string;
          thumbnails: { medium?: { url: string }; default?: { url: string } };
        };
      }>;
    };

    const videos: VideoItem[] = data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
    }));

    const result: ScanChannelResult = {
      channelId,
      videoCount: videos.length,
      videos,
    };

    const textOutput = videos
      .map((v, i) => `${i + 1}. ${v.title} (${v.videoId}) - ${v.publishedAt}`)
      .join('\n');

    return {
      content: [{ type: 'text', text: `Found ${videos.length} videos:\n\n${textOutput}` }],
      structuredContent: result,
    };
  },
});
