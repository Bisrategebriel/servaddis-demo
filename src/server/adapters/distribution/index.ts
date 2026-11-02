import "server-only";
import type { Channel } from "@prisma/client";

// Distribution seam (TRD §5.6). The demo publishes nothing: the simulated adapter reports
// success and the UI tags every row "Simulated". TikTok has no posting API for a demo, so it
// becomes a draft for the team to finish (add a trending sound). A real Telegram adapter
// (TELEGRAM_REAL=1, D-10) would plug in here; it is skipped for now.

export type PublishInput = {
  channel: Channel;
  caption: string;
  card: Uint8Array;
};
export type PublishResult = {
  status: "PUBLISHED" | "DRAFT_FOR_TEAM";
  externalUrl: string | null;
  simulated: boolean;
};

export interface DistributionAdapter {
  publish(input: PublishInput): Promise<PublishResult>;
}

/** Pause per channel so the publish log visibly fills in; none in tests. */
const delayMs = () =>
  Number(process.env.DISTRIBUTION_SIM_DELAY_MS ?? (process.env.VITEST ? 0 : 700));

export const simulatedDistribution: DistributionAdapter = {
  async publish({ channel }) {
    const ms = delayMs();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return channel === "TIKTOK"
      ? { status: "DRAFT_FOR_TEAM", externalUrl: null, simulated: true }
      : { status: "PUBLISHED", externalUrl: null, simulated: true };
  },
};

export const distribution: DistributionAdapter = simulatedDistribution;
