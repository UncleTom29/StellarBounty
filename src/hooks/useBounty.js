import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildApproveBounty,
  buildCancelBounty,
  buildClaimBounty,
  buildPostBounty,
  bustAll,
  getBounties,
  getBountyCount,
  getTokenBalance,
  getTotalPaid,
  getXLMBalance,
  submitTx,
  waitTx,
} from '../utils/contract.js';
import { parseErr } from '../utils/errors.js';

export const TX = {
  IDLE: 'IDLE',
  BUILD: 'BUILD',
  SIGN: 'SIGN',
  SEND: 'SEND',
  CONFIRM: 'CONFIRM',
  OK: 'OK',
  FAIL: 'FAIL',
};

export function useBounty(pk, sign) {
  const [bounties, setBounties] = useState([]);
  const [xlmBal, setXlmBal] = useState(0);
  const [tokBal, setTokBal] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [st, setSt] = useState(TX.IDLE);
  const [hash, setHash] = useState('');
  const [txErr, setTxErr] = useState('');
  const [events, setEvents] = useState([]);

  const resetState = useCallback(() => {
    setBounties([]);
    setXlmBal(0);
    setTokBal(0);
    setTotalPaid(0);
    setCount(0);
    setLoading(false);
    setSt(TX.IDLE);
    setHash('');
    setTxErr('');
    setEvents([]);
  }, []);

  const addEvent = useCallback((type, meta) => {
    setEvents((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        meta,
        time: Date.now(),
      },
      ...prev,
    ].slice(0, 8));
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!pk) {
        return;
      }

      if (force) {
        bustAll(pk);
      }

      setLoading(true);
      try {
        const [nextBounties, nextXlm, nextTotal, nextCount, nextTok] =
          await Promise.all([
            getBounties(pk),
            getXLMBalance(pk),
            getTotalPaid(pk),
            getBountyCount(pk),
            getTokenBalance(pk).catch(() => 0),
          ]);

        setBounties(nextBounties);
        setXlmBal(nextXlm);
        setTokBal(nextTok);
        setTotalPaid(nextTotal);
        setCount(nextCount);
      } finally {
        setLoading(false);
      }
    },
    [pk],
  );

  const run = useCallback(
    async (buildFn, eventType, meta) => {
      if (!pk) {
        throw new Error('No wallet connected');
      }

      setTxErr('');
      setHash('');
      setSt(TX.BUILD);

      try {
        const tx = await buildFn();
        setSt(TX.SIGN);

        const signed = await sign(tx.toXDR());
        setSt(TX.SEND);

        const nextHash = await submitTx(signed);
        setHash(nextHash);
        setSt(TX.CONFIRM);

        await waitTx(nextHash);
        setSt(TX.OK);
        addEvent(eventType, meta);
        setTimeout(() => {
          refresh(true);
        }, 2000);

        return nextHash;
      } catch (error) {
        const parsed = parseErr(error);
        setTxErr(parsed.msg);
        setSt(TX.FAIL);
        return null;
      }
    },
    [addEvent, pk, refresh, sign],
  );

  const postBounty = useCallback(
    (title, description, rewardXLM) =>
      run(
        () => buildPostBounty(pk, title, description, rewardXLM),
        'POST',
        { title, rewardXLM },
      ),
    [pk, run],
  );

  const claimBounty = useCallback(
    (bountyId) =>
      run(() => buildClaimBounty(pk, bountyId), 'CLAIM', { bountyId }),
    [pk, run],
  );

  const approveBounty = useCallback(
    (bountyId) =>
      run(() => buildApproveBounty(pk, bountyId), 'APPROVE', { bountyId }),
    [pk, run],
  );

  const cancelBounty = useCallback(
    (bountyId) =>
      run(() => buildCancelBounty(pk, bountyId), 'CANCEL', { bountyId }),
    [pk, run],
  );

  const reset = useCallback(() => {
    setSt(TX.IDLE);
    setHash('');
    setTxErr('');
  }, []);

  useEffect(() => {
    if (!pk) {
      resetState();
      return undefined;
    }

    refresh();
    const timer = setInterval(() => {
      refresh();
    }, 20000);

    return () => clearInterval(timer);
  }, [pk, refresh, resetState]);

  return useMemo(
    () => ({
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
      refresh,
      postBounty,
      claimBounty,
      approveBounty,
      cancelBounty,
      reset,
    }),
    [
      approveBounty,
      bounties,
      cancelBounty,
      claimBounty,
      count,
      events,
      hash,
      loading,
      postBounty,
      refresh,
      reset,
      st,
      tokBal,
      totalPaid,
      txErr,
      xlmBal,
    ],
  );
}

export default useBounty;
