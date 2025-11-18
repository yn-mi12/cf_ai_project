import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

  mcp.registerTool(
    "proxy_image",
    {
      description: "Fetch an image from a URL and return it CORS-safe",
      inputSchema: {
        url: z.string().describe("URL of the image to proxy")
      }
    },
    async ({ url }) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";

      // Convert ArrayBuffer to Base64
      let binary = "";
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 0x8000; // process in chunks for large images
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      return {
        content: [
          {
            type: "resource",
            resource: {
              mimeType: contentType,
              blob: `data:${contentType};base64,${base64}`,
              uri: url // optional: original URL
            }
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
      description:
        "Search for Unsplash photos based on a query description. Returns a list of high-quality photos matching the search criteria.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Search query to find photos (e.g., 'modern kitchen designs', 'summer outfits', 'nature landscapes')"
          ),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of photos to return (default: 10, max: 30)")
      }
    },
    async (args) => {
      const query = args.query || "";
      const limit = Math.min(args.limit || 10, 30);

      try {
        // Using Unsplash Source API which doesn't require authentication

        const url = new URL("https://api.unsplash.com/search/photos");
        url.searchParams.set("query", query);
        url.searchParams.set("per_page", limit.toString());
        url.searchParams.set("client_id", "demo"); // Demo client for public access

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
                type: "text",
                text: `No photos found for query: "${query}"`
              }
            ]
          };
        }

        const photos = data.results.map((photo) => ({
          title: photo.description || photo.alt_description || "Untitled",
          author: `${photo.user.name} (@${photo.user.username})`
          //proxyUrl: `/mcp/proxy_image?url=${encodeURIComponent(photo.urls.regular)}`,
          //unsplashPage: photo.links.html
        }));
        const resultText = `Found ${data.results.length} photos (total: ${data.total})
 for query: "${query}" \n\n${photos
   .map(
     (p) => `**${p.title}**\nAuthor: 
  ${p.author}`
   )
   .join("\n\n---\n\n")}`;
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

export const tools = {};
export const executions = {};
