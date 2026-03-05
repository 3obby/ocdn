import type { PrismaClient } from "../../generated/prisma/client";
import type { BitcoinRpc } from "./rpc";
import { broadcastCommitReveal, broadcastTx } from "./tx";

const MAX_ATTEMPTS = 10;
const RECOVERY_AGE_MS = 24 * 60 * 60 * 1000;
const REBROADCAST_WINDOW_MS = 60 * 60 * 1000;

function mlog(level: string, msg: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ctx: "tx-monitor",
    msg,
    ...(data ? { data } : {}),
  });
  if (level === "error" || level === "warn") console.error(entry);
  else console.log(entry);
}

export async function runTxMonitor(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
): Promise<void> {
  const pending = await prisma.pendingTx.findMany({
    where: { status: { notIn: ["confirmed", "failed"] } },
  });

  if (pending.length === 0) return;

  for (const tx of pending) {
    try {
      await checkPendingTx(rpc, prisma, tx);
    } catch (e) {
      mlog("warn", "monitor check failed", {
        id: tx.id,
        error: (e as Error).message,
      });
    }
  }
}

async function checkPendingTx(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  tx: {
    id: number;
    commitTxid: string | null;
    revealTxid: string | null;
    txType: string;
    commitHex: string | null;
    revealHex: string | null;
    status: string;
    attempts: number;
    createdAt: Date;
  },
): Promise<void> {
  const isCommitReveal = tx.txType === "post" || tx.txType === "reply";
  const ageMs = Date.now() - tx.createdAt.getTime();
  const txLabel = `${tx.txType}#${tx.id}`;

  if (isCommitReveal) {
    await checkCommitReveal(rpc, prisma, tx, ageMs, txLabel);
  } else {
    await checkSingleTx(rpc, prisma, tx, ageMs, txLabel);
  }
}

async function checkCommitReveal(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  tx: {
    id: number;
    commitTxid: string | null;
    revealTxid: string | null;
    commitHex: string | null;
    revealHex: string | null;
    attempts: number;
    createdAt: Date;
  },
  ageMs: number,
  label: string,
): Promise<void> {
  if (tx.revealTxid) {
    try {
      const info = await rpc.getRawTransaction(tx.revealTxid, true);
      if (info.confirmations && info.confirmations > 0) {
        await prisma.pendingTx.update({
          where: { id: tx.id },
          data: { status: "confirmed" },
        });
        mlog("info", "confirmed", { label, revealTxid: tx.revealTxid });
        return;
      }
    } catch {
      // reveal not in mempool or chain — needs rebroadcast
    }
  }

  if (tx.attempts >= MAX_ATTEMPTS && ageMs > RECOVERY_AGE_MS) {
    await prisma.pendingTx.update({
      where: { id: tx.id },
      data: {
        status: "failed",
        lastError: "max attempts exceeded, needs manual key-path recovery",
      },
    });
    mlog("warn", "marked failed — key-path recovery needed", {
      label,
      commitTxid: tx.commitTxid,
      attempts: tx.attempts,
    });
    return;
  }

  if (tx.revealHex) {
    try {
      await rpc.sendRawTransaction(tx.revealHex);
      await prisma.pendingTx.update({
        where: { id: tx.id },
        data: { attempts: { increment: 1 } },
      });
      mlog("info", "rebroadcast reveal", { label, attempt: tx.attempts + 1 });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("already in block chain") || msg.includes("already known")) {
        await prisma.pendingTx.update({
          where: { id: tx.id },
          data: { status: "confirmed" },
        });
        mlog("info", "reveal already confirmed", { label });
      } else if (tx.commitHex && ageMs < REBROADCAST_WINDOW_MS) {
        try {
          await broadcastCommitReveal(tx.commitHex, tx.revealHex);
          await prisma.pendingTx.update({
            where: { id: tx.id },
            data: { attempts: { increment: 1 } },
          });
          mlog("info", "rebroadcast commit+reveal pair", { label });
        } catch {
          await prisma.pendingTx.update({
            where: { id: tx.id },
            data: {
              attempts: { increment: 1 },
              lastError: msg,
            },
          });
          mlog("warn", "rebroadcast failed", { label, error: msg });
        }
      } else {
        await prisma.pendingTx.update({
          where: { id: tx.id },
          data: {
            attempts: { increment: 1 },
            lastError: msg,
          },
        });
        mlog("warn", "reveal rebroadcast rejected", { label, error: msg });
      }
    }
  } else {
    mlog("warn", "no revealHex stored — cannot rebroadcast", { label });
    if (ageMs > RECOVERY_AGE_MS) {
      await prisma.pendingTx.update({
        where: { id: tx.id },
        data: {
          status: "failed",
          lastError: "no revealHex persisted, key-path recovery needed",
        },
      });
    }
  }
}

async function checkSingleTx(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  tx: {
    id: number;
    commitTxid: string | null;
    commitHex: string | null;
    attempts: number;
    createdAt: Date;
  },
  ageMs: number,
  label: string,
): Promise<void> {
  if (tx.commitTxid) {
    try {
      const info = await rpc.getRawTransaction(tx.commitTxid, true);
      if (info.confirmations && info.confirmations > 0) {
        await prisma.pendingTx.update({
          where: { id: tx.id },
          data: { status: "confirmed" },
        });
        mlog("info", "confirmed", { label, txid: tx.commitTxid });
        return;
      }
    } catch {
      // not found
    }
  }

  if (tx.attempts >= MAX_ATTEMPTS) {
    await prisma.pendingTx.update({
      where: { id: tx.id },
      data: { status: "failed", lastError: "max attempts exceeded" },
    });
    mlog("warn", "marked failed", { label, attempts: tx.attempts });
    return;
  }

  if (tx.commitHex) {
    try {
      await broadcastTx(tx.commitHex);
      await prisma.pendingTx.update({
        where: { id: tx.id },
        data: { attempts: { increment: 1 } },
      });
      mlog("info", "rebroadcast single tx", { label, attempt: tx.attempts + 1 });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("already in block chain") || msg.includes("already known")) {
        await prisma.pendingTx.update({
          where: { id: tx.id },
          data: { status: "confirmed" },
        });
        mlog("info", "tx already confirmed", { label });
      } else {
        await prisma.pendingTx.update({
          where: { id: tx.id },
          data: {
            attempts: { increment: 1 },
            lastError: msg,
          },
        });
      }
    }
  } else if (ageMs > RECOVERY_AGE_MS) {
    await prisma.pendingTx.update({
      where: { id: tx.id },
      data: { status: "failed", lastError: "no hex persisted" },
    });
  }
}
