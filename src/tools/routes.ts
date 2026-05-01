import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stravaFetch } from "../strava-client.js";

export function registerRouteTools(server: McpServer): void {
  // ── List athlete routes ───────────────────────────────────────────────────
  server.registerTool(
    "list_routes",
    {
      title: "List Athlete Routes",
      description:
        "Returns the authenticated athlete's saved routes. Useful for identifying planned training routes when building a training plan.",
      inputSchema: z.object({
        athlete_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Athlete ID. Leave blank to use the authenticated athlete."
          ),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(200).default(30),
      }),
    },
    async ({ athlete_id, page, per_page }) => {
      let id = athlete_id;
      if (!id) {
        const athlete = await stravaFetch<{ id: number }>("/athlete");
        id = athlete.id;
      }
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(per_page),
      });
      const routes = await stravaFetch<unknown[]>(
        `/athletes/${id}/routes?${params}`
      );
      const summary = (routes as Record<string, unknown>[]).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        sub_type: r.sub_type,
        distance_m: r.distance,
        elevation_gain_m: r.elevation_gain,
        estimated_moving_time_s: r.estimated_moving_time,
        created_at: r.created_at,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  // ── Get route ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_route",
    {
      title: "Get Route Details",
      description:
        "Returns the full details of a saved route including segments, map and estimated moving time.",
      inputSchema: z.object({
        route_id: z.number().int().describe("The Strava route ID."),
      }),
    },
    async ({ route_id }) => {
      const route = await stravaFetch<Record<string, unknown>>(
        `/routes/${route_id}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(route, null, 2) }],
      };
    }
  );

  // ── Get gear ──────────────────────────────────────────────────────────────
  server.registerTool(
    "get_gear",
    {
      title: "Get Gear Details",
      description:
        "Returns details of a specific piece of gear (bike or shoes) including total distance logged.",
      inputSchema: z.object({
        gear_id: z
          .string()
          .describe(
            "The gear ID. Bike IDs start with 'b', shoe IDs start with 'g'. E.g. 'b12345'."
          ),
      }),
    },
    async ({ gear_id }) => {
      const gear = await stravaFetch<Record<string, unknown>>(
        `/gear/${gear_id}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(gear, null, 2) }],
      };
    }
  );

  // ── List clubs ────────────────────────────────────────────────────────────
  server.registerTool(
    "list_clubs",
    {
      title: "List Athlete Clubs",
      description:
        "Returns the clubs the authenticated athlete is a member of. Useful for group training context.",
      inputSchema: z.object({
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(200).default(30),
      }),
    },
    async ({ page, per_page }) => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(per_page),
      });
      const clubs = await stravaFetch<unknown[]>(
        `/athlete/clubs?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(clubs, null, 2) }],
      };
    }
  );
}
