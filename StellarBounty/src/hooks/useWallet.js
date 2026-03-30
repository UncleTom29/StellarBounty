import { useCallback, useEffect, useState } from 'react';
import {
  FREIGHTER_ID,
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';
import { parseErr } from '../utils/errors.js';

let sharedKit = null;
const STORE_KEY = 'stellarbounty.wallet';

function makeKit() {
  return new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: FREIGHTER_ID,
    modules: allowAllModules(),
  });
}

function getKit() {
  if (!sharedKit) {
    sharedKit = makeKit();
  }
  return sharedKit;
}

function readStoredWallet() {
  if (typeof window === 'undefined') {
    return { pk: '', wid: '' };
  }

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      return { pk: '', wid: '' };
    }

    const parsed = JSON.parse(raw);
    return {
      pk: typeof parsed?.pk === 'string' ? parsed.pk : '',
      wid: typeof parsed?.wid === 'string' ? parsed.wid : '',
    };
  } catch {
    return { pk: '', wid: '' };
  }
}

function persistWallet(nextPk, nextWid) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      pk: nextPk,
      wid: nextWid,
    }),
  );
}

function clearStoredWallet() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORE_KEY);
}

export function useWallet() {
  const [stored] = useState(() => readStoredWallet());
  const [pk, setPk] = useState(stored.pk);
  const [wid, setWid] = useState(stored.wid);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!wid) {
      return undefined;
    }

    let ignore = false;
    const kit = getKit();

    try {
      kit.setWallet(wid);
    } catch {
      return undefined;
    }

    (async () => {
      try {
        const publicKey = await kit.getPublicKey();
        if (!ignore && publicKey) {
          setPk(publicKey);
          persistWallet(publicKey, wid);
        }
      } catch {
        // Keep the cached session so the app restores state after refresh
        // even if the wallet extension is temporarily unavailable.
      }
    })();

    return () => {
      ignore = true;
    };
  }, [wid]);

  const connect = useCallback(async () => {
    setBusy(true);
    setErr('');

    try {
      const kit = getKit();
      const selected = await new Promise((resolve, reject) => {
        let settled = false;

        kit
          .openModal({
            modalTitle: 'Connect Stellar Wallet',
            notAvailableText: 'Install',
            onWalletSelected: async (option) => {
              try {
                kit.setWallet(option.id);
                const publicKey = await kit.getPublicKey();
                if (!settled) {
                  settled = true;
                  resolve({ publicKey, walletId: option.id });
                }
              } catch (error) {
                if (!settled) {
                  settled = true;
                  reject(error);
                }
              }
            },
            onClosed: (error) => {
              if (!settled) {
                settled = true;
                reject(error || new Error('Wallet connection cancelled'));
              }
            },
          })
          .catch((error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
      });

      setWid(selected.walletId);
      setPk(selected.publicKey);
      persistWallet(selected.publicKey, selected.walletId);
      return selected.publicKey;
    } catch (error) {
      const parsed = parseErr(error);
      setErr(parsed.msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPk('');
    setWid('');
    setErr('');
    clearStoredWallet();
    sharedKit = null;
  }, []);

  const sign = useCallback(
    async (xdr) => {
      const kit = getKit();
      if (!pk) {
        throw new Error('No wallet connected');
      }

      if (wid) {
        kit.setWallet(wid);
      }

      const { result } = await kit.signTx({
        xdr,
        publicKeys: [pk],
        network: WalletNetwork.TESTNET,
      });

      return result;
    },
    [pk, wid],
  );

  return { pk, wid, busy, err, connect, disconnect, sign };
}

export default useWallet;
