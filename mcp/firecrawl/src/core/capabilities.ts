import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';

/**
 * Build server capabilities declaration.
 *
 * Capabilities tell the client what features this server supports:
 * - tools: Server can register and execute tools
 * - logging: Server can send log messages to client
 */
export function buildCapabilities(): ServerCapabilities {
  return {
    tools: {
      listChanged: true,
    },
    logging: {},
  };
}
