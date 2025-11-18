
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tool, type ToolSet} from "ai";

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
    }
  };
  current_user_collections: any[];
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
  }
}

/**
 * Unsplash API response interface
 */
interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

/**
 * Initialize Unsplash MCP server with tools
 */
const searchTool = tool({
    description: "Search for Unsplash photos based on a query description. Returns a list of photos matching the search criteria.",
    inputSchema: z.object({
      query: z.string().describe("Search query to find photos (e.g., 'modern kitchen designs', 'summer outfits', 'nature landscapes')"),
      limit: z.number().optional().default(10).describe("Maximum number of photos to return (default: 10, max: 30)")
    })
})

export function initializeUnsplashMcp() {
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

  /**
   * Register the search photos tool
   * Uses Unsplash API /search/photos endpoint (no auth required for basic search)
   */
  mcp.registerTool(
    "search_unsplash_photos",
    {
      description: "Search for Unsplash photos based on a query description. Returns a list of high-quality photos matching the search criteria.",
      inputSchema: {
        query: z.string().describe("Search query to find photos (e.g., 'modern kitchen designs', 'summer outfits', 'nature landscapes')"),
        limit: z.number().optional().default(10).describe("Maximum number of photos to return (default: 10, max: 30)")
      }
    },
    async (args) => {
      const query = args.query || "";
      const limit = Math.min(args.limit || 10, 30);

      try {
        // Using Unsplash Source API which doesn't require authentication
        // Alternative: Use official API with access key if needed
        const url = new URL("https://api.unsplash.com/search/photos");
        url.searchParams.set("query", query);
        url.searchParams.set("per_page", limit.toString());
        url.searchParams.set("client_id", "demo"); // Demo client for public access

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Accept-Version": "v1"
          }
        });

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
                type: "text",
                text: `No photos found for query: "${query}"`
              }
            ]
          };
        }

        // Format photos for display
        const formattedPhotos = data.results.map((photo, index) => {
          return `Photo ${index + 1}:
- ID: ${photo.id}
- Description: ${photo.description || photo.alt_description || "No description"}
- Image URL: ${photo.urls.regular}
- Full Resolution: ${photo.urls.full}
- Thumbnail: ${photo.urls.thumb}
- Link: ${photo.links.html}
- Photographer: ${photo.user.name} (@${photo.user.username})
- Dimensions: ${photo.width}x${photo.height}
- Created: ${photo.created_at}`;
        });

        const resultText = `Found ${data.results.length} photos (total: ${data.total}) for query: "${query}"\n\n${formattedPhotos.join("\n\n")}`;

        return {
          content: [
            {
              type: "text",
              text: resultText
            }
          ]
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text",
              text: `Error searching Unsplash photos: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );
  return mcp;
}

export const tools = {
  searchTool,
} satisfies ToolSet;

export const executions = {}

