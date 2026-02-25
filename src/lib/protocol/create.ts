import {
  PROTOCOL_VERSION,
  TYPE_POST,
  TYPE_REPLY,
  TYPE_BURN,
  TYPE_SIGNAL,
  HASH_LENGTH,
} from "./constants";
import {
  contentHash,
  computeParentRef,
  signMessage,
  sign,
  generateNonce,
  getPublicKey,
  topicHash,
} from "./crypto";
import type {
  PostEnvelope,
  ReplyEnvelope,
  BurnPayload,
  SignalPayload,
  SignalRef,
} from "./types";

const encoder = new TextEncoder();

export function createPostEnvelope(
  privkey: Uint8Array,
  content: string,
  topic: string = "",
  nonce?: Uint8Array,
): { envelope: PostEnvelope; contentHash: Uint8Array } {
  const pubkey = getPublicKey(privkey);
  const n = nonce ?? generateNonce();
  const contentBytes = encoder.encode(content);
  const parentRef = computeParentRef(TYPE_POST, topic);
  const cHash = contentHash(pubkey, n, parentRef, contentBytes);
  const msg = signMessage(PROTOCOL_VERSION, TYPE_POST, cHash);
  const sig = sign(privkey, msg);

  return {
    envelope: {
      version: PROTOCOL_VERSION,
      type: TYPE_POST,
      nonce: n,
      pubkey,
      sig,
      topic,
      content,
    },
    contentHash: cHash,
  };
}

export function createReplyEnvelope(
  privkey: Uint8Array,
  content: string,
  parentHash: Uint8Array,
  nonce?: Uint8Array,
): { envelope: ReplyEnvelope; contentHash: Uint8Array } {
  if (parentHash.length !== HASH_LENGTH) {
    throw new Error(`parentHash must be ${HASH_LENGTH} bytes`);
  }
  const pubkey = getPublicKey(privkey);
  const n = nonce ?? generateNonce();
  const contentBytes = encoder.encode(content);
  const parentRef = computeParentRef(TYPE_REPLY, undefined, parentHash);
  const cHash = contentHash(pubkey, n, parentRef, contentBytes);
  const msg = signMessage(PROTOCOL_VERSION, TYPE_REPLY, cHash);
  const sig = sign(privkey, msg);

  return {
    envelope: {
      version: PROTOCOL_VERSION,
      type: TYPE_REPLY,
      nonce: n,
      pubkey,
      sig,
      parentHash,
      content,
    },
    contentHash: cHash,
  };
}

export function createBurnPayload(targetHash: Uint8Array): BurnPayload {
  if (targetHash.length !== HASH_LENGTH) {
    throw new Error(`targetHash must be ${HASH_LENGTH} bytes`);
  }
  return {
    version: PROTOCOL_VERSION,
    type: TYPE_BURN,
    targetHash,
  };
}

export function createSignalPayload(refs: SignalRef[]): SignalPayload {
  return {
    version: PROTOCOL_VERSION,
    type: TYPE_SIGNAL,
    refs,
  };
}

export function createTopicBurnPayload(topicString: string): BurnPayload {
  return createBurnPayload(topicHash(topicString));
}
