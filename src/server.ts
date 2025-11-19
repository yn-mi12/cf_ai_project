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
          system: `You are a helpful assistant that can search for and display high-quality photos from Unsplash upon request.
          You can also engage in general conversation and provide assistance as needed.

You have access to these tools:
- search_unsplash_photos: Search for photos based on a description or query

When a user greets you ("Hi","Hello","Hey" and similar)or asks for help, respond politely and offer assistance. Do NOT
use any tools unless the user specifically asks for photos or images. Do NOT mention the tools.

When a user asks for photos or images:

IMPORTANT: A query can start with phrases like "Show me", "Find me", "I want to see", "Do you have pictures of",
 "Can you display images of", "Look for photos of", "Search for images of", "I'd like to see", "Get me pictures of", "Provide images of", 
 "Fetch photos of", "Send", "Give me" or similar variations.
1. Use the search_unsplash_photos tool with their query, but do NOT mention the tool usage in your response
2. The tool returns markdown-formatted image results that you should display as actual images
3. You should include image previews, photographer credits and likes as provided by the tool
IMPORTANT: Return all images the user asked for, do not truncate or limit the number of images shown
4. Present the images in an organized, gallery-like format, but do not change the markdown provided by the tool
5. If no photos are found, inform the user politely
6. CRITICAL: After using the tool, DO NOT generate any text response whatsoever
7. The tool output will display the images automatically - never add commentary, summaries, or additional messages
8. Only respond with text if there's an error or if no photos are found

Always use the tool to search for images when users ask for photos, pictures, or visual content.

`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,

          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(40)
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
