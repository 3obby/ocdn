import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import {
  TAGGED_HASH_DOMAIN_CONTENT,
  TAGGED_HASH_DOMAIN_TOPIC,
  TAGGED_HASH_DOMAIN_SIGN,
  NONCE_LENGTH,
  PUBKEY_LENGTH,
  HASH_LENGTH,
  NULL_PARENT_REF,
} from "./constants";

const encoder = new TextEncoder();

const tagHashCache = new Map<string, Uint8Array>();

function getTagPrefix(tag: string): Uint8Array {
  const cached = tagHashCache.get(tag);
  if (cached) return cached;
  const h = sha256(encoder.encode(tag));
  const prefix = new Uint8Array(64);
  prefix.set(h, 0);
  prefix.set(h, 32);
  tagHashCache.set(tag, prefix);
  return prefix;
}

export function taggedHash(tag: string, msg: Uint8Array): Uint8Array {
  const prefix = getTagPrefix(tag);
  const buf = new Uint8Array(prefix.length + msg.length);
  buf.set(prefix, 0);
  buf.set(msg, prefix.length);
  return sha256(buf);
}

export function topicHash(topicString: string): Uint8Array {
  return taggedHash(TAGGED_HASH_DOMAIN_TOPIC, encoder.encode(topicString));
}

export function contentHash(
  pubkey: Uint8Array,
  nonce: Uint8Array,
  parentRef: Uint8Array,
  content: Uint8Array,
): Uint8Array {
  if (pubkey.length !== PUBKEY_LENGTH) throw new Error(`pubkey must be ${PUBKEY_LENGTH} bytes`);
  if (nonce.length !== NONCE_LENGTH) throw new Error(`nonce must be ${NONCE_LENGTH} bytes`);
  if (parentRef.length !== HASH_LENGTH) throw new Error(`parentRef must be ${HASH_LENGTH} bytes`);

  const msg = new Uint8Array(PUBKEY_LENGTH + NONCE_LENGTH + HASH_LENGTH + content.length);
  let offset = 0;
  msg.set(pubkey, offset); offset += PUBKEY_LENGTH;
  msg.set(nonce, offset); offset += NONCE_LENGTH;
  msg.set(parentRef, offset); offset += HASH_LENGTH;
  msg.set(content, offset);

  return taggedHash(TAGGED_HASH_DOMAIN_CONTENT, msg);
}

export function computeParentRef(
  type: number,
  topic?: string,
  parentHash?: Uint8Array,
): Uint8Array {
  if (type === 0x01) {
    return topic ? topicHash(topic) : NULL_PARENT_REF;
  }
  if (type === 0x02) {
    if (!parentHash || parentHash.length !== HASH_LENGTH) {
      throw new Error("REPLY requires a 32-byte parentHash");
    }
    return parentHash;
  }
  throw new Error(`Unsupported type for parentRef: 0x${type.toString(16)}`);
}

export function signMessage(
  version: number,
  type: number,
  cHash: Uint8Array,
): Uint8Array {
  if (cHash.length !== HASH_LENGTH) throw new Error(`contentHash must be ${HASH_LENGTH} bytes`);
  const preimage = new Uint8Array(1 + 1 + HASH_LENGTH);
  preimage[0] = version;
  preimage[1] = type;
  preimage.set(cHash, 2);
  return taggedHash(TAGGED_HASH_DOMAIN_SIGN, preimage);
}

export function sign(privkey: Uint8Array, msg: Uint8Array): Uint8Array {
  return schnorr.sign(msg, privkey);
}

export function verify(pubkey: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean {
  try {
    return schnorr.verify(sig, msg, pubkey);
  } catch {
    return false;
  }
}

export function generateNonce(): Uint8Array {
  const nonce = new Uint8Array(NONCE_LENGTH);
  crypto.getRandomValues(nonce);
  return nonce;
}

export function generateKeyPair(): { privkey: Uint8Array; pubkey: Uint8Array } {
  const privkey = schnorr.utils.randomSecretKey();
  const pubkey = schnorr.getPublicKey(privkey);
  return { privkey, pubkey };
}

export function getPublicKey(privkey: Uint8Array): Uint8Array {
  return schnorr.getPublicKey(privkey);
}
