import { z } from 'zod';
import { defineTool } from './types.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const getPlaylistInputSchema = z.object({
  channelId: z.string().optional().describe('YouTube channel ID - list playlists from this channel'),
  playlistId: z.string().optional().describe('YouTube playlist ID - list videos in this playlist'),
  maxResults: z.number().min(1).max(50).optional().default(20).describe('Number of results (1-50, default 20)'),
}).refine(
  (data) => data.channelId || data.playlistId,
  { message: 'Either channelId or playlistId must be provided' }
);

interface PlaylistItem {
  playlistId: string;
  title: string;
  description: string;
  itemCount: number;
  thumbnailUrl: string;
}

interface VideoItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  position: number;
  thumbnailUrl: string;
}

interface GetPlaylistResult {
  type: 'playlists' | 'videos';
  channelId?: string;
  playlistId?: string;
  count: number;
  playlists?: PlaylistItem[];
  videos?: VideoItem[];
}

export const getPlaylistTool = defineTool({
  name: 'get_playlist',
  title: 'Get Playlist',
  description: 'Get playlists from a channel (provide channelId) OR get videos from a playlist (provide playlistId)',
  inputSchema: getPlaylistInputSchema,
  outputSchema: {
    type: z.enum(['playlists', 'videos']),
    channelId: z.string().optional(),
    playlistId: z.string().optional(),
    count: z.number(),
    playlists: z.array(z.object({
      playlistId: z.string(),
      title: z.string(),
      description: z.string(),
      itemCount: z.number(),
      thumbnailUrl: z.string(),
    })).optional(),
    videos: z.array(z.object({
      videoId: z.string(),
      title: z.string(),
      description: z.string(),
      channelTitle: z.string(),
      position: z.number(),
      thumbnailUrl: z.string(),
    })).optional(),
  },
  annotations: {
    title: 'Get Playlist',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (args, context) => {
    const apiKey = context.authHeaders?.['x-youtube-api-key'] ?? context.providerToken;
    
    if (!apiKey) {
      return {
        content: [{ type: 'text', text: 'YouTube API key required. Pass via X-YouTube-Api-Key header.' }],
        isError: true,
      };
    }

    const { channelId, playlistId, maxResults } = args;

    // If playlistId provided, get videos from that playlist
    if (playlistId) {
      return await getPlaylistVideos(playlistId, maxResults, apiKey, context.signal);
    }

    // Otherwise get playlists from channel
    return await getChannelPlaylists(channelId!, maxResults, apiKey, context.signal);
  },
});

async function getChannelPlaylists(
  channelId: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ content: Array<{ type: 'text'; text: string }>; structuredContent: GetPlaylistResult; isError?: boolean }> {
  const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('maxResults', String(maxResults));

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    const error = await response.text();
    return {
      content: [{ type: 'text', text: `YouTube API error: ${response.status} - ${error}` }],
      structuredContent: { type: 'playlists', channelId, count: 0, playlists: [] },
      isError: true,
    };
  }

  const data = await response.json() as {
    items: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
      contentDetails: { itemCount: number };
    }>;
  };

  const playlists: PlaylistItem[] = data.items.map((item) => ({
    playlistId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    itemCount: item.contentDetails.itemCount,
    thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
  }));

  const result: GetPlaylistResult = {
    type: 'playlists',
    channelId,
    count: playlists.length,
    playlists,
  };

  const textOutput = playlists.length > 0
    ? playlists.map((p, i) => `${i + 1}. ${p.title} (${p.itemCount} videos)\n   ID: ${p.playlistId}`).join('\n\n')
    : 'No playlists found';

  return {
    content: [{ type: 'text', text: `Found ${playlists.length} playlists:\n\n${textOutput}` }],
    structuredContent: result,
  };
}

async function getPlaylistVideos(
  playlistId: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ content: Array<{ type: 'text'; text: string }>; structuredContent: GetPlaylistResult; isError?: boolean }> {
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', String(maxResults));

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    const error = await response.text();
    return {
      content: [{ type: 'text', text: `YouTube API error: ${response.status} - ${error}` }],
      structuredContent: { type: 'videos', playlistId, count: 0, videos: [] },
      isError: true,
    };
  }

  const data = await response.json() as {
    items: Array<{
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        position: number;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
        resourceId: { videoId: string };
      };
    }>;
  };

  const videos: VideoItem[] = data.items
    .filter((item) => item.snippet.resourceId?.videoId)
    .map((item) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      position: item.snippet.position,
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
    }));

  const result: GetPlaylistResult = {
    type: 'videos',
    playlistId,
    count: videos.length,
    videos,
  };

  const textOutput = videos.length > 0
    ? videos.map((v) => `${v.position + 1}. ${v.title}\n   ID: ${v.videoId}`).join('\n\n')
    : 'No videos in playlist';

  return {
    content: [{ type: 'text', text: `Playlist has ${videos.length} videos:\n\n${textOutput}` }],
    structuredContent: result,
  };
}
