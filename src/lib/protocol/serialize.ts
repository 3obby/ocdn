import {
  PROTOCOL_TAG_BYTES,
  PROTOCOL_VERSION,
  TYPE_POST,
  TYPE_REPLY,
  TYPE_BURN,
  TYPE_SIGNAL,
  MAX_DATA_PUSH,
  HASH_LENGTH,
  CONTENT_HASH_PREFIX_LENGTH,
} from "./constants";
import type {
  PostEnvelope,
  ReplyEnvelope,
  BurnPayload,
  SignalPayload,
  SignalRef,
} from "./types";

const encoder = new TextEncoder();

function splitPushes(data: Uint8Array): Uint8Array[] {
  const pushes: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += MAX_DATA_PUSH) {
    pushes.push(data.slice(i, i + MAX_DATA_PUSH));
  }
  return pushes;
}

export function serializePostEnvelope(env: PostEnvelope): Uint8Array[] {
  const topicBytes = encoder.encode(env.topic);
  const contentBytes = encoder.encode(env.content);
  const contentPushes = splitPushes(contentBytes);

  return [
    PROTOCOL_TAG_BYTES,
    new Uint8Array([env.version]),
    new Uint8Array([TYPE_POST]),
    env.nonce,
    env.pubkey,
    env.sig,
    topicBytes,
    ...contentPushes,
  ];
}

export function serializeReplyEnvelope(env: ReplyEnvelope): Uint8Array[] {
  const contentBytes = encoder.encode(env.content);
  const contentPushes = splitPushes(contentBytes);

  return [
    PROTOCOL_TAG_BYTES,
    new Uint8Array([env.version]),
    new Uint8Array([TYPE_REPLY]),
    env.nonce,
    env.pubkey,
    env.sig,
    env.parentHash,
    ...contentPushes,
  ];
}

export function serializeWitnessEnvelope(
  env: PostEnvelope | ReplyEnvelope,
): Uint8Array[] {
  if (env.type === TYPE_POST) return serializePostEnvelope(env as PostEnvelope);
  if (env.type === TYPE_REPLY) return serializeReplyEnvelope(env as ReplyEnvelope);
  throw new Error(`Unknown envelope type: ${(env as PostEnvelope | ReplyEnvelope).type}`);
}

export function serializeBurnOpReturn(payload: BurnPayload): Uint8Array {
  if (payload.targetHash.length !== HASH_LENGTH) {
    throw new Error(`targetHash must be ${HASH_LENGTH} bytes`);
  }
  const buf = new Uint8Array(4 + 1 + 1 + HASH_LENGTH);
  buf.set(PROTOCOL_TAG_BYTES, 0);
  buf[4] = payload.version;
  buf[5] = TYPE_BURN;
  buf.set(payload.targetHash, 6);
  return buf;
}

export function serializeSignalOpReturn(payload: SignalPayload): Uint8Array {
  const header = new Uint8Array(6);
  header.set(PROTOCOL_TAG_BYTES, 0);
  header[4] = payload.version;
  header[5] = TYPE_SIGNAL;

  const refChunks: Uint8Array[] = [];
  for (const ref of payload.refs) {
    if (ref.kind === "text") {
      const textBytes = encoder.encode(ref.value);
      if (textBytes.length === 0 || textBytes.length > 255) {
        throw new Error("Signal text ref must be 1-255 bytes");
      }
      const chunk = new Uint8Array(1 + textBytes.length);
      chunk[0] = textBytes.length;
      chunk.set(textBytes, 1);
      refChunks.push(chunk);
    } else {
      if (ref.hashPrefix.length !== CONTENT_HASH_PREFIX_LENGTH) {
        throw new Error(`Content ref must be ${CONTENT_HASH_PREFIX_LENGTH} bytes`);
      }
      const chunk = new Uint8Array(1 + CONTENT_HASH_PREFIX_LENGTH);
      chunk[0] = 0x00;
      chunk.set(ref.hashPrefix, 1);
      refChunks.push(chunk);
    }
  }

  const refsLen = refChunks.reduce((sum, c) => sum + c.length, 0);
  if (refsLen > 74) {
    throw new Error(`Signal refs exceed 74 bytes (got ${refsLen})`);
  }

  const buf = new Uint8Array(6 + refsLen);
  buf.set(header, 0);
  let offset = 6;
  for (const chunk of refChunks) {
    buf.set(chunk, offset);
    offset += chunk.length;
  }
  return buf;
}

export function serializeOpReturn(
  payload: BurnPayload | SignalPayload,
): Uint8Array {
  if (payload.type === TYPE_BURN) return serializeBurnOpReturn(payload as BurnPayload);
  if (payload.type === TYPE_SIGNAL) return serializeSignalOpReturn(payload as SignalPayload);
  throw new Error(`Unknown OP_RETURN type: ${(payload as BurnPayload | SignalPayload).type}`);
}

export { PROTOCOL_VERSION };
