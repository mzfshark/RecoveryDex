import React, { useEffect, useMemo, useState } from "react";
import styles from "../styles/Global.module.css";
import routersConfig from "../config/routers.json";
import { WONE_ADDRESS } from "../utils/constants";
import { useContract } from "../context/ContractContext";
import {
  readOwner,
  readWETH,
  readFeeBps,
  readFeeReceiver,
  readRouters,
  readRouterCount,
  readRouterAt,
  adminSetWETH,
  adminSetFeeBps,
  adminSetFeeReceiver,
  adminAddRouter,
  adminRemoveRouter,
  adminTransferOwnership,
  adminRenounceOwnership,
} from "../services/aggregatorService";

export default function AdminPage() {
  const { signer, account } = useContract();
  const [owner, setOwner] = useState(null);
  const [weth, setWeth] = useState(null);
  const [feeBps, setFeeBps] = useState(0);
  const [feeReceiver, setFeeReceiver] = useState("");
  const [routers, setRouters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const expectedRouters = useMemo(() => Object.values(routersConfig?.UNISWAP?.ROUTERS || {}), []);
  const missingRouters = useMemo(() => {
    const set = new Set(routers.map(r => r.toLowerCase()));
    return expectedRouters.filter(r => !set.has(r.toLowerCase()));
  }, [routers, expectedRouters]);

  const isOwner = useMemo(() => {
    if (!owner || !account) return false;
    return String(owner).toLowerCase() === String(account).toLowerCase();
  }, [owner, account]);

  const isWethOk = useMemo(() => (weth || "").toLowerCase() === WONE_ADDRESS.toLowerCase(), [weth]);

  const load = async () => {
    try {
      const [o, w, fBps, fRecv] = await Promise.all([
        readOwner(), readWETH(), readFeeBps(), readFeeReceiver()
      ]);
      setOwner(o); setWeth(w); setFeeBps(Number(fBps)); setFeeReceiver(String(fRecv));

      // Load routers
      const list = await readRouters();
      if (Array.isArray(list) && list.length) {
        setRouters(list);
      } else {
        // fallback by iterating count in case of older contracts
        const n = await readRouterCount();
        const arr = [];
        for (let i = 0n; i < BigInt(n); i++) {
          // readRouterAt is BigInt-index friendly? ensure cast to Number if needed
          const idx = Number(i);
          arr.push(await readRouterAt(idx));
        }
        setRouters(arr);
      }
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Falha ao carregar estado do Aggregator' });
    }
  };

  useEffect(() => { load(); }, [account]);

  const run = async (fn, onOk) => {
    if (!signer) { setMsg({ type: 'error', text: 'Conecte sua carteira' }); return; }
    setBusy(true); setMsg(null);
    try {
      const tx = await fn();
      await tx.wait();
      await load();
      if (onOk) onOk();
      setMsg({ type: 'success', text: 'Transação confirmada' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Transação falhou' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.swapCard}>
      <div className={styles.swapCardTitle}><h2>Admin</h2></div>
      {msg && <p style={{ color: msg.type === 'error' ? '#b00020' : '#006400' }}>{msg.text}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <strong>Owner:</strong> {owner || '-'} {isOwner ? '(you)' : ''}
        </div>
        <div>
          <strong>WETH:</strong> {weth || '-'} {isWethOk ? '✅ WONE' : '❌ diferente de WONE'}
          {isOwner && !isWethOk && (
            <button className={styles.button} disabled={busy} style={{ marginLeft: 8 }}
              onClick={() => run(() => adminSetWETH({ signer, wethAddress: WONE_ADDRESS }))}>
              Set WETH = WONE
            </button>
          )}
        </div>
        <div>
          <strong>Fee (bps):</strong> {feeBps}
          {isOwner && (
            <span style={{ marginLeft: 8 }}>
              <input type="number" min={0} max={1000} defaultValue={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className={styles.inputField}
                style={{ width: 100 }} />
              <button className={styles.button} disabled={busy} style={{ marginLeft: 8 }}
                onClick={() => run(() => adminSetFeeBps({ signer, newFeeBps: feeBps }))}>
                Update Fee
              </button>
            </span>
          )}
        </div>
        <div>
          <strong>Fee Receiver:</strong> {feeReceiver}
          {isOwner && (
            <span style={{ marginLeft: 8 }}>
              <input type="text" defaultValue={feeReceiver}
                onChange={(e) => setFeeReceiver(e.target.value)}
                className={styles.inputField}
                style={{ width: 360 }} />
              <button className={styles.button} disabled={busy} style={{ marginLeft: 8 }}
                onClick={() => run(() => adminSetFeeReceiver({ signer, newReceiver: feeReceiver }))}>
                Update Receiver
              </button>
            </span>
          )}
        </div>
        <div>
          <strong>Routers whitelistados:</strong>
          <ul style={{ marginTop: 6 }}>
            {routers.map(r => (
              <li key={r} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{r}</span>
                {isOwner && (
                  <button className={styles.button} disabled={busy}
                    onClick={() => run(() => adminRemoveRouter({ signer, router: r }))}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {missingRouters.length > 0 && isOwner && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {missingRouters.map(addr => (
                <button key={addr} className={styles.button} disabled={busy}
                  onClick={() => run(() => adminAddRouter({ signer, router: addr }))}>
                  Add {addr.slice(0,6)}…
                </button>
              ))}
            </div>
          )}
        </div>
        {isOwner && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={styles.button} disabled={busy}
              onClick={() => {
                const to = prompt('New owner address:');
                if (to) run(() => adminTransferOwnership({ signer, newOwner: to }));
              }}>
              Transfer Ownership
            </button>
            <button className={styles.button} disabled={busy}
              onClick={() => {
                if (confirm('Renounce ownership? This action is irreversible.')) {
                  run(() => adminRenounceOwnership({ signer }));
                }
              }}>
              Renounce Ownership
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
