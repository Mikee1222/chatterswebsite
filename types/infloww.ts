export interface InflowwModel {
  id: string;
  name: string;
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
