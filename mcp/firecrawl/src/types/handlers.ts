/**
 * Handler type definitions for MCP tools.
 */

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

/**
 * The extra context type that SDK provides to handlers.
 */
export type HandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Tool handler function signature.
 *
 * @param args - Validated input arguments
 * @param extra - SDK-provided context with signal, progress, notifications
 */
export type ToolHandler<TInput = unknown> = (
  args: TInput,
  extra: HandlerExtra,
) => Promise<CallToolResult>;

/**
 * Tool definition with schema and handler.
 */
export interface ToolDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  /** Unique tool name (snake_case recommended) */
  name: string;
  /** Human-readable description for LLM */
  description: string;
  /** Zod schema for input validation */
  inputSchema: TInput;
  /** Optional Zod schema for structured output */
  outputSchema?: TOutput;
  /** Handler function */
  handler: ToolHandler<z.infer<TInput>>;
}
