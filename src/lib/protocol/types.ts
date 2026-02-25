export interface PostEnvelope {
  version: number;
  type: typeof import("./constants").TYPE_POST;
  nonce: Uint8Array;
  pubkey: Uint8Array;
  sig: Uint8Array;
  topic: string;
  content: string;
}

export interface ReplyEnvelope {
  version: number;
  type: typeof import("./constants").TYPE_REPLY;
  nonce: Uint8Array;
  pubkey: Uint8Array;
  sig: Uint8Array;
  parentHash: Uint8Array;
  content: string;
}

export type WitnessEnvelope = PostEnvelope | ReplyEnvelope;

export interface BurnPayload {
  version: number;
  type: typeof import("./constants").TYPE_BURN;
  targetHash: Uint8Array;
}

export interface SignalTextRef {
  kind: "text";
  value: string;
}

export interface SignalContentRef {
  kind: "content";
  hashPrefix: Uint8Array;
}

export type SignalRef = SignalTextRef | SignalContentRef;

export interface SignalPayload {
  version: number;
  type: typeof import("./constants").TYPE_SIGNAL;
  refs: SignalRef[];
}

export type OpReturnPayload = BurnPayload | SignalPayload;

export interface KeyPair {
  privkey: Uint8Array;
  pubkey: Uint8Array;
}
