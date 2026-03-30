import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import CFG from '../config.js';
import cache from './cache.js';

const rpc = new SorobanRpc.Server(CFG.RPC, { allowHttp: false });

function toNum(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (value && typeof value === 'object') {
    if ('value' in value) {
      return Number(value.value);
    }
    if ('_value' in value) {
      return Number(value._value);
    }
  }

  return Number(value || 0);
}

function toText(value) {
  if (value == null) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

function toMaybeAddress(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return toMaybeAddress(value[0]);
  }

  if (typeof value === 'object') {
    if ('tag' in value && String(value.tag).toLowerCase() === 'some') {
      return toMaybeAddress(value.values ?? value.value);
    }
    if ('some' in value) {
      return toMaybeAddress(value.some);
    }
    if ('value' in value) {
      return toMaybeAddress(value.value);
    }
  }

  return toText(value);
}

function toStatus(value) {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }

  if (Array.isArray(value) && value.length) {
    return toStatus(value[0]);
  }

  if (value && typeof value === 'object') {
    if ('tag' in value) {
      return toStatus(value.tag);
    }

    const [first] = Object.keys(value);
    if (first) {
      return first.toLowerCase();
    }
  }

  return 'open';
}

function normalizeBounty(raw) {
  const row = raw && typeof raw === 'object' ? raw : {};

  return {
    id: toNum(row.id),
    poster: toText(row.poster),
    title: toText(row.title),
    description: toText(row.description),
    reward_xlm: toNum(row.reward_xlm) / 1e7,
    status: toStatus(row.status),
    worker: toMaybeAddress(row.worker),
    created_at: toNum(row.created_at),
  };
}

async function sim(pk, cid, method, args = []) {
  const source = await rpc.getAccount(pk);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(cid).call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(result.error || 'Contract simulation failed');
  }

  return result.result?.retval ? scValToNative(result.result.retval) : null;
}

async function prep(pk, cid, method, args = []) {
  const source = await rpc.getAccount(pk);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(cid).call(method, ...args))
    .setTimeout(30)
    .build();

  return rpc.prepareTransaction(tx);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBounties(pk) {
  const hit = cache.get('bounties');
  if (hit !== null) {
    return hit;
  }

  const raw = (await sim(pk, CFG.BOUNTY, 'get_bounties')) || [];
  const rows = Array.isArray(raw) ? raw : Object.values(raw);
  const data = rows.map(normalizeBounty);
  cache.set('bounties', data, 10000);
  return data;
}

export async function getBountyCount(pk) {
  const hit = cache.get('count');
  if (hit !== null) {
    return hit;
  }

  const count = Number(await sim(pk, CFG.BOUNTY, 'bounty_count'));
  cache.set('count', count, 8000);
  return count;
}

export async function getTotalPaid(pk) {
  const hit = cache.get('paid');
  if (hit !== null) {
    return hit;
  }

  const total = toNum(await sim(pk, CFG.BOUNTY, 'total_paid')) / 1e7;
  cache.set('paid', total, 10000);
  return total;
}

export async function getXLMBalance(pk) {
  const key = `xb:${pk}`;
  const hit = cache.get(key);
  if (hit !== null) {
    return hit;
  }

  const res = await fetch(`${CFG.HORIZON}/accounts/${pk}`);
  if (!res.ok) {
    throw new Error('Failed to fetch XLM balance');
  }

  const json = await res.json();
  const native = (json.balances || []).find((b) => b.asset_type === 'native');
  const balance = native ? Number(native.balance) : 0;
  cache.set(key, balance, 12000);
  return balance;
}

export async function getTokenBalance(pk) {
  const key = `tb:${pk}`;
  const hit = cache.get(key);
  if (hit !== null) {
    return hit;
  }

  const balance = toNum(
    await sim(pk, CFG.TOKEN, 'balance', [nativeToScVal(pk, { type: 'address' })]),
  ) / 1e7;
  cache.set(key, balance, 12000);
  return balance;
}

export function buildPostBounty(pk, title, description, rewardXLM) {
  return prep(pk, CFG.BOUNTY, 'post_bounty', [
    nativeToScVal(pk, { type: 'address' }),
    nativeToScVal(title),
    nativeToScVal(description),
    nativeToScVal(Math.round(rewardXLM * 1e7), { type: 'i128' }),
  ]);
}

export function buildClaimBounty(pk, bountyId) {
  return prep(pk, CFG.BOUNTY, 'claim_bounty', [
    nativeToScVal(pk, { type: 'address' }),
    nativeToScVal(bountyId, { type: 'u32' }),
  ]);
}

export function buildApproveBounty(pk, bountyId) {
  return prep(pk, CFG.BOUNTY, 'approve_bounty', [
    nativeToScVal(pk, { type: 'address' }),
    nativeToScVal(bountyId, { type: 'u32' }),
  ]);
}

export function buildCancelBounty(pk, bountyId) {
  return prep(pk, CFG.BOUNTY, 'cancel_bounty', [
    nativeToScVal(pk, { type: 'address' }),
    nativeToScVal(bountyId, { type: 'u32' }),
  ]);
}

export async function submitTx(xdrStr) {
  const tx = TransactionBuilder.fromXDR(xdrStr, Networks.TESTNET);
  const res = await rpc.sendTransaction(tx);

  if (res.status === 'ERROR') {
    throw new Error('Transaction submission failed');
  }

  return res.hash;
}

export async function waitTx(hash) {
  for (let i = 0; i < 20; i += 1) {
    const tx = await rpc.getTransaction(hash);

    if (tx.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return tx;
    }

    if (tx.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain');
    }

    await delay(1500);
  }

  throw new Error('Timeout waiting for confirmation');
}

export function bustAll(pk) {
  cache.bust('bounties');
  cache.bust('count');
  cache.bust('paid');
  cache.bust(`tb:${pk}`);
  cache.bust(`xb:${pk}`);
}

export { rpc, sim, prep, Address };
