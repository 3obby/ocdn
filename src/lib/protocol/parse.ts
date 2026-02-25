import {
  PROTOCOL_TAG,
  PROTOCOL_TAG_BYTES,
  TYPE_POST,
  TYPE_REPLY,
  TYPE_BURN,
  TYPE_SIGNAL,
  NONCE_LENGTH,
  PUBKEY_LENGTH,
  SIG_LENGTH,
  HASH_LENGTH,
  CONTENT_HASH_PREFIX_LENGTH,
} from "./constants";
import type {
  PostEnvelope,
  ReplyEnvelope,
  WitnessEnvelope,
  BurnPayload,
  SignalPayload,
  SignalRef,
  OpReturnPayload,
} from "./types";
import {
  contentHash,
  computeParentRef,
  signMessage,
  verify,
} from "./crypto";

const decoder = new TextDecoder("utf-8", { fatal: true });

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function parseWitnessEnvelope(
  pushes: Uint8Array[],
): WitnessEnvelope | null {
  if (pushes.length < 8) return null;

  const tag = pushes[0];
  if (!bytesEqual(tag, PROTOCOL_TAG_BYTES)) return null;

  if (pushes[1].length !== 1) return null;
  const version = pushes[1][0];

  if (pushes[2].length !== 1) return null;
  const type = pushes[2][0];

  if (type !== TYPE_POST && type !== TYPE_REPLY) return null;

  const nonce = pushes[3];
  if (nonce.length !== NONCE_LENGTH) return null;

  const pubkey = pushes[4];
  if (pubkey.length !== PUBKEY_LENGTH) return null;

  const sig = pushes[5];
  if (sig.length !== SIG_LENGTH) return null;

  if (type === TYPE_POST) {
    if (pushes.length < 8) return null;
    let topic: string;
    try {
      topic = pushes[6].length === 0 ? "" : decoder.decode(pushes[6]);
    } catch {
      return null;
    }

    let content: string;
    try {
      const contentBytes = concatUint8Arrays(pushes.slice(7));
      content = decoder.decode(contentBytes);
    } catch {
      return null;
    }

    return {
      version,
      type: TYPE_POST,
      nonce: nonce.slice(),
      pubkey: pubkey.slice(),
      sig: sig.slice(),
      topic,
      content,
    } satisfies PostEnvelope;
  }

  if (type === TYPE_REPLY) {
    if (pushes.length < 8) return null;
    const parentHash = pushes[6];
    if (parentHash.length !== HASH_LENGTH) return null;

    let content: string;
    try {
      const contentBytes = concatUint8Arrays(pushes.slice(7));
      content = decoder.decode(contentBytes);
    } catch {
      return null;
    }

    return {
      version,
      type: TYPE_REPLY,
      nonce: nonce.slice(),
      pubkey: pubkey.slice(),
      sig: sig.slice(),
      parentHash: parentHash.slice(),
      content,
    } satisfies ReplyEnvelope;
  }

  return null;
}

export function parseOpReturn(data: Uint8Array): OpReturnPayload | null {
  if (data.length < 6) return null;

  const tag = data.slice(0, 4);
  if (!bytesEqual(tag, PROTOCOL_TAG_BYTES)) return null;

  const version = data[4];
  const type = data[5];

  if (type === TYPE_BURN) {
    if (data.length !== 6 + HASH_LENGTH) return null;
    return {
      version,
      type: TYPE_BURN,
      targetHash: data.slice(6, 6 + HASH_LENGTH),
    } satisfies BurnPayload;
  }

  if (type === TYPE_SIGNAL) {
    const refs: SignalRef[] = [];
    let offset = 6;
    while (offset < data.length) {
      const len = data[offset];
      offset++;
      if (len === 0x00) {
        if (offset + CONTENT_HASH_PREFIX_LENGTH > data.length) return null;
        refs.push({
          kind: "content",
          hashPrefix: data.slice(offset, offset + CONTENT_HASH_PREFIX_LENGTH),
        });
        offset += CONTENT_HASH_PREFIX_LENGTH;
      } else {
        if (offset + len > data.length) return null;
        try {
          const value = decoder.decode(data.slice(offset, offset + len));
          refs.push({ kind: "text", value });
        } catch {
          return null;
        }
        offset += len;
      }
    }
    return {
      version,
      type: TYPE_SIGNAL,
      refs,
    } satisfies SignalPayload;
  }

  return null;
}

export function verifyContentHash(env: WitnessEnvelope): Uint8Array {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(env.content);
  const parentRef = env.type === TYPE_POST
    ? computeParentRef(TYPE_POST, (env as PostEnvelope).topic)
    : computeParentRef(TYPE_REPLY, undefined, (env as ReplyEnvelope).parentHash);

  return contentHash(env.pubkey, env.nonce, parentRef, contentBytes);
}

export function verifyAuthorSignature(env: WitnessEnvelope): boolean {
  const cHash = verifyContentHash(env);
  const msg = signMessage(env.version, env.type, cHash);
  return verify(env.pubkey, msg, env.sig);
}

export function verifyEnvelope(env: WitnessEnvelope): {
  valid: boolean;
  contentHash: Uint8Array;
} {
  const cHash = verifyContentHash(env);
  const msg = signMessage(env.version, env.type, cHash);
  const valid = verify(env.pubkey, msg, env.sig);
  return { valid, contentHash: cHash };
}
