# Permissionless Storage Market — Nostr-Native

**Purpose**: A permissionless conviction scoreboard. Sats bind to hashes. Reading is free. Funding is advertising. Four separated roles (store, serve, mint, genesis) ensure no intermediary can redirect economic flows. Settlement divides each mint's pool drain among P participants at parity — coordination earns what one store-shard pair earns. The importance index is the product. The dimensional friction of a deep storage market is the income. The mapping moat deepens with every upload.

---

## Glossary

Terms are defined here once; the rest of the document uses them by reference.

### Roles

| Term | Definition |
|------|-----------|
| **Store** | Bonded operator holding encrypted shards. Earns from pool drain via settlement. |
| **Serve endpoint** | Untrusted delivery pipe (front-end, CDN, proxy). Earns referrer income via `via` tag. No bond required. |
| **Mint** | Bonded operator: holds pool balances, verifies request proofs, collects attestations, issues storage challenges, publishes epoch summaries. |
| **Settler** | Anyone who computes deterministic payouts from epoch summaries. Public service, no bond. |
| **Genesis address** | Protocol constant receiving settlement remainders + sweep + slash. Like the 21M cap — embedded in code, not an authority. |

### Settlement Math

| Symbol | Definition |
|--------|-----------|
| **N** | Shard count. 1 for text (below MIN_FRAGMENT_SIZE), RS_N (20) for documents. |
| **S** | Stores per shard with valid attestations this epoch (market depth of thinnest shard). |
| **K** | Reconstruction threshold: any K of N shards suffice (RS_K = 10). |
| **P** | Participant count = N·S+1. One per store-shard pair, plus one for coordination. |
| **R** | Unique referrer count from valid request proofs this epoch. |
| **Coordination fraction** | 1/P = 1/(N·S+1). Self-regulating: shrinks as market deepens. |
| **Participant parity** | All P participants earn `floor(drain/P)`. Coordination is one of them — priced at parity with one unit of storage labor. |
| **Remainder** | Integer truncation from `floor()` at each division level → genesis. Grows with P. |
| **Inverse size premium** | Text (N=1) has a higher coordination fraction than documents (N=20) at every S. |

Bootstrap reference: At S=1, coordination fraction = 50% for text, 4.8% for documents. At S=3: text 25%, documents 1.6%. At S=10: text 9.1%. See [Settlement Rule](#4-settlement-settler-signed) for canonical pseudocode.

### Content Lifecycle

| Term | Definition |
|------|-----------|
| **Pool** | Sats bound to a content hash. Credits accumulate from fund events; drains pay stores + coordination. |
| **Drain** | Per-epoch outflow from a pool. `epoch_drain = Σ store_claims`. More stores = faster drain. |
| **Sweep** | Pool with no valid attestations for SWEEP_EPOCHS (42 epochs, ~7 days) → entire balance to genesis. |
| **Ghost** | Content whose pool is depleted. Metadata, economic history, edges, and discussion survive on relays. Bytes are gone. `[+] to restore`. |
| **Coverage signal** | Per-content shard store count, published by mints each COVERAGE_BLOCKS (~1h). No store identities. Used by stores for opportunity assessment. |

### Storage & Privacy

| Term | Definition |
|------|-----------|
| **Convergent encryption** | Deterministic encryption: `key = SHA256(CONTENT_KEY_DOMAIN \|\| content_hash)`. Same content → same ciphertext → verifiable without trust. |
| **Blind addressing** | Stores hold shards under random blob IDs, not shard hashes. Mapping registered with mints, never published in cleartext on relays. |
| **Store-blind** | Stores cannot determine what content their fragments represent. Protects against bulk scanning; does NOT protect against targeted identification of known content. |
| **Shard** | One piece of encrypted content. Text = 1 shard (N=1). Documents = N shards via RS erasure coding. |
| **Mapping** | The content_hash → (store, blob_id) association. Four layers: relay-encrypted (durable) → mint cache (fast, PoW-gated) → serve cache (organic) → coverage signals (anonymous counts only). |

### Events

| Term | Definition |
|------|-----------|
| **Fund confirmation** | Bonded mint signs: sats bound to a hash. Published to relays. |
| **Request proof** | Client PoW + Nostr signature + referrer `via` tag. Gates content delivery. Published to relays as demand signal. |
| **Store attestation** | Store signs "I served shard *i* for request *R*." Submitted directly to mint (not relayed). |
| **Epoch summary** | Mint aggregates attestations into canonical settlement input. Hash-chained (`prev` tag). |
| **Settlement event** | Settler publishes deterministic payout computation from epoch summaries. |

### Economic Terms

| Term | Definition |
|------|-----------|
| **Via tag** | Referrer pubkey in request proofs. The front-end that facilitated the request. Earns a coordination sub-share. |
| **Bond** | On-chain BTC UTXO as collateral for stores/mints. `balance(mint) ≤ bond_value(mint)`. |
| **Dwell-based PoW** | Reference client pre-mines request proofs in background; submits on viewport dwell ≥2s. Reading feels instant. |
| **Ephemeral message** | Free Nostr event. Relay-only, no protocol awareness, no pool, no rank influence. Visible as collapsed `+ n` counts. `[+]` upgrades to funded. |
| **Mapping moat** | Content-to-store mappings accumulated inside bonded mints since genesis. A fork must bond a mint to receive gossip — expensive and self-defeating. |

---

## Core Thesis

1. **Spam is a pricing problem** — Mandatory minimum fees filter infinite spam.
2. **Censorship is an availability market** — Replication funded by those who care.
3. **Infrastructure is a commodity** — Borrow it. Nostr relays distribute events. Blossom servers store blobs. Lightning/Cashu handle payments. Nostr keys handle identity. All already deployed, already distributed, already resilient.
4. **The protocol is a storage market; the index is the product** — The protocol clears payments between funders and stores. The importance index is a product built on the market's public data. The protocol is plumbing; the index is the shopfront. The two axes — commitment (pool balance) and demand (request proof velocity) — are independent measurements. Their divergence IS the signal. No other system produces both.
5. **The hierarchy is append/promote-only** — Content, topics, and discussion form a graph. Nodes are added (append) or funded (promote). Nothing is edited, deleted, or hidden at the protocol level. Loss is an explicit, auditable state — the pool exists, the request proofs existed, the bytes are gone. Every other information system makes loss silent. This one makes loss visible, attributable, and economically actionable.
6. **Store-blind storage** — Stores hold encrypted, erasure-coded shards under random blob IDs. They cannot determine what content their fragments represent.

   **How it works**: Convergent encryption makes shards deterministic for verification; blind addressing breaks the public content_hash → store link. Mappings are gated behind request proofs (see Glossary: Mapping). Coverage signals let stores see opportunity without learning store identities.

   **Privacy boundary**: Store-blindness protects against **bulk scanning** — PoW cost scales linearly with scan breadth, making untargeted fishing expeditions expensive. It does NOT protect against **targeted identification** of known content — an adversary who possesses the plaintext can derive the content hash, generate one request proof (~200ms), and discover stores. Censorship resistance against targeted action comes from redundancy + jurisdiction diversity + economic replacement incentive, not from encryption alone.

   **Store posture**: Attestations go direct to mint (see Glossary: Store attestation) — stores never appear in public events by real pubkey. Zero editorial decisions: software selects shards by economic signal, not by content. Storage is a commodity: bytes in, sats out.

   **Legal posture**: Generic encrypted blob cache — cannot decrypt, cannot identify content, no public record linking to specific content, complies with blob-ID removal on valid legal order.

   **Censorship resistance**: Requires taking down more than N-K stores across jurisdictions simultaneously, while economic incentives actively recruit replacements. The adversary's takedown action increases per-store payout, advertising the opportunity to replacement stores. The system channels self-interest (stores want sats, funders want permanence, readers want signal) into collective censorship resistance.
7. **Resilience is a property of greed, not architecture** — The protocol doesn't specify redundancy. It makes storage profitable and anonymously operable; serving is a separate, permissionless role earning via the via tag. Stores watch coverage signals for undercovered funded content, mirror shards, earn sats. Censoring content increases per-store payout, attracting replacements. The adversary fights economic gravity.
8. **The genesis address is a protocol constant** — Not an authority, not a delegation root, not a key that controls anything. Receives remainder by the math, not by any operational role (see Glossary: Genesis address).

   **Permissionless mints**: Bonded (on-chain UTXO), not genesis-delegated — anyone can become a mint by posting a verifiable bond.

   **Fork resistance**: Forking the income requires changing one constant in settler code — but accessing mappings requires bonding a mint to receive gossip, which is expensive and self-defeating (that mint earns from the original protocol). The mapping moat deepens with every upload.
9. **The founder's income is proportional to settlement dimensionality** — Each mint settles independently. Remainder grows with P (see Glossary: Remainder). Every architectural improvement that makes the system more robust also increases P and the coordination subdivision count. See [Settlement Rule](#4-settlement-settler-signed).

   **Passive by construction**: No fee. No rate. The income is the irreducible coordination cost of multi-party integer settlement, embedded in the math that independent settlers run.
10. **Coordination costs one participant** — Participant parity: coordination earns what one store-shard pair earns (see Glossary: Participant parity). Counter-cyclical: during booms (high S), value flows to stores; during busts (low S), value flows to coordination. Within coordination: mints earn because they verify, referrers because they distribute, genesis earns a share plus all sub-remainders.
11. **The moat is compound: four layers** — (a) The mapping moat: accessing mappings requires bonding a mint (see Glossary: Mapping moat). (b) The math moat: genesis address is a protocol constant in settler code. (c) The traffic moat: reference client hardcodes the founder's via tag. (d) The deposit moat: reference client defaults to the founder-bonded mint. Each layer is individually surmountable; collectively they require re-bootstrapping the entire system.
12. **Funding is advertising** — Funders pay for availability and visibility. Readers consume for free. This is advertising economics: the person who wants attention pays, the person who has attention consumes for free. Free distribution maximizes the audience that makes funding valuable. Conviction spending is the revenue. Free reading is the amplifier.
13. **The system optimizes for contested content** — Uncontested content is funded once. Contested content is funded repeatedly by competing sides. Competitive dynamics drive repeat funding — the highest-velocity economic behavior in the system. The founder earns from the froth of disagreement, not from any position. Free reading amplifies this: everyone sees the scoreboard, everyone can take a side.
14. **The protocol is four event types and one rule** — Fund confirmation, request proof, store attestation, settlement (see Glossary: Events). Rule: unclaimed drain → genesis; pools with no attestations for SWEEP_EPOCHS → sweep. Everything else is a product concern or emergent market property.
15. **The network metabolizes failed attention bids** — Self-promoters fund their own content. If nobody reads it, sats sweep to genesis. Contested content produces remainder income (active market). Ignored content produces sweep income (failed attention bid). Both modes pay genesis. The total addressable revenue is all inflow.
16. **The protocol settles; the product interprets** — Settlement is narrow, deterministic, and hard to game (requires real sats, real storage, real bonds). The importance index is broad, interpretive, and soft-gameable — but also forkable, competitive, and improvable without protocol changes. Most attacks target the index. The index is the expendable layer. Settlement — where the money flows — is robust. Attacks on interpretation don't corrupt settlement. Attacks on settlement require real capital at risk.
17. **All funded content is stored; text conviction is the highest-margin income at bootstrap** — All funded content is stored as encrypted shards. Unfunded ephemeral messages live on relays only (see thesis 18).

    **Uniform storage**: Text stores as N=1 shards, documents as N=RS_N. The protocol makes no distinction — the inverse size premium emerges from the settlement math (see Glossary).

    **Text as revenue engine**: Small-drain, high-volume — where remainder is most significant relative to drain. The froth of competing ideologies is almost entirely text. At scale, text income transitions from coordination share (low S) to remainder (high S).

    **Escalation path**: Text claims → document evidence is the value creation moment. Sweep catches truly abandoned pools.
18. **Two metabolisms: free discourse, funded signal** — Ephemeral messages are regular Nostr events — free, relay-dependent, zero protocol awareness, visible as collapsed `+ n` counts. `[+]` upgrades to the funded layer. The free layer is the discourse substrate (volume, whistleblowers, the 4chan energy). The funded layer is the conviction signal. The divergence between free volume and funded persistence is itself a signal axis no other system produces. Ephemeral messages don't influence the importance index. The free layer solves cold start; the funded layer solves quality.
19. **Honest-minority resilience** — The protocol's durability depends on honest minorities, not honest majorities.

    **Discovery layers** degrade gracefully through the four mapping layers (see Glossary: Mapping). Relay-encrypted mappings are durable and mint-independent. Mint cache is fast and request-proof-gated. Serve caches are organic. Coverage signals are anonymous.

    **Honest-minority thresholds**: One honest relay = discoverable. One honest store per shard = available. One honest mint = deposits accepted. Total failure requires ALL roles to fail simultaneously. Mints exit without mapping loss — the relay layer survives them.

    **Attestation integrity**: Stores broadcast attestations to ALL bonded mints — omission by one mint is detectable via cross-mint epoch summary comparison. Storage challenges are permissionless.

---

## What This System Invented

Seven things no existing system provides:

1. **A pool attached to a hash** — money bound to content identity, not to an author or server
2. **Request proofs as demand signal** — PoW-gated request proofs gate content delivery, ensuring every read produces a verifiable demand signal. The `via` tag attributes distribution to the front-end that facilitated the request
3. **Pool drain to proven stores** — stores earn from pools proportional to proven storage of consumed content
4. **Participant parity** — coordination costs one participant's share at parity with storage labor (see Glossary)
5. **The importance index** — the ranking derived from 1-3: commitment × demand × centrality
6. **Accountable loss** — every node that ever existed leaves a permanent economic trace (pool events, request proofs, settlements, Bitcoin anchors). Loss is a first-class state: the record survives the bytes. No other system distinguishes "never existed" from "existed and was lost"
7. **Multi-party request-attestation binding** — each participant signs their own part of the composite receipt (client signs request proof, store signs attestation direct to mint). No intermediary can redirect economic flows

Everything else is borrowed infrastructure.

---

## Architecture

### Four Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  INDEX (the product)                                            │
│  Materializer reads market data from relays, computes rankings, │
│  serves feed/API/widget. Anyone operates. Forkable.             │
├─────────────────────────────────────────────────────────────────┤
│  STORAGE (borrowed — Blossom) + SERVING (untrusted, separated)  │
│  Stores hold shards, prove possession to mints, earn from pools.│
│  Serve endpoints deliver bytes to users. Any front-end/CDN.     │
│  Stores are bonded. Serve endpoints are permissionless/unpaid.  │
├─────────────────────────────────────────────────────────────────┤
│  EVENTS (borrowed — Nostr)                                      │
│  All market activity is public signed events on relays.         │
│  Fund events, request proofs, settlements — all verifiable.     │
│  Store attestations go direct to mint (not relayed publicly).   │
├─────────────────────────────────────────────────────────────────┤
│  MONEY (bonded mints — genesis address as protocol constant)    │
│  Mints hold pool balances, verify request proofs + attestations,│
│  issue storage challenges, execute payouts. Permissionless      │
│  entry via on-chain bond. Multi-jurisdiction. Custodial.        │
└─────────────────────────────────────────────────────────────────┘
```

### Four Protocol Roles

| Role | Entry | Earns from protocol | Trust required |
|------|-------|---------------------|----------------|
| **STORE** | On-chain bond | Yes — storage shard drain via settlement | Bonded, mint-challenged, peer-verified |
| **SERVE** | None | Yes — referrer income via via tag | **None — untrusted delivery pipe** |
| **MINT** | On-chain bond | Yes — coordination share + bond slash income | Bonded, auditable |
| **SETTLER** | None | None (public service) | Deterministic, auditable by anyone |

### Unbundled Mint Functions

The bonded mint bundles six logically separable functions. Unbundling clarifies trust requirements and enables honest-minority resilience:

| Function | What it does | Trust model | Honest-minority property |
|----------|-------------|-------------|-------------------------|
| **Custody** | Holds pool sats across epochs | Custodial (bond = ceiling) | Per-mint: one honest mint = its deposits safe. Deposit splitting across 2+ mints makes loss proportional, not binary. |
| **Privacy bridge** | Maps content_hash → (store, blob_id) | Trusted not to leak | Three-layer fallback: mints → serve caches → relay-encrypted mappings. One honest relay = discoverable. |
| **Discovery gate** | Serves mappings to clients with valid request proofs | Trusted to respond | Any mint, any serve cache, or relay-encrypted mapping can serve discovery. |
| **Challenge authority** | Issues storage challenges to stores | Permissionless — anyone can challenge | One honest challenger = storage fraud detected. Mints challenge by default; independent challengers supplement. |
| **Attestation collector** | Receives store attestations (private channel) | Trusted not to omit (receipts + fraud proofs) | Stores broadcast to ALL bonded mints. Omission detectable via cross-mint comparison. |
| **Epoch summarizer** | Aggregates attestations into settlement input | Bonded, auditable | One honest mint = correct summary for its deposits. Cross-settler verification catches discrepancies. |

A single operator runs all six in practice. The decomposition ensures that no single function's failure is catastrophic — each has an independent fallback path.

### Communication Channels

```
CLIENT ─────────────────→ MINT          discovery (request-proof-gated, returns store locations)
CLIENT ←→ SERVE ENDPOINT ←→ STORES     delivery channel (front-end lives here; serve caches locations)
CLIENT ─────────────────→ RELAYS        request proofs (public demand signal)
STORES ─────────────────→ MINT          attestations + mapping registration (private, bypasses front-end)
MINT   ←───────────────→ STORES        storage challenges (direct, out-of-band)
MINT   ←───────────────→ MINT          mapping gossip (cross-mint replication of store locations)
MINT   ─────────────────→ RELAYS        coverage signals (per-content shard store counts — no store IDs)
```

**Four mapping layers** (degrading privacy, increasing availability — see also Glossary: Mapping):

1. **Relay-encrypted mappings (mandatory, durable)** — mints MUST publish on every store registration: `encrypt(store_endpoint || blob_id, key=HKDF(content_hash || shard_index, "discovery-v1"))`. Anyone with the content_hash can derive the key. No mint needed. Survives mint exits/crashes. Clients SHOULD re-publish on successful reconstruction (belt-and-suspenders). Privacy cost: adversary with content_hash discovers stores without PoW gate, marginal vs. state-actor class.
2. **Mint cache (fast, private)** — actual store locations, request-proof-gated, replicated via gossip. Any mint can serve discovery for any content. Rebuilds from relay events + gossip on restart.
3. **Serve-layer cache** — organic fallback from prior reads, proportional to content popularity. No privacy guarantee, no mint dependency.
4. **Coverage signals** — per-content shard store counts on relays each COVERAGE_BLOCKS, no store identities. Enables supply response, not a discovery layer.

Mints are a discovery cache — the relay layer is the source of truth. Economic signaling (request proofs, attestations, challenges) flows through channels the front-end cannot intercept. The front-end's economic role is bounded to coordination (see Trust Assumptions).

### What's Borrowed

| Layer | Provider | Already deployed |
|-------|----------|-----------------|
| Event distribution | Nostr relays (hundreds, multi-jurisdiction) | Yes |
| Blob storage | Blossom servers (BUD-01 through BUD-06) | Yes |
| Identity / keys | Nostr Ed25519 keys + NIP-07 browser extensions | Yes (millions of users) |
| Payment rails | Lightning (Zaps), Cashu (bearer tokens) | Yes |
| Discovery | Nostr relay subscriptions + kind 10063 | Yes |

### What's Built

| Component | Layer | Purpose |
|-----------|-------|---------|
| **Convergent encryption + deterministic RS** | Protocol | Content key = SHA256(domain \|\| content_hash). RS(K,N) over GF(2^8) with pinned generator polynomial and canonical shard ordering. Shard hashes are deterministic for verification — no manifest trust surface. **Canonical RS implementation**: protocol ships a single WASM encoder/decoder (~2-5KB compiled). Content-hash of the WASM binary (`RS_WASM_HASH`) is a protocol constant. Every client, store, and settler loads the same binary — no independent reimplementation. Shard identity is load-bearing for convergent encryption; one wrong byte = content unrecoverable, silently, with no fraud proof possible. Test vectors (10 included) are regression tests for the one implementation, not interop tests across N implementations. Upgrading the encoder = new WASM hash = protocol version bump. The zlib pattern: spec exists for auditability, everyone runs the same code. |
| **Blind addressing + relay-durable mapping** | Protocol | See Glossary: Blind addressing, Mapping. Four mapping layers with relay-encrypted events as durable source of truth. |
| **Coverage signal event** | Protocol | See Glossary: Coverage signal. The gap between "how many" and "which ones" is the privacy boundary. |
| **Fund confirmation event** | Protocol | Bind sats to content hash (bonded mint-signed). See §1. |
| **Request proof event** | Protocol | Client PoW + Nostr signature + via tag. Gates delivery, published as demand signal. See §2. |
| **Store attestation** | Protocol | Store proves shard service for a specific request. Direct to mint. See §3. |
| **Settlement event** | Protocol | Per-mint deterministic payout across P participants. See §4. |
| **Storage challenge protocol** | Protocol | Permissionless — anyone can challenge (no bond needed). Random byte offsets + Merkle proofs, latency-tested. Failure → lose epoch earnings. Repeated failure → bond slash. |
| **Cross-store verification** | Protocol | Block-hash-assigned per-epoch peer verification. Earning requires proving own storage AND verifying a peer. |
| **Attestation broadcast** | Protocol | Stores submit to ALL bonded mints (O(M), M small). Omission detectable via cross-mint comparison. Receipts enable fraud proofs. |
| **Bonded mint registration** | Protocol | On-chain UTXO bond. Permissionless. Fraud proof → bond slashed to genesis. |
| **Fraud proof event** | Protocol | Anyone can publish provable evidence of mint/store misbehavior → triggers bond slash |
| **`ocdn-store` daemon** | Product | Commodity storage: watches coverage signals on relays for undercovered shards, stores encrypted shards, registers mapping with mint (gossip replicates), responds to mint challenges, attests to mint, cross-verifies peers, earns BTC. Zero editorial decisions. `docker run` entry point. |
| **Importance index** | Product | Rankings, feed, API, widget. Anyone operates. |
| **OG image endpoint** | Product | Cloudflare Worker renders live scoreboard snapshots for social sharing. Stateless, serve-layer. The viral loop. |
| **Clearinghouse** | Product | Preserve/offer order matching |
| **`ocdn-pack`** | Product | Deterministic tar (`--sort=name --mtime=0 --owner=0 --group=0`). Same tree → same hash → convergent encryption composes. Any file tree becomes one funded document (N=RS_N). 10× efficiency vs individual small files. |
| **HTTP gateway** | Product (serve layer) | HTTP ↔ OCDN. Reconstructs archives, serves files. Earns via via tag. Vanity domains via DNS TXT or Nostr kind. Enables self-hosting. ~500 lines. |

### Trust Assumptions

- **Custodial trust (bond = custody ceiling)**: Bonded mints hold pool balances. Irreducible — sats that persist across epochs and pay multiple parties over time require custody. **Protocol rule: `balance(mint) ≤ bond_value(mint)`.** The bond is not a fixed entry cost — it is the maximum custodial capacity. Deposits that would exceed the ratio are rejected; the client routes to the next mint. Mints compete for deposits by posting larger bonds: larger bond → more capacity → more deposits → more coordination income. Net gain from theft is zero or negative (bond forfeited ≥ balances stolen). All custody operations are auditable from public events.
- **Founder operates nothing post-launch.** No operational role, no delegation authority, no admin key. All roles operated by independent actors.
- Independent operators run: bonded mints, stores, serve endpoints, settlers, importance indexes
- All settlement is deterministic and auditable — settlers query mints directly for epoch summaries, each per-mint settlement is independently verifiable, anyone can recompute from day 1
- **Competing settlers, competing mints, and competing importance indexes are permitted and encouraged from day 1**
- **Store liability isolation**: Store-blind (see Glossary). Legal posture: generic encrypted blob cache. Blob-hash removal on valid legal order (safe harbor). System heals through replacement — compliance and censorship-resistance are independent properties.
- **Serve endpoint isolation**: Serve endpoints earn via the via tag but cannot redirect store income — multi-party binding (see §3) prevents it. The front-end's economic role is bounded to coordination.

### Symbiosis

- **Blossom servers** have no revenue model → store economy gives them pool income
- **Relay operators** have no sustainability path → economically meaningful events create traffic worth persisting
- **Nostr clients** have no economic ranking signal → importance scores are a new feature any client can subscribe to
- **VPS operators / homelabbers** have idle disk and bandwidth → `ocdn-store` daemon converts latent storage into BTC income with zero content liability
- **Front-end operators** have audiences but no economic layer → serve endpoints earn via the via tag. Better UX → more traffic → more referrer income. Composable with ads or venue fees
- **Positive-sum**: the economic layer makes the Nostr layer more sustainable; the Nostr layer makes the economic layer more resilient.

---

## Protocol: Four Event Types

### 1. Fund Confirmation (bonded mint-signed)

A three-step process: (1) funder deposits sats to a bonded mint, (2) mint verifies shard integrity, (3) mint publishes a signed confirmation event to relays.

**Step 1 — Deposit** (private, off-relay): Funder sends sats to a mint via Lightning invoice or Cashu P2PK transfer locked to the mint's pubkey. The reference client defaults to splitting deposits across 2+ bonded mints (round-robin via `DEPOSIT_SPLIT_MIN`). Per-mint custody risk becomes proportional, not binary — one honest mint = its fraction of deposits safe. The mint credits the pool on its internal ledger. No bearer tokens are published on relays.

**Step 1b — Upload verification** (private, off-relay): Mint verifies shard integrity before confirming. Uploader submits K shards + content_hash. Mint decrypts, reconstructs, checks `SHA256(plaintext) == content_hash`. If invalid, deposit is rejected. Prevents free griefing — without this, an adversary can fund garbage shards that stores blindly mirror, making content unrecoverable despite a funded pool. Cost: ~100ms compute per upload (decrypt + hash check). For large documents, the mint verifies a random subset of shard Merkle roots against the deterministic expected values.

**Step 2 — Confirmation** (public, on-relay):
```
kind: NIP_POOL_KIND (non-replaceable, 1000-9999 range)
pubkey: mint_pubkey                      # bonded mint signs
tags:
  ["v", "1"]                             # protocol version — explicit from day one
  ["r", "<sha256>"]                      # content hash (the pool key)
  ["amount", "<sats>"]                   # sats confirmed
  ["funder", "<funder_pubkey>"]          # who deposited (ephemeral key OK)
  ["seq", "<monotonic_sequence>"]        # per-mint sequence number for canonical ordering
  ["bond", "<bond_utxo_ref>"]           # proves mint bonded (on-chain verifiable)
  ["meta:title", "<title>"]              # optional — content identity for graceful degradation
  ["meta:type", "<mime_type>"]           # optional — survives content death on relays
  ["meta:size", "<bytes>"]              # optional
content: optional JSON (metadata)
sig: mint signature
```

**Pool key** = SHA256 hash. Protocol doesn't care what it references — it credits and drains. All nodes are identical at the protocol level: hash + pool. The only variation is what the hash references and whether any store can serve bytes for it:

| Node type | Pool key | N |
|-----------|----------|---|
| **Document** | SHA256 of file bytes | RS_N (20) |
| **Claim** | SHA256 of claim text | 1 |
| **Topic** | SHA256 of topic string | 1 |
| **Reply** | SHA256 of reply text | 1 |
| **Edge** | SHA256 of rel \|\| hash_A \|\| hash_B | 1 |

The protocol makes no distinction — all content is stored, all settlement follows participant parity (see Glossary). N=1 content has the inverse size premium (see Glossary). `meta:*` tags travel with fund events on relays for discoverability and graceful degradation — content itself is stored, not relayed.

**Upgrading ephemeral messages**: `[+]` on an ephemeral event triggers four atomic operations: (1) hash, (2) deposit to mint, (3) encrypt + upload initial shard to Blossom, (4) register mapping with mint. Content then exists in three locations: original Nostr event (relay-dependent), encrypted shard (pool-funded), fund event `meta:*` tags (relay-dependent). Stores see the opportunity via coverage signals, replicate, start earning.

**Re-funding after sweep**: A swept pool is zeroed, not destroyed. The hash persists on relays (ghost state). Re-funding the same hash credits the same pool — the claim reappears on the leaderboard at its new balance. The economic history (previous funding rounds, sweep events, edges, replies) is permanent. Each funding cycle is visible: "funded 3 times, swept twice, currently live." Repeat funding of discourse is the primary revenue behavior — the protocol makes it a single tap on a ghost.

**Anonymous funding**: Funder deposits via Cashu P2PK using an ephemeral pubkey. The mint confirms the deposit without knowing who sent it. Irrevocable AND unattributable.

**Metadata for graceful degradation**: When content bytes die (ghost state — see Glossary), the economic history, edges, discussion, and `meta:*` tags persist on relays.

### 2. Request Proof (client-signed, public)

A PoW-gated request that gates store discovery and content delivery. Clients present request proofs to the mint to discover store locations; stores will not serve shards without a valid request proof. Every read generates a demand signal by construction — no silent consumption.

```
kind: NIP_REQUEST_KIND (non-replaceable, 1000-9999 range)
pubkey: client_pubkey                   # client Nostr key (NIP-07)
tags:
  ["v", "1"]                            # protocol version
  ["r", "<content_hash>"]              # what the client wants to consume
  ["pow", "<nonce>", "<pow_hash>"]     # anti-sybil (reading is free, PoW prevents abuse)
  ["epoch", "<epoch_number>"]
  ["via", "<referrer_pubkey>"]         # front-end that facilitated this request (earns coordination share)
content: ""
sig: client signature (NIP-07)
```

**All content is store-gated.** Request proofs gate delivery for all content types — stores verify PoW + signature + epoch before serving any shard. The front-end requests the signature via NIP-07 but cannot modify `content_hash` — the extension shows what it's signing.

**Dwell-based PoW** (reference client implementation): The client pre-mines request proofs in a background Web Worker as content enters the viewport. For text content (leaderboard cards, claims, replies), proofs are submitted on dwell — visible and paused ≥2s — ensuring demand signal reflects actual reading, not scroll-by. For documents, proofs submit on tap. Reading feels instant; PoW is invisible infrastructure. Pre-mined but unused proofs are discarded (no wasted signal, modest wasted compute).

**Ephemeral keys (privacy by default)**: The reference client defaults to ephemeral keys for request proofs — a fresh key per session, unlinkable to the reader's main Nostr identity. Readers who want a consumption credential (agents, researchers) opt in to identified proofs signed by their main key. Sybil risk from ephemeral keys affects only the index (display layer), not settlement (economic layer) — drain is gate-triggered by the existence of valid request proofs, not count-triggered by their volume. The index can weight commitment (sats, unsybilable) over demand (request proofs, sybilable).

**Referrer (`via` tag)**: See Glossary: Via tag. Forgery is unprofitable — you can't profit without generating real consumption (valid request proofs + store attestations). The reference client hardcodes the founder's pubkey.

**Published to relays**: Request proofs are the public demand signal. The importance index reads them. Settlers count them. Anyone can verify PoW + signature.

### 3. Store Attestation (store-signed, direct to mint)

After serving a shard in response to a valid request proof, the store signs an attestation binding itself to the specific request and submits it **directly to the mint** — not through the front-end, not published on relays.

```
store → mint (direct channel):
  request_hash: hash(request_proof_event)    # binds to specific client request
  store_pubkey: store's bonded pubkey
  shard_index: which shard was served (0..N-1)
  response_hash: SHA256(bytes_served)        # proves correct shard bytes
  epoch: epoch_number
  sig: store signature
```

**Why direct to mint, not relayed**: Store attestations contain the store's real pubkey and the shard index — publishing them would link store identity to content identity. The direct-to-mint channel preserves store blindness in the public record. The mint aggregates attestations into epoch summaries for settlers.

**Mint-canonical epoch assignment**: The mint assigns attestations to epochs based on the block height at the time the mint *received* the attestation. Stores include their proposed epoch; the mint overrides on disagreement (block propagation delay can cause store/mint to see different epoch boundaries). The mint's epoch summary is canonical for all attestations it contains — settlers need no knowledge of block propagation timing.

**Multi-party binding**: The attestation contains `request_hash` — cryptographically chained to the client's signed request proof. The front-end cannot redirect store income:
- The client signed the request including `via` tag (NIP-07 — front-end can't forge a different referrer)
- The store signed the attestation (store's private key — front-end can't forge)
- The store submitted the attestation directly to the mint (front-end can't intercept)

**Consumption flow**: (1) Client signs request proof via NIP-07 (includes `via` referrer tag set by front-end). (2) Client presents request proof to mint; mint verifies PoW + signature + epoch and returns store locations (blob_ids + endpoints) for the requested content. (3) Request reaches store (through any serve endpoint / front-end / proxy). (4) Store verifies PoW + client signature + epoch. (5) Store serves shard (opaque encrypted blob — store never learns content identity). (6) Store signs attestation binding itself to this request. (7) Store submits attestation to mint directly. (8) Client receives shard, verifies hash, reconstructs content from K shards. (9) Client publishes request proof to relays (public demand signal — includes referrer attribution).

**Verification**: O(1). `Ed25519_verify(attestation, store_pubkey)` + `bond_check(store_pubkey)` + `request_hash matches valid request proof`.

**Attestation receipt**: Mint returns a signed acknowledgment on attestation delivery: `ack(attestation_hash, epoch, mint_sig)`. Store retains the receipt. If the mint's epoch summary omits an acknowledged attestation, the store publishes `(attestation, ack)` as a fraud proof → selective omission is provable → bond slash. Without receipts, a mint can silently drop attestations with no recourse.

### Epoch Summary (bonded mint-signed)

Mints publish epoch-aggregated summaries — the canonical settlement input.

```
kind: NIP_EPOCH_SUMMARY_KIND
pubkey: mint_pubkey                      # bonded mint
tags:
  ["v", "1"]                             # protocol version
  ["epoch", "<epoch_number>"]
  ["prev", "<prev_epoch_summary_event_id>"]  # hash chain — settler convergence + fork/gap detection
  ["request_count", "<n>"]              # unique request proofs verified
  ["content_totals", "<content_hash>", "<request_count>", "<unique_clients>"]
  ["store_totals", "<store_count>", "<attestation_count>"]  # aggregate only — no individual store IDs in public events
  ["challenge_results", "<passed>", "<failed>"]  # storage challenge summary
  ["seq", "<monotonic_sequence>"]
  ["bond", "<bond_utxo_ref>"]
sig: mint signature
```

**Why summaries**: Individual request proofs are signed by clients (unbounded, non-enumerable on relays). Epoch summaries are signed by bonded mints (bounded, enumerable, gap-detectable via `seq`). The `prev` tag creates a per-mint hash chain — settlers detect gaps (missing summaries), forks (conflicting summaries at the same `seq`), and converge by collecting all chains to the current epoch. Two settlers that see the same hash chains produce the same settlement. Conflicting summaries at the same `seq` are a double-sign → fraud proof → bond slash. Individual store identities never appear in public events — the mint resolves store pubkeys for payout internally.

### 4. Settlement (settler-signed)

A service that subscribes to fund confirmation + epoch summary events, computes epoch payouts, publishes settlement.

```
kind: NIP_SETTLE_KIND
pubkey: settler
tags:
  ["v", "1"]                             # protocol version
  ["epoch", "<epoch_number>"]
  ["store", "<store_pubkey>"]
  ["r", "<sha256>"]
  ["reward", "<sats>"]
  ["residual", "<sats>"]               # unclaimed → genesis address
  ["epoch_summary_refs", "<event_ids>"]
  ["input_set", "<hash>"]               # SHA256(sorted epoch_summary_event_ids) — settler convergence proof
content: JSON settlement details
sig: settler signature
```

**The settlement rule** (per-mint, participant parity with coordination subdivision):

Each mint settles independently — no cross-mint join. Settlers query each bonded mint directly for its epoch summary. A settler that reaches mint M produces a deterministic settlement for M regardless of whether it has reached mint N. Settlement events are additive: each per-mint settlement is independently final; missing mints are filled in when available.

```
for each mint m:
  for each content_hash cid where m holds balance AND has valid attestations this epoch:
    mint_drain = drain(m, cid, epoch)                          # from attestations submitted to THIS mint

    # Participant parity: P = N·S+1 participants (N·S store-shard pairs + 1 coordination).
    # S = min stores with valid attestations across shards (market depth of thinnest shard).
    N = shard_count(cid)                                       # 1 for text, RS_N for documents
    S = min(len(stores_with_valid_attestations_AND_storage_proofs(s, m, epoch)) for s in 0..N-1)
    if S == 0: continue                                        # no service, no drain
    P = N * S + 1
    participant_unit = floor(mint_drain / P)
    remainder_p += mint_drain - (P × participant_unit)         → GENESIS_ADDRESS

    # Coordination: 1 participant_unit, subdivided among market participants
    coord_drain = participant_unit
    referrers = unique_via_pubkeys_from_valid_request_proofs(cid, epoch)
    coord_participants = 1(mint m) + len(referrers) + 1(genesis)  # R+2
    per_coord = floor(coord_drain / coord_participants)
    remainder_coord += coord_drain - (coord_participants × per_coord) → GENESIS_ADDRESS
    payout(mint m) += per_coord
    for each referrer r in referrers:
      payout(r) += per_coord
    payout(genesis) += per_coord + remainder_coord             # share + sub-remainder

    # Storage: each store-shard pair earns 1 participant_unit
    for each shard s in 0..N-1:
      for each store st in stores_with_valid_attestations_AND_storage_proofs(s, m, epoch):
        payout(st) += participant_unit

genesis_total = remainder_p + remainder_coord
             + coordination_shares

# Abandoned pools sweep to genesis
if no_valid_attestations(cid, last_N_epochs):
    sweep(pool[cid]) → GENESIS_ADDRESS
```

**Earning requires BOTH demand AND proven storage**: A store earns for a shard only if (1) it submitted a valid attestation for a valid request proof this epoch AND (2) it passed the mint's storage challenge for that shard this epoch. Attestation without storage proof = invalid (prevents proxy-only stores). Storage proof without attestation = no demand signal (content not consumed).

**Participant parity**: See Glossary. The pseudocode above is canonical. Bootstrap reference numbers are in the Glossary. The counter-intuitive property: remainder grows with P, so at high market depth, integer friction becomes a significant genesis income source.

No mandated drain rate. Drain = sum of valid store claims. Content below MIN_FRAGMENT_SIZE settles as N=1.

**Per-mint independence**: Each pool-CID-mint triple tracks its own balance. The mint that confirmed the deposit handles claims against that balance. No cross-mint coordination needed. Each mint's settlement is a closed computation — a settler needs only that mint's epoch summary to produce a deterministic result.

**Settlers query mints directly**: Settlers fetch epoch summaries from bonded mints' endpoints, not from relays. Mints are a bounded, enumerable set (bond registration includes endpoint). Relays carry epoch summaries for public auditability but are not on the settlement critical path. Each per-mint settlement event is independently final. Missing mints are filled in when their summaries become available. The `prev` hash chain on epoch summaries makes each mint's history self-proving — a new settler reconstructs any mint's complete history by following the chain backward from the latest summary.

**Payout accumulation**: Lightning payouts batch when accumulated balance crosses `PAYOUT_THRESHOLD`. Sub-threshold amounts accumulate across epochs. Standard in mining pools. Bond covers all accumulations (see Glossary: Bond).

**Properties**:
- Deterministic: same epoch summary → same settlement. Anyone can verify.
- Per-mint decomposition: no cross-mint join.
- Epochs by block height (EPOCH_BLOCKS). Mint-canonical epoch assignment.
- Settlement merkle root anchored via OpenTimestamps.
- Multiple settlers cross-verify via `input_set` convergence tag.
- Mint liveness: missing MAX_SILENT_EPOCHS summaries → bond slash.
- All events carry `["v", "1"]` version tag.

---

## The Storage Market

The protocol is a market. Demand side: funders. Supply side: stores. Clearing mechanism: request proofs, store attestations, and settlement. The depth of this market determines protocol health AND founder income.

### Reading is Free; Funding is Advertising

Readers consume at zero cost (PoW-gated). Serve endpoints deliver and earn via the via tag. Stores earn from pools for proven storage of consumed content. Popular content drives faster drain but attracts more funders (visibility drives conviction). The market equilibrates: storage costs scale with demand, funding scales with visibility.

### Demand Signal

Pool balance, request proof volume, and coverage signals are all public. A hash with 100K sats and zero stores on shard 4 is a visible opportunity. Demand signal is reliable by construction — delivery is request-proof-gated, so every read produces a verifiable signal.

### Supply Response

Stores read coverage signals for undercovered funded content. Mirror shards, register mapping with any bonded mint (gossip replicates), pass challenges, earn. No registration beyond posting a bond. See opportunity, store bytes, get paid.

### Price Discovery

Stores declare rates. Cheap stores attract more content. Expensive stores serve premium (jurisdiction diversity, SLA, speed). Content naturally migrates to the cheapest adequate store. The market determines drain rate, durability, and redundancy. No protocol parameters needed.

### Drain

```
epoch_drain(cid) = Σ store_claims(cid, epoch)
```

More stores = faster drain = shorter durability = more funding urgency = more deposits. Fast drain means an active, healthy market. Stores compete on price; competition compresses rates over time, making content more durable — an emergent anti-decay force.

**Drain rate floor**: `MIN_DRAIN_RATE` (protocol constant, e.g., 1 sat/shard/epoch) prevents market equilibrium from converging to near-zero throughput. Without a floor, store competition compresses rates indefinitely → drain slows → pool duration increases → re-funding urgency drops → genesis income starves. The floor ensures genesis income has a minimum proportional to stored content count, independent of how efficiently stores compete. Content below the floor effectively decays at a fixed calendar rate — the irreducible cost of persistence.

### Degradation

Market-driven, no parameters:

1. **Fully funded**: Multiple stores, multiple jurisdictions. Content available and redundant.
2. **Thinning**: Expensive stores evict first. Cheapest stores remain. Fewer replicas.
3. **Last store**: Single point of failure. Index shows warning.
4. **Dead**: No stores. Bytes gone. Ghost persists on relays — full metadata (`meta:*` tags), economic history (funding events), citation graph (edges), discussion (replies). `[+] to restore`. For content upgraded from ephemeral, the original Nostr event may still exist on relays — an independent recovery source that doesn't depend on the storage market. The client re-hashes the relay plaintext, verifies the content hash matches, re-encrypts, and re-uploads the shard.
5. **Restored**: Someone re-funds. A store sees the opportunity, mirrors shards, starts earning. The gap in the record is permanent and visible.

### Coverage Signal Frequency

Coverage signals are decoupled from settlement: every COVERAGE_BLOCKS (~1h) vs. EPOCH_BLOCKS (~4h). Faster opportunity signals, no increase in settlement complexity.

### Market Depth = Founder Income

Genesis remainder scales with P, which grows with market depth (see Glossary: Remainder, Participant parity). The founder's income scales with:
- **P** — more shards × more stores = more divisions = more remainder
- **R** — more referrers = more coordination subdivisions
- **Store transitions** — churn creates epochs with unclaimed drain
- **Self-healing cycles** — repair lag = unclaimed drain
- **Reference client traffic** — referrer share via via tag

The inverse size premium (see Glossary) persists at every S. The founder's durable income requires no client dominance — only that the storage market serves content.

### Store Interdependence

With RS(10,20), content requires K stores to collectively serve for reconstruction. Each store's income depends on peer stores being available:
- If fewer than K stores are online for a content item, it can't be consumed → no request proofs → no drain → **all** stores for that content earn nothing
- Each store is incentivized to want more peer stores online (collective availability = more consumption events = more drain)
- Stores monitor peer availability — if a peer goes down, their own income drops
- Cross-store verification (random per-epoch peer assignment) creates a ring of mutual dependency for earning

### Three Self-Correcting Loops

1. **Eviction → funding urgency**: Store fills → low-funded content evicted → "not stored" visible on index → community funds → content re-stored
2. **High prices → new stores**: Stores fill → storage prices rise → storage becomes profitable → new operators join → capacity increases → prices stabilize
3. **Content migration**: Expensive store → cheap store has capacity → content migrates → expensive store frees space → equilibrium

### Conviction Momentum

The feedback loop: reads → visibility → funding → storage → reads. The money enters from conviction. The distribution is free. Contested content generates the strongest momentum: both sides fund repeatedly, each round amplifying visibility and driving counter-funding.

---

## Verification System

### Why Request Proofs + Attestations Work

| Attack | Defense |
|--------|---------|
| Fake demand (sybil clients) | PoW cost per request proof. Ephemeral keys make sybil cheaper but only affect the index (display layer), not settlement (economic layer) — drain is gate-triggered, not count-triggered. Index weights commitment (sats) over demand (PoW). |
| Flood requests | PoW difficulty scales with volume — exponential cost |
| Replay requests | Epoch-bound, single use |
| Fake bytes served | response_hash in store attestation must match expected shard hash |
| Forge store attestation | Requires store's private key (Ed25519) + valid bond |
| Front-end redirects store income | **Impossible** — multi-party binding (see §3). Front-end earns only via the via tag. |
| Sybil referrers (fake `via` tags) | Referrer income requires valid request proofs with matching store attestations. You can't profit from fake referrals without generating real consumption. |
| Store proxies without storing | Storage challenges (random byte offset + Merkle proof, latency-tested) catch fetch-on-demand. Repeated failure → bond slash. |
| Sybil receipt inflation | Receipt doesn't credit specific stores — demand signal is diluted across ALL stores for that content. Less profitable than original model. |
| Store self-dealing (own request proofs) | **Tolerated — self-dealing is work, not fraud.** Pays real PoW, provides real storage, triggers correct settlement. Cost makes it unprofitable at scale. At small scale, converts sweep to settlement income — a bounded loss. |
| Mint-store collusion | Block-hash-assigned cross-store verification. Colluding mint cannot rig peer assignments. Probability of colluding verifier = C/S per epoch. Over multiple epochs, honest peer is assigned and fake storage is caught. Bond at risk for both parties. |
| Mint deposit flight | Bond = custody ceiling (see Glossary). Net gain from theft ≤ 0. |
| Centrality gaming (citation clusters) | PageRank with pool-based teleportation: unfunded nodes inject zero importance. Isolated unfunded clusters have zero importance regardless of edge density. Gaming requires funding multiple nodes — expensive and self-defeating (outgoing edges donate importance to real content). |

### Storage Challenge Protocol

Mints challenge stores continuously, out-of-band from the front-end:

```
Every epoch, for each claimed shard:
  mint picks random byte offset R, sends challenge: (blob_id, R, nonce)
  store responds within T seconds:
    response = bytes[R..R+32] || merkle_proof(R, shard_merkle_root)
  mint verifies:
    merkle_proof valid against known shard_hash (deterministic from content_hash + shard_index)
    latency < T (proves local storage, not fetch-on-demand)

Stores that fail: lose earnings for that epoch.
Repeated failure (N consecutive): bond slashed → genesis address.
```

### Cross-Store Verification (block-hash assigned)

Each epoch, a Bitcoin block hash determines the verification ring — not the mint. To avoid reorg ambiguity at epoch boundaries, the ring uses the block at `epoch_start_height - RING_CONFIRM_DEPTH` (6 blocks, ~1h before boundary). Assignment is deterministic from `hash(block_hash || store_set || epoch)`, unpredictable before the block, reorg-proof at depth 6, and independently verifiable by anyone.

```
Epoch E (block hash determines ring):
  Store_A proves shard_3 → Store_B assigned to verify Store_A's response
  Store_B proves shard_7 → Store_C assigned to verify Store_B's response
  Store_C proves shard_12 → Store_A assigned to verify Store_C's response
```

Earning requires BOTH passing your own challenge AND verifying a peer. Block-hash assignment removes the mint from the challenge loop — the mint collects attestations and publishes summaries, but cannot rig verification assignments. Mint-store collusion requires the block-hash-assigned peer verifier to also be colluding. With S total stores and C colluding, probability of drawing a colluding verifier is C/S per epoch — over multiple epochs, an honest verifier is eventually assigned and fake storage is caught. The assignment record is public: if a fraud proof later shows Store B never had the shard, Store A's "pass" verdict implicates Store A's bond too.

### Bonded Mint Operators (Permissionless)

Permissionless entry via on-chain bond (BTC in time-locked UTXO). Any operator in any jurisdiction. Each operator: holds pool balance fraction (custody), verifies request proofs, collects store attestations, issues storage challenges, publishes epoch summaries, publishes coverage signals, executes settlement payouts.

**Mapping gossip**: See four mapping layers (Communication Channels). Key additions: **Gossip authentication** — mints only accept from peers with on-chain-verified bonds. **Gossip consistency** — best-effort; divergent mints fall through to relay-encrypted mappings (canonical). New mints bootstrap from relay mapping events.

**Bootstrap exception**: Founder operates a bonded mint at launch (Phase 2-3). Irreducible bootstrap cost. The `DEFAULT_MINT` in the reference client. Achieved at Phase 4 "forget" threshold.

**Resilience**: Any 2 mints surviving = full functionality. Serve caches provide organic fallback.

**Fraud proofs**: Anyone publishes evidence of misbehavior → bond slashed to genesis.

**Mint verification is free.** Free verification maximizes request proof volume, deepening the demand history moat.

---

## Revenue Model

### Protocol-Level: Coordination Share + Dimensional Remainder (passive)

Neither is a fee. Neither is a rate. Both are emergent from the settlement structure (see §4 pseudocode). Income flows to genesis (protocol constant) and to the reference client's via pubkey.

**Four income modes — all pay genesis:**
- **Active market** — coordination share + remainder from settlement. The primary, durable income. Survives total client competition.
- **Sweep** — pools with no attestations for SWEEP_EPOCHS → 100% to genesis. Catches noise and failed self-promotion.
- **Bond slash** — misbehavior → bond to genesis.
- **Referrer** — via tag income through the reference client. Bonus, fragile to client competition.

Total addressable revenue = all inflow (successful, failed, and fraudulent).

**Income hierarchy** (descending by durability):
1. **Text coordination share + remainder** — N=1, highest coordination fraction at every S (inverse size premium). Income transitions from coordination rent (low S) to integer friction (high S). Fork-resistant via the mapping moat.
2. **Document coordination share + remainder** — smaller coordination fraction but remainder grows with market depth.
3. **Sweep** (100% capture) — failed attention bids.
4. **Referrer** — fragile to better clients.
5. **Bond slash** — episodic, front-loaded to early network.

Additional genesis income: timing gaps (store transitions), cross-epoch prorating (fractional claims → 0), self-healing repair lag, bond slashes.

The capture rate is emergent and convex — every architectural improvement multiplies divisions. Fork resistance: the mapping moat (see Glossary). The founder earns from the froth of disagreement — contested content drives the most conviction spending.

**Fire-and-forget economics**: Published code, walked away. Zero operational cost, zero legal surface. The data moat is the floor; the client defaults are the ceiling.

### Product-Level (forkable, operated by anyone)

**Venue fee**: Whatever any serve endpoint operator charges on funding through their UI. Market-priced. Raw protocol events via relay: no fee. The founder does not operate a venue.

**Index products**: API, feed, widgets, institutional licensing. Market-priced. Operated by anyone. The reference index has a data moat (citation graph, request proof history) but it's forkable with effort.

**Clearinghouse spread**: Whatever any clearinghouse operator charges. Market-priced.

---

## Product: The Importance Index

### Three Axes

| Axis | Source | Measures |
|------|--------|----------|
| **Commitment** | Pool balance (fund events) | How much money is behind this |
| **Demand** | Request proof velocity (request proofs/epoch) | How much people are consuming right now (free reads, PoW-verified, epoch granularity) |
| **Centrality** | Graph importance (citation DAG) | How structurally connected to other funded content |

### Divergence Labels

| Label | Condition | Incentive created |
|-------|-----------|-------------------|
| **Underpriced** | High centrality + low pool | "Fund it before others do" |
| **Flash** | High demand + low pool | "Popular but unfunded — will it survive?" |
| **Endowed** | High pool + low centrality + low demand | "Big money, no analysis — be the first" |
| **Contested** | High funded-reply density with contradictions | "The discussion itself is expensive — read the arguments" |

### Citation Graph

Edges from Nostr events:

| Edge type | Source | Durability |
|-----------|--------|------------|
| **ref edge** | event ref field | Relay-dependent |
| **body edge** | `[ref:bytes32]` in content | Relay-dependent |
| **list edge** | LIST event items | Relay-dependent |
| **inscribed edge** | Bitcoin transaction | **Permanent** |

**Graph importance** (materializer-computed, display signal only — settlement does NOT depend on importance):
```
importance(node) = (1 - d) × direct_pool(node)
                 + d × Σ (edge_weight × importance(source)) / out_degree(source)
```

Reference index defaults: damping `d = 0.85`, inscribed edges weighted heavier than relay edges, funded replies weighted by pool balance. Competing indexes may use different parameters — this is a product decision, not protocol.

The graph appreciates over time — old content increases in importance as new analyses reference it. This is the data moat.

### Competing Indexes

Multiple materializers compute importance from the same public relay events. Each publishes scores as Nostr events. Indexes earn from their own products (API fees, widget hosting, institutional licensing). Users/agents choose which to follow. Competition improves quality.

---

## Product: Clearinghouse

Matching engine for structured preservation demand and store supply. Not protocol — a product built on protocol events.

**NIP-PRESERVE** (demand side): Structured bid for replication outcome. Escrowed, refundable, cleared at epoch boundary.
```
tags: ["r", "<sha256>"], ["replicas", "<n>"], ["jurisdictions", "<n>"],
      ["duration", "<epochs>"], ["max_price", "<sats_per_replica_per_epoch>"]
```

**NIP-OFFER** (supply side): Store commits bonded capacity.
```
tags: ["r", "<sha256>"], ["replicas", "<n>"], ["regions", "<list>"],
      ["price", "<sats>"], ["bond", "<sats>"], ["duration", "<epochs>"]
```

**NIP-CLEARING**: Published at epoch boundary. Deterministic, auditable matching.

Spread: whatever the clearinghouse operator charges. Two-tier store market: commodity (spot, pool drain only) vs committed (bonded offer, earns clearing price).

---

## Product: Permanence Tiers

Three-layer durability. Store-blind storage is the architecture, not an upgrade:

| Layer | Where | Cost | Durability |
|-------|-------|------|------------|
| Relay | Nostr relays (events, metadata — not content) | PoW | Relay-dependent |
| Fragment | Blossom servers (store-blind shards) | Sats (pool) | Pool-funded, self-healing |
| Inscribed | Bitcoin blockchain | On-chain fee | Permanent |

Content below MIN_FRAGMENT_SIZE → N=1 shards. Above → RS(K,N). Self-healing: any participant reconstructs from K shards, re-encodes a missing shard (deterministic), uploads to new store.

**NIP-INSCRIBE**: Taproot witness envelope for permanent content/edges on Bitcoin. Materializer watches for OCDN-prefixed inscriptions. Batched into daily Bitcoin anchor transaction.

---

## Product: Founder Protection

Protection applies only to the genesis address and its accumulated income.

**Three key contexts**:

| Key | Hot/Cold | Purpose | Risk if lost | Bootstrap → Steady state |
|-----|----------|---------|-------------|--------------------------|
| **Genesis key** | Cold (threshold) | Spends accumulated income | Income locked forever | Single-sig cold key initially → FROST 2-of-3 ceremony when balance warrants |
| **Nostr identity key** | Warm (phone/extension) | Seeds content, posts announcements, earns referrer income | Reputational — founder voice lost. Replaceable socially. | Same key = FOUNDER_VIA_PUBKEY (collapse to one context) |
| **Mint key** | Hot (on VPS) | Signs fund confirmations, epoch summaries, coverage signals (bootstrap only) | Mint stops. Replaceable by bonding a new mint. | Founder-operated → shut down at "forget" threshold

**Threshold genesis key**: Single-sig cold key initially. Upgrade to 2-of-3 FROST when income justifies ceremony. Share 1: founder. Shares 2-3: trusted parties in different jurisdictions. Protects against seizure and coercion. The genesis address receives income automatically — the threshold key is only needed to SPEND it.

**Genesis UTXO management**: Genesis should receive income via Lightning or Cashu, not raw on-chain UTXOs. If on-chain required, automatic sweep to Lightning/coinjoin. Minimize on-chain footprint at a publicly tracked address.

---

## Agent Economy

Agents read for free (PoW) and fund with conviction (delegation budget). Three additions:

**Delegation**: Human authorizes agent with budget, allowed kinds, per-event max, expiry. Agent signs events with its own key. Revocation: budget 0.

**Structured Edges**: Agent-produced citation graph entries: `{"_edges": [{"ref": "hex64", "rel": "cites", "w": 0.92}]}` — `rel` is any UTF-8 string; conventions (cites, contradicts, corroborates, supersedes, etc.) emerge from agent usage.

**Request-Proof-as-Credential**: Agent's request proof portfolio is a public, machine-verifiable research credential. Proves diligence and consumption volume, not correctness.

**Agent Loop**: Discover (index) → Consume (free, PoW request proof) → Analyze (edges) → Fund (delegation budget) → request proofs deepen moat → loop. Agents are both consumers (generating demand signal via PoW request proofs) and conviction signalers (funding what they analyze as important). At scale, agent conviction spending may exceed human conviction spending — automated ideologues funded by humans who delegate their conviction to machines.

**Follow Investigation**: Client subscribes to all edges for a specific hash subgraph. Agents continuously add structured edges; humans consume the resulting map via alerts. One button on claim detail: "Follow." ~20 lines of client code — relay subscription filter on hash subgraph.

---

## Human Interface

**Principle**: The product is the READ experience. Reading is free. The economic signal IS the content. The only economic action is `[+]` — a conviction signal, not a consumption toll. Two metabolisms (see thesis 18): ephemeral = free discourse, funded = conviction signal. `[+]` upgrades. 100 sats should feel like a like.

### Design

**Typography**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). No custom fonts — zero load time, works everywhere, respects device locale. Two sizes: content (large, regular weight) and metadata (small, muted). Sats use `font-variant-numeric: tabular-nums` for column alignment. Content is the largest text on every screen. Everything else recedes.

**Color**: High-contrast, two-tone. Light background, dark text. One accent color for ⚡ (amber/gold). State communicated by opacity: live = full, ghost/swept = faded. No color-coding for categories — content is untyped. Dark mode via `prefers-color-scheme`. Conviction bar: solid fill for claim pool, lighter fill for reply pool.

**Layout**: Single column, full-width cards. No sidebars, no multi-panel. Tap to drill in, back to drill out. Mobile-first — the primary reader is on a phone over a VPN. RTL-aware (`dir="auto"`) for Arabic, Hebrew, Farsi.

**Position = rank.** No numbers. Order communicates hierarchy. The top card is #1. Scroll position is the only rank signal needed. Sharing a specific claim uses the hash deep link, not a rank number — rank changes; the hash doesn't.

### Symbols

Labels are language-bound. Symbols are global. The entire interface vocabulary:

| Symbol | Meaning |
|--------|---------|
| `⚡` | Sats (pool balance) |
| `↑` `↓` | Rising / falling (velocity) |
| `↩` | Replies |
| `→` `←` | Cites / Cited by |
| `+` | Fund |
| `/` | Topic |
| `₿` | Bitcoin-anchored |
| `↵` | Resolver input |

No text labels on tabs. No text labels on metadata. A reader who speaks no English sees: content in their language, numbers, and symbols. The system is legible without localization.

### One Surface: Search Bar = Leaderboard

The search bar IS the product. The leaderboard lives inside it. Empty query = global leaderboard. Typing = filtering. Everything flows from one input.

**Landing state** — search bar centered, prominent. The only element:
```
              ↵  |
```

**Focused** — tap the bar, leaderboard appears beneath. Global topics by default:
```
 ↵  |                              ⚡  ↑  ⚖  ◇

 /corruption                             [+]
 847,000⚡  ↑12%  · 34↩

 /surveillance                           [+]
 614,200⚡  ↑3%   · 21↩

 /bitcoin                                [+]
 590,100⚡  ↓1%   · 89↩

 /pharma                                 [+]
 441,800⚡  ↑28%  · 12↩
```

Sort toggles inline with the bar: `⚡` (pool), `↑` (velocity), `⚖` (mispriced), `◇` (fragile). Active sort highlighted. Divergence between ⚡ and ↑ IS the signal.

**Typing** — results filter live as the query narrows:
```
 ↵  corr|                          ⚡  ↑  ⚖  ◇

 /corruption                             [+]
 847,000⚡  ↑12%  · 34↩

 Internal audit reveals $2.3B            [+]
 misallocation across three divisions
 184,000⚡  ↑  · 23↩

 court-filing.pdf  (2.4 MB)             [+]
 84,000⚡  ≈  · 14↩
```

Matches across topics AND claims. Topics first, then claims containing the query, ranked by active sort. The leaderboard is always the result — search doesn't switch to a different view.

**Input modes** — same bar, different behavior by content:

| Input | Behavior |
|-------|----------|
| Empty | Global topic leaderboard |
| Text | Filter topics + claims matching text |
| `/topic` | Drill into topic — claims within |
| URL paste | Hash the content, show conviction state (or `[+] to create`) |
| New text + submit | Create a new claim |

No mode selector. The bar infers intent from the input. `/` prefix = topic navigation. URL pattern = hash lookup. Everything else = search. Submit on a non-matching query = claim creation flow.

**Within a topic** — the bar shows context, further typing filters within:
```
 ↵  /corruption  |                 ⚡  ↑  ⚖  ◇

 Internal audit reveals $2.3B            [+]
 misallocation across three divisions
 184,000⚡  ↑  · 23↩

 court-filing.pdf  (2.4 MB)             [+]
 84,000⚡  ≈  · 14↩

 The audit methodology is flawed         [+]
 because...
 47,200⚡  ↑  · 8↩
```

Topic prefix stays in the bar as a breadcrumb. Backspace past it = return to global. Claim text is the hero — large, multi-line, full-width. Metadata below in small muted type. Position = rank.

**Claim detail** (`/hash`) — tap a claim to expand:
```
 ↵  /corruption                    ⚡  ↑  ⚖  ◇

 Internal audit reveals $2.3B misallocation
 across three divisions

 184,000⚡  · 47 funders  · 23↩  + 147
 2,400⚡/epoch ↑  ·  8/10◇  ·  →3  ←14
 ████████████████████████████░░░░░  [+]

 ↩  corroborating: I worked in div. 2   [+]
    and saw the ledger discrepancies...
    4,200⚡  · + 31

 ↩  this is a misread of GAAP           [+]
    standards...
    2,100⚡  · + 22

 ↩  → spreadsheet.xlsx                  [+]
    1,800⚡  · + 8

 [↩]
```

Velocity with direction, store coverage (`8/10◇`), outgoing citations (`→3`), incoming citations (`←14`). All symbols, no labels. `+ n` = ephemeral replies (collapsed, relay-only, free). Tapping `+ n` expands ephemeral messages inline — muted, chronological, no `⚡`, no rank position. `[+]` on any ephemeral message upgrades it to funded. Conviction bar: solid fill = claim pool, lighter fill = reply pool. When reply fill exceeds claim fill, the claim is being actively contested.

`[↩]` at the bottom — tap to reply. Free (ephemeral). Optional ⚡ to fund on submit.

### One Action

`[+]` → tap → amount (100 / 500 / 2K / 10K) → Lightning → done.

No label. The symbol is the action. 100 sats should cost the same mental effort as a like.

**Wallet**: NIP-47 (Nostr Wallet Connect). Connect once (QR/string), persists encrypted on relays (NIP-78). Subsequent `[+]` taps → wallet pays automatically from any device. We hold zero sats. Cashu in-browser as fallback.

**Reply**: `[↩]` → text input. Posts as ephemeral Nostr event (free, relay-only). Optional ⚡ attached on submit to fund immediately (upgrade to stored). PoW in background for request proofs.

**Content states** (communicated by opacity + one-line status, no labels):
- **Ephemeral** — relay-only, no pool, no storage. Visible only inside `+ n` expansion. Muted. `[+]` upgrades to funded.
- **Live** — full opacity. Card is normal.
- **Not indexed** — `[+] to create`. Faded, one line.
- **Not stored** — `[+] to summon stores`. Card visible, `◇` indicator shows 0/K.
- **Ghost** — faded (see Glossary). Full economic history visible. `[+] to restore`. Upgraded ephemeral content may recover from relay plaintext.
- **Swept** — faded. `10K⚡ · 3 funders · 7 days · swept`. `[+] to re-fund`. Normal end-state for discourse.

### Routes

All routes land on the same surface — the search bar + leaderboard. Routes pre-fill context:

| Route | Search bar state |
|-------|-----------------|
| `/` | Empty — global topic leaderboard |
| `/topic` | Pre-filled with `/topic` — claims within |
| `/<hash>` | Deep link — claim expanded with replies |
| `/verify/<hash>` | Integrity proof page (institutional-facing) |
| `/earn` | Operator view — funded hashes with low store coverage, estimated sats/epoch, required disk, copy-paste `docker run` |

Every shared link opens the same interface. The URL determines the starting context; the search bar determines where you go next. One component, many entry points.

### Stateless Client

The SPA stores nothing. The user's Nostr key IS the session. Every piece of state lives on relays as signed events.

| Feature | Outsourced to | Our code |
|---------|---------------|----------|
| Identity / session | NIP-07 browser extension | `window.nostr.getPublicKey()` |
| Wallet / payments | NIP-47 (Nostr Wallet Connect) | One relay subscription |
| Conviction portfolio | Fund events on relays (query by pubkey) | One relay query on connect |
| Watchlist / bookmarks | NIP-51 encrypted lists on relays | One event kind, encrypted |
| Preferences | NIP-78 application-specific data on relays | One event kind, encrypted |
| Cross-device sync | Same key = same relay queries = same state | Zero |
| Notifications (live) | Relay subscriptions already open for feed rendering | Filter on user's funded hashes |
| Notifications (background) | Service Worker + relay WebSocket (no server) | ~100 lines |
| Notifications (reliable) | NIP-44 DMs from ecosystem notification bots | Zero (not our infra) |

**Session reconstruction on return visit**: Detect NIP-07 → query relays for user's fund events → reconstruct portfolio → query NIP-51 for watchlist → subscribe to new events on funded/watched hashes. Cross-device by construction.

**Alerts** (computed client-side from relay subscriptions + cached last-seen state — zero new infra):
- "3 claims you funded moved up 12 ranks"
- "a contradiction surpassed the parent claim"
- "this doc is 1 store away from death — [+] to summon stores"
- "new evidence cited by a claim you funded"
- "a claim you funded was cited by a top-10 node"

Badge on return: "5 updates on your positions." Alerts feel like portfolio notifications — your conviction moved. This is the daily re-engagement loop.

**Onboarding ramp**: Anonymous reader (no key, ephemeral PoW) → localStorage key (fund, watch, in-tab notifications) → NIP-07 extension (cross-device, portfolio, background notifications) → NIP-07 + NWC (one-tap funding from any device). Each step opt-in, each unlocks more.

### OG Image Endpoint

Cloudflare Worker / Vercel edge function. Stateless. Queries relays, renders a fresh OG image per scrape. Every shared link carries a live scoreboard snapshot: claim text (truncated), ⚡ pool balance, rank in topic, velocity, store count/threshold, reply count, URL as CTA. Twitter/Slack/Discord/Reddit become the distribution layer. The preview IS the product — the share is the viral loop.

The SPA remains static (IPFS + domain). The OG endpoint is a serve-layer function — consistent with the serve role. Separate deploy, separate URL, no state.

### Widget

```html
<ocdn-widget></ocdn-widget>              <!-- feed mode -->
<ocdn-widget hash="a1b2..."></ocdn-widget> <!-- single card -->
```

CDN-hosted. Mobile-responsive. Ship before media outreach.

---

## Content Policy

No governance. No global moderation. Operators apply local policy.

- **Stores**: choose what to store (local policy, blob-ID removal on legal order).
- **Serve endpoints**: choose what to display/deliver (front-ends, CDNs — fully independent).
- **Nostr relays**: choose what to relay.
- **Index operators**: choose what to rank.
- **Protocol**: doesn't know or care what content is. Knows: hash, pool balance, request proof count.

**Append/promote-only**: No edit (hash-addressed = immutable). No delete (events are permanent). No hide (all events are public). Versioning: publish new content with a `supersedes` edge.

**Store compliance vs. system resilience**: See Trust Assumptions: Store liability isolation. Individual compliance and collective persistence are independent properties.

---

## Private Content Marketplace

Public content is the base layer: funded by conviction, free to read.

Private content uses the same index as a billboard:

1. Seller uploads encrypted content to Blossom
2. Seller funds the pool (self-promotion — pays for hosting the encrypted blob and for ranking position on the index)
3. Preview/metadata is public and free (title, description, price)
4. Index ranks it identically (pool balance, PoW request proof velocity on preview, centrality)
5. Buyer pays seller directly (Lightning/Cashu — outside the protocol) for decryption key
6. Buyer decrypts locally

The protocol earns friction on the seller's promotion spend. The sale is peer-to-peer. The protocol doesn't touch the transaction. This is Google's model: the advertiser pays for placement, the search engine earns from the ad spend, the buyer-seller transaction happens elsewhere.

---

## Constants

Only protocol-adjacent constants. Everything else is operator-set or market-determined.

| Constant | Value | Note |
|----------|-------|------|
| GENESIS_ADDRESS | `<address>` | See Glossary: Genesis address. |
| EPOCH_BLOCKS | 24 | ~4h at 10min/block. Bitcoin block height. Natural Schelling point. |
| RS_K | 10 | Reconstruction threshold. Any 10 of 20 shards suffice. |
| RS_N | 20 | Total storage shards. 2× overhead. 10-of-20 for censorship resistance. |
| MIN_FRAGMENT_SIZE | 10240 (10 KB) | Below this: single encrypted shard (N=1). Above: full RS(K,N). |
| MIN_REPLICAS | 3 | Minimum stores per shard for settlement validity. Ensures redundancy even for N=1 content (text claims, replies, topics, edges). |
| CONTENT_KEY_DOMAIN | "ocdn-v1" | Convergent encryption: key = SHA256(domain \|\| content_hash). |
| POW_TARGET_BASE | 2^240 | Anti-spam for request proofs + comments. ~200ms mobile. |
| POW_SIZE_UNIT | 1048576 (1 MB) | PoW scales with content size. |
| SWEEP_EPOCHS | 42 | ~7 days. See Glossary: Sweep. |
| MIN_ATTESTATIONS | 1 (graduates to RS_K) | Minimum store attestations for a valid consumption event. Starts at 1 for bootstrap; increases toward RS_K as store count grows. Graduation thresholds are protocol constants, not operator-set. |
| CHALLENGE_INTERVAL | 1 epoch | How often mints challenge stores for storage proof. |
| MIN_DRAIN_RATE | 1 sat/shard/epoch | Drain rate floor. See Storage Market: Drain. |
| COVERAGE_BLOCKS | 6 | ~1h. Coverage signal frequency. Decoupled from EPOCH_BLOCKS. |
| RS_WASM_HASH | SHA256 of canonical WASM binary | Protocol ships one RS encoder/decoder. This hash pins it. New binary = protocol version bump. |
| MAX_SILENT_EPOCHS | 6 | ~24h. Missing summaries without pause event → bond slash. |
| RING_CONFIRM_DEPTH | 6 | Cross-store verification ring uses block at `epoch_start_height - 6`. Reorg-proof at depth 6. ~1h delay on ring assignment, negligible vs. 4h epoch. |
| PROTOCOL_VERSION | 1 | All events carry `["v", "1"]` tag. Version bumps are coordinated flag days. |
| PAYOUT_THRESHOLD | 1000 sats | Minimum accumulated balance before Lightning payout executes. Sub-threshold amounts accumulate across epochs. |
| NIP Event Kinds | 1000-9999 range | Non-replaceable. Pool credits are additive. |

**Reference client constants** (not protocol — embedded in the reference SPA):

| Constant | Value | Note |
|----------|-------|------|
| FOUNDER_VIA_PUBKEY | `<pubkey>` | Default via tag in reference client. = founder's Nostr identity key. |
| DEFAULT_MINT | `<mint_pubkey>` | Default deposit mint in reference client. First-mover deposit stickiness. |
| DEPOSIT_SPLIT_MIN | 2 | Splits deposits across mints. Per-mint custody risk proportional, not binary. |

**Operator-set** (not protocol):

| Parameter | Set by | Note |
|-----------|--------|------|
| Min deposit | Each mint | Anti-spam. Reference mint: 100 sats. Low-ball mints attract dust — their overhead. |
| Venue fee | Serve endpoint operator | Market-priced. |
| Clearing spread | Clearinghouse operator | Whatever the clearinghouse charges. |
| Store rate | Each store | Market-determined. Covers storage costs. |
| Damping factor | Each index | Reference: 0.85. Competing indexes choose their own. |
| Inscription weight | Each index | Reference: 2×. Product decision. |

---

## MVP Build Order

### Phase 1: Prior Work (Complete)

File layer, L402, node kit, receipt SDK, pin contracts. Cryptographic primitives carry forward.

### Phase 2: Build Four Artifacts

The client validates the thesis. The storage market captures value from the thesis. Build the client first — if nobody funds contested claims through it, the storage market is moot. All four ship in MVP, but priority is: client → spec → settle → store.

1. **Static client SPA + OG endpoint** — No backend. Stateless (see Human Interface: Stateless Client). Via tag = FOUNDER_VIA_PUBKEY. Funding via NWC/Cashu through DEFAULT_MINT, split across DEPOSIT_SPLIT_MIN mints. Deploy to IPFS + domain + self-host via `ocdn-pack`. OG endpoint as Cloudflare Worker. `/earn` route for operator recruitment. **This is the founder's primary income-generating asset** — every request proof earns referrer income. First-mover links and OG cards compound the social moat. **Shelf life**: IPFS SPA breaks within 6-18 months; domain version is updatable. Genesis income survives client competition; referrer income doesn't.
2. **Protocol spec (NIP)** — Four event types (see §1-4), bonded mints, settlement rule, all protocol constants. Short enough to read in 20 minutes. Immutable once published (version bumps via flag days).
3. **`ocdn-settle` binary** — Deterministic CLI (single static binary). Input: relay URL(s) + mint epoch summaries. Output: settlement events published to relays. `GENESIS_ADDRESS` is a constant in the source. Content-hash the binary, publish the hash.
4. **`ocdn-store` daemon** — Docker container. Watches coverage signals, stores shards, registers mappings, responds to challenges, attests to mint, cross-verifies peers, earns BTC. Zero editorial decisions. `docker run ocdn-store --ln-address=<me>`.

### Phase 2b: Bootstrap Mint (founder-operated, temporary)

The founder operates a bonded mint on a VPS for the bootstrap window. **This is the irreducible bootstrap cost if no partner mint is recruited before launch.** The VPS runs `ocdn-mint` and requires:
- Lightning node (CLN/LND) or Cashu backend connection for deposits/payouts
- Reachable endpoint (domain or static IP) for store attestation submission
- On-chain bond UTXO (~500K sats, recoverable when shut down)
- Relay WebSocket connections (outbound) for fund confirmations, epoch summaries, coverage signals, encrypted mapping backups

Budget 2-3 days integration beyond core protocol logic. The mint is a Lightning-connected service, not a standalone binary. **Exit criterion**: one independent mint bonds and accepts deposits. The founder's mint shuts down; the founder's seed funding already routed through the partner mint gives it immediate coordination share income.

**Alternative**: recruit a partner mint operator (existing Cashu operator or Nostr ecosystem builder) before launch. Pitch: "Run this Docker image, post a 500K sat bond, I'll route 200K sats of deposits through you on day 1." The founder's seed budget IS the recruitment budget. If successful: zero founder VPS, zero ongoing machines.

### Phase 3: Ignite (two weeks)

**Week 1 — Deploy + Seed + Announce:**

5. **Publish** — NIP spec to Nostr protocol repos. Open-source all four artifacts on GitHub. Docker image to Docker Hub. Static client to IPFS + domain.
6. **Seed** — Fund 20-30 timely propositions from multiple ephemeral keys. 100-500 sats each. Total budget: 100-200K sats. **The seed content IS the marketing — budget 3-5 days of editorial curation, not hours.** Selection criteria: items people will screenshot and share on X/Reddit/Signal with "look at this." Prioritize: (a) suppressed documents with active news cycles, (b) contested claims where both sides are vocal online, (c) whistleblower-adjacent content that people already share in DMs. **Seed BOTH sides of 5 contested topics** (not one side of 15) — plausible deniability, and both sides drive counter-funding. Content must be fresh on launch day — tie to current events. The seed leaderboard must look interesting to a stranger in 3 seconds. Bad seeds = dead product regardless of protocol quality.
7. **Announce** — Post on Nostr: "The OCDN protocol is live. Here's what people are funding. Here's the spec. Here's the store daemon — run it and earn sats." OG cards are the viral loop.
8. **Zap-to-pool bridge** — capture existing Nostr economic flow.

**Week 2 — Monitor + Recruit + Iterate:**

9. **Monitor** — Watch for: funders-per-item, independent stores joining, store coverage per seeded item, first non-founder deposits. Adjust seed content if leaderboard looks dead.
10. **Recruit** — Active outreach to potential store operators and mint operators. The `/earn` page with live economics is the pitch. Target: at least 2 independent stores and 1 independent mint within 14 days.
11. **Iterate** — Fix client bugs, adjust relay lists, respond to community feedback. The domain-deployed client is updatable; the IPFS version is a snapshot.

### Phase 4: The "Forget" Threshold

The founder monitors for:
- 2+ independent stores running `ocdn-store` and earning from pools (visible as attestation patterns in epoch summaries)
- 1+ independent bonded mint operating (not founder-operated)
- 1+ independent settler publishing settlement events that match the reference settler's output

At this point, every role is performed by someone other than the founder. The genesis address continues receiving remainders. **The founder shuts down any infrastructure they personally operated and walks away.**

### Post-Launch (Build When Triggered — by anyone)

| Feature | Trigger |
|---------|---------|
| Clearinghouse (preserve/offer matching) | Preservation demand from users |
| Bitcoin inscriptions | Demand for permanence |
| Importance API + competing index support | Organic API inquiries |
| HTTP gateway serve endpoint | Self-hosting demand / serve endpoint ecosystem |
| `ocdn-pack` CLI | Ship alongside `ocdn-store` (trivial — deterministic tar wrapper) |
| Block-level chunking | Streaming media demand |
| Genesis key ceremony (FROST 2-of-3) | Income justifies ceremony |
| Cross-settler verification | Multiple settlers running |

---

## Role Fragmentation

Every protocol role is profitable to operate independently. The founder operates none of them.

| Role | Day 1 operators | Revenue | Failure mode |
|------|----------------|---------|--------------|
| Stores | Independent bonded operators | Storage shard drain via settlement | Any K survive per content = availability maintained |
| Serve endpoints | Anyone (front-ends, CDNs) | Coordination shard referrer share + venue fees, ads | Any 1 survives = content deliverable |
| Bonded mints | Independent bonded operators | Coordination shard mint share + bond slash income | Any 2 survive = request proofs verified + payouts flow |
| Importance indexes | Independent operators | API fees, venue fees | Any 1 survives = rankings exist |
| Settlers | Anyone | None (public service) | Any 1 survives = settlements computed |
| Clearinghouse | Anyone | Market-set spread | Degrades to raw pool credits |
| **Founder** | **None** | **Genesis coordination share + remainder + sweep + slash + referrer income via reference client** | **N/A — no operational role to fail** |

### The Longevity Test

> If founder is permanently removed at midnight: do proofs verify, balances remain accessible, events propagate, shards serve, epochs settle, payouts execute, indexes rank, client still serving, code still buildable? **Every answer is "yes" by construction — the founder was never in the loop.**

### The Income Durability Test

> If founder is in custody at midnight: does residual accumulate (yes — protocol constant), does referrer income accumulate (yes — IPFS client), can income be accessed (yes — threshold key), is income seizure-resistant (yes — on-chain BTC), does it redirect if founder can't claim (yes — beneficiary)? **Every answer is "yes" — no operational role means no operational vulnerability.**

---

## Go-to-Market

### Positioning

Not "decentralized storage." Not "censorship-resistant platform."

**"The economic indexing layer for content that matters."**

For consumers: **"Content that can't be killed, priced by the people who care."**

For institutions: **"Proof URLs — verifiable evidence links with Bitcoin-anchored timestamps."**

For agent platforms: **"The demand oracle — what should your agent consume next?"**

### Three Growth Loops

1. **Acquisition** (OG image endpoint): Every shared link carries a live scoreboard snapshot. Twitter/Nostr/Reddit become distribution. The preview is the product.
2. **Supply depth** (`/earn` page): Market depth deficit as recruitment pitch. Every store that joins deepens settlement dimensions → more founder income. Funded hashes with low coverage, estimated sats/epoch, copy-paste docker run.
3. **Retention** (alerts): "Your positions moved." Client-side from relay subscriptions + cached last-seen state. Portfolio notifications for conviction holders. Daily re-engagement without push infrastructure.

### Bootstrap Sequence

```
Pre-launch: Recruit partner mint operator OR prepare founder VPS.
            3-5 days seed content curation (editorial work, not engineering).

Day 0:     Publish spec + code + deploy static client (IPFS + domain).
           OG endpoint live. /earn page live (with live store economics).
           Seed 20-30 items from ephemeral keys. 100-200K sats total.
           Both sides of contested topics. Fresh, tied to current events.
           Feed live. [+] works. OG cards shareable.

Day 1:     Announce on Nostr. "The OCDN protocol is live. Here's what
           people are funding. Run a store and earn sats."

Week 1:    Share on Nostr and Bitcoin Twitter. "Put your money where
           your mouth is." OG cards are the viral loop.

Week 2:    Monitor + recruit. Active outreach to store/mint operators.
           Iterate on client bugs, relay lists, seed content.
           Target: 2+ independent stores, 1 independent mint.

Week 3-4:  Observe: funders-per-item, independent stores joining,
           independent mints bonding. Do people fund? Do stores join?
           If nothing: thesis tested for 200K sats, not 12 months.

Month 2:   "Forget" threshold: 2+ independent operators per role.
           Shut down founder-operated VPS (if any). Walk away.

Month 3+:  If validated: independent operators build funded discussion,
           widgets, importance API. The founder builds nothing more.
```

### What NOT to Do

- Don't curate. Don't operate infrastructure. Don't have an admin panel.
- Don't build social features first. Economics first.
- Don't chase volume. Chase intensity.
- Don't explain the protocol. Show the content. "47 people funded this document's survival" is the entire pitch.
- Don't operate anything after the "forget" threshold. The temptation to "help" is the threat model.

### Obsession Metric

**Repeat funders per contested topic.** Every design decision judged by: does it drive competitive repeat funding?

---

## Post-MVP Revenue Layers

| Layer | Trigger | Revenue profile |
|-------|---------|-----------------|
| Priority replication auctions | 10+ stores | Convex (crisis spikes) |
| Pin insurance / SLA | 6mo telemetry, institutional demand | Recurring, high-margin |
| Namespace auctions | Organic "topic ownership" attempts | Culturally convex |
| Institutional API | Organic inquiries | Recurring |
| Pro dashboard | 1000+ DAU | Recurring |

### Day-1 Data Constraint

Every event, request proof, body edge, graph computation, and threshold crossing stored in queryable, exportable schema from day 1. Materialized views are disposable. The raw event stream is sacred. Data lost is revenue destroyed.

---

## Sprint Updates/Resolutions
founder shards 1/(N+1)->1/(N·S+1)

## The One-Sentence Version

**Sats bind to hashes; four separated roles (store, serve, mint, genesis) settle at participant parity; the founder operates nothing; the income is settlement math; the moat is mapping data.**
