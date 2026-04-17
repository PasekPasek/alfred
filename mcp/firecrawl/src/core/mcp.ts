import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from '../config/env.js';
import { registerTools } from '../tools/index.js';
import { buildCapabilities } from './capabilities.js';

export interface ServerOptions {
  /** Server name (appears in client UI) */
  name: string;
  /** Server version (semver) */
  version: string;
  /** Optional instructions for LLM on how to use this server */
  instructions?: string;
}

/**
 * Build and configure the MCP server.
 *
 * This is the main factory function that:
 * 1. Creates the McpServer instance with capabilities
 * 2. Registers all tools
 */
export function buildServer(options: ServerOptions): McpServer {
  const { name, version, instructions } = options;

  const server = new McpServer(
    { name, version },
    {
      capabilities: buildCapabilities(),
      instructions: instructions ?? config.INSTRUCTIONS,
    },
  );

  // Register tools
  registerTools(server);

  return server;
}
