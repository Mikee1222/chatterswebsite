/** ClarioSuite public REST API types (https://clariosuite.com/docs/llm.txt). */

export type ClarioSuiteIgProfile = {
  igUserId: string;
  username: string;
  accountType: string | null;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
};

export type ClarioSuiteTimeSeriesPoint = {
  date: string;
  value: number;
};

export type ClarioSuiteAccountInsightsTotals = {
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
  accountsReached: number | null;
  totalInteractions: number | null;
  profileViews: number | null;
  emailContacts: number | null;
  phoneCallClicks: number | null;
  textMessageClicks: number | null;
  directions: number | null;
  profileLinkTaps: number | null;
};

export type ClarioSuiteAccountInsights = {
  rangeDays: number;
  totals: ClarioSuiteAccountInsightsTotals;
  series: {
    reach: ClarioSuiteTimeSeriesPoint[];
    views: ClarioSuiteTimeSeriesPoint[];
    interactions: ClarioSuiteTimeSeriesPoint[];
    followerGrowth: ClarioSuiteTimeSeriesPoint[];
    profileViews: ClarioSuiteTimeSeriesPoint[];
  };
  source: "live" | "snapshots" | "mixed" | string;
};

export type ClarioSuiteDemographicBucket = {
  label: string;
  value: number;
};

export type ClarioSuiteDemographicDimension = {
  dimension: string;
  results: ClarioSuiteDemographicBucket[];
};

export type ClarioSuiteOnlineFollowerHour = {
  hour: number;
  value: number;
};

export type ClarioSuiteAudience = {
  followersCount: number | null;
  demographics: ClarioSuiteDemographicDimension[];
  onlineFollowers: ClarioSuiteOnlineFollowerHour[];
};

export type ClarioSuiteMediaItem = {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaProductType: string | null;
  permalink: string | null;
  imageUrl: string;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
};

export type ClarioSuiteMediaInsight = {
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
  videoViews: number | null;
  quartileP95: number | null;
  carouselAlbumEngagement: number | null;
  carouselAlbumImpressions: number | null;
  carouselAlbumReach: number | null;
  carouselAlbumSaved: number | null;
};

export type ClarioSuiteMe = {
  keyId: string;
  name: string;
  orgId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  rateLimit: { limit: number; window: string };
};

export type ClarioSuiteDailyInsightRow = {
  id: string;
  ig_user_id: string;
  model_record_id: string | null;
  model_stable_id: string | null;
  model_name: string | null;
  date: string;
  reach: number;
  views: number;
  total_interactions: number;
  follower_count: number | null;
  engagement_rate: number | null;
  synced_at: string;
};

export type ClarioSuiteAudienceSnapshotRow = {
  id: string;
  ig_user_id: string;
  model_record_id: string | null;
  model_stable_id: string | null;
  model_name: string | null;
  followers_count: number | null;
  age_ranges: unknown;
  countries: unknown;
  gender_split: unknown;
  cities: unknown;
  locales: unknown;
  online_followers_by_hour: unknown;
  synced_at: string;
};

export type ClarioSuiteTopPostRow = {
  id: string;
  ig_user_id: string;
  model_record_id: string | null;
  model_stable_id: string | null;
  model_name: string | null;
  media_id: string;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  caption: string | null;
  image_url: string | null;
  engagement_score: number | null;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  views: number;
  posted_at: string | null;
  rank: number;
  synced_at: string;
};
