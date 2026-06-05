export const SUPPORTED_SOLANA_TOKENS = ["USDC", "USDT", "SOL"] as const;
export type SolanaToken = (typeof SUPPORTED_SOLANA_TOKENS)[number];
