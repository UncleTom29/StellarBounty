export const ET = {
  WALLET: 'WALLET',
  REJECTED: 'REJECTED',
  BALANCE: 'BALANCE',
  LIQUIDITY: 'LIQUIDITY',
  CONTRACT: 'CONTRACT',
  NETWORK: 'NETWORK',
};

const MSG = {
  [ET.WALLET]: 'Wallet not found. Install Freighter or connect a supported Stellar wallet.',
  [ET.REJECTED]: 'Transaction was cancelled in your wallet.',
  [ET.BALANCE]: 'Insufficient balance to complete this action.',
  [ET.LIQUIDITY]: 'Liquidity is limited right now. Please try again shortly.',
  [ET.CONTRACT]: 'Contract simulation failed. Double-check the bounty state and inputs.',
  [ET.NETWORK]: 'Network error. Please try again in a moment.',
};

export function parseErr(e) {
  const raw = e?.message || String(e || '');
  const msg = String(raw);
  const low = msg.toLowerCase();

  let t = ET.NETWORK;

  if (
    low.includes('not found') ||
    low.includes('no wallet') ||
    low.includes('not installed')
  ) {
    t = ET.WALLET;
  } else if (
    low.includes('reject') ||
    low.includes('declined') ||
    low.includes('cancel')
  ) {
    t = ET.REJECTED;
  } else if (low.includes('insufficient') || low.includes('underfunded')) {
    t = ET.BALANCE;
  } else if (low.includes('liquidity')) {
    t = ET.LIQUIDITY;
  } else if (msg.includes('Contract') || low.includes('simulation')) {
    t = ET.CONTRACT;
  }

  return { t, msg: MSG[t] };
}
