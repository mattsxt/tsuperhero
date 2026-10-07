import { ratingRoutes, type RatingSummaryRow } from "@/api/v1/ratings/routes";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";

export const maxFeedbackLength = 500;

export type Review = {
  id: string;
  score: number;
  feedback: string | null;
  ratedAt: Date;
  kind: "pickup" | "rental";
  destination: string | null;
  commuterName: string | null;
};

export type RatingSummary = {
  average: number | null;
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  recent: Review[];
};

export const scoreLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

export async function rateTrip(
  requestId: string,
  score: number,
  feedback: string,
): Promise<Result<unknown>> {
  if (score < 1 || score > 5) return failure("Choose between 1 and 5 stars.");
  if (feedback.trim().length > maxFeedbackLength) {
    return failure(`Keep your feedback under ${maxFeedbackLength} characters.`);
  }
  return attempt(() =>
    unwrap(ratingRoutes.rate(requestId, score, feedback.trim() || null)),
  );
}

export function loadMyRatings(): Promise<Result<RatingSummary>> {
  return attempt(async () => {
    const row: RatingSummaryRow = await unwrap(ratingRoutes.mySummary());
    const average = row?.average === null ? null : Number(row?.average);
    return {
      average: average !== null && Number.isFinite(average) ? average : null,
      count: Number(row?.count) || 0,
      breakdown: {
        1: Number(row?.breakdown?.["1"]) || 0,
        2: Number(row?.breakdown?.["2"]) || 0,
        3: Number(row?.breakdown?.["3"]) || 0,
        4: Number(row?.breakdown?.["4"]) || 0,
        5: Number(row?.breakdown?.["5"]) || 0,
      },
      recent: (row?.recent ?? []).map((review) => ({
        id: review.rating_id,
        score: review.score,
        feedback: review.feedback,
        ratedAt: new Date(review.rated_at),
        kind: review.request_type === "Pickup" ? "pickup" : "rental",
        destination: review.destination,
        commuterName: review.commuter_name,
      })),
    };
  });
}
