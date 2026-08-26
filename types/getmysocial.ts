/**
 * GetMySocial API v3 response shapes (verified against live API + MCP tool docs).
 * Base: https://api.getmysocial.com — Auth: Authorization: Bearer gms_live_…
 */

export type GetMySocialTimeframe =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "allTime";

export type GetMySocialBreakdownDimension =
  | "countries"
  | "regions"
  | "cities"
  | "devices"
  | "browsers"
  | "languages"
  | "custom-domains";

export type GetMySocialPing = {
  ok: boolean;
  user_id: string;
  request_id: string;
};

export type GetMySocialMeta = {
  service: string;
  version: string;
  docs: string;
};

export type GetMySocialShieldSummary = {
  blocked_pct: number;
  blocked_count: number;
};

export type GetMySocialCountryCount = {
  country: string;
  country_code: string;
  count: number;
};

export type GetMySocialDeviceCount = {
  device: string;
  count: number;
};

export type GetMySocialBrowserCount = {
  browser: string;
  count: number;
};

export type GetMySocialReferrerCount = {
  referrer: string;
  count: number;
};

export type GetMySocialAnalyticsOverview = {
  total_clicks: number;
  total_pageviews: number;
  total_button_clicks: number;
  unique_visitors: number;
  shield: GetMySocialShieldSummary;
  top_countries: GetMySocialCountryCount[];
  top_devices: GetMySocialDeviceCount[];
  top_browsers: GetMySocialBrowserCount[];
  top_referrers: GetMySocialReferrerCount[];
};

export type GetMySocialLinkMetrics = {
  key: string;
  label: string;
  shortcode: string;
  pageviews: number;
  button_clicks: number;
  unique_visitors: number;
  ctr_pct: number;
};

export type GetMySocialVisitorEvent = {
  object: "visitor_event";
  timestamp: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  is_bot: boolean;
  is_proxy: boolean;
  is_hosting: boolean;
  safe_page_triggered: boolean;
  link_id: string;
  link_shortcode: string | null;
  link_display_name: string | null;
};

export type GetMySocialTimeSeriesPoint = {
  bucket: string;
  pageviews?: number;
  clicks?: number;
  button_clicks?: number;
};

export type GetMySocialShieldBucket = {
  bucket: string;
  total: number;
  blocked: number;
  clean: number;
  breakdown: {
    vpn: number;
    datacenter: number;
    bot: number;
  };
};

export type GetMySocialCtrButton = {
  index: number;
  clicks: number;
  label: string | null;
  url: string | null;
};

export type GetMySocialCtr = {
  clicks: number;
  pageviews: number;
  button_clicks: number;
  button_interactions: number;
  ctr_pct: number;
  top_buttons: GetMySocialCtrButton[];
};

export type GetMySocialBreakdownRow = Record<string, string | number | null>;

export type GetMySocialTrackingParamSummary = {
  name?: string;
  param?: string;
  values?: Array<{ value: string; count: number }>;
  count?: number;
  [key: string]: unknown;
};

export type GetMySocialLinkButton = {
  block_id: string;
  label: string | null;
  url: string | null;
  description?: string | null;
  [key: string]: unknown;
};

export type GetMySocialLink = {
  id: string;
  object: "link";
  type: string;
  shortcode: string;
  url: string | null;
  buttons: GetMySocialLinkButton[];
  display_name: string | null;
  status: string | null;
  deeplink_enabled?: boolean;
  user_id?: string;
  created?: number;
  updated?: number;
  name_user?: string | null;
  [key: string]: unknown;
};

export type GetMySocialListResponse<T> = {
  object: "list";
  data: T[];
  has_more?: boolean;
  next_cursor?: string | null;
};
