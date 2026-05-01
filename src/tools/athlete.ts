import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stravaFetch } from "../strava-client.js";

export function registerAthleteTools(server: McpServer): void {
  // ── Get authenticated athlete ──────────────────────────────────────────────
  server.registerTool(
    "get_athlete",
    {
      title: "Get Athlete Profile",
      description:
        "Returns the profile of the currently authenticated Strava athlete including name, location, follower/friend counts and fitness level.",
      inputSchema: z.object({}),
    },
    async () => {
      const athlete = await stravaFetch<Record<string, unknown>>("/athlete");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(athlete, null, 2),
          },
        ],
      };
    }
  );

  // ── Get athlete stats ──────────────────────────────────────────────────────
  server.registerTool(
    "get_athlete_stats",
    {
      title: "Get Athlete Stats",
      description:
        "Returns totals and stats for the authenticated athlete across all-time, recent (last 4 weeks) and year-to-date periods. Includes total distance, elevation gain, ride/run/swim counts and best efforts.",
      inputSchema: z.object({
        athlete_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Strava athlete ID. Leave blank to use the authenticated athlete's ID."
          ),
      }),
    },
    async ({ athlete_id }) => {
      let id = athlete_id;
      if (!id) {
        const athlete = await stravaFetch<{ id: number }>("/athlete");
        id = athlete.id;
      }
      const stats = await stravaFetch<Record<string, unknown>>(
        `/athletes/${id}/stats`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  // ── Get heart rate and power zones ────────────────────────────────────────
  server.registerTool(
    "get_athlete_zones",
    {
      title: "Get Athlete Heart Rate & Power Zones",
      description:
        "Returns the heart rate and power zones configured for the authenticated athlete. Useful for structuring training plans by intensity zone.",
      inputSchema: z.object({}),
    },
    async () => {
      const zones = await stravaFetch<Record<string, unknown>>(
        "/athlete/zones"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(zones, null, 2) }],
      };
    }
  );

  // ── Update athlete weight ─────────────────────────────────────────────────
  server.registerTool(
    "update_athlete",
    {
      title: "Update Athlete Weight",
      description:
        "Updates the weight (kg) of the authenticated athlete. Requires activity:write scope.",
      inputSchema: z.object({
        weight: z
          .number()
          .positive()
          .describe("Athlete weight in kilograms."),
      }),
    },
    async ({ weight }) => {
      const updated = await stravaFetch<Record<string, unknown>>("/athlete", {
        method: "PUT",
        body: JSON.stringify({ weight }),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    }
  );
}
