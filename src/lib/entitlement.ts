// Posting entitlement, decided at submit (doc 03 §4.2, doc 05 §7.2). Pure, so the composer can
// show the same answer before the employer presses Submit.

export type PostingSource = "SUBSCRIPTION" | "FOUNDING_FREE" | "URGENT_PAID";

export type Entitlement =
  | { source: "SUBSCRIPTION" | "FOUNDING_FREE"; requiresPayment: false }
  | { source: null; requiresPayment: true };

export function resolveEntitlement(
  venue: { foundingPostsLeft: number },
  /** The venue's ACTIVE, unexpired subscription, if any. */
  subscription: { plan: { maxLiveJobs: number | null } } | null,
  counts: {
    /** The venue's LIVE + PENDING_REVIEW jobs. */
    liveOrPending: number;
    /** PENDING_REVIEW jobs using a founding post: the counter only drops on approval. */
    pendingFounding: number;
  },
): Entitlement {
  const max = subscription?.plan.maxLiveJobs;
  if (subscription && (max === null || counts.liveOrPending < max!)) {
    return { source: "SUBSCRIPTION", requiresPayment: false };
  }
  if (venue.foundingPostsLeft - counts.pendingFounding > 0) {
    return { source: "FOUNDING_FREE", requiresPayment: false };
  }
  return { source: null, requiresPayment: true };
}
