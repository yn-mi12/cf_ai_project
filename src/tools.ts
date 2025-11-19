import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tool } from "ai";
import { z } from "zod";

interface UnsplashPhoto {
  id: string;
  created_at: string;
  width: number;
  height: number;
  color: string;
  blur_hash: string;
  likes: number;
  liked_by_user: boolean;
  description: string | null;
  alt_description?: string;
  user: {
    id: string;
    username: string;
    name: string;
    first_name: string;
    last_name: string;
    instagram_username: string | null;
    twitter_username: string | null;
    portfolio_url: string | null;
    profile_image: {
      small: string;
      medium: string;
      large: string;
    };
    links: {
      self: string;
      html: string;
      photos: string;
      likes: string;
    };
  };
  current_user_collections: [];
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    self: string;
    html: string;
    download: string;
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export function initializeUnsplashMcp(env?: {
  UNSPLASH_CLIENT_ACCESS?: string;
  UNSPLASH_CLIENT_SECRET?: string;
}) {
  const mcp = new McpServer({
    name: "unsplash-mcp",
    version: "1.0.0"
  });

  mcp.registerResource(
    "list of photos",
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

  // MCP implementation that returns the expected format
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
        title: (
          photo.description ||
          photo.alt_description ||
          "Untitled"
        ).replace(/["\n\r]/g, ""),
        author: `${photo.user.name} (@${photo.user.username})`,
        url: `/mcp/proxy_image?url=${encodeURIComponent(photo.urls.small)}`
      }));

      // Create markdown with embedded images
      const markdownContent = `Found ${data.results.length} photos for "${query}":

${photos
  .map(
    (photo) =>
      `**${photo.title}**\nBy ${photo.author}\n\n![${photo.title}](${photo.url})\n`
  )
  .join("\n---\n\n")}`;

      // Debug logging
      console.log("Generated markdown content:", markdownContent);
      console.log(
        "Photo URLs:",
        photos.map((p) => p.url)
      );

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
   * Uses Unsplash API /search/photos endpoint (no auth required for basic search)
   */
  mcp.registerTool(
    "search_unsplash_photos",
    {
      description:
        "Search for Unsplash photos based on a query description. Returns a list of high-quality photos matching the search criteria."
    },
    async (args, _extra) => searchPhotos(args)
  );

  // Create the AI tool using the tool function
  const searchPhotosTool = tool({
    description:
      "Search for Unsplash photos based on a query description. Returns a list of high-quality photos matching the search criteria.",
    inputSchema: z.object({
      query: z.string().describe("The search query for finding photos"),
      limit: z
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
