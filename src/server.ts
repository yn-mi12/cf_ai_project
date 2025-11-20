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

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Check if the latest user message might need tools
        const latestUserMessage = cleanedMessages
          .slice()
          .reverse()
          .find((msg) => msg.role === "user");
        const messageText =
          latestUserMessage?.parts
            ?.find((part) => part.type === "text")
            ?.text?.toLowerCase() || "";

        // Keywords that suggest photo/image search is needed
        const photoKeywords = [
          "show me",
          "find",
          "search",
          "the same",
          "more",
          "looking for",
          "want to see",
          "do you have pictures",
          "pictures of",
          "display images",
          "look for photos",
          "search for images",
          "i'd like to see",
          "get me pictures",
          "provide images",
          "fetch photos",
          "send",
          "give me",
          "photo",
          "image",
          "picture",
          "pic",
          "depict"
        ];

        const needsTools = photoKeywords.some((keyword) =>
          messageText.includes(keyword)
        );

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: needsTools ? allTools : {},
          executions: {}
        });

        let toolExecuted = false;

        const result = streamText({
          system: `You are a helpful assistant that can search for and display high-quality photos from Unsplash upon request.
          You can also engage in general conversation.

${
  needsTools
    ? `You have access to these tools:
- search_unsplash_photos: Search for photos based on a description or query`
    : "You are currently in conversation mode without access to tools."
}

When a user greets you ("Hi","Hello","Hey" and similar) or asks for help, 
respond politely and offer assistance offering to search for photos if needed.
${
  needsTools
    ? `
When a user asks for photos or images:
IMPORTANT: try to derive a number even if it is written in words (e.g., "five" = 5).
1. Use the search_unsplash_photos tool with their query, but do NOT mention the tool usage in your response
2. The tool returns markdown-formatted image results that you should display as actual images
3. You should include image previews, photographer credits and likes as provided by the tool
IMPORTANT: Return all images the user asked for, do not truncate or limit the number of images shown
4. Present the images in an organized format but do not change the markdown provided by the tool
5. If no photos are found, inform the user politely
6. CRITICAL: After using the tool, DO NOT generate any text response whatsoever

Always use the tool to search for images when users ask for photos, pictures, or any visual content.`
    : "Engage in natural conversation and provide helpful responses without using tools."
}

`,

          messages: convertToModelMessages(processedMessages),
          model,
          ...(needsTools ? { tools: allTools } : {}),
          onStepFinish: async (step) => {
            if (step.toolResults && step.toolResults.length > 0) {
              toolExecuted = true;
            }
          },
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: (step) => {
            return toolExecuted || stepCountIs(20)(step);
          }
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
 * Worker entry point that routes incoming requests to the mcp handler
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
