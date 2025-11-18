import { routeAgentRequest, type Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { tools, executions, initializeUnsplashMcp } from "./tools";
import { createMcpHandler } from "agents/mcp";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from 'workers-ai-provider';
import { processToolCalls, cleanupMessages } from "./utils";
import { env } from "cloudflare:workers";

const workersai = createWorkersAI({ binding: env.AI });
const model = workersai("@cf/meta/llama-3.1-8b-instruct-fp8");

// Initialize Unsplash MCP server (no authentication required)
const mcp = initializeUnsplashMcp();
const mcpHandler = createMcpHandler(mcp);
/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Merge local tools with MCP tools from Pinterest
    
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions: executions
        });

        const result = streamText({
          system: `You are a helpful assistant that can search for and display high-quality photos from Unsplash.

You have access to these tools:
- search_unsplash_photos: Search for photos based on a description or query

When a user asks for photos or images:
1. Use the search_unsplash_photos tool with their query
2. The tool returns markdown-formatted image results that will display as actual images
3. The results include image previews, photographer credits, and links to full-size images
4. Present the images in an organized, gallery-like format

Always use the tool to search for images when users ask for photos, pictures, or visual content.

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/mcp")) return mcpHandler(request, env, _ctx);

    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
