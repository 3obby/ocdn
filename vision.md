# Permissionless Storage Market — Nostr-Native

**Purpose**: A permissionless conviction scoreboard. Sats bind to hashes. Reading is free. Funding is advertising — funders pay for availability and visibility, readers consume for free. Content is convergent-encrypted and erasure-coded into host-blind shards. Hosts prove shard service and earn from pools. Settlement divides pool drain across mints, shards, and hosts — each division is integer arithmetic on sats, each produces a remainder that flows to the genesis key. No fee, no rate, no parameter — the remainder is the irreducible cost of multi-party coordination on an integer monetary substrate. The importance index is the product. The dimensional friction of a deep storage market is the income.

---

## Core Thesis

1. **Spam is a pricing problem** — Mandatory minimum fees filter infinite spam.
2. **Censorship is an availability market** — Replication funded by those who care.
3. **Infrastructure is a commodity** — Borrow it. Nostr relays distribute events. Blossom servers store blobs. Lightning/Cashu handle payments. Nostr keys handle identity. All already deployed, already distributed, already resilient.
4. **The protocol is a storage market; the index is the product** — The protocol clears payments between funders and hosts. The importance index — the real-time, economically-weighted ranking of what humanity values enough to pay to persist — is a product built on the market's public data. The protocol is plumbing; the index is the shopfront. Reading is free (PoW-gated). Funding costs sats. The two axes — conviction (funding) and attention (PoW receipts) — are independent measurements. Their divergence IS the signal. No other system produces both.
5. **The hierarchy is append/promote-only** — Content, topics, and discussion form a graph. Nodes are added (append) or funded (promote). Nothing is edited, deleted, or hidden at the protocol level. Loss is an explicit, auditable state — the pool exists, the receipts existed, the bytes are gone. Every other information system makes loss silent. This one makes loss visible, attributable, and economically actionable.
6. **Host-blind storage** — Fragment hosts store encrypted, erasure-coded shards under random blob IDs. They cannot determine what content their fragments represent AND cannot be externally identified as hosting a specific content item. Convergent encryption makes shards deterministic for client-side verification; blind addressing (random blob IDs, mapping stored on relays) breaks the public content_hash → host link that would otherwise let an adversary scan for known hashes. No content inspection, no acceptance policy, no legal judgment, no content-addressed scanning surface. Hosting is a commodity: bytes in, sats out. Censorship requires taking down more than N-K hosts across jurisdictions simultaneously, while economic incentives actively recruit replacements. Individual hosts comply with local law (blob-hash removal on valid legal order); the system heals through replacement. The system channels self-interest (hosts want sats, funders want permanence, readers want signal) into collective censorship resistance.
7. **Resilience is a property of greed, not architecture** — The protocol doesn't specify redundancy. It makes every infrastructure role profitable and anonymously operable. Rogue operators watch for funded content with few hosts (the opportunity signal), mirror fragments, earn sats. Censoring content increases the per-host payout, attracting replacements. The adversary fights economic gravity. The protocol specifies incentive gradients; profit-seeking actors carve the architecture.
8. **The genesis key is the mint trust root** — The genesis key delegates receipt signing authority to mint operators. Receipts signed by genesis-delegated mints are the only valid demand signal. Settlement residual flows to the genesis key. Forking the income requires forking the demand history. The moat deepens with every receipt and requires zero ongoing effort.
9. **The founder's income is proportional to settlement dimensionality** — Settlement divides pool drain across three independent dimensions: mints (trust distribution), shards (host-blind storage), and hosts (availability). Each dimension produces independent integer remainders. The remainder count scales with the product of dimensions (M × N × H), not their sum. Every architectural improvement — more mints, more shards, more hosts — that makes the system more robust also multiplies the number of integer divisions. The genesis income has convex scaling: it grows faster than any single system metric. No fee. No rate. The income is the irreducible coordination cost of multi-party integer settlement. A fork copies the same physics but starts with zero dimensions.
10. **Funding is advertising** — Funders pay for availability and visibility. Readers consume for free. This is advertising economics: the person who wants attention pays, the person who has attention consumes for free. Free distribution maximizes the audience that makes funding valuable. Conviction spending is the revenue. Free reading is the amplifier.
11. **The system optimizes for contested content** — Uncontested content is funded once. Contested content is funded repeatedly by competing sides. Competitive dynamics drive repeat funding — the highest-velocity economic behavior in the system. The founder earns from the froth of disagreement, not from any position. Free reading amplifies this: everyone sees the scoreboard, everyone can take a side.
12. **The protocol is three event types and one rule** — (1) Fund confirmation: sats bind to a hash. (2) Receipt summary: hosts proved service. (3) Settlement: deterministic payout computation. Rule: unclaimed drain → genesis key. Pools with no host claims for N consecutive epochs are abandoned — remaining balance sweeps to genesis. Everything else — host pricing, content durability, ranking, discussion structure, edge types, topic organization — is a product concern or emergent market property.

---

## What This System Invented

Five things no existing system provides:

1. **A pool attached to a hash** — money bound to content identity, not to an author or server
2. **Receipts as proof of service** — cryptographic evidence that a host served real bytes to a real consumer (PoW-verified)
3. **Pool drain to receipt-holders** — hosts earn from pools proportional to proven service
4. **The importance index** — the ranking derived from 1-3: commitment × demand × centrality
5. **Accountable loss** — every node that ever existed leaves a permanent economic trace (pool events, receipts, settlements, Bitcoin anchors). Loss is a first-class state: the record survives the bytes. No other system distinguishes "never existed" from "existed and was lost"

Everything else is borrowed infrastructure.

---

## Architecture

### Four Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  INDEX (the product)                                            │
│  Materializer reads market data from relays, computes rankings, │
│  serves feed/API/widget. Founder operates. Forkable.            │
├─────────────────────────────────────────────────────────────────┤
│  STORAGE (borrowed — Blossom)                                   │
│  Hosts store + serve bytes freely. Any VPS can host.            │
│  Commodity. Permissionless entry. Earns from pools.             │
├─────────────────────────────────────────────────────────────────┤
│  EVENTS (borrowed — Nostr)                                      │
│  All market activity is public signed events on relays.         │
│  Fund events, receipts, settlements — all verifiable.           │
├─────────────────────────────────────────────────────────────────┤
│  MONEY (the trust root — genesis-delegated mints)               │
│  Mints hold pool balances, sign receipts, execute payouts.      │
│  3-5 operators, multi-jurisdiction. Custodial. Irreducible.     │
└─────────────────────────────────────────────────────────────────┘
```

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
| **Convergent encryption + deterministic RS** | Protocol | Content key = SHA256(domain \|\| content_hash). RS(K,N) with canonical shard ordering. Shard hashes are deterministic for client-side verification — no manifest trust surface. |
| **Blind addressing** | Protocol | Hosts store shards under random blob IDs, not shard hashes. Mapping (shard_hash → host, blob_id) stored on relays. Breaks the public content_hash → host link. Hosts cannot be scanned for known content. |
| **Fund confirmation event** | Protocol | Bind sats to content hash (mint-signed) |
| **Receipt summary event** | Protocol | Aggregate proof of shard service per epoch (mint-signed) |
| **Settlement event** | Protocol | Deterministic payout across mints × shards × hosts (settler-signed) |
| **Importance index** | Product | Rankings, feed, API, widget |
| **Clearinghouse** | Product | Preserve/offer order matching |
| **Founder protection** | Product | Key delegation, beneficiary, threshold keys |

### Trust Assumptions

- **Custodial trust**: The mint federation holds pool balances. Irreducible — sats that persist across epochs and pay multiple parties over time require custody. The federation (3-5 operators, multi-jurisdiction, genesis-delegated) minimizes this trust; it cannot eliminate it. All custody operations are auditable from public events. Same trust model as any Cashu mint.
- Founder operates: reference importance index, clearinghouse, 1 of 3-5 mint operators. Founder does NOT operate Blossom servers or Nostr relays.
- Peers operate: 2-4 mint operators (different jurisdictions), Blossom servers, additional settlers
- All settlement is deterministic and auditable from the canonical event set — anyone can recompute from day 1
- **Competing settlers and competing importance indexes are permitted and encouraged from day 1**
- **Host liability isolation**: Hosts store encrypted blobs under random IDs with no manifest, no content index, no content-addressed scanning surface. Legal posture: generic encrypted blob store, not a content platform. Individual hosts honor blob-hash removal on valid legal order (safe harbor). The system heals through replacement — removed shards are re-uploaded to new hosts by the self-healing mechanism. Host compliance and system censorship-resistance are independent properties.

### Symbiosis

- **Blossom servers** have no revenue model → receipt economy gives them pool income
- **Relay operators** have no sustainability path → economically meaningful events create traffic worth persisting
- **Nostr clients** have no economic ranking signal → importance scores are a new feature any client can subscribe to
- **Positive-sum**: the economic layer makes the Nostr layer more sustainable; the Nostr layer makes the economic layer more resilient.

---

## Protocol: Three Event Types

### Fund Confirmation (mint-signed)

A two-step process: (1) funder deposits sats to a genesis-delegated mint, (2) mint publishes a signed confirmation event to relays.

**Step 1 — Deposit** (private, off-relay): Funder sends sats to a mint via Lightning invoice or Cashu P2PK transfer locked to the mint's pubkey. The mint credits the pool on its internal ledger. No bearer tokens are published on relays.

**Step 2 — Confirmation** (public, on-relay):
```
kind: NIP_POOL_KIND (non-replaceable, 1000-9999 range)
pubkey: mint_pubkey                      # genesis-delegated mint signs
tags:
  ["r", "<sha256>"]                      # content hash (the pool key)
  ["amount", "<sats>"]                   # sats confirmed
  ["funder", "<funder_pubkey>"]          # who deposited (ephemeral key OK)
  ["seq", "<monotonic_sequence>"]        # per-mint sequence number for canonical ordering
  ["delegation", "<genesis_delegation_event_id>"]  # proves mint authority
  ["meta:title", "<title>"]              # optional — content identity for graceful degradation
  ["meta:type", "<mime_type>"]           # optional — survives content death on relays
  ["meta:size", "<bytes>"]              # optional
content: optional JSON (metadata)
sig: mint signature
```

**Pool key** = SHA256 hash. Protocol doesn't care what it references — it credits and drains. All nodes are identical at the protocol level: hash + pool. The only variation is what the hash references and whether any host can serve bytes for it:

| Node type | Pool key | Servable | Example |
|-----------|----------|----------|---------|
| **Document** | SHA256 of file bytes | Yes | Court filing, image, PDF |
| **Claim** | SHA256 of claim text | Effectively no (text on relays) | "Lab leak is the origin of COVID" |
| **Topic** | SHA256 of topic string | No | `SHA256("china")` |
| **Reply** | SHA256 of reply text | Effectively no (text on relays) | Counter-argument, corroboration |
| **Edge** | SHA256 of rel \|\| hash_A \|\| hash_B | No | "A contradicts B" |

The protocol makes no distinction. Hosts claim from any pool they can prove service for. Pools with no valid host claims accumulate indefinitely — they are demand signals, not income sources.

**Anonymous funding**: Funder deposits via Cashu P2PK using an ephemeral pubkey. The mint confirms the deposit without knowing who sent it. Irrevocable AND unattributable.

**Metadata for graceful degradation**: Optional `meta:*` tags travel with the fund event on relays. When content bytes die (hosts evict, pool depleted), the ghost — full economic history, edges, discussion, and identity metadata — persists on relays. The hash is the only thing that dies.

### Receipt Summary (mint-signed)

Mints publish epoch-aggregated receipt digests — the canonical settlement input.

```
kind: NIP_RECEIPT_SUMMARY_KIND
pubkey: mint_pubkey                      # genesis-delegated
tags:
  ["epoch", "<epoch_number>"]
  ["receipt_merkle_root", "<root>"]
  ["receipt_count", "<n>"]
  ["host_totals", "<host_pubkey>", "<receipt_count>", "<unique_clients>"]  # per host
  ["seq", "<monotonic_sequence>"]
  ["delegation", "<genesis_delegation_event_id>"]
sig: mint signature
```

**Why summaries, not individual receipts**: Individual receipt events are signed by clients (unbounded, non-enumerable). Two settlers querying different relay subsets would see different receipt sets and compute different settlements. Receipt summaries are signed by genesis-delegated mints (bounded, enumerable, gap-detectable via `seq`). Two settlers always converge.

Individual receipt events still publish to relays for transparency and audit. Each read generates K receipts — one per shard-host pair that served a fragment:
```
kind: NIP_RECEIPT_KIND
pubkey: client
tags:
  ["r", "<shard_hash>"]               # shard hash served (deterministic from content hash + index)
  ["content", "<content_hash>"]       # parent content (verifiable: recompute shard hash from content + index)
  ["shard_index", "<index>"]          # which shard (0..N-1)
  ["host", "<host_pubkey>"]           # who served this shard
  ["receipt_token", "<token>"]        # mint-signed proof of service
  ["epoch", "<epoch_number>"]
  ["response_hash", "<hash>"]         # proves correct shard bytes
  ["pow", "<nonce>", "<pow_hash>"]    # anti-sybil (reading is free, PoW prevents abuse)
content: ""
sig: client signature
```

**Receipt token** (the cryptographic core):
```
receipt_token = Sign_mint_sk(
  "R3" || host_pubkey || epoch || shard_hash || content_hash || shard_index || response_hash || pow_nonce || reserved(8)
)
```

Reading is free — no payment fields. The receipt proves shard service + consumption, not payment. `shard_hash` and `shard_index` bind the receipt to a specific fragment of a specific content item. The mint verifies `shard_hash == RS_shard(content_hash, shard_index)` — deterministic, no manifest lookup. `pow_nonce` proves a real client consumed the content. `reserved(8)` bytes for future extensibility without a format break.

**Mint verification flow**: (1) Client resolves shard mapping from relay (shard_hash → host, blob_id). (2) Client requests blob_id from host — host serves opaque blob, never learns shard identity. (3) Client verifies blob decrypts to expected shard (deterministic: shard_hash = RS_shard(content_hash, shard_index)). (4) Client computes PoW over (shard_hash || response_hash || nonce). (5) Client presents PoW + content_hash + shard_index to mint. (6) Mint derives expected shard_hash from content_hash + shard_index (deterministic RS — no manifest needed). (7) Mint verifies shard_hash matches, PoW meets target, response_hash is well-formed. (8) Mint signs receipt_token. (9) Client publishes receipt event. The mint aggregates into epoch summary. The host is never in the verification chain for content identity.

**Verification**: O(1), permissionless. `Ed25519_verify(receipt_token, mint_pubkey)` + `pow_hash < TARGET` + `sig check`.

### Settlement (settler-signed)

A service that subscribes to fund confirmation + receipt summary events, computes epoch payouts, publishes settlement.

```
kind: NIP_SETTLE_KIND
pubkey: settler
tags:
  ["epoch", "<epoch_number>"]
  ["host", "<host_pubkey>"]
  ["r", "<sha256>"]
  ["reward", "<sats>"]
  ["residual", "<sats>"]               # unclaimed → genesis key
  ["receipt_summary_refs", "<event_ids>"]
content: JSON settlement details
sig: settler signature
```

**The settlement rule** (three-level dimensional cascade):
```
for each content_hash cid with active pool:
  for each mint m holding balance for cid:
    mint_drain = floor(epoch_drain(cid) × mint_share(m, cid))
    remainder_1 += epoch_drain(cid) - Σ mint_drains          → genesis

    for each shard s in 0..RS_N-1:
      shard_drain = floor(mint_drain / RS_N)
      remainder_2 += mint_drain - (RS_N × shard_drain)        → genesis

      hosts_s = hosts_with_receipts(s, m, epoch)
      if len(hosts_s) == 0: continue                          # no service, no drain
      per_host = floor(shard_drain / len(hosts_s))
      remainder_3 += shard_drain - (len(hosts_s) × per_host)  → genesis

      for each host h in hosts_s:
        payout(h) += per_host

genesis_total = remainder_1 + remainder_2 + remainder_3

# Abandoned pools sweep to genesis
if no_valid_claims(cid, last_N_epochs):
    sweep(pool[cid]) → genesis_key
```

No fee. No rate. No mandated drain rate. Drain = sum of valid host claims from hosts that proved shard service via PoW receipts. The genesis remainder is the sum of integer truncation at each division level — mints, shards, hosts. Each dimension is independently justified (trust distribution, host-blind storage, availability). The remainder scales with the product of dimensions. Content below MIN_FRAGMENT_SIZE settles as a single shard (N=1), producing fewer divisions and less remainder.

**Canonical event set**: Settlement inputs are exclusively events signed by genesis-delegated keys: fund confirmations + receipt summaries. Both enumerable, both gap-detectable via monotonic `seq`. Two settlers querying overlapping relay sets converge to the same result.

**Multi-mint coordination**: Each pool-CID-mint triple tracks its own balance. The mint that confirmed the deposit handles claims against that balance. No cross-mint coordination needed.

**Properties**:
- Deterministic: same canonical event set → same outputs. Anyone can verify.
- Epochs defined by block height (EPOCH_BLOCKS = 24, ~4h). Global consensus, no wall-clock ambiguity.
- Settlement merkle root anchored via OpenTimestamps.
- Multiple settlers can run simultaneously and cross-verify.

---

## The Storage Market

The protocol is a market. Demand side: funders. Supply side: hosts. Clearing mechanism: receipts and settlement. The depth of this market determines protocol health AND founder income.

### Reading is Free; Funding is Advertising

Readers consume content at zero cost (PoW-gated). Hosts serve content to readers for free — the pool covers both storage AND bandwidth. Popular content costs more to host (bandwidth) and drains its pool faster. But popular content attracts more funders (visibility drives conviction). The market equilibrates: hosting costs scale with demand, funding scales with visibility. Unpopular content is cheap to host and needs minimal funding.

### Demand Signal

Pool balance is public. A hash with 100K sats and zero hosts is a visible opportunity: "this content is worth 100K sats to persist and nobody is earning from it yet."

### Supply Response

Any host can see funded hashes with few hosts (the opportunity signal). They mirror the bytes, start serving, submit receipts, earn from the pool. No registration. No approval. See opportunity, serve bytes, get paid.

### Price Discovery

Hosts declare rates. Cheap hosts attract more content. Expensive hosts serve premium (jurisdiction diversity, SLA, speed). Content naturally migrates to the cheapest adequate host. The market determines drain rate, durability, and redundancy. No protocol parameters needed.

### Drain

```
epoch_drain(cid) = Σ host_claims(cid, epoch)
```

More hosts = faster drain = shorter durability = more funding urgency = more deposits. Fast drain means an active, healthy market. Hosts compete on price; competition compresses rates over time, making content more durable — an emergent anti-decay force.

### Degradation

Market-driven, no parameters:

1. **Fully funded**: Multiple hosts, multiple jurisdictions. Content available and redundant.
2. **Thinning**: Expensive hosts evict first. Cheapest hosts remain. Fewer replicas.
3. **Last host**: Single point of failure. Index shows warning.
4. **Dead**: No hosts. Bytes gone. Ghost persists on relays — full metadata (`meta:*` tags), economic history (funding events), citation graph (edges), discussion (replies). `[+] to restore`.
5. **Restored**: Someone re-funds. A host sees the opportunity, mirrors bytes, starts earning. The gap in the record is permanent and visible.

### Market Depth = Founder Income

Settlement divides drain across M mints × N shards × H hosts. Each division is integer truncation on sats. The genesis remainder scales with the product of dimensions, not their sum.

The founder's income scales with:
- **Shard count (N)** — 20 shards = 20× the divisions vs whole-file hosting
- **Host count per shard (H)** — more hosts per shard = more host-level divisions
- **Mint count (M)** — more mints = more independent mint-level divisions
- **Host transitions** — churn creates epochs where shard drain continues but claims pause
- **Self-healing cycles** — repair lag between shard loss and replacement = unclaimed drain

A thin market (1 host, 1 shard, 1 mint) produces near-zero remainder. A deep market (5 hosts per shard, 20 shards, 3 mints = 300 divisions per pool per epoch) produces ~5-6% structural capture — emergent, no rate set. **Building a deep storage market IS building the income.**

### Three Self-Correcting Loops

1. **Eviction → funding urgency**: Host fills → low-funded content evicted → "not served" visible on index → community funds → content re-hosted
2. **High prices → new hosts**: Hosts fill → storage prices rise → hosting becomes profitable → new operators join → capacity increases → prices stabilize
3. **Content migration**: Expensive host → cheap host has capacity → content migrates → expensive host frees space → equilibrium

### Conviction Momentum

Content sustains from funding, not from reads (reading is free). But reads drive funding: popular content is visible, visible content attracts funders, funded content stays available, available content attracts readers. The feedback loop is: reads → visibility → funding → hosting → reads. The MONEY enters from conviction. The DISTRIBUTION is free. Contested content generates the strongest conviction momentum: both sides fund repeatedly, each round amplifying visibility and driving counter-funding.

---

## Receipt System

### Why Receipts Work

| Attack | Defense |
|--------|---------|
| Fake demand (sybil clients) | Each receipt costs PoW compute (escalating per pubkey/day) |
| Flood receipts | PoW difficulty scales with volume — exponential cost |
| Replay receipts | epoch-bound, single use |
| Fake bytes served | response_hash must match actual content |
| Forge receipt_token | Requires mint private key (Ed25519) |

### Mint Operators (Fragmented Day 1)

3-5 independent operators in different jurisdictions. Each holds a genesis-delegated Ed25519 keypair. Founder holds 1 key. Each operator: holds pool balance fraction (custody), signs receipts (demand verification), publishes receipt summaries, executes settlement payouts.

**Resilience**: Zero coordination between operators for receipt signing. Any 2 surviving = receipts keep flowing, settlements keep computing, payouts keep executing.

**Mint signing is free.** No per-receipt fee. Free minting maximizes receipt volume, which deepens the demand history moat. The moat is the income protection — not the signing fee.

---

## Revenue Model

### Protocol-Level: Dimensional Remainder (unforkable, zero effort)

The genesis key receives the sum of integer truncation at every division level in settlement. This is not a fee. There is no rate, no parameter, no percentage. It is the irreducible coordination cost of multi-party integer settlement on a Bitcoin-denominated substrate.

Settlement divides pool drain across three independent dimensions:
- **Mints** (trust distribution) — pool drain divided among M genesis-delegated mints
- **Shards** (host-blind storage) — per-mint drain divided among N erasure-coded fragments
- **Hosts** (availability) — per-shard drain divided among H hosts with valid receipts

Each division is `floor()` on integer sats. Each produces a remainder. The total remainder scales with M × N × H independent divisions per pool per epoch. With M=3, N=20, H=5: ~300 divisions per pool per epoch. The expected genesis capture is ~5-6% of total drain — emergent from the dimensional structure, not from any set rate.

Additional sources:
- **Timing gaps**: host transitions create epochs where drain continues but shard claims pause.
- **Cross-epoch prorating**: partial-epoch service produces fractional claims truncated to zero.
- **Dust sweep**: abandoned pools (no claims for N epochs) sweep entirely to genesis.
- **Self-healing gaps**: when a shard host departs and a repairer reconstructs + re-uploads, the replacement lag produces unclaimed drain.

The capture rate is not set. It is emergent. Every architectural improvement — more mints, more shards, more hosts — that makes the system more robust also multiplies divisions. The founder's income has convex scaling: it grows faster than the system. A fork copies the same physics but starts with zero dimensions, zero demand history, zero hosts.

The total volume flowing through settlement is conviction spending (funding volume only). Reading is free and generates no pool income. Contested content generates the most conviction spending — competitive repeat funding is the volume engine. The founder earns from the froth of disagreement.

### Product-Level (forkable, requires operation)

**Venue fee**: Whatever the index operator charges on funding through their venue. Market-priced. Raw protocol events via relay: no fee.

**Index products**: API, feed, widgets, institutional licensing. Market-priced. The reference index has a data moat (citation graph, receipt history) but it's forkable with effort.

**Clearinghouse spread**: Whatever the clearinghouse operator charges. Market-priced.

---

## Product: The Importance Index

### Three Axes

| Axis | Source | Measures |
|------|--------|----------|
| **Commitment** | Pool balance (fund events) | How much money is behind this |
| **Demand** | PoW receipt velocity (receipts/epoch) | How much people are consuming right now (free reads, PoW-verified) |
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

Matching engine for structured preservation demand and host supply. Not protocol — a product built on protocol events.

**NIP-PRESERVE** (demand side): Structured bid for replication outcome. Escrowed, refundable, cleared at epoch boundary.
```
tags: ["r", "<sha256>"], ["replicas", "<n>"], ["jurisdictions", "<n>"],
      ["duration", "<epochs>"], ["max_price", "<sats_per_replica_per_epoch>"]
```

**NIP-OFFER** (supply side): Host commits bonded capacity.
```
tags: ["r", "<sha256>"], ["replicas", "<n>"], ["regions", "<list>"],
      ["price", "<sats>"], ["bond", "<sats>"], ["duration", "<epochs>"]
```

**NIP-CLEARING**: Published at epoch boundary. Deterministic, auditable matching.

Spread: whatever the clearinghouse operator charges. Two-tier host market: commodity (spot, pool drain only) vs committed (bonded offer, earns clearing price).

---

## Product: Permanence Tiers

Three-layer durability. Fragment hosting is the default for funded content — host-blind storage is the architecture, not an upgrade:

| Layer | Where | Cost | Durability | Host knowledge |
|-------|-------|------|------------|----------------|
| Relay | Nostr relays (metadata, events, manifests) | PoW (~200ms) | Relay-dependent | Full |
| Fragment | Convergent-encrypted, erasure-coded shards on Blossom servers under random blob IDs | Sats (pool, ~2× overhead) | Pool-funded, self-healing | **None — host is blind, addressing is non-content-based** |
| Inscribed | Bitcoin blockchain | On-chain fee | Permanent | N/A |

Content below MIN_FRAGMENT_SIZE (10 KB) stores as a single shard on Blossom (still encrypted for host-blindness, but no erasure coding — N=1). Content above the threshold is always fragmented. Self-healing: any participant can download K surviving shards, reconstruct, re-encode a missing shard (deterministic — same hash), and upload to a new host to earn from the pool.

**NIP-INSCRIBE**: Taproot witness envelope for permanent content/edges on Bitcoin. Materializer watches for OCDN-prefixed inscriptions. Batched into daily Bitcoin anchor transaction.

---

## Product: Founder Protection

**NIP-INDEX-DELEGATION**: Index master key delegates signing authority to operators in multiple jurisdictions. Founder doesn't need to be online — delegates operate, master key earns.

**Threshold master key**: 2-of-3 FROST. Share 1: founder. Shares 2-3: trusted parties in different jurisdictions. Protects against seizure and coercion.

**NIP-INDEX-BENEFICIARY**: Dead man's switch. Designates beneficiary key that inherits income if master key misses heartbeat. Protects against incapacitation.

---

## Agent Economy

Agents read for free (PoW) and fund with conviction (delegation budget). Three additions:

**Delegation**: Human authorizes agent with budget, allowed kinds, per-event max, expiry. Agent signs events with its own key. Revocation: budget 0.

**Structured Edges**: Agent-produced citation graph entries: `{"_edges": [{"ref": "hex64", "rel": "cites|contradicts|corroborates|supersedes", "w": 0.92}]}`

**Receipt-as-Credential**: Agent's receipt portfolio is a public, machine-verifiable research credential. Proves diligence and consumption volume, not correctness.

**Agent Loop**: Discover (index) → Consume (free, PoW receipt) → Analyze (edges) → Fund (delegation budget) → receipts deepen moat → loop. Agents are both consumers (generating demand signal via PoW receipts) and conviction signalers (funding what they analyze as important). At scale, agent conviction spending may exceed human conviction spending — automated ideologues funded by humans who delegate their conviction to machines.

---

## Human Interface

**Principle**: The product is the READ experience. Reading is free — tap a card, content loads, no payment. The economic signal (what people fund, how heavily, the shape of the disagreement) IS the content. The only economic action is [+] — a deliberate conviction signal, not a consumption toll. Identity lives in NIP-07.

### Universal Symbols

| Symbol | Meaning |
|--------|---------|
| `+` | Fund |
| `/` | Topic |
| `→` `←` | Cites / Cited by |
| `⚡` | Sats |
| `₿` | Bitcoin anchor |

### One Surface: The Feed

One page (`/`). Cards expand inline. Hash URLs (`/<hash>`) deep-link.

**Collapsed card**:
```
court-filing.pdf                           →
⚡84,000  47 funders  23↩  ████████████  [+]
```

**Expanded card** (tap to expand):
```
┌──────────────────────────────────┐
│ court-filing.pdf              →  │
│ PDF · 2.4 MB                    │
│  ⚡ 84,000      47 funders      │
│  ████████████████████████  [+]  │
│  → blossom1.example.com/a1b2    │
│  → blossom2.example.com/a1b2    │
│  → ₿ 820,000                    │
│  ←12      →3                    │
│  23↩ · 4,200⚡ in replies        │
│  ┊ Alice  8×PoW     [+] [620⚡] │
│  ┊  "contradicts the..."        │
│  ┊ Carol          [+] [2,100⚡] │
│  ┊  "corroborating: [ref→]"     │
│  [ ↩ reply ]                    │
└──────────────────────────────────┘
```

### One Action

| Action | Symbol | Flow |
|--------|--------|------|
| **Fund** | `+` | Tap → amount (100/500/2K/10K) → Lightning → done |

**Pre-funded wallet**: Cashu ecash in browser. Deposit once, fund with one tap. 100 sats should cost the same mental effort as a "like."

**Reply** (`↩`): Tap → text input. PoW in background. Optional sats attached. Submit.

**Content states** (inline on card): Live / Not indexed (`[+] to create`) / Not served (`[+] to summon hosts`) / Lost (ghost with full history, `[+] to restore`).

### Routes

| Route | Purpose |
|-------|---------|
| `/` | The feed. Resolver input at top. |
| `/<hash>` | Deep link — card pre-expanded. |
| `/verify/<hash>` | Integrity proof page (institutional-facing). |

### Widget

```html
<ocdn-widget></ocdn-widget>              <!-- feed mode -->
<ocdn-widget hash="a1b2..."></ocdn-widget> <!-- single card -->
```

CDN-hosted. Mobile-responsive. Ship before media outreach.

---

## Content Policy

No governance. No global moderation. Operators apply local policy.

- **Blossom servers**: choose what to store/serve.
- **Nostr relays**: choose what to relay.
- **Index operators**: choose what to rank.
- **Clients**: choose what to display.
- **Protocol**: doesn't know or care what content is. Knows: hash, pool balance, receipt count.

**Append/promote-only**: No edit (hash-addressed = immutable). No delete (events are permanent). No hide (all events are public). Versioning: publish new content with a `supersedes` edge.

**Host compliance vs. system resilience**: Each operator applies local law. Hosts remove specific blob hashes on valid legal order — safe harbor preserved. The system re-uploads removed shards to new hosts via self-healing. Individual compliance and collective persistence are independent properties. No operator needs to break local law for the system to resist censorship.

---

## Private Content Marketplace

Public content is the base layer: funded by conviction, free to read.

Private content uses the same index as a billboard:

1. Seller uploads encrypted content to Blossom
2. Seller funds the pool (self-promotion — pays for hosting the encrypted blob and for ranking position on the index)
3. Preview/metadata is public and free (title, description, price)
4. Index ranks it identically (pool balance, PoW receipt velocity on preview, centrality)
5. Buyer pays seller directly (Lightning/Cashu — outside the protocol) for decryption key
6. Buyer decrypts locally

The protocol earns friction on the seller's promotion spend. The sale is peer-to-peer. The protocol doesn't touch the transaction. This is Google's model: the advertiser pays for placement, the search engine earns from the ad spend, the buyer-seller transaction happens elsewhere.

---

## Constants

Only protocol-adjacent constants. Everything else is operator-set or market-determined.

| Constant | Value | Note |
|----------|-------|------|
| EPOCH_BLOCKS | 24 | ~4h at 10min/block. Bitcoin block height. Natural Schelling point. |
| RS_K | 10 | Reconstruction threshold. Any 10 of 20 shards suffice. |
| RS_N | 20 | Total shards. 2× storage overhead. 10-of-20 for censorship resistance. |
| MIN_FRAGMENT_SIZE | 10240 (10 KB) | Below this: single encrypted shard (N=1). Above: full RS(K,N). |
| CONTENT_KEY_DOMAIN | "ocdn-v1" | Convergent encryption: key = SHA256(domain \|\| content_hash). |
| POW_TARGET_BASE | 2^240 | Anti-spam for receipts + comments. ~200ms mobile. |
| POW_SIZE_UNIT | 1048576 (1 MB) | PoW scales with content size. |
| NIP Event Kinds | 1000-9999 range | Non-replaceable. Pool credits are additive. |

**Operator-set** (not protocol):

| Parameter | Set by | Note |
|-----------|--------|------|
| Venue fee | Index operator | Whatever the venue charges. |
| Clearing spread | Clearinghouse operator | Whatever the clearinghouse charges. |
| Host storage rate | Each host | Market-determined. Covers storage + bandwidth for free reads. |
| Damping factor | Each index | Reference: 0.85. Competing indexes choose their own. |
| Inscription weight | Each index | Reference: 2×. Product decision. |

---

## MVP Build Order

### Phase 1: Prior Work (Complete)

File layer, L402, node kit, receipt SDK, pin contracts. Receipt cryptography carries forward.

### Phase 2: Launch MVP (Ship This)

1. **Lightning payment backend** — LNbits on VPS. Real invoices. The gating item.
2. **Venue fee** — operator-set, deducted at venue level. Protocol events via relay: 0%.
3. **Fix NIP event kinds** — non-replaceable range. Pool credits must be additive.
4. **Real-time SSE on funding** — cards update live.
5. **Remove review gate** — default to "live". Moderate post-hoc.
6. **Text/link posting** — propositions are first-class.
7. **Visual OG card** — the viral loop.
8. **Deploy** — Postgres + LNbits on VPS.
9. **Seed** — 20-30 timely propositions, 100-500 sats each.
10. **Cashu pre-funded wallet** — one-tap funding.
11. **Zap-to-pool bridge** — capture existing Nostr economic flow.
12. **Competitive display** — funded contradictions surface as live head-to-head clusters.

13. **Client-side RS encoding** — convergent encrypt + Reed-Solomon(10,20) + shard distribution to Blossom servers. The settlement income depends on fragment-level division.

### Post-Launch (Build When Triggered)

| Feature | Trigger |
|---------|---------|
| Receipt economy (NIP-RECEIPT + Blossom addon) | Hosts want pool revenue |
| Full settlement (NIP-SETTLE + cross-verification) | Multiple settlers running |
| Clearinghouse (preserve/offer matching) | Preservation demand from users |
| Bitcoin inscriptions | Demand for permanence |
| Importance API + competing index support | Organic API inquiries |
| Block-level chunking | Streaming media demand |
| Founder key ceremony (FROST 2-of-3) | Income justifies ceremony |

---

## Role Fragmentation

Every role is profitable to operate independently.

| Role | Day 1 operators | Revenue | Failure mode |
|------|----------------|---------|--------------|
| Mint operators | 3-5 peers, different jurisdictions | Market-set settlement fees | Any 2 survive = receipts + payouts flow |
| Importance indexes | Founder + competitors | API fees, venue fees | Any 1 survives = rankings exist |
| Clearinghouse | Founder + competitors | Market-set spread | Degrades to raw pool credits |
| Code / DNS | 2-3 maintainers | None | Any 1 survives = code available |

### The Longevity Test

> If founder is permanently removed at midnight: do receipts still mint (distributed mints), pool balances still accessible (federated custody), events still propagate (Nostr relays), blobs still serve (Blossom servers), state still computable (canonical event set), epochs still settle (peer settlers), payouts still execute (any surviving operator), indexes still rank (competing materializers), code still buildable (multi-platform repos)? Every "no" is a failure.

### The Income Durability Test

> If founder is in custody at midnight: does residual still accumulate to genesis key (embedded in settlement math), can income be accessed (threshold key — 2 of 3 trusted parties), is income in a seizure-resistant form (on-chain BTC), does income redirect if founder can't claim (beneficiary designation)? Every "no" is a vulnerability.

---

## Go-to-Market

### Positioning

Not "decentralized storage." Not "censorship-resistant platform."

**"The economic indexing layer for content that matters."**

For consumers: **"Content that can't be killed, priced by the people who care."**

For institutions: **"Proof URLs — verifiable evidence links with Bitcoin-anchored timestamps."**

For agent platforms: **"The demand oracle — what should your agent consume next?"**

### Bootstrap Sequence

```
Week 0:    Seed 20-30 timely claims/documents. 100-500 sats each.
           Total budget: 5K-15K sats. Feed live. [+] works.

Week 1:    Share on Nostr and Bitcoin Twitter. "Put your money where
           your mouth is." OG cards are the viral loop.

Week 2-4:  Observe: funders-per-item. Do people fund? What types?
           If nothing: thesis tested for 15K sats, not 12 months.

Month 2+:  If validated: add funded discussion, widget, importance API.
           Build what the market demands.
```

### What NOT to Do

- Don't curate. Operate infrastructure, not editorial.
- Don't build social features first. Economics first.
- Don't chase volume. Chase intensity.
- Don't explain the protocol. Show the content. "47 people funded this document's survival" is the entire pitch.

### Obsession Metric

**Repeat funders per contested topic.** Every design decision judged by: does it drive competitive repeat funding?

---

## Post-MVP Revenue Layers

| Layer | Trigger | Revenue profile |
|-------|---------|-----------------|
| Priority replication auctions | 10+ hosts | Convex (crisis spikes) |
| Pin insurance / SLA | 6mo telemetry, institutional demand | Recurring, high-margin |
| Namespace auctions | Organic "topic ownership" attempts | Culturally convex |
| Institutional API | Organic inquiries | Recurring |
| Pro dashboard | 1000+ DAU | Recurring |

### Day-1 Data Constraint

Every event, receipt, body edge, graph computation, and threshold crossing stored in queryable, exportable schema from day 1. Materialized views are disposable. The raw event stream is sacred. Data lost is revenue destroyed.

---

## The One-Sentence Version

**A permissionless conviction scoreboard where sats bind to hashes, reading is free, and content is convergent-encrypted and erasure-coded into host-blind shards. Settlement divides pool drain across mints, shards, and hosts — each division is integer arithmetic on sats, each produces a remainder that flows to the genesis key. No fee, no rate, no parameter: the remainder is the irreducible coordination cost of multi-party settlement on an integer substrate, and it scales with the product of dimensions. Funding is advertising. Contested content drives repeat funding. The dimensional friction of a deep storage market is the founder's permanent income. The moat deepens with every receipt and requires zero effort.**
