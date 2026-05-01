import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stravaFetch } from "../strava-client.js";

export function registerSegmentTools(server: McpServer): void {
  // ── List starred segments ─────────────────────────────────────────────────
  server.registerTool(
    "list_starred_segments",
    {
      title: "List Starred Segments",
      description:
        "Returns the authenticated athlete's starred segments. Useful for identifying key benchmark efforts on a training route.",
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
      const segments = await stravaFetch<unknown[]>(
        `/segments/starred?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(segments, null, 2) }],
      };
    }
  );

  // ── Get a segment ─────────────────────────────────────────────────────────
  server.registerTool(
    "get_segment",
    {
      title: "Get Segment Details",
      description:
        "Returns details of a specific segment including distance, elevation profile, hazard flag and athlete counts.",
      inputSchema: z.object({
        segment_id: z.number().int().describe("The Strava segment ID."),
      }),
    },
    async ({ segment_id }) => {
      const segment = await stravaFetch<Record<string, unknown>>(
        `/segments/${segment_id}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(segment, null, 2) }],
      };
    }
  );

  // ── Explore segments in a bounding box ───────────────────────────────────
  server.registerTool(
    "explore_segments",
    {
      title: "Explore Segments",
      description:
        "Returns up to 10 popular segments within a geographic bounding box. Useful for finding climbs or sprints in a training area.",
      inputSchema: z.object({
        bounds: z
          .string()
          .describe(
            "Comma-separated bounding box: sw_lat,sw_lng,ne_lat,ne_lng. E.g. '37.821362,-122.505373,37.842038,-122.465977'."
          ),
        activity_type: z
          .enum(["running", "riding"])
          .optional()
          .describe("Filter by sport (running or riding). Optional."),
        min_cat: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("Minimum climb category (0–5). Optional."),
        max_cat: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("Maximum climb category (0–5). Optional."),
      }),
    },
    async ({ bounds, activity_type, min_cat, max_cat }) => {
      const params = new URLSearchParams({ bounds });
      if (activity_type) params.set("activity_type", activity_type);
      if (min_cat !== undefined) params.set("min_cat", String(min_cat));
      if (max_cat !== undefined) params.set("max_cat", String(max_cat));

      const result = await stravaFetch<{ segments: unknown[] }>(
        `/segments/explore?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ── List segment efforts ──────────────────────────────────────────────────
  server.registerTool(
    "list_segment_efforts",
    {
      title: "List Segment Efforts",
      description:
        "Returns all of the authenticated athlete's efforts on a specific segment, optionally filtered by date. Useful for tracking progression on key benchmark segments.",
      inputSchema: z.object({
        segment_id: z.number().int().describe("The Strava segment ID."),
        start_date_local: z
          .string()
          .optional()
          .describe(
            "ISO 8601 date — only return efforts after this date. E.g. 2024-01-01T00:00:00Z."
          ),
        end_date_local: z
          .string()
          .optional()
          .describe("ISO 8601 date — only return efforts before this date."),
        per_page: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(30),
        page: z.number().int().min(1).default(1),
      }),
    },
    async ({ segment_id, start_date_local, end_date_local, per_page, page }) => {
      const params = new URLSearchParams({
        segment_id: String(segment_id),
        per_page: String(per_page),
        page: String(page),
      });
      if (start_date_local) params.set("start_date_local", start_date_local);
      if (end_date_local) params.set("end_date_local", end_date_local);

      const efforts = await stravaFetch<unknown[]>(
        `/segment_efforts?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(efforts, null, 2) }],
      };
    }
  );

  // ── Get segment effort ────────────────────────────────────────────────────
  server.registerTool(
    "get_segment_effort",
    {
      title: "Get Segment Effort Details",
      description:
        "Returns details of a specific segment effort including elapsed time, start/end indices and average HR/watts.",
      inputSchema: z.object({
        effort_id: z.number().int().describe("The segment effort ID."),
      }),
    },
    async ({ effort_id }) => {
      const effort = await stravaFetch<Record<string, unknown>>(
        `/segment_efforts/${effort_id}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(effort, null, 2) }],
      };
    }
  );

  // ── Get segment streams ───────────────────────────────────────────────────
  server.registerTool(
    "get_segment_streams",
    {
      title: "Get Segment Streams",
      description:
        "Returns time-series streams for a segment (elevation, distance, gradient, latlng).",
      inputSchema: z.object({
        segment_id: z.number().int().describe("The Strava segment ID."),
        stream_types: z
          .array(
            z.enum(["distance", "latlng", "altitude", "grade_smooth", "moving"])
          )
          .default(["distance", "altitude", "grade_smooth"])
          .describe("Stream types to fetch."),
      }),
    },
    async ({ segment_id, stream_types }) => {
      const params = new URLSearchParams({
        keys: stream_types.join(","),
        key_by_type: "true",
      });
      const streams = await stravaFetch<Record<string, unknown>>(
        `/segments/${segment_id}/streams?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(streams, null, 2) }],
      };
    }
  );
}
