import { z } from 'zod';
import { defineTool } from './types.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const videoDetailsInputSchema = z.object({
  videoId: z.string().min(1).describe('YouTube video ID'),
});

interface VideoDetails {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  thumbnailUrl: string;
}

export const videoDetailsTool = defineTool({
  name: 'video_details',
  title: 'Get Video Details',
  description: 'Get detailed information about a YouTube video including statistics, duration, and metadata',
  inputSchema: videoDetailsInputSchema,
  outputSchema: {
    videoId: z.string(),
    title: z.string(),
    description: z.string(),
    channelId: z.string(),
    channelTitle: z.string(),
    publishedAt: z.string(),
    duration: z.string(),
    viewCount: z.number(),
    likeCount: z.number(),
    commentCount: z.number(),
    tags: z.array(z.string()),
    thumbnailUrl: z.string(),
  },
  annotations: {
    title: 'Get Video Details',
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

    const { videoId } = args;

    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('id', videoId);
    url.searchParams.set('part', 'snippet,contentDetails,statistics');

    const response = await fetch(url.toString(), {
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
        id: string;
        snippet: {
          title: string;
          description: string;
          channelId: string;
          channelTitle: string;
          publishedAt: string;
          tags?: string[];
          thumbnails: { maxres?: { url: string }; high?: { url: string }; medium?: { url: string } };
        };
        contentDetails: {
          duration: string;
        };
        statistics: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }>;
    };

    if (!data.items?.length) {
      return {
        content: [{ type: 'text', text: `Video not found: ${videoId}` }],
        isError: true,
      };
    }

    const video = data.items[0];
    const result: VideoDetails = {
      videoId: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails.duration,
      viewCount: Number(video.statistics.viewCount ?? 0),
      likeCount: Number(video.statistics.likeCount ?? 0),
      commentCount: Number(video.statistics.commentCount ?? 0),
      tags: video.snippet.tags ?? [],
      thumbnailUrl: video.snippet.thumbnails.maxres?.url 
        ?? video.snippet.thumbnails.high?.url 
        ?? video.snippet.thumbnails.medium?.url 
        ?? '',
    };

    const textOutput = `
Title: ${result.title}
Channel: ${result.channelTitle}
Published: ${result.publishedAt}
Duration: ${result.duration}
Views: ${result.viewCount.toLocaleString()}
Likes: ${result.likeCount.toLocaleString()}
Comments: ${result.commentCount.toLocaleString()}
Tags: ${result.tags.slice(0, 10).join(', ')}${result.tags.length > 10 ? '...' : ''}

Description:
${result.description.slice(0, 500)}${result.description.length > 500 ? '...' : ''}
`.trim();

    return {
      content: [{ type: 'text', text: textOutput }],
      structuredContent: result,
    };
  },
});
