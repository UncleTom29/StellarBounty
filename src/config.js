export const CFG = {
  BOUNTY: import.meta.env.VITE_BOUNTY_CONTRACT || 'YOUR_BOUNTY_CONTRACT',
  TOKEN: import.meta.env.VITE_TOKEN_CONTRACT || 'YOUR_TOKEN_CONTRACT',
  RPC: import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org',
  HORIZON: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  PASS: 'Test SDF Network ; September 2015',
  EXPLORER: 'https://stellar.expert/explorer/testnet',
  CACHE_TTL: 15000,
};

export default CFG;
