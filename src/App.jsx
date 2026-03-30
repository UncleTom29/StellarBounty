import { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import CFG from './config.js';
import { TX, useBounty } from './hooks/useBounty.js';
import { useWallet } from './hooks/useWallet.js';

const STEP_CONFIG = {
  [TX.BUILD]: { pct: 20, label: 'Building transaction payload' },
  [TX.SIGN]: { pct: 45, label: 'Awaiting wallet signature' },
  [TX.SEND]: { pct: 68, label: 'Submitting to Soroban RPC' },
  [TX.CONFIRM]: { pct: 88, label: 'Waiting for confirmation' },
  [TX.OK]: { pct: 100, label: 'Transaction confirmed' },
  [TX.FAIL]: { pct: 0, label: 'Transaction failed' },
};

const ACTIVE_STATES = [TX.BUILD, TX.SIGN, TX.SEND, TX.CONFIRM];

function shortAddr(value, lead = 6, tail = 5) {
  if (!value) {
    return 'Unknown';
  }
  if (value.length <= lead + tail + 3) {
    return value;
  }
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

function fmtAmount(value, digits = 2) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Copy failed');
  }
}

function TxBox({ st, hash, txErr }) {
  if (st === TX.IDLE) {
    return null;
  }

  const cfg = STEP_CONFIG[st] || STEP_CONFIG[TX.FAIL];
  const active = ACTIVE_STATES.includes(st);
  const cls = active ? 'w' : st === TX.OK ? 'ok' : 'fail';
  const titles = {
    [TX.BUILD]: '🛠 Building transaction',
    [TX.SIGN]: '✍️ Signature requested',
    [TX.SEND]: '📡 Sending transaction',
    [TX.CONFIRM]: '⏳ Confirming on-chain',
    [TX.OK]: '✅ Transaction complete',
    [TX.FAIL]: '⚠️ Transaction failed',
  };

  return (
    <div className={`card txb ${cls}`}>
      <div className={`txt ${cls}`}>{titles[st]}</div>
      <div className="hint">{cfg.label}</div>
      {active ? (
        <div className="prog" aria-hidden="true">
          <div className="pb" style={{ width: `${cfg.pct}%` }} />
        </div>
      ) : null}
      {st === TX.OK && hash ? (
        <>
          <div className="txh">{hash}</div>
          <a
            className="txl"
            href={`${CFG.EXPLORER}/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Stellar Expert
          </a>
        </>
      ) : null}
      {st === TX.FAIL && txErr ? <div className="em mt8">{txErr}</div> : null}
    </div>
  );
}

function PostForm({ onPost, busy }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErr('');

    const rewardNum = Number(reward);
    if (!title.trim() || !description.trim() || !reward) {
      setErr('Fill in the title, description, and reward amount.');
      return;
    }
    if (!Number.isFinite(rewardNum) || rewardNum <= 0) {
      setErr('Reward must be greater than 0 XLM.');
      return;
    }

    const hash = await onPost(title.trim(), description.trim(), rewardNum);
    if (hash) {
      setTitle('');
      setDescription('');
      setReward('');
      setOpen(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div className="cl">Create</div>
        <button
          type="button"
          className="btn bp bsm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : '+ Post Bounty'}
        </button>
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="mt8">
          <div className="form-group">
            <label className="lbl" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="inp"
              placeholder="Fix landing page animation bug"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="lbl" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="textarea"
              placeholder="Describe the task, acceptance criteria, and any links."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="lbl" htmlFor="reward">
              Reward (XLM)
            </label>
            <input
              id="reward"
              className="inp"
              type="number"
              min="0"
              step="0.1"
              placeholder="25"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
            />
            <div className="hint">Tip: leave at least 1 XLM in your wallet for fees.</div>
          </div>

          {err ? <div className="em">{err}</div> : null}

          <button className="btn bp bf" type="submit" disabled={busy}>
            {busy ? <span className="sp" aria-hidden="true" /> : null}
            {busy ? 'Posting...' : 'Post Bounty'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function BountyCard({ bounty, pk, onClaim, onApprove, onCancel, busy }) {
  const isPoster = pk && pk === bounty.poster;
  const status = bounty.status?.toLowerCase() || 'open';
  const canClaim = status === 'open' && pk && !isPoster;
  const canCancel = status === 'open' && isPoster;
  const canApprove = status === 'claimed' && isPoster;

  return (
    <div className="bounty-card">
      <div className="bc-header">
        <div className="bc-title">{bounty.title}</div>
        <div className="bc-reward">{fmtAmount(bounty.reward_xlm)} XLM</div>
      </div>

      <div className="bc-desc">{bounty.description}</div>

      <div className="bc-footer">
        <div className="col">
          <span className={`bc-status ${status}`}>{status}</span>
          <span className="hint">Poster: {shortAddr(bounty.poster)}</span>
        </div>

        <div className="bc-actions">
          {canClaim ? (
            <button
              type="button"
              className="btn bs bsm"
              onClick={() => onClaim(bounty.id)}
              disabled={busy}
            >
              Claim
            </button>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              className="btn bd bsm"
              onClick={() => onCancel(bounty.id)}
              disabled={busy}
            >
              Cancel
            </button>
          ) : null}

          {canApprove ? (
            <button
              type="button"
              className="btn bp bsm"
              onClick={() => onApprove(bounty.id)}
              disabled={busy}
            >
              Approve
            </button>
          ) : null}

          {status === 'completed' ? <span className="hint">✓ Approved</span> : null}
          {status === 'cancelled' ? <span className="hint">Cancelled</span> : null}
        </div>
      </div>
    </div>
  );
}

function BountyList({ bounties, pk, onClaim, onApprove, onCancel, busy }) {
  const [tab, setTab] = useState('all');

  const filtered = useMemo(() => {
    const order = { open: 0, claimed: 1, completed: 2, cancelled: 3 };
    return [...bounties]
      .filter((bounty) => {
        if (tab === 'all') {
          return true;
        }
        return bounty.status === tab;
      })
      .sort((a, b) => {
        const left = order[a.status] ?? 99;
        const right = order[b.status] ?? 99;
        if (left !== right) {
          return left - right;
        }
        return b.id - a.id;
      });
  }, [bounties, tab]);

  return (
    <div className="card">
      <div className="cl">Bounties</div>
      <div className="tabs">
        {['all', 'open', 'claimed', 'completed'].map((value) => (
          <button
            key={value}
            type="button"
            className={`tab ${tab === value ? 'on' : ''}`}
            onClick={() => setTab(value)}
          >
            {value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      <div className="bounty-list">
        {filtered.length ? (
          filtered.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              pk={pk}
              onClaim={onClaim}
              onApprove={onApprove}
              onCancel={onCancel}
              busy={busy}
            />
          ))
        ) : (
          <div className="empty">No bounties in this view yet.</div>
        )}
      </div>
    </div>
  );
}

function StatsBar({ count, totalPaid, xlmBal, tokBal, loading }) {
  const items = [
    ['Total Bounties', count, 0],
    ['Total Paid (XLM)', totalPaid, 2],
    ['Your XLM Balance', xlmBal, 2],
    ['Your BNT Balance', tokBal, 2],
  ];

  return (
    <div className="card">
      <div className="cl">Overview</div>
      <div className="status-grid">
        {items.map(([label, value, digits]) => (
          <div key={label} className="sstat">
            <div className="sv">{loading ? '...' : fmtAmount(value, digits)}</div>
            <div className="sl">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventFeed({ events }) {
  if (!events.length) {
    return null;
  }

  function summarize(event) {
    switch (event.type) {
      case 'POST':
        return `${event.meta.title} for ${fmtAmount(event.meta.rewardXLM)} XLM`;
      case 'CLAIM':
        return `Claimed bounty #${event.meta.bountyId}`;
      case 'APPROVE':
        return `Approved bounty #${event.meta.bountyId}`;
      case 'CANCEL':
        return `Cancelled bounty #${event.meta.bountyId}`;
      default:
        return 'Transaction event';
    }
  }

  return (
    <div className="card">
      <div className="cl">Recent Activity</div>
      <div className="evt-feed">
        {events.map((event) => (
          <div className="evt-item" key={event.id}>
            <div>
              <div className="evt-type">{event.type}</div>
              <div>{summarize(event)}</div>
            </div>
            <div className="evt-time">
              {new Date(event.time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractInfo() {
  return (
    <div className="card">
      <div className="cl">Contracts</div>

      <div className="lbl">Bounty Contract</div>
      <button
        type="button"
        className="ci"
        onClick={() => copyText(CFG.BOUNTY, 'Bounty contract ID')}
      >
        {CFG.BOUNTY}
      </button>
      <a
        className="txl"
        href={`${CFG.EXPLORER}/contract/${CFG.BOUNTY}`}
        target="_blank"
        rel="noreferrer"
      >
        Open bounty contract
      </a>

      <div className="lbl mt8">BNT Token Contract</div>
      <button
        type="button"
        className="ci"
        onClick={() => copyText(CFG.TOKEN, 'Token contract ID')}
      >
        {CFG.TOKEN}
      </button>
      <a
        className="txl"
        href={`${CFG.EXPLORER}/contract/${CFG.TOKEN}`}
        target="_blank"
        rel="noreferrer"
      >
        Open token contract
      </a>
    </div>
  );
}

function HeroScreen({ connect, busy, err }) {
  return (
    <div className="card hero">
      <div style={{ fontSize: '2rem' }}>🎯</div>
      <h1 className="ht">StellarBounty</h1>
      <p className="hs">
        A bounty board for posting work, claiming tasks, and rewarding completions on
        Stellar Testnet.
      </p>

      <div className="feats">
        <div className="feat">Lock bounty rewards in a Soroban-powered workflow.</div>
        <div className="feat">Claim open work with your Stellar wallet in one tap.</div>
        <div className="feat">Approve finished work and mint BNT via inter-contract call.</div>
        <div className="feat">Track XLM and BNT balances alongside recent activity.</div>
      </div>

      <button type="button" className="btn bp bf" onClick={connect} disabled={busy}>
        {busy ? <span className="sp" aria-hidden="true" /> : null}
        {busy ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {err ? <div className="em">{err}</div> : null}
    </div>
  );
}

function App() {
  const {
    pk,
    wid,
    busy: connecting,
    err: walletErr,
    connect,
    disconnect,
    sign,
  } = useWallet();
  const {
    bounties,
    xlmBal,
    tokBal,
    totalPaid,
    count,
    loading,
    st,
    hash,
    txErr,
    events,
    postBounty,
    claimBounty,
    approveBounty,
    cancelBounty,
  } = useBounty(pk, sign);

  const lastStateRef = useRef(TX.IDLE);
  const busy = connecting || ACTIVE_STATES.includes(st);

  useEffect(() => {
    if (lastStateRef.current === st) {
      return;
    }
    lastStateRef.current = st;

    if (st === TX.OK) {
      toast.success('Transaction confirmed');
    }

    if (st === TX.FAIL && txErr) {
      toast.error(txErr);
    }
  }, [st, txErr]);

  return (
    <>
      <header className="hdr">
        <div className="logo">🎯 StellarBounty</div>
        <div className="hdr-right">
          <span className="bdg bdg-net">Testnet</span>
          {pk ? <span className="bdg bdg-wid">{wid || 'wallet'}</span> : null}
          {pk ? (
            <button type="button" className="btn bs bsm" onClick={disconnect}>
              Disconnect
            </button>
          ) : null}
        </div>
      </header>

      <main className="main">
        {!pk ? (
          <HeroScreen connect={connect} busy={connecting} err={walletErr} />
        ) : (
          <>
            <StatsBar
              count={count}
              totalPaid={totalPaid}
              xlmBal={xlmBal}
              tokBal={tokBal}
              loading={loading}
            />
            <TxBox st={st} hash={hash} txErr={txErr} />
            <PostForm onPost={postBounty} busy={busy} />
            <BountyList
              bounties={bounties}
              pk={pk}
              onClaim={claimBounty}
              onApprove={approveBounty}
              onCancel={cancelBounty}
              busy={busy}
            />
            <EventFeed events={events} />
            <ContractInfo />
          </>
        )}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#13122a',
            color: '#f4f7ff',
            border: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      />
    </>
  );
}

export default App;
