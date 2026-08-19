export interface InflowwModel {
  id: string;
  name: string;
  /** OnlyFans / platform performer id — matches `infloww_daily_stats.infloww_performer_id`. */
  platformPid?: string;
}

export interface InflowwEarnings {
  model_id: string;
  model_name: string;
  gross_earnings: number;
  net_earnings: number;
  agency_cut: number;
  date: string;
}

export interface InflowwTransaction {
  id: string;
  model_id: string;
  model_name: string;
  amount: number;
  date: string;
  type?: string;
}

export interface InflowwEarningsResponse {
  earnings: InflowwEarnings[];
  models: InflowwModel[];
  transactions: InflowwTransaction[];
  totals: {
    gross: number;
    net: number;
    cut: number;
  };
}

/** Row from Infloww Employee list (`GET /v1/employees`) for ID lookup. */
export interface InflowwEmployee {
  employeeId: number;
  name: string;
  email?: string;
  status?: string;
  username?: string;
  role?: string;
}

/** One employee × performer × day row from Infloww employee-report endpoints. */
export interface InflowwEmployeeSalesRow {
  employeeId: number;
  performerId: number;
  performerName?: string;
  /** Calendar day YYYY-MM-DD when the API returns a date; otherwise the request day. */
  date?: string;
  sales: number;
  ppvSales: number;
  tips: number;
  dmSales: number;
  pmmSales: number;
  ofmmSales: number;
}

export interface InflowwEmployeeChatRow {
  employeeId: number;
  performerId: number;
  performerName?: string;
  date?: string;
  messagesSent: number;
  ppvsSent: number;
  fansChatted: number;
  fansWhoSpent: number;
  /** Direct from chat-summary `ppvsUnlocked`. */
  ppvsUnlocked: number;
  /** Fraction 0–1 from chat-summary `unlockRate` (e.g. "75.00%" → 0.75). */
  unlockRate: number | null;
  /**
   * Golden Ratio as fraction 0–1 (PPVs sent ÷ messages).
   * Infloww chat-summary returns a percent (e.g. 7.32 → 0.0732).
   */
  goldenRatio: number | null;
  fanCvr: number | null;
  avgEarningsPerSpendingFan: number | null;
  responseTimeSeconds: number | null;
  /** Scheduled-hours response time (seconds). When present, also stored in responseTimeSeconds. */
  responseTimeScheduledSeconds?: number | null;
  /** Clocked-hours response time (seconds). */
  responseTimeClockedSeconds?: number | null;
  salesPerHour: number | null;
  messagesPerHour: number | null;
  fansChattedPerHour: number | null;
  /** Total characters sent across all messages for this employee+creator+day. */
  characterCount?: number | null;
}

/** Merged sales + chat metrics for upsert into infloww_daily_stats. */
export interface InflowwEmployeeDayStats {
  employeeId: number;
  performerId: number;
  performerName?: string;
  date: string;
  sales: number;
  ppvSales: number;
  tips: number;
  dmSales: number;
  pmmSales: number;
  ofmmSales: number;
  messagesSent: number;
  ppvsSent: number;
  fansChatted: number;
  fansWhoSpent: number;
  ppvsUnlocked: number;
  unlockRate: number | null;
  /** Fraction 0–1 (PPVs ÷ messages). */
  goldenRatio: number | null;
  fanCvr: number | null;
  avgEarningsPerSpendingFan: number | null;
  responseTimeSeconds: number | null;
  salesPerHour: number | null;
  messagesPerHour: number | null;
  fansChattedPerHour: number | null;
}

/** Marketing link type for GET /v1/links and /v1/linkfans. */
export type InflowwLinkType = "CAMPAIGN" | "TRIAL" | "TRACKING";

/** Normalized row from GET /v1/transactions. Monetary fields are dollars. */
export interface InflowwCreatorTransaction {
  transactionId: string;
  inflowwRowId?: string;
  creatorId: string;
  platformPid?: string;
  fanId?: string;
  fanName?: string;
  createdTimeMs: number;
  type?: string;
  tipSource?: string;
  status?: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
}

/** Attribution row from GET /v1/transaction-perf/details. */
export interface InflowwTransactionPerfDetail {
  transactionId: string;
  inflowwRowId?: string;
  creatorId: string;
  platformPid?: string;
  fanId?: string;
  fanName?: string;
  createdTimeMs: number;
  type?: string;
  tipSource?: string;
  status?: string;
  amount: number;
  fee: number;
  net: number;
  salesRule?: string;
  attributeEmployeeId?: string;
  salesAmount: number;
  currency: string;
}

export interface InflowwMarketingLink {
  linkId: string;
  creatorId: string;
  linkType: InflowwLinkType;
  message?: string;
  campaignType?: string;
  subCount: number;
  subLimit: number | null;
  subDuration: number | null;
  discount: number | null;
  finishedFlag: boolean;
  earningsGross: number;
  earningsNet: number;
  payingFansCount: number;
  currency: string;
  createdTimeMs: number;
  expiredTimeMs: number | null;
  updatedTimeMs: number | null;
}

export interface InflowwLinkFan {
  linkId: string;
  fanId: string;
  fanName?: string;
  subscriptionEarningGross: number;
  subscriptionEarningNet: number;
  postsEarningGross: number;
  postsEarningNet: number;
  messagesEarningGross: number;
  messagesEarningNet: number;
  streamsEarningGross: number;
  streamsEarningNet: number;
  tipsEarningGross: number;
  tipsEarningNet: number;
  currency: string;
  subscribedTimeMs: number | null;
}

export interface InflowwCreatorRankRow {
  creatorId?: string;
  platformPid: string;
  date: string;
  performanceRank: number | null;
}

export interface InflowwCreatorVisitorRow {
  platformPid: string;
  date: string;
  profileVisitors: number;
  guestProfileVisitors: number;
  loggedInUsersProfileVisitors: number;
}

export interface InflowwCreatorFansCountRow {
  platformPid: string;
  date: string;
  activeFans: number;
  expiredFans: number;
}

export interface InflowwCreatorSubscriberCountRow {
  platformPid: string;
  date: string;
  newSubscribers: number;
  subscriberRenewals: number;
}

export interface InflowwCreatorChatSummaryRow {
  platformPid: string;
  date?: string;
  replyTimeMs: number | null;
  fansChatted: number;
  messagesSent: number;
  ppvsSent: number;
}

/** Merged creator-report day for upsert into infloww_creator_daily_stats. */
export interface InflowwCreatorDayStats {
  creatorId: string;
  platformPid?: string;
  date: string;
  performanceRank: number | null;
  profileVisitors: number;
  guestVisitors: number;
  loggedInVisitors: number;
  activeFans: number;
  expiredFans: number;
  newSubscribers: number;
  renewals: number;
  messagesSent: number;
  ppvsSent: number;
  fansChatted: number;
  replyTimeMs: number | null;
  /**
   * Fans with auto-renew on — from GET /v1/creator-report/fans/renew-on.
   * `null` when Infloww omitted this creator/day (distinct from a genuine 0).
   */
  fansWithRenewOn: number | null;
}

/** Normalized row from GET /v1/refunds. Monetary fields are dollars. */
export interface InflowwRefund {
  /** Infloww refund row id (preferred unique key). */
  refundId: string;
  transactionId: string;
  creatorId: string;
  fanId?: string;
  paymentAmount: number;
  transactionType?: string;
  paymentStatus?: string;
  currency: string;
  paymentTimeMs: number | null;
  refundTimeMs: number;
}

/** Daily renew-on count from GET /v1/creator-report/fans/renew-on. */
export interface InflowwCreatorRenewOnRow {
  platformPid: string;
  date: string;
  fansWithRenewOn: number;
  creatorId?: string;
}

/** Normalized row from GET /v1/priority-mass-messages. Money in dollars. */
export interface InflowwPriorityMassMessage {
  priorityMassMessageId: string;
  creatorId: string;
  employeeId?: string;
  status?: string;
  price: number;
  revenue: number;
  numberOfTimesSent: number;
  numberOfPurchases: number;
  /** Raw targeting rules / audience filters when present. */
  targetingRules: unknown;
  messagePreview?: string;
  createdTimeMs: number | null;
  sentTimeMs: number | null;
  currency: string;
}
