import { routeAgentRequest, type Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { initializeUnsplashMcp } from "./tools";
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
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { env } from "cloudflare:workers";

const workersai = createWorkersAI({ binding: env.AI });
const model = workersai("@cf/meta/llama-3.1-8b-instruct-fp8");

// Initialize Unsplash MCP server with environment credentials
const { mcp, searchPhotosTool } = initializeUnsplashMcp(env);
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
    const allTools = {
      search_unsplash_photos: searchPhotosTool
    } satisfies ToolSet;

    // Debug: Log available tools
    console.log("Available tools:", Object.keys(allTools));

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
          executions: {}
        });

        const result = streamText({
          system: `You are a helpful assistant that can search for and display high-quality photos from Unsplash.

You have access to these tools:
- search_unsplash_photos: Search for photos based on a description or query

CRITICAL INSTRUCTIONS:
- You MUST use the search_unsplash_photos tool for ANY image request
- You CANNOT generate image URLs yourself
- You CANNOT create markdown images without using the tool first
- When a user asks for photos, your ONLY response should be to call search_unsplash_photos
- Display exactly what the tool returns, nothing more, nothing less

DO NOT create any ![image](url) markdown unless it comes from the search_unsplash_photos tool result.

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

    // Handle image proxy requests directly
    if (url.pathname === "/mcp/proxy_image") {
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response("Missing url parameter", { status: 400 });
      }

      try {
        const response = await fetch(decodeURIComponent(imageUrl));
        if (!response.ok) {
          return new Response("Failed to fetch image", {
            status: response.status
          });
        }

        const contentType =
          response.headers.get("content-type") || "image/jpeg";
        const imageData = await response.arrayBuffer();

        return new Response(imageData, {
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "public, max-age=3600"
          }
        });
      } catch (error) {
        console.error("Error proxying image:", error);
        return new Response("Failed to proxy image", { status: 500 });
      }
    }

    if (url.pathname.startsWith("/mcp")) return mcpHandler(request, env, _ctx);

    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
