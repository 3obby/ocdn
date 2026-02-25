import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  taggedHash,
  topicHash,
  contentHash,
  signMessage,
  generateKeyPair,
  generateNonce,
  sign,
  verify,
  getPublicKey,
  PROTOCOL_VERSION,
  TYPE_POST,
  TYPE_REPLY,
  TYPE_BURN,
  TYPE_SIGNAL,
  HASH_LENGTH,
  NONCE_LENGTH,
  PUBKEY_LENGTH,
  SIG_LENGTH,
  CONTENT_HASH_PREFIX_LENGTH,
  NULL_PARENT_REF,
} from "./index";

import {
  serializePostEnvelope,
  serializeReplyEnvelope,
  serializeBurnOpReturn,
  serializeSignalOpReturn,
} from "./serialize";

import {
  parseWitnessEnvelope,
  parseOpReturn,
  verifyContentHash,
  verifyAuthorSignature,
  verifyEnvelope,
} from "./parse";

import {
  createPostEnvelope,
  createReplyEnvelope,
  createBurnPayload,
  createSignalPayload,
  createTopicBurnPayload,
} from "./create";

import { computeParentRef } from "./crypto";

import type {
  PostEnvelope,
  ReplyEnvelope,
  SignalRef,
} from "./types";

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ═══ CRYPTO PRIMITIVES ═══

describe("taggedHash", () => {
  it("produces 32-byte output", () => {
    const result = taggedHash("test", new Uint8Array([1, 2, 3]));
    assert.equal(result.length, HASH_LENGTH);
  });

  it("is deterministic", () => {
    const a = taggedHash("ocdn/content", new Uint8Array([0xff]));
    const b = taggedHash("ocdn/content", new Uint8Array([0xff]));
    assert.deepEqual(a, b);
  });

  it("different tags produce different hashes", () => {
    const msg = new Uint8Array([1, 2, 3]);
    const a = taggedHash("ocdn/content", msg);
    const b = taggedHash("ocdn/topic", msg);
    assert.notDeepEqual(a, b);
  });

  it("different messages produce different hashes", () => {
    const a = taggedHash("ocdn/content", new Uint8Array([1]));
    const b = taggedHash("ocdn/content", new Uint8Array([2]));
    assert.notDeepEqual(a, b);
  });
});

describe("topicHash", () => {
  it("produces 32 bytes", () => {
    assert.equal(topicHash("bitcoin").length, HASH_LENGTH);
  });

  it("is deterministic", () => {
    assert.deepEqual(topicHash("bitcoin"), topicHash("bitcoin"));
  });

  it("different topics produce different hashes", () => {
    assert.notDeepEqual(topicHash("bitcoin"), topicHash("ethereum"));
  });
});

describe("contentHash", () => {
  it("produces 32 bytes", () => {
    const { pubkey } = generateKeyPair();
    const nonce = generateNonce();
    const result = contentHash(pubkey, nonce, NULL_PARENT_REF, encoder.encode("hello"));
    assert.equal(result.length, HASH_LENGTH);
  });

  it("is author-bound (different keys → different hash)", () => {
    const k1 = generateKeyPair();
    const k2 = generateKeyPair();
    const nonce = generateNonce();
    const content = encoder.encode("same text");
    const h1 = contentHash(k1.pubkey, nonce, NULL_PARENT_REF, content);
    const h2 = contentHash(k2.pubkey, nonce, NULL_PARENT_REF, content);
    assert.notDeepEqual(h1, h2);
  });

  it("is unique (different nonces → different hash)", () => {
    const { pubkey } = generateKeyPair();
    const n1 = generateNonce();
    const n2 = generateNonce();
    const content = encoder.encode("same text");
    const h1 = contentHash(pubkey, n1, NULL_PARENT_REF, content);
    const h2 = contentHash(pubkey, n2, NULL_PARENT_REF, content);
    assert.notDeepEqual(h1, h2);
  });

  it("is position-bound (different parent_ref → different hash)", () => {
    const { pubkey } = generateKeyPair();
    const nonce = generateNonce();
    const content = encoder.encode("same text");
    const h1 = contentHash(pubkey, nonce, NULL_PARENT_REF, content);
    const h2 = contentHash(pubkey, nonce, topicHash("bitcoin"), content);
    assert.notDeepEqual(h1, h2);
  });
});

describe("signMessage", () => {
  it("produces 32 bytes", () => {
    const cHash = new Uint8Array(HASH_LENGTH);
    const result = signMessage(PROTOCOL_VERSION, TYPE_POST, cHash);
    assert.equal(result.length, HASH_LENGTH);
  });

  it("different types produce different messages", () => {
    const cHash = new Uint8Array(HASH_LENGTH).fill(0xab);
    const a = signMessage(PROTOCOL_VERSION, TYPE_POST, cHash);
    const b = signMessage(PROTOCOL_VERSION, TYPE_REPLY, cHash);
    assert.notDeepEqual(a, b);
  });
});

describe("BIP-340 sign/verify", () => {
  it("valid signature verifies", () => {
    const { privkey, pubkey } = generateKeyPair();
    const msg = taggedHash("test", encoder.encode("hello"));
    const sig = sign(privkey, msg);
    assert.equal(sig.length, SIG_LENGTH);
    assert.ok(verify(pubkey, msg, sig));
  });

  it("wrong pubkey rejects", () => {
    const k1 = generateKeyPair();
    const k2 = generateKeyPair();
    const msg = taggedHash("test", encoder.encode("hello"));
    const sig = sign(k1.privkey, msg);
    assert.ok(!verify(k2.pubkey, msg, sig));
  });

  it("tampered message rejects", () => {
    const { privkey, pubkey } = generateKeyPair();
    const msg = taggedHash("test", encoder.encode("hello"));
    const sig = sign(privkey, msg);
    const badMsg = taggedHash("test", encoder.encode("tampered"));
    assert.ok(!verify(pubkey, badMsg, sig));
  });
});

// ═══ POST: CREATE → SERIALIZE → PARSE → VERIFY ═══

describe("POST round-trip", () => {
  it("serialize → parse → verify for post with topic", () => {
    const { privkey } = generateKeyPair();
    const { envelope, contentHash: cHash } = createPostEnvelope(
      privkey,
      "Hello, Bitcoin!",
      "bitcoin",
    );

    assert.equal(envelope.type, TYPE_POST);
    assert.equal(envelope.topic, "bitcoin");
    assert.equal(envelope.content, "Hello, Bitcoin!");
    assert.equal(cHash.length, HASH_LENGTH);

    const pushes = serializePostEnvelope(envelope);
    assert.ok(pushes.length >= 8);

    const parsed = parseWitnessEnvelope(pushes);
    assert.ok(parsed !== null);
    assert.equal(parsed!.type, TYPE_POST);

    const post = parsed as PostEnvelope;
    assert.equal(post.topic, "bitcoin");
    assert.equal(post.content, "Hello, Bitcoin!");
    assert.deepEqual(post.pubkey, envelope.pubkey);
    assert.deepEqual(post.nonce, envelope.nonce);
    assert.deepEqual(post.sig, envelope.sig);

    const recomputedHash = verifyContentHash(parsed!);
    assert.deepEqual(recomputedHash, cHash);

    assert.ok(verifyAuthorSignature(parsed!));

    const { valid, contentHash: vHash } = verifyEnvelope(parsed!);
    assert.ok(valid);
    assert.deepEqual(vHash, cHash);
  });

  it("standalone post (empty topic)", () => {
    const { privkey } = generateKeyPair();
    const { envelope, contentHash: cHash } = createPostEnvelope(
      privkey,
      "Standalone post",
    );

    assert.equal(envelope.topic, "");

    const pushes = serializePostEnvelope(envelope);
    const parsed = parseWitnessEnvelope(pushes) as PostEnvelope;
    assert.ok(parsed !== null);
    assert.equal(parsed.topic, "");
    assert.ok(verifyAuthorSignature(parsed));
  });

  it("long content splits into multiple pushes", () => {
    const { privkey } = generateKeyPair();
    const longContent = "A".repeat(2000);
    const { envelope } = createPostEnvelope(privkey, longContent, "test");

    const pushes = serializePostEnvelope(envelope);
    assert.ok(pushes.length > 8, "long content should produce extra pushes");

    const parsed = parseWitnessEnvelope(pushes) as PostEnvelope;
    assert.ok(parsed !== null);
    assert.equal(parsed.content, longContent);
    assert.ok(verifyAuthorSignature(parsed));
  });
});

// ═══ REPLY: CREATE → SERIALIZE → PARSE → VERIFY ═══

describe("REPLY round-trip", () => {
  it("serialize → parse → verify", () => {
    const author1 = generateKeyPair();
    const { contentHash: parentCHash } = createPostEnvelope(
      author1.privkey,
      "Parent post",
      "bitcoin",
    );

    const author2 = generateKeyPair();
    const { envelope, contentHash: replyCHash } = createReplyEnvelope(
      author2.privkey,
      "This is a reply",
      parentCHash,
    );

    assert.equal(envelope.type, TYPE_REPLY);
    assert.deepEqual(envelope.parentHash, parentCHash);

    const pushes = serializeReplyEnvelope(envelope);
    const parsed = parseWitnessEnvelope(pushes);
    assert.ok(parsed !== null);
    assert.equal(parsed!.type, TYPE_REPLY);

    const reply = parsed as ReplyEnvelope;
    assert.equal(reply.content, "This is a reply");
    assert.deepEqual(reply.parentHash, parentCHash);

    const { valid, contentHash: vHash } = verifyEnvelope(parsed!);
    assert.ok(valid);
    assert.deepEqual(vHash, replyCHash);
  });
});

// ═══ BURN: CREATE → SERIALIZE → PARSE ═══

describe("BURN round-trip", () => {
  it("serialize → parse for content burn", () => {
    const { privkey } = generateKeyPair();
    const { contentHash: target } = createPostEnvelope(
      privkey,
      "Target post",
      "bitcoin",
    );

    const payload = createBurnPayload(target);
    assert.equal(payload.type, TYPE_BURN);

    const bytes = serializeBurnOpReturn(payload);
    assert.equal(bytes.length, 38);

    const parsed = parseOpReturn(bytes);
    assert.ok(parsed !== null);
    assert.equal(parsed!.type, TYPE_BURN);
    assert.deepEqual((parsed as typeof payload).targetHash, target);
  });

  it("serialize → parse for topic burn", () => {
    const payload = createTopicBurnPayload("bitcoin");
    const bytes = serializeBurnOpReturn(payload);
    const parsed = parseOpReturn(bytes);
    assert.ok(parsed !== null);
    assert.equal(parsed!.type, TYPE_BURN);
    assert.deepEqual(
      (parsed as typeof payload).targetHash,
      topicHash("bitcoin"),
    );
  });
});

// ═══ SIGNAL: CREATE → SERIALIZE → PARSE ═══

describe("SIGNAL round-trip", () => {
  it("text refs only", () => {
    const refs: SignalRef[] = [
      { kind: "text", value: "McDonald's" },
      { kind: "text", value: "wage theft" },
    ];
    const payload = createSignalPayload(refs);
    const bytes = serializeSignalOpReturn(payload);
    assert.ok(bytes.length <= 80);

    const parsed = parseOpReturn(bytes);
    assert.ok(parsed !== null);
    assert.equal(parsed!.type, TYPE_SIGNAL);
    const sig = parsed as typeof payload;
    assert.equal(sig.refs.length, 2);
    assert.equal(sig.refs[0].kind, "text");
    assert.equal((sig.refs[0] as { kind: "text"; value: string }).value, "McDonald's");
    assert.equal((sig.refs[1] as { kind: "text"; value: string }).value, "wage theft");
  });

  it("mixed text and content refs", () => {
    const hashPrefix = new Uint8Array(CONTENT_HASH_PREFIX_LENGTH).fill(0xab);
    const refs: SignalRef[] = [
      { kind: "text", value: "Oracle" },
      { kind: "text", value: "open source" },
      { kind: "content", hashPrefix },
    ];
    const payload = createSignalPayload(refs);
    const bytes = serializeSignalOpReturn(payload);
    assert.ok(bytes.length <= 80);

    const parsed = parseOpReturn(bytes);
    assert.ok(parsed !== null);
    const sig = parsed as typeof payload;
    assert.equal(sig.refs.length, 3);
    assert.equal(sig.refs[2].kind, "content");
    assert.deepEqual(
      (sig.refs[2] as { kind: "content"; hashPrefix: Uint8Array }).hashPrefix,
      hashPrefix,
    );
  });
});

// ═══ INVALID ENVELOPES ═══

describe("invalid envelopes rejected", () => {
  it("wrong tag rejected", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(privkey, "test", "topic");
    const pushes = serializePostEnvelope(envelope);
    pushes[0] = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    assert.equal(parseWitnessEnvelope(pushes), null);
  });

  it("bad nonce length rejected", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(privkey, "test", "topic");
    const pushes = serializePostEnvelope(envelope);
    pushes[3] = new Uint8Array(4); // wrong length
    assert.equal(parseWitnessEnvelope(pushes), null);
  });

  it("bad pubkey length rejected", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(privkey, "test", "topic");
    const pushes = serializePostEnvelope(envelope);
    pushes[4] = new Uint8Array(16); // wrong length
    assert.equal(parseWitnessEnvelope(pushes), null);
  });

  it("tampered signature fails verification", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(privkey, "test", "topic");
    const pushes = serializePostEnvelope(envelope);
    const parsed = parseWitnessEnvelope(pushes)!;
    parsed.sig[0] ^= 0xff;
    assert.ok(!verifyAuthorSignature(parsed));
  });

  it("too few pushes rejected", () => {
    assert.equal(parseWitnessEnvelope([new Uint8Array([1])]), null);
  });

  it("unknown type rejected", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(privkey, "test", "topic");
    const pushes = serializePostEnvelope(envelope);
    pushes[2] = new Uint8Array([0xff]);
    assert.equal(parseWitnessEnvelope(pushes), null);
  });

  it("malformed OP_RETURN too short", () => {
    assert.equal(parseOpReturn(new Uint8Array(3)), null);
  });

  it("wrong BURN length rejected", () => {
    const bytes = new Uint8Array(20);
    bytes.set(new Uint8Array([0x6f, 0x63, 0x64, 0x6e, 0x01, 0x03]), 0);
    assert.equal(parseOpReturn(bytes), null);
  });
});

// ═══ CROSS-TYPE REPLAY PROTECTION ═══

describe("cross-type replay protection", () => {
  it("POST signature does not verify as REPLY", () => {
    const { privkey } = generateKeyPair();
    const nonce = generateNonce();
    const { envelope: postEnv, contentHash: postHash } = createPostEnvelope(
      privkey,
      "Hello",
      "bitcoin",
      nonce,
    );

    const fakeReplyPushes = serializePostEnvelope(postEnv);
    fakeReplyPushes[2] = new Uint8Array([TYPE_REPLY]);
    fakeReplyPushes[6] = new Uint8Array(HASH_LENGTH); // parentHash instead of topic

    const parsed = parseWitnessEnvelope(fakeReplyPushes);
    if (parsed) {
      assert.ok(!verifyAuthorSignature(parsed));
    }
  });
});

// ═══ DETERMINISM ═══

describe("determinism", () => {
  it("same inputs produce same contentHash", () => {
    const { privkey, pubkey } = generateKeyPair();
    const nonce = new Uint8Array(NONCE_LENGTH).fill(0x42);
    const content = encoder.encode("deterministic");
    const parentRef = NULL_PARENT_REF;

    const h1 = contentHash(pubkey, nonce, parentRef, content);
    const h2 = contentHash(pubkey, nonce, parentRef, content);
    assert.deepEqual(h1, h2);
  });

  it("same envelope re-serializes identically", () => {
    const { privkey } = generateKeyPair();
    const nonce = new Uint8Array(NONCE_LENGTH).fill(0x01);
    const { envelope } = createPostEnvelope(privkey, "test", "topic", nonce);

    const s1 = serializePostEnvelope(envelope);
    const s2 = serializePostEnvelope(envelope);
    assert.equal(s1.length, s2.length);
    for (let i = 0; i < s1.length; i++) {
      assert.deepEqual(s1[i], s2[i]);
    }
  });
});
