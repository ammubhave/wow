import {z} from "zod";

/** Which tour: the full setup walkthrough (whoever made the workspace), or the shorter one. */
export const TOUR_KINDS = ["captain", "solver"] as const;
export type TourKind = (typeof TOUR_KINDS)[number];

/** A member's onboarding tour, saved on their member row (member.tour). */
export const tourStateSchema = z.object({
  kind: z.enum(TOUR_KINDS),
  /** The id of the step they're on. */
  step: z.string().max(64).nullable(),
  status: z.enum(["active", "done", "dismissed"]),
  /** Example rounds and puzzles "Do it for me" made, so later steps can find them. */
  examples: z
    .object({
      roundId: z.string().max(64).optional(),
      metaId: z.string().max(64).optional(),
      puzzleIds: z.array(z.string().max(64)).max(10).optional(),
    })
    .optional(),
});
export type TourState = z.infer<typeof tourStateSchema>;

export const newTourState = (kind: TourKind): TourState => ({kind, step: null, status: "active"});

/** The member row's untyped JSON column, read safely (anything odd means "no tour"). */
export function parseTourState(value: unknown): TourState | null {
  const parsed = tourStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
