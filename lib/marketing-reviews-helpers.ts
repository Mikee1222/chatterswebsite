export const SPOT_CHECK_TYPES = [
  "Account audit",
  "Exec QA",
  "Account warning",
  "Brief delay",
  "Other",
] as const;

export type SpotCheckType = (typeof SPOT_CHECK_TYPES)[number];

export const SPOT_CHECK_STATUSES = ["Pending", "Fixed", "Escalated"] as const;
export type SpotCheckStatus = (typeof SPOT_CHECK_STATUSES)[number];

export const DAILY_REVIEW_KPIS = [
  "Posts published on time",
  "Engagement targets met",
  "Follower growth on track",
  "Content quality standards",
  "DM / comment response rate",
  "Hashtag & caption compliance",
] as const;

export const COMPLIANCE_VS_MASTER = [
  "Username matches master",
  "Bio matches master",
  "Link in bio correct",
  "Profile photo matches",
  "Highlights / pinned posts updated",
] as const;
