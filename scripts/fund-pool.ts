import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { BitcoinRpc } from "../src/lib/bitcoin/rpc.js";

neonConfig.webSocketConstructor = ws;

function slog(msg: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg, ...data }));
}

async function main() {
  const portalPrivkey = process.env.PORTAL_PRIVKEY;
  if (!portalPrivkey) throw new Error("PORTAL_PRIVKEY not set");

  // Derive the portal P2TR address
  const { schnorr } = await import("@noble/curves/secp256k1.js");
  const { payments, networks, initEccLib } = await import("bitcoinjs-lib");
  const ecc = await import("@bitcoinerlab/secp256k1");
  initEccLib(ecc);

  const privkeyBuf = Buffer.from(portalPrivkey, "hex");
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkeyBuf));
  const network = process.env.BITCOIN_NETWORK === "signet" ? networks.testnet : networks.bitcoin;
  const { address, output: scriptPubkey } = payments.p2tr({ internalPubkey: xOnlyPubkey, network });

  if (!address || !scriptPubkey) throw new Error("Failed to derive portal address");
  slog("portal address", { address });

  const rpc = new BitcoinRpc();
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter }) as unknown as import("../src/generated/prisma/client.js").PrismaClient;

  // Scan the UTXO set for the portal address
  slog("scanning UTXO set (this may take a minute)...");
  const scanResult = await rpc.call<{
    success: boolean;
    txouts: number;
    height: number;
    bestblock: string;
    unspents: Array<{
      txid: string;
      vout: number;
      scriptPubKey: string;
      desc: string;
      amount: number;
      coinbase: boolean;
      height: number;
    }>;
    total_amount: number;
  }>("scantxoutset", ["start", [`addr(${address})`]]);

  if (!scanResult.success) {
    throw new Error("scantxoutset failed");
  }

  slog("scan complete", {
    utxoCount: scanResult.unspents.length,
    totalBtc: scanResult.total_amount,
    totalSats: Math.round(scanResult.total_amount * 1e8),
  });

  if (scanResult.unspents.length === 0) {
    slog("no UTXOs found — fund the portal address first", { address });
    await prisma.$disconnect();
    return;
  }

  // Register each UTXO in the database
  let added = 0;
  let skipped = 0;
  const spk = new Uint8Array(scriptPubkey);

  for (const utxo of scanResult.unspents) {
    const amount = BigInt(Math.round(utxo.amount * 1e8));

    const existing = await prisma.utxo.findUnique({
      where: { txid_vout: { txid: utxo.txid, vout: utxo.vout } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.utxo.create({
      data: {
        txid: utxo.txid,
        vout: utxo.vout,
        amount,
        scriptPubkey: spk,
        status: "available",
      },
    });
    slog("registered UTXO", { txid: utxo.txid, vout: utxo.vout, sats: Number(amount) });
    added++;
  }

  slog("done", { added, skipped, total: scanResult.unspents.length });

  // Show pool summary
  const pool = await prisma.utxo.groupBy({
    by: ["status"],
    _count: true,
    _sum: { amount: true },
  });
  for (const row of pool) {
    slog("pool", { status: row.status, count: row._count, totalSats: Number(row._sum.amount ?? 0) });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
