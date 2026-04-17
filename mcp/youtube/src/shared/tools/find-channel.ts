import { z } from 'zod';
import { defineTool } from './types.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const findChannelInputSchema = z.object({
  query: z.string().min(1).describe('Channel name or search query'),
  maxResults: z.number().min(1).max(10).optional().default(5).describe('Number of results (1-10, default 5)'),
});

interface ChannelResult {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl?: string;
}

interface FindChannelResult {
  query: string;
  count: number;
  channels: ChannelResult[];
}

export const findChannelTool = defineTool({
  name: 'find_channel',
  title: 'Find YouTube Channel',
  description: 'Search for YouTube channels by name. Returns channel IDs that can be used with scan_channel tool.',
  inputSchema: findChannelInputSchema,
  outputSchema: {
    query: z.string(),
    count: z.number(),
    channels: z.array(z.object({
      channelId: z.string(),
      title: z.string(),
      description: z.string(),
      thumbnailUrl: z.string(),
      customUrl: z.string().optional(),
    })),
  },
  annotations: {
    title: 'Find YouTube Channel',
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

    const { query, maxResults } = args;

    // Search for channels
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'channel');
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
        snippet: {
          channelId: string;
          title: string;
          description: string;
          thumbnails: { medium?: { url: string }; default?: { url: string } };
          customUrl?: string;
        };
      }>;
    };

    const channels: ChannelResult[] = data.items.map((item) => ({
      channelId: item.snippet.channelId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
      customUrl: item.snippet.customUrl,
    }));

    const result: FindChannelResult = {
      query,
      count: channels.length,
      channels,
    };

    const textOutput = channels.length > 0
      ? channels.map((c, i) => 
          `${i + 1}. ${c.title}${c.customUrl ? ` (@${c.customUrl})` : ''}\n   ID: ${c.channelId}\n   ${c.description.slice(0, 100)}${c.description.length > 100 ? '...' : ''}`
        ).join('\n\n')
      : 'No channels found';

    return {
      content: [{ type: 'text', text: `Found ${channels.length} channels for "${query}":\n\n${textOutput}` }],
      structuredContent: result,
    };
  },
});
