import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stravaFetch } from "../strava-client.js";

// Stream keys accepted by Strava
const STREAM_KEYS = [
  "time",
  "distance",
  "latlng",
  "altitude",
  "velocity_smooth",
  "heartrate",
  "cadence",
  "watts",
  "temp",
  "moving",
  "grade_smooth",
] as const;

export function registerActivityTools(server: McpServer): void {
  // ── List activities ────────────────────────────────────────────────────────
  server.registerTool(
    "list_activities",
    {
      title: "List Athlete Activities",
      description:
        "Returns a paginated list of the authenticated athlete's activities, newest first. Filter by date range. Useful for reviewing training history when building a plan.",
      inputSchema: z.object({
        before: z
          .number()
          .int()
          .optional()
          .describe(
            "Unix timestamp. Only return activities before this time."
          ),
        after: z
          .number()
          .int()
          .optional()
          .describe(
            "Unix timestamp. Only return activities after this time."
          ),
        page: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Page number (default 1)."),
        per_page: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(30)
          .describe("Activities per page, max 200 (default 30)."),
      }),
    },
    async ({ before, after, page, per_page }) => {
      const params = new URLSearchParams();
      if (before) params.set("before", String(before));
      if (after) params.set("after", String(after));
      params.set("page", String(page));
      params.set("per_page", String(per_page));

      const activities = await stravaFetch<unknown[]>(
        `/athlete/activities?${params}`
      );

      // Return a concise summary to avoid huge payloads
      const summary = (activities as Record<string, unknown>[]).map((a) => ({
        id: a.id,
        name: a.name,
        sport_type: a.sport_type,
        start_date_local: a.start_date_local,
        distance_m: a.distance,
        moving_time_s: a.moving_time,
        elapsed_time_s: a.elapsed_time,
        total_elevation_gain_m: a.total_elevation_gain,
        average_speed_mps: a.average_speed,
        max_speed_mps: a.max_speed,
        average_heartrate: a.average_heartrate,
        max_heartrate: a.max_heartrate,
        average_cadence: a.average_cadence,
        average_watts: a.average_watts,
        suffer_score: a.suffer_score,
        kudos_count: a.kudos_count,
        pr_count: a.pr_count,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  // ── Get a single activity (detailed) ──────────────────────────────────────
  server.registerTool(
    "get_activity",
    {
      title: "Get Activity Details",
      description:
        "Returns full details of a specific activity including splits, best efforts, segment efforts and gear used.",
      inputSchema: z.object({
        activity_id: z
          .number()
          .int()
          .describe("The Strava activity ID."),
        include_all_efforts: z
          .boolean()
          .default(false)
          .describe("Include all segment efforts (default false)."),
      }),
    },
    async ({ activity_id, include_all_efforts }) => {
      const params = new URLSearchParams();
      if (include_all_efforts) params.set("include_all_efforts", "true");
      const activity = await stravaFetch<Record<string, unknown>>(
        `/activities/${activity_id}?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(activity, null, 2) }],
      };
    }
  );

  // ── Get activity laps ─────────────────────────────────────────────────────
  server.registerTool(
    "get_activity_laps",
    {
      title: "Get Activity Laps",
      description:
        "Returns the laps of an activity. Each lap includes distance, time, pace, heart rate and cadence.",
      inputSchema: z.object({
        activity_id: z.number().int().describe("The Strava activity ID."),
      }),
    },
    async ({ activity_id }) => {
      const laps = await stravaFetch<unknown[]>(
        `/activities/${activity_id}/laps`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(laps, null, 2) }],
      };
    }
  );

  // ── Get activity streams ──────────────────────────────────────────────────
  server.registerTool(
    "get_activity_streams",
    {
      title: "Get Activity Streams",
      description:
        "Returns time-series data streams for an activity (e.g. heart rate, pace, elevation, cadence, power). Great for analysing effort distribution when designing training plans.",
      inputSchema: z.object({
        activity_id: z.number().int().describe("The Strava activity ID."),
        stream_types: z
          .array(z.enum(STREAM_KEYS))
          .min(1)
          .default(["time", "heartrate", "distance", "altitude", "velocity_smooth"])
          .describe(
            "Which streams to fetch. Options: time, distance, latlng, altitude, velocity_smooth, heartrate, cadence, watts, temp, moving, grade_smooth."
          ),
        resolution: z
          .enum(["low", "medium", "high"])
          .default("medium")
          .describe("Data resolution: low (~100 pts), medium (~1000 pts), high (raw)."),
      }),
    },
    async ({ activity_id, stream_types, resolution }) => {
      const keys = stream_types.join(",");
      const params = new URLSearchParams({
        keys,
        key_by_type: "true",
        resolution,
      });
      const streams = await stravaFetch<Record<string, unknown>>(
        `/activities/${activity_id}/streams?${params}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(streams, null, 2) }],
      };
    }
  );

  // ── Get activity zones ────────────────────────────────────────────────────
  server.registerTool(
    "get_activity_zones",
    {
      title: "Get Activity Heart Rate / Power Zones",
      description:
        "Returns the time spent in each heart rate and power zone during a specific activity.",
      inputSchema: z.object({
        activity_id: z.number().int().describe("The Strava activity ID."),
      }),
    },
    async ({ activity_id }) => {
      const zones = await stravaFetch<Record<string, unknown>>(
        `/activities/${activity_id}/zones`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(zones, null, 2) }],
      };
    }
  );

  // ── Create a manual activity ──────────────────────────────────────────────
  server.registerTool(
    "create_activity",
    {
      title: "Create Manual Activity",
      description:
        "Creates a manual activity on Strava. Requires activity:write scope. Useful for logging training sessions that weren't recorded by a device.",
      inputSchema: z.object({
        name: z.string().describe("Activity name."),
        sport_type: z
          .string()
          .describe(
            "Sport type, e.g. Run, Ride, Swim, WeightTraining, Workout, etc."
          ),
        start_date_local: z
          .string()
          .describe("ISO 8601 start date/time in local time, e.g. 2024-06-01T07:00:00Z."),
        elapsed_time: z.number().int().describe("Duration in seconds."),
        description: z.string().optional().describe("Activity description."),
        distance: z.number().optional().describe("Distance in metres."),
        trainer: z
          .boolean()
          .optional()
          .describe("Set true for indoor trainer activity."),
        commute: z.boolean().optional().describe("Set true for commute."),
      }),
    },
    async ({
      name,
      sport_type,
      start_date_local,
      elapsed_time,
      description,
      distance,
      trainer,
      commute,
    }) => {
      const body: Record<string, unknown> = {
        name,
        sport_type,
        start_date_local,
        elapsed_time,
      };
      if (description !== undefined) body.description = description;
      if (distance !== undefined) body.distance = distance;
      if (trainer !== undefined) body.trainer = trainer ? 1 : 0;
      if (commute !== undefined) body.commute = commute ? 1 : 0;

      const activity = await stravaFetch<Record<string, unknown>>(
        "/activities",
        { method: "POST", body: JSON.stringify(body) }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(activity, null, 2) }],
      };
    }
  );

  // ── Update activity ───────────────────────────────────────────────────────
  server.registerTool(
    "update_activity",
    {
      title: "Update Activity",
      description:
        "Updates mutable fields of an activity (name, description, type, gear, privacy flags). Requires activity:write scope.",
      inputSchema: z.object({
        activity_id: z.number().int().describe("The Strava activity ID."),
        name: z.string().optional().describe("New activity name."),
        sport_type: z.string().optional().describe("New sport type."),
        description: z.string().optional().describe("New description."),
        gear_id: z.string().optional().describe("Gear ID to associate (use 'none' to clear)."),
        commute: z.boolean().optional(),
        trainer: z.boolean().optional(),
        hide_from_home: z.boolean().optional(),
      }),
    },
    async ({ activity_id, ...fields }) => {
      const body: Record<string, unknown> = {};
      if (fields.name !== undefined) body.name = fields.name;
      if (fields.sport_type !== undefined) body.sport_type = fields.sport_type;
      if (fields.description !== undefined) body.description = fields.description;
      if (fields.gear_id !== undefined) body.gear_id = fields.gear_id;
      if (fields.commute !== undefined) body.commute = fields.commute;
      if (fields.trainer !== undefined) body.trainer = fields.trainer;
      if (fields.hide_from_home !== undefined) body.hide_from_home = fields.hide_from_home;

      const updated = await stravaFetch<Record<string, unknown>>(
        `/activities/${activity_id}`,
        { method: "PUT", body: JSON.stringify(body) }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    }
  );
}
