import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseScriptForEnvelopes,
  extractOpReturnData,
  computeTxFee,
  extractSignerPubkey,
  extractWitnessEnvelopes,
  extractOpReturns,
  normalizeTopic,
  normalizedTopicHash,
  toHex,
  fromHex,
} from "./detector";

import {
  PROTOCOL_TAG_BYTES,
  PROTOCOL_VERSION,
  TYPE_POST,
  TYPE_REPLY,
  TYPE_BURN,
  TYPE_SIGNAL,
  HASH_LENGTH,
  NONCE_LENGTH,
  SIG_LENGTH,
  PUBKEY_LENGTH,
  CONTENT_HASH_PREFIX_LENGTH,
} from "../protocol/constants";

import {
  serializePostEnvelope,
  serializeReplyEnvelope,
  serializeBurnOpReturn,
  serializeSignalOpReturn,
} from "../protocol/serialize";

import {
  createPostEnvelope,
  createReplyEnvelope,
  createBurnPayload,
  createSignalPayload,
} from "../protocol/create";

import { generateKeyPair, generateNonce, topicHash } from "../protocol/crypto";

import type { RawTransaction, TxInput, TxOutput } from "../bitcoin/rpc";

// ═══ HELPERS ═══

/** Compile an array of (Uint8Array | opcode-number) into raw script bytes. */
function compileScript(parts: (Uint8Array | number)[]): Uint8Array {
  const pieces: Uint8Array[] = [];
  for (const part of parts) {
    if (typeof part === "number") {
      pieces.push(new Uint8Array([part]));
    } else {
      // Encode as a push operation
      if (part.length === 0) {
        pieces.push(new Uint8Array([0x00])); // OP_0
      } else if (part.length <= 0x4b) {
        pieces.push(new Uint8Array([part.length]));
        pieces.push(part);
      } else if (part.length <= 0xff) {
        pieces.push(new Uint8Array([0x4c, part.length]));
        pieces.push(part);
      } else {
        pieces.push(
          new Uint8Array([0x4d, part.length & 0xff, (part.length >> 8) & 0xff]),
        );
        pieces.push(part);
      }
    }
  }
  const total = pieces.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of pieces) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const OP_CHECKSIG = 0xac;
const OP_FALSE = 0x00;
const OP_IF = 0x63;
const OP_ENDIF = 0x68;
const OP_RETURN = 0x6a;

function makeFakeControlBlock(): string {
  // 33 bytes: version byte (0xc0) + 32-byte internal key
  const cb = new Uint8Array(33);
  cb[0] = 0xc0;
  return toHex(cb);
}

function makeMockTx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    txid: "aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233",
    hash: "aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233",
    version: 2,
    size: 200,
    vsize: 150,
    weight: 600,
    locktime: 0,
    vin: [],
    vout: [],
    ...overrides,
  };
}

// ═══ TESTS ═══

describe("detector — hex utilities", () => {
  it("toHex / fromHex round-trip", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x42, 0xab]);
    assert.equal(toHex(bytes), "00ff42ab");
    assert.deepEqual(fromHex("00ff42ab"), bytes);
  });

  it("fromHex of empty string", () => {
    assert.deepEqual(fromHex(""), new Uint8Array(0));
  });
});

describe("detector — topic normalization", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizeTopic("  Bitcoin  "), "bitcoin");
  });

  it("NFC normalizes unicode", () => {
    // é as e + combining acute (NFD) → single codepoint (NFC)
    const nfd = "caf\u0065\u0301";
    const nfc = "caf\u00e9";
    assert.equal(normalizeTopic(nfd), nfc);
  });

  it("normalizedTopicHash is deterministic for equivalent strings", () => {
    const a = normalizedTopicHash("  Bitcoin  ");
    const b = normalizedTopicHash("bitcoin");
    assert.equal(a, b);
  });
});

describe("detector — parseScriptForEnvelopes", () => {
  it("finds a single envelope in a script", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(privkey, "hello world", "test");
    const pushes = serializePostEnvelope(envelope);

    const xPubkey = new Uint8Array(32).fill(0x02); // dummy
    const script = compileScript([
      xPubkey,
      OP_CHECKSIG,
      OP_FALSE,
      OP_IF,
      ...pushes,
      OP_ENDIF,
    ]);

    const found = parseScriptForEnvelopes(script);
    assert.equal(found.length, 1);
    assert.equal(toHex(found[0][0]), toHex(PROTOCOL_TAG_BYTES));
  });

  it("finds multiple envelopes (multi-envelope script)", () => {
    const { privkey } = generateKeyPair();
    const { envelope: env1 } = createPostEnvelope(privkey, "post one", "a");
    const { envelope: env2 } = createPostEnvelope(privkey, "post two", "b");

    const pushes1 = serializePostEnvelope(env1);
    const pushes2 = serializePostEnvelope(env2);

    const xPubkey = new Uint8Array(32).fill(0x02);
    const script = compileScript([
      xPubkey,
      OP_CHECKSIG,
      OP_FALSE,
      OP_IF,
      ...pushes1,
      OP_ENDIF,
      OP_FALSE,
      OP_IF,
      ...pushes2,
      OP_ENDIF,
    ]);

    const found = parseScriptForEnvelopes(script);
    assert.equal(found.length, 2);
  });

  it("ignores non-ocdn envelopes", () => {
    const fakeTag = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const script = compileScript([
      OP_FALSE,
      OP_IF,
      fakeTag,
      new Uint8Array([0x01]),
      OP_ENDIF,
    ]);

    const found = parseScriptForEnvelopes(script);
    // Still finds the envelope structurally — the ocdn tag check is in extractWitnessEnvelopes
    assert.equal(found.length, 1);
    assert.notDeepEqual(found[0][0], PROTOCOL_TAG_BYTES);
  });

  it("returns empty for script with no envelopes", () => {
    const script = compileScript([
      new Uint8Array(32).fill(0x02),
      OP_CHECKSIG,
    ]);
    assert.equal(parseScriptForEnvelopes(script).length, 0);
  });

  it("handles OP_PUSHDATA1 inside envelopes", () => {
    const bigPush = new Uint8Array(100).fill(0xab);
    const script = compileScript([OP_FALSE, OP_IF, bigPush, OP_ENDIF]);

    const found = parseScriptForEnvelopes(script);
    assert.equal(found.length, 1);
    assert.equal(found[0][0].length, 100);
    assert.equal(found[0][0][0], 0xab);
  });
});

describe("detector — extractOpReturnData", () => {
  it("extracts data from a burn OP_RETURN", () => {
    const payload = createBurnPayload(new Uint8Array(32).fill(0xaa));
    const opData = serializeBurnOpReturn(payload);
    // Build scriptPubKey: OP_RETURN + push(data)
    const script = compileScript([OP_RETURN, opData]);
    // But OP_RETURN in our compileScript is treated as an opcode, not a push...
    // Actually, OP_RETURN is opcode 0x6a.  The script is: 6a <push opdata>
    // We need to build this manually since OP_RETURN is followed by a push.
    const spk = new Uint8Array(1 + 1 + opData.length);
    spk[0] = 0x6a; // OP_RETURN
    spk[1] = opData.length; // push length
    spk.set(opData, 2);

    const extracted = extractOpReturnData(toHex(spk));
    assert.ok(extracted);
    assert.deepEqual(extracted, opData);
  });

  it("extracts data from a signal OP_RETURN", () => {
    const payload = createSignalPayload([
      { kind: "text", value: "Bitcoin" },
      { kind: "text", value: "freedom" },
    ]);
    const opData = serializeSignalOpReturn(payload);

    const spk = new Uint8Array(1 + 1 + opData.length);
    spk[0] = 0x6a;
    spk[1] = opData.length;
    spk.set(opData, 2);

    const extracted = extractOpReturnData(toHex(spk));
    assert.ok(extracted);
    assert.deepEqual(extracted, opData);
  });

  it("handles OP_PUSHDATA1 for larger payloads", () => {
    const data = new Uint8Array(80).fill(0xcc); // 80 bytes, needs OP_PUSHDATA1
    const spk = new Uint8Array(1 + 2 + data.length);
    spk[0] = 0x6a; // OP_RETURN
    spk[1] = 0x4c; // OP_PUSHDATA1
    spk[2] = data.length;
    spk.set(data, 3);

    const extracted = extractOpReturnData(toHex(spk));
    assert.ok(extracted);
    assert.equal(extracted.length, 80);
    assert.equal(extracted[0], 0xcc);
  });

  it("returns null for non-OP_RETURN script", () => {
    assert.equal(extractOpReturnData("0014" + "aa".repeat(20)), null);
  });
});

describe("detector — computeTxFee", () => {
  it("computes fee from prevout values minus outputs", () => {
    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          prevout: {
            generated: false,
            height: 100,
            value: 0.001, // 100,000 sats
            scriptPubKey: { asm: "", hex: "", type: "witness_v1_taproot" },
          },
        },
      ],
      vout: [
        {
          value: 0.0005, // 50,000 sats
          n: 0,
          scriptPubKey: { asm: "", hex: "6a26" + "ff".repeat(38), type: "nulldata" },
        },
        {
          value: 0.00045, // 45,000 sats change
          n: 1,
          scriptPubKey: { asm: "", hex: "5120" + "bb".repeat(32), type: "witness_v1_taproot" },
        },
      ],
    });

    const fee = computeTxFee(tx);
    // 100,000 - 50,000 - 45,000 = 5,000
    assert.equal(fee, 5000n);
  });

  it("handles multiple inputs", () => {
    const makeInput = (valueBtc: number): TxInput => ({
      txid: "aa".repeat(32),
      vout: 0,
      scriptSig: { asm: "", hex: "" },
      sequence: 0xffffffff,
      prevout: {
        generated: false,
        height: 100,
        value: valueBtc,
        scriptPubKey: { asm: "", hex: "", type: "witness_v1_taproot" },
      },
    });

    const tx = makeMockTx({
      vin: [makeInput(0.001), makeInput(0.002)],
      vout: [
        {
          value: 0.0029,
          n: 0,
          scriptPubKey: { asm: "", hex: "", type: "witness_v1_taproot" },
        },
      ],
    });

    // (100,000 + 200,000) - 290,000 = 10,000
    assert.equal(computeTxFee(tx), 10000n);
  });

  it("returns 0 for coinbase (no prevout)", () => {
    const tx = makeMockTx({
      vin: [
        {
          txid: "00".repeat(32),
          vout: 0xffffffff,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
        } as TxInput,
      ],
      vout: [
        {
          value: 50,
          n: 0,
          scriptPubKey: { asm: "", hex: "", type: "witness_v1_taproot" },
        },
      ],
    });

    assert.equal(computeTxFee(tx), 0n);
  });

  it("handles a burn tx (OP_RETURN output has 0 value)", () => {
    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          prevout: {
            generated: false,
            height: 100,
            value: 0.0001, // 10,000 sats
            scriptPubKey: { asm: "", hex: "", type: "witness_v1_taproot" },
          },
        },
      ],
      vout: [
        {
          value: 0, // OP_RETURN — 0 sats
          n: 0,
          scriptPubKey: { asm: "", hex: "6a26" + "ff".repeat(38), type: "nulldata" },
        },
        {
          value: 0.00002, // 2,000 sats change
          n: 1,
          scriptPubKey: { asm: "", hex: "5120" + "bb".repeat(32), type: "witness_v1_taproot" },
        },
      ],
    });

    // 10,000 - 0 - 2,000 = 8,000
    assert.equal(computeTxFee(tx), 8000n);
  });
});

describe("detector — extractSignerPubkey", () => {
  it("extracts x-only pubkey from P2TR prevout", () => {
    const pubkeyHex = "ab".repeat(32);
    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          txinwitness: ["cc".repeat(64)],
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + pubkeyHex,
              type: "witness_v1_taproot",
            },
          },
        },
      ],
    });

    assert.equal(extractSignerPubkey(tx), pubkeyHex);
  });

  it("returns null for non-Taproot input", () => {
    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "0014" + "bb".repeat(20),
              type: "witness_v0_keyhash",
            },
          },
        },
      ],
    });

    assert.equal(extractSignerPubkey(tx), null);
  });
});

describe("detector — extractWitnessEnvelopes (integration)", () => {
  it("detects a POST envelope in a mock Taproot script-path spend", () => {
    const { privkey } = generateKeyPair();
    const { envelope } = createPostEnvelope(
      privkey,
      "hello indexer",
      "testing",
    );
    const pushes = serializePostEnvelope(envelope);

    const xPubkey = new Uint8Array(32).fill(0x02);
    const script = compileScript([
      xPubkey,
      OP_CHECKSIG,
      OP_FALSE,
      OP_IF,
      ...pushes,
      OP_ENDIF,
    ]);

    const scriptHex = toHex(script);
    const controlBlock = makeFakeControlBlock();
    const fakeSig = "cc".repeat(64);

    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          txinwitness: [fakeSig, scriptHex, controlBlock],
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + "dd".repeat(32),
              type: "witness_v1_taproot",
            },
          },
        },
      ],
    });

    const envelopes = extractWitnessEnvelopes(tx);
    assert.equal(envelopes.length, 1);
    assert.equal(envelopes[0].envelope.type, TYPE_POST);
    assert.equal(envelopes[0].valid, true);
    assert.equal(envelopes[0].envelope.content, "hello indexer");
  });

  it("detects a REPLY envelope", () => {
    const { privkey } = generateKeyPair();
    const parentHash = new Uint8Array(32).fill(0xee);
    const { envelope } = createReplyEnvelope(
      privkey,
      "nice post!",
      parentHash,
    );
    const pushes = serializeReplyEnvelope(envelope);

    const xPubkey = new Uint8Array(32).fill(0x02);
    const script = compileScript([
      xPubkey,
      OP_CHECKSIG,
      OP_FALSE,
      OP_IF,
      ...pushes,
      OP_ENDIF,
    ]);

    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          txinwitness: ["cc".repeat(64), toHex(script), makeFakeControlBlock()],
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + "dd".repeat(32),
              type: "witness_v1_taproot",
            },
          },
        },
      ],
    });

    const envelopes = extractWitnessEnvelopes(tx);
    assert.equal(envelopes.length, 1);
    assert.equal(envelopes[0].envelope.type, TYPE_REPLY);
    assert.equal(envelopes[0].valid, true);
    assert.equal(envelopes[0].envelope.content, "nice post!");
  });

  it("detects multiple envelopes per witness", () => {
    const { privkey } = generateKeyPair();
    const { envelope: e1 } = createPostEnvelope(privkey, "post A", "topic");
    const { envelope: e2 } = createPostEnvelope(privkey, "post B", "topic");

    const p1 = serializePostEnvelope(e1);
    const p2 = serializePostEnvelope(e2);

    const xPubkey = new Uint8Array(32).fill(0x02);
    const script = compileScript([
      xPubkey,
      OP_CHECKSIG,
      OP_FALSE,
      OP_IF,
      ...p1,
      OP_ENDIF,
      OP_FALSE,
      OP_IF,
      ...p2,
      OP_ENDIF,
    ]);

    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          txinwitness: ["cc".repeat(64), toHex(script), makeFakeControlBlock()],
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + "dd".repeat(32),
              type: "witness_v1_taproot",
            },
          },
        },
      ],
    });

    const envelopes = extractWitnessEnvelopes(tx);
    assert.equal(envelopes.length, 2);
    assert.equal(envelopes[0].envelope.content, "post A");
    assert.equal(envelopes[1].envelope.content, "post B");
  });

  it("skips inputs that are not Taproot script-path", () => {
    const tx = makeMockTx({
      vin: [
        {
          txid: "aa".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          txinwitness: ["cc".repeat(64)], // key-path spend: only 1 witness element
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + "dd".repeat(32),
              type: "witness_v1_taproot",
            },
          },
        },
      ],
    });

    assert.equal(extractWitnessEnvelopes(tx).length, 0);
  });
});

describe("detector — extractOpReturns (integration)", () => {
  it("detects a BURN OP_RETURN", () => {
    const targetHash = new Uint8Array(32).fill(0xaa);
    const payload = createBurnPayload(targetHash);
    const opData = serializeBurnOpReturn(payload);

    const spk = new Uint8Array(1 + 1 + opData.length);
    spk[0] = 0x6a;
    spk[1] = opData.length;
    spk.set(opData, 2);

    const tx = makeMockTx({
      vin: [
        {
          txid: "bb".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          prevout: {
            generated: false,
            height: 100,
            value: 0.001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + "dd".repeat(32),
              type: "witness_v1_taproot",
            },
          },
        },
      ],
      vout: [
        {
          value: 0,
          n: 0,
          scriptPubKey: { asm: "", hex: toHex(spk), type: "nulldata" },
        },
        {
          value: 0.00002,
          n: 1,
          scriptPubKey: { asm: "", hex: "5120" + "cc".repeat(32), type: "witness_v1_taproot" },
        },
      ],
    });

    const items = extractOpReturns(tx);
    assert.equal(items.length, 1);
    assert.equal(items[0].payload.type, TYPE_BURN);
    assert.equal(toHex((items[0].payload as { targetHash: Uint8Array }).targetHash), "aa".repeat(32));
    // fee = 100,000 - 0 - 2,000 = 98,000
    assert.equal(items[0].fee, 98000n);
  });

  it("detects a SIGNAL OP_RETURN", () => {
    const payload = createSignalPayload([
      { kind: "text", value: "ocdn" },
      { kind: "text", value: "freedom" },
    ]);
    const opData = serializeSignalOpReturn(payload);

    const spk = new Uint8Array(1 + 1 + opData.length);
    spk[0] = 0x6a;
    spk[1] = opData.length;
    spk.set(opData, 2);

    const tx = makeMockTx({
      vin: [
        {
          txid: "bb".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          prevout: {
            generated: false,
            height: 100,
            value: 0.0001,
            scriptPubKey: {
              asm: "",
              hex: "5120" + "ee".repeat(32),
              type: "witness_v1_taproot",
            },
          },
        },
      ],
      vout: [
        {
          value: 0,
          n: 0,
          scriptPubKey: { asm: "", hex: toHex(spk), type: "nulldata" },
        },
      ],
    });

    const items = extractOpReturns(tx);
    assert.equal(items.length, 1);
    assert.equal(items[0].payload.type, TYPE_SIGNAL);
    assert.equal(items[0].signerPubkey, "ee".repeat(32));
  });

  it("ignores non-ocdn OP_RETURN", () => {
    const fakeData = new Uint8Array(10).fill(0xff);
    const spk = new Uint8Array(1 + 1 + fakeData.length);
    spk[0] = 0x6a;
    spk[1] = fakeData.length;
    spk.set(fakeData, 2);

    const tx = makeMockTx({
      vin: [
        {
          txid: "bb".repeat(32),
          vout: 0,
          scriptSig: { asm: "", hex: "" },
          sequence: 0xffffffff,
          prevout: {
            generated: false,
            height: 100,
            value: 0.0001,
            scriptPubKey: { asm: "", hex: "", type: "witness_v1_taproot" },
          },
        },
      ],
      vout: [
        {
          value: 0,
          n: 0,
          scriptPubKey: { asm: "", hex: toHex(spk), type: "nulldata" },
        },
      ],
    });

    assert.equal(extractOpReturns(tx).length, 0);
  });
});
