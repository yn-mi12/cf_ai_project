# Chat agent that fetches images

An applicaton that fetches and displays images from Unsplash using an AI chat agent built with Cloudflare Agents. It uses the [Cloudflare agents-starter](https://github.com/cloudflare/agents-starter) template as a starting point and builds on it by introducing a custom MCP server to connect to the [Unsplash API](https://unsplash.com).

## Features

- Interactive chat interface with AI
- Dark/Light theme support
- Tool integration for image searching and display in chat
- Real-time streaming responses
- State management and chat history
- Modern, responsive UI

## Prerequisites

- Cloudflare account
- Unsplash client ID

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/yn-mi12/cf_ai_project.git
cd cf_ai_project
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment:

Create a `.dev.vars` file:

```env
UNSPLASH_CLIENT_ACCESS=your_unsplash_client_access_key
```

4. Run locally:

```bash
npm start
```

5. Deploy:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── app.tsx        # Chat UI implementation
│   ├── server.ts      # Chat agent logic
│   ├── tools.ts       # Tool definitions
│   ├── utils.ts       # Helper functions
│   └── styles.css     # UI styling
```

## Customization Guide

### Changing MCP Resource

You can modify the MCP server in `tools.ts` to connect to different APIs or services.To do this, update the `initializeUnsplashMcp` function to interact with your desired API:

```typescript
export function initializeYourMcp(env?: { YOUR_API_KEY?: string }) {
  const mcp = new McpServer({
    name: "your-mcp",
    description: "MCP server for your API"
  });

  mcp.registerResource(
    "your-resource",
    "Resource for your API",
    {},
    async (_uri, extra) => {
      console.log("HEADERS", extra.requestInfo?.headers);
      return {
        contents: [
          {
            uri: "https://your-api-endpoint.com",
            mimeType: "text/html",
            text: "Your API Resource"
          }
        ]
      };
    }
  );
}
```

### Adding New Tools

Add new tools in `tools.ts` using the tool builder - You can create tools that either require confirmation before execution or auto-execute upon invocation. You can also choose to register a tool for the mcp server:

```ts
// For example, a tool that requires confirmation before execution to see a particular user's collections in Unsplash
const seeCollections = tool({
  description: "See specific user's collections",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Maximum number of results")
  })
  // No execute function - requires confirmation
});

// Register the tool with MCP server
mcp.registerTool({
  name: "seeCollections",
  description: "See specific user's collections",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Maximum number of results" }
    },
    required: ["query"]
  }
});
```

To handle tool confirmations, add execution functions to the `executions` object:

```typescript
export const executions = {
  seeCollections: async ({
    query,
    limit
  }: {
    query: string;
    limit?: number;
  }) => {
    // Implementation for when the tool is confirmed
    const results = await db.search(query, limit);
    return results;
  }
  // Add more execution handlers for other tools that require confirmation
};
```

Tools can be configured in two ways:

1. With an `execute` function for automatic execution
2. Without an `execute` function, requiring confirmation and using the `executions` object to handle the confirmed action. NOTE: The keys in `executions` should match `toolsRequiringConfirmation` in `app.tsx`.

### Use a different AI model provider

The starting `server.ts` implementation uses the [`workers-ai-provider`](https://sdk.vercel.ai/providers/community-providers/cloudflare-workers-ai) with [`llama-3.1-8b-instruct-fp8`], but you can use any AI model provider by:

1. Installing an alternative AI provider, such as the [`OpenAI provider`](https://ai-sdk.dev/providers/ai-sdk-providers/openai) or [`anthropic`](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic) provider:
2. Replacing the AI SDK with the [OpenAI SDK](https://github.com/openai/openai-node)
3. Using the Cloudflare [Workers AI + AI Gateway](https://developers.cloudflare.com/ai-gateway/providers/workersai/#workers-binding) binding API directly

For example, to use the [`OpenAI provider`](https://ai-sdk.dev/providers/ai-sdk-providers/openai), install the package:

```sh
npm install @ai-sdk/openai
```

Replace the `workers-ai-provider` import and usage with the `@ai-sdk/openai`:

```diff
// server.ts
// Change the imports
- import { createWorkersAI } from "workers-ai-provider";
+ import { openai } from "@ai-sdk/openai";

// Create an openai model instance
- const workersai = createWorkersAI({ binding: env.AI });
- const model = workersai("@cf/meta/llama-3.1-8b-instruct-fp8");
+ const model = openai("gpt-4o-2024-11-20");


### Modifying the UI

The chat interface is built with React and can be customized in `app.tsx` and the component files. You can:

- Modify the theme colors in `styles.css`
- Add new UI components in the chat container
- Customize message rendering and tool confirmation dialogs
- Add new controls to the header

### Example Use Cases

--- I'll finish this later ---

Each use case can be implemented by:

1. Adding relevant tools in `tools.ts`
2. Customizing the UI
3. Extending the agent's capabilities in `server.ts`
4. Adding any necessary external API integrations

## Learn More

- [`agents`](https://github.com/cloudflare/agents/blob/main/packages/agents/README.md)
- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT
```
