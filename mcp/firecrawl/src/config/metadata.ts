/**
 * Centralized metadata for Firecrawl MCP tools.
 */

export const toolsMetadata = {
  scrape: {
    name: 'scrape',
    title: 'Web Scraper',
    description: `Scrapes web pages and extracts content in various formats.

Features:
- Single URL or batch scraping (up to 100 URLs)
- Multiple output formats (markdown, html, links, screenshot)
- Smart content extraction (main content only)
- Geographic targeting
- Rate limit handling with automatic retries

Output modes:
- direct: Returns content in response
- file: Saves as markdown files organized by domain`,
  },

  search: {
    name: 'search',
    title: 'Web Search',
    description: `Searches the web and optionally scrapes results.

Features:
- Single or batch search queries (up to 10)
- Web, image, and news results
- Location-based targeting
- Time filtering (hour/day/week/month/year)
- Optional content scraping from results
- Rate limit handling with automatic retries

Output modes:
- direct: Returns results in response
- file: Saves as markdown files with timestamps`,
  },
} as const;

export type ToolName = keyof typeof toolsMetadata;
