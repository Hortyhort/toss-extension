import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Initialize MCP Server
const server = new Server(
  {
    name: "toss-gateway",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "notion_append",
        description: "Append text to a Notion page via Server-side Token",
        inputSchema: {
          type: "object",
          properties: {
            pageId: { type: "string" },
            content: { type: "string" },
            sourceUrl: { type: "string" },
            notionToken: { type: "string" }
          },
          required: ["pageId", "content", "notionToken"]
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "notion_append") {
    const args = request.params.arguments as any;
    const { pageId, content, sourceUrl, notionToken } = args;

    if (!notionToken || !pageId || !content) {
      throw new Error("Missing notionToken, pageId, or content");
    }

    try {
      const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          children: [
            {
              object: "block",
              type: "quote",
              quote: {
                rich_text: [{ type: "text", text: { content: content } }],
                extensions: { "com.notion.source": { url: sourceUrl || "" } } // Unofficial, checking if Notion V1 supports children citation inside block or just text
                // More standard: Append a paragraph block with the link after the quote?
                // Let's stick to simple quote for now.
              }
            },
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                  rich_text: [
                      { type: "text", text: { content: "Source: " } },
                      { type: "text", text: { content: sourceUrl || "Web", link: sourceUrl ? { url: sourceUrl } : null } }
                  ],
                  color: "gray"
              }
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: "Successfully saved to Notion." }]
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error saving to Notion: ${err.message}` }]
      };
    }
  }
  throw new Error("Tool not found");
});

// SSE Transport Endpoint for Extensions
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  // Handle JSON-RPC messages from client
  // Note: SSEServerTransport handles specific routing usually, 
  // but for Express we might need an adapter. 
  // For now, simple mock setup.
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Toss Backend Gateway running on port ${PORT}`);
});
