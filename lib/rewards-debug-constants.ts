export const REWARDS_TEST_EVENT_TYPES = [
  "shift_end",
  "whale_added",
  "transaction",
  "custom_completed",
  "availability",
] as const;

export type RewardsTestEventType = (typeof REWARDS_TEST_EVENT_TYPES)[number];
