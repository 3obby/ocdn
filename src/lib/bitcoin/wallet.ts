import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { schnorr } from "@noble/curves/secp256k1.js";
import { prisma } from "../db";

bitcoin.initEccLib(ecc);

function resolveNetwork(): bitcoin.Network {
  const net = process.env.BITCOIN_NETWORK;
  if (net === "regtest") return bitcoin.networks.regtest;
  if (net === "mainnet" || net === "bitcoin") return bitcoin.networks.bitcoin;
  return bitcoin.networks.testnet;
}
export const NETWORK = resolveNetwork();
export const DUST_LIMIT = 546;
export const RBF_SEQUENCE = 0xfffffffd;

const SECP256K1_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);

// ═══ PORTAL KEY MANAGEMENT ═══

export interface PortalKey {
  privkey: Buffer;
  xOnlyPubkey: Buffer;
  p2trOutput: Buffer;
  p2trAddress: string;
}

let _portalKey: PortalKey | null = null;

export function loadPortalKey(): PortalKey {
  if (_portalKey) return _portalKey;

  const hex = process.env.PORTAL_PRIVKEY;
  if (!hex) throw new Error("PORTAL_PRIVKEY not set in environment");

  const privkey = Buffer.from(hex, "hex");
  if (privkey.length !== 32)
    throw new Error("PORTAL_PRIVKEY must be 64 hex characters (32 bytes)");

  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const p2tr = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  _portalKey = {
    privkey,
    xOnlyPubkey,
    p2trOutput: Buffer.from(p2tr.output!),
    p2trAddress: p2tr.address!,
  };
  return _portalKey;
}

export function generatePortalKey(): { hex: string; address: string } {
  const privkey = Buffer.from(schnorr.utils.randomSecretKey());
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));
  const { address } = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });
  return { hex: privkey.toString("hex"), address: address! };
}

/** Reset cached key (for testing) */
export function _resetPortalKey(): void {
  _portalKey = null;
}

// ═══ TAPROOT SIGNER UTILITIES ═══

export interface TaprootSigner {
  publicKey: Uint8Array;
  sign(hash: Uint8Array, lowR?: boolean): Uint8Array;
  signSchnorr(hash: Uint8Array): Uint8Array;
}

function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.length === 32 ? pubkey : pubkey.subarray(1, 33);
}

function bufToBigInt(buf: Uint8Array): bigint {
  return BigInt("0x" + Buffer.from(buf).toString("hex"));
}

function bigIntToBuf32(n: bigint): Buffer {
  const hex = n.toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
}

/**
 * Create a signer for Taproot key-path spends.
 * Applies the BIP-341 tweak: t = H_TapTweak(P || merkleRoot), d' = d + t.
 * Handles Y-parity: if the full pubkey has odd Y, negate d before tweaking.
 */
export function createKeyPathSigner(
  privkey: Buffer,
  merkleRoot?: Buffer,
): TaprootSigner {
  const compressed = ecc.pointFromScalar(privkey, true);
  if (!compressed) throw new Error("Invalid private key");

  const xOnly = Buffer.from(compressed.slice(1));
  const hasOddY = compressed[0] === 0x03;

  let d = bufToBigInt(privkey);
  if (hasOddY) d = SECP256K1_ORDER - d;

  const tweakData =
    merkleRoot && merkleRoot.length
      ? Buffer.concat([xOnly, merkleRoot])
      : xOnly;
  const tweak = bitcoin.crypto.taggedHash("TapTweak", tweakData);
  const t = bufToBigInt(tweak);
  const tweakedD = (d + t) % SECP256K1_ORDER;
  const tweakedPrivkey = bigIntToBuf32(tweakedD);

  const tweakedPub = Buffer.from(ecc.pointFromScalar(tweakedPrivkey, true)!);

  return {
    publicKey: tweakedPub,
    sign(hash: Uint8Array): Uint8Array {
      return ecc.sign(hash, tweakedPrivkey);
    },
    signSchnorr(hash: Uint8Array): Uint8Array {
      return ecc.signSchnorr!(hash, tweakedPrivkey);
    },
  };
}

/**
 * Create a signer for Taproot script-path spends.
 * Uses the untweaked key (pubkey appears in the leaf script).
 */
export function createScriptPathSigner(privkey: Buffer): TaprootSigner {
  const pub = Buffer.from(ecc.pointFromScalar(privkey, true)!);
  return {
    publicKey: pub,
    sign(hash: Uint8Array): Uint8Array {
      return ecc.sign(hash, privkey);
    },
    signSchnorr(hash: Uint8Array): Uint8Array {
      return ecc.signSchnorr!(hash, privkey);
    },
  };
}

// ═══ UTXO POOL ═══

export interface PoolUtxo {
  id: number;
  txid: string;
  vout: number;
  amount: bigint;
  scriptPubkey: Buffer;
}

export async function getAvailableUtxos(): Promise<PoolUtxo[]> {
  const utxos = await prisma.utxo.findMany({
    where: { status: "available" },
    orderBy: { amount: "desc" },
  });
  return utxos.map((u) => ({
    id: u.id,
    txid: u.txid,
    vout: u.vout,
    amount: u.amount,
    scriptPubkey: Buffer.from(u.scriptPubkey),
  }));
}

export async function reserveUtxo(minAmount: bigint): Promise<PoolUtxo> {
  const result = await prisma.$transaction(async (tx) => {
    const utxo = await tx.utxo.findFirst({
      where: { status: "available", amount: { gte: minAmount } },
      orderBy: { amount: "asc" },
    });
    if (!utxo)
      throw new Error(`No available UTXO with >= ${minAmount} sats`);

    await tx.utxo.update({
      where: { id: utxo.id },
      data: { status: "reserved", reservedAt: new Date() },
    });
    return utxo;
  });

  return {
    id: result.id,
    txid: result.txid,
    vout: result.vout,
    amount: result.amount,
    scriptPubkey: Buffer.from(result.scriptPubkey),
  };
}

export async function releaseUtxo(id: number): Promise<void> {
  await prisma.utxo.update({
    where: { id },
    data: { status: "available", reservedAt: null },
  });
}

export async function markUtxoSpent(
  id: number,
  spentTxid: string,
): Promise<void> {
  await prisma.utxo.update({
    where: { id },
    data: { status: "spent", spentTxid },
  });
}

export async function addUtxo(
  txid: string,
  vout: number,
  amount: bigint,
  scriptPubkey: Buffer,
): Promise<number> {
  const spk = new Uint8Array(scriptPubkey);
  const utxo = await prisma.utxo.upsert({
    where: { txid_vout: { txid, vout } },
    update: { amount, scriptPubkey: spk, status: "available" },
    create: { txid, vout, amount, scriptPubkey: spk },
  });
  return utxo.id;
}

/** Release UTXOs that have been reserved for too long (stale locks). */
export async function releaseStaleReservations(
  maxAgeMs: number = 5 * 60 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const { count } = await prisma.utxo.updateMany({
    where: {
      status: "reserved",
      reservedAt: { lt: cutoff },
    },
    data: { status: "available", reservedAt: null },
  });
  return count;
}

export { toXOnly };
