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
  goldenRatio: number | null;
  fanCvr: number | null;
  avgEarningsPerSpendingFan: number | null;
  responseTimeSeconds: number | null;
  salesPerHour: number | null;
  messagesPerHour: number | null;
  fansChattedPerHour: number | null;
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
  goldenRatio: number | null;
  fanCvr: number | null;
  avgEarningsPerSpendingFan: number | null;
  responseTimeSeconds: number | null;
  salesPerHour: number | null;
  messagesPerHour: number | null;
  fansChattedPerHour: number | null;
}
