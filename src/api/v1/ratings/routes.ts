import { getSupabaseClient } from "@/api/v1/client";

export type RatingSummaryRow = {
  average: number | string | null;
  count: number;
  breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  recent: {
    rating_id: string;
    score: number;
    feedback: string | null;
    rated_at: string;
    request_type: "Pickup" | "Charter_Rental";
    destination: string | null;
    commuter_name: string | null;
  }[];
};

export const ratingRoutes = {
  rate: (requestId: string, score: number, feedback: string | null) =>
    getSupabaseClient().rpc("rate_request", {
      p_request_id: requestId,
      p_score: score,
      p_feedback: feedback,
    }),

  mySummary: () => getSupabaseClient().rpc("get_my_ratings"),
};
