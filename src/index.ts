#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAthleteTools } from "./tools/athlete.js";
import { registerActivityTools } from "./tools/activities.js";
import { registerSegmentTools } from "./tools/segments.js";
import { registerRouteTools } from "./tools/routes.js";

const server = new McpServer({
  name: "strava-mcp-server",
  version: "1.0.0",
});

registerAthleteTools(server);
registerActivityTools(server);
registerSegmentTools(server);
registerRouteTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
