import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tool } from "ai";
import { z } from "zod";
import type { UnsplashSearchResponse } from "./commons/unsplash";

/**
 * Initializes the Unsplash MCP server and tools
 * @param env the environment containing Unsplash API credentials
 * @returns an mcp server instance
 */
export function initializeUnsplashMcp(env?: {
  UNSPLASH_CLIENT_ACCESS?: string;
  UNSPLASH_CLIENT_SECRET?: string;
}) {
  const mcp = new McpServer({
    name: "unsplash-mcp",
    version: "1.0.0"
  });

  mcp.registerResource(
    "unsplash",
    "https://unsplash.com",
    {},
    async (_uri, extra) => {
      console.log("HEADERS", extra.requestInfo?.headers);
      return {
        contents: [
          {
            uri: "https://unsplash.com",
            mimeType: "text/html",
            text: "Unsplash Photo Search"
          }
        ]
      };
    }
  );

  const searchPhotos = async (args: { query?: string; limit?: number }) => {
    const query = args.query || "";
    const limit = Math.min(args.limit || 10, 30);

    try {
      // Get the access token from environment or fall back to demo
      const accessKey = env?.UNSPLASH_CLIENT_ACCESS || "demo";

      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", limit.toString());
      url.searchParams.set("client_id", accessKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Unsplash API error (${response.status}): ${errorText}`
        );
      }

      const data = (await response.json()) as UnsplashSearchResponse;

      if (!data.results || data.results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No photos found for query: "${query}"`
            }
          ]
        };
      }

      const photos = data.results.map((photo) => ({
        title: photo.description || photo.alt_description || "Untitled",
        author: `${photo.user.name} (@${photo.user.username})`,
        authorUrl: photo.user.links.html,
        imageUrl: photo.urls.small,
        photoUrl: photo.links.html,
        likes: photo.likes
      }));

      // Create markdown formatted response
      const markdownContent = `I found ${data.results.length} photos describing "${query}":\n

${photos

  .map(
    (photo) =>
      `[${photo.title}](${photo.photoUrl})\nBy **[${photo.author}](${photo.authorUrl})**\n\n[![${photo.title}](${photo.imageUrl})](${photo.photoUrl})\n\n**[View full size](${photo.photoUrl})** • ❤️ ${photo.likes}`
  )

  .join("\n\n---\n\n")}

  Tell me if you'd like to see more photos like this or search for something else!`;

      return {
        content: [
          {
            type: "text" as const,
            text: markdownContent
          }
        ]
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching Unsplash photos: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  };

  /**
   * Register the search photos tool
   * Uses Unsplash API /search/photos endpoint
   */
  mcp.registerTool(
    "search_unsplash_photos",
    {
      description:
        "Search for Unsplash photos based on a query description. Returns a list of high-quality photos matching the search criteria."
    },
    async (args) => searchPhotos(args)
  );

  // Define the tool to be used by the agent
  const searchPhotosTool = tool({
    description:
      "Search for Unsplash photos based on a query description. Returns a list of high-quality photos matching the search criteria.",
    inputSchema: z.object({
      query: z.string().describe("The search query for finding photos"),
      limit: z.coerce
        .number()
        .optional()
        .default(10)
        .describe("Number of photos to return (max 30)")
    }),
    execute: async (args) => {
      return await searchPhotos(args);
    }
  });

  return { mcp, searchPhotosTool };
}
