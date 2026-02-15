# Permissionless Storage Market — Nostr-Native

**Purpose**: A permissionless conviction scoreboard. Sats bind to hashes. Reading is free. Funding is advertising — funders pay for availability and visibility, readers consume for free. Content is convergent-encrypted and erasure-coded into store-blind shards. Four separated roles — stores prove possession, serve endpoints deliver bytes and earn referrer income, mints verify both and earn from coordination, genesis collects the remainder — ensure no intermediary can redirect economic flows. Settlement divides pool drain across mints, a coordination shard, storage shards, and stores — each division is integer arithmetic on sats, each produces a remainder that flows to the genesis address, a protocol constant like the 21M cap. Coordination costs one shard: N shards for storage, 1 for the participants who make the market work. The importance index is the product. The dimensional friction of a deep storage market is the income. The reference client is the moat.

---

## Core Thesis

1. **Spam is a pricing problem** — Mandatory minimum fees filter infinite spam.
2. **Censorship is an availability market** — Replication funded by those who care.
3. **Infrastructure is a commodity** — Borrow it. Nostr relays distribute events. Blossom servers store blobs. Lightning/Cashu handle payments. Nostr keys handle identity. All already deployed, already distributed, already resilient.
4. **The protocol is a storage market; the index is the product** — The protocol clears payments between funders and stores. The importance index — the real-time, economically-weighted ranking of what humanity values enough to pay to persist — is a product built on the market's public data. The protocol is plumbing; the index is the shopfront. Reading is free (PoW-gated). Funding costs sats. The two axes — conviction (funding) and attention (PoW request proofs) — are independent measurements. Their divergence IS the signal. No other system produces both.
5. **The hierarchy is append/promote-only** — Content, topics, and discussion form a graph. Nodes are added (append) or funded (promote). Nothing is edited, deleted, or hidden at the protocol level. Loss is an explicit, auditable state — the pool exists, the request proofs existed, the bytes are gone. Every other information system makes loss silent. This one makes loss visible, attributable, and economically actionable.
6. **Store-blind storage** — Stores hold encrypted, erasure-coded shards under random blob IDs. They cannot determine what content their fragments represent AND cannot be externally identified as storing a specific content item. Convergent encryption makes shards deterministic for verification; blind addressing (random blob IDs, mapping encrypted to content key on relays) breaks the public content_hash → store link that would otherwise let an adversary scan for known hashes. Store attestations are submitted directly to the mint (not published on relays) — stores never appear in public events by real pubkey. The store operator makes zero editorial decisions: software selects shards by economic signal (payout per byte), not by content. No content inspection, no acceptance policy, no legal judgment, no content-addressed scanning surface. Storage is a commodity: bytes in, sats out. Serving is a separate, untrusted role — any front-end, CDN, or proxy can deliver bytes to readers. The store's legal posture: generic encrypted blob cache — cannot decrypt, cannot identify content, complies with blob-ID removal on valid legal order. Censorship requires taking down more than N-K stores across jurisdictions simultaneously, while economic incentives actively recruit replacements. The adversary's takedown action increases per-store payout, advertising the opportunity to replacement stores. The system channels self-interest (stores want sats, funders want permanence, readers want signal) into collective censorship resistance.
7. **Resilience is a property of greed, not architecture** — The protocol doesn't specify redundancy. It makes storage profitable and anonymously operable; serving is a separate, permissionless role that requires no bond and earns referrer income from the coordination shard. Rogue store operators watch for funded content with few stores (the opportunity signal), mirror fragments, earn sats. Censoring content increases the per-store payout, attracting replacements. The adversary fights economic gravity. The protocol specifies incentive gradients; profit-seeking actors carve the architecture.
8. **The genesis address is a protocol constant** — The genesis address is embedded in the protocol specification — like EPOCH_BLOCKS or RS_K. It is not an authority, not a delegation root, not a key that controls anything. It receives settlement remainder by the math, not by any operational role. Mints are bonded (on-chain UTXO), not genesis-delegated — anyone can become a mint by posting a verifiable bond. The founder operates nothing post-launch. Forking the income requires forking the demand history AND convincing every operator to change one constant in their software. The moat deepens with every request proof and requires zero ongoing effort.
9. **The founder's income is proportional to settlement dimensionality** — Settlement divides pool drain across independent dimensions: mints (trust distribution), coordination (market facilitation), shards (store-blind storage), and stores (availability). Each dimension produces independent integer remainders. The remainder count scales with the product of dimensions, not their sum. Every architectural improvement — more mints, more referrers, more shards, more stores — that makes the system more robust also multiplies the number of integer divisions. The genesis income has convex scaling: it grows faster than any single system metric. No fee. No rate. The income is the irreducible coordination cost of multi-party integer settlement. The founder operates nothing — the income is passive, structural, embedded in the settlement math that independent settlers run. A fork copies the same physics but starts with zero dimensions.
10. **Coordination costs one shard** — Settlement divides each mint's drain among N+1 shards: N storage shards that pay stores, and 1 coordination shard that pays the participants who make the market work — the mint that verified, the referrers that brought users, and genesis. No new constants. N+1 is derived from N. The coordination payment is structurally equivalent to one shard's worth of income — the cost of coordination is denominated in the same unit as storage. Mints earn because they verify. Referrers earn because they distribute. Genesis earns a share plus the coordination remainder. The ~4.8% coordination allocation (1/21) is emergent from the shard count, not a parameter.
11. **The moat is compound: three defaults** — The genesis address is a protocol constant in settler code (the floor). The reference client hardcodes the founder's pubkey as the default referrer `via` tag (the ceiling — income proportional to traffic through the client). The reference client defaults to the founder-bonded mint (deposit stickiness — sats in custody don't migrate). A fork must change one constant AND build a better client AND attract deposits away from the default mint. Any one is easy. All three simultaneously, while also bootstrapping stores, mints, and demand history, is the moat. Defaults are sticky without ongoing competition.
12. **Funding is advertising** — Funders pay for availability and visibility. Readers consume for free. This is advertising economics: the person who wants attention pays, the person who has attention consumes for free. Free distribution maximizes the audience that makes funding valuable. Conviction spending is the revenue. Free reading is the amplifier.
13. **The system optimizes for contested content** — Uncontested content is funded once. Contested content is funded repeatedly by competing sides. Competitive dynamics drive repeat funding — the highest-velocity economic behavior in the system. The founder earns from the froth of disagreement, not from any position. Free reading amplifies this: everyone sees the scoreboard, everyone can take a side.
14. **The protocol is four event types and one rule** — (1) Fund confirmation: sats bind to a hash. (2) Request proof: client proves intent to consume (PoW-gated, gates content delivery, includes referrer `via` tag). (3) Store attestation: store proves it served a shard for a specific request (signed, submitted directly to mint). (4) Settlement: deterministic payout computation matching request proofs to store attestations. Rule: unclaimed drain → genesis address. Pools with no valid attestations for N consecutive epochs are abandoned — remaining balance sweeps to genesis. Everything else — store pricing, content durability, ranking, discussion structure, edge types, topic organization — is a product concern or emergent market property.
15. **The network metabolizes failed attention bids** — Self-promoters deposit sats to fund their own content. If nobody reads it, no stores earn, the pool sits unclaimed, and sats sweep to genesis. The network converts low-value interaction into founder income. Contested content produces remainder income (active market). Ignored content produces sweep income (failed attention bid). Both modes pay genesis. The total addressable revenue is all inflow, not just successful content.
16. **The protocol settles; the product interprets** — Settlement is narrow, deterministic, and hard to game (requires real sats, real storage, real bonds). The importance index is broad, interpretive, and soft-gameable — but also forkable, competitive, and improvable without protocol changes. Most attacks target the index. The index is the expendable layer. Settlement — where the money flows — is robust. Attacks on interpretation don't corrupt settlement. Attacks on settlement require real capital at risk.
17. **Text conviction is the highest-margin income** — Genesis income per sat funded is inversely proportional to content size. Text claims (no stores, no shards) → pool sweeps to genesis → **100% capture**. Small documents (N=1, 2-shard settlement) → coordination shard = 50% of drain → genesis captures ~16.7%. Large documents (N=20, 21-shard settlement) → coordination shard = 4.8% → genesis captures ~1-2% (one of R+2 coordination participants, plus remainders). The froth of competing ideologies is almost entirely text claims. Text conviction spending is the most efficient income source in the protocol. The store economy earns from documents; the sweep mechanism earns from discourse. Both pay genesis. The escalation from text claims to document evidence is the value creation moment — someone uploads the actual court filing, stores join, the storage market activates.

---

## What This System Invented

Seven things no existing system provides:

1. **A pool attached to a hash** — money bound to content identity, not to an author or server
2. **Request proofs as demand signal** — PoW-gated request proofs gate content delivery, ensuring every read produces a verifiable demand signal. The `via` tag attributes distribution to the front-end that facilitated the request
3. **Pool drain to proven stores** — stores earn from pools proportional to proven storage of consumed content
4. **The coordination shard** — settlement divides among N+1 shards: N for storage, 1 for the participants who make the market work (mints, referrers, genesis). Coordination costs one shard — no fee, no rate, derived from an existing constant
5. **The importance index** — the ranking derived from 1-3: commitment × demand × centrality
6. **Accountable loss** — every node that ever existed leaves a permanent economic trace (pool events, request proofs, settlements, Bitcoin anchors). Loss is a first-class state: the record survives the bytes. No other system distinguishes "never existed" from "existed and was lost"
7. **Multi-party request-attestation binding** — content delivery is gated behind a client request proof (PoW + Nostr signature + referrer `via` tag); stores attest directly to the mint (not through the front-end); the front-end earns from the coordination shard but cannot redirect store income. No intermediary can redirect economic flows because each participant signs their own part of the composite receipt

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
| **SERVE** | None | Yes — coordination shard via referrer (`via` tag in request proofs) | **None — untrusted delivery pipe** |
| **MINT** | On-chain bond | Yes — coordination shard share + bond slash income | Bonded, auditable |
| **SETTLER** | None | None (public service) | Deterministic, auditable by anyone |

### Three Communication Channels

```
CLIENT ←→ SERVE ENDPOINT ←→ STORES     delivery channel (front-end lives here)
CLIENT ─────────────────→ RELAYS        request proofs (public demand signal)
STORES ─────────────────→ MINT          attestations (private, bypasses front-end)
MINT   ←───────────────→ STORES        storage challenges (direct, out-of-band)
```

The front-end controls the delivery channel and earns from the coordination shard via the `via` tag in request proofs. Economic signaling — request proofs, store attestations, storage challenges — flows through independent channels the front-end cannot intercept. A malicious front-end can route traffic and earn its referrer share, but cannot forge any participant's signature or redirect store income. The front-end's economic role is bounded: it earns from coordination, not from storage.

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
| **Convergent encryption + deterministic RS** | Protocol | Content key = SHA256(domain \|\| content_hash). RS(K,N) with canonical shard ordering. Shard hashes are deterministic for verification — no manifest trust surface. |
| **Blind addressing + encrypted mapping** | Protocol | Stores hold shards under random blob IDs, not shard hashes. Mapping (shard_hash → store, blob_id) encrypted to content key on relays — only clients who know content_hash can resolve store locations. Breaks the public content_hash → store link. Stores cannot be scanned for known content. |
| **Fund confirmation event** | Protocol | Bind sats to content hash (bonded mint-signed) |
| **Request proof event** | Protocol | Client PoW + Nostr signature + referrer `via` tag, gates content delivery, published to relays as demand signal |
| **Store attestation** | Protocol | Store signs "I served shard i for request R", submitted directly to mint (not published on relays) |
| **Settlement event** | Protocol | Deterministic payout across mints × (N+1) shards (coordination + storage) × stores (settler-signed) |
| **Storage challenge protocol** | Protocol | Mint challenges stores with random byte offsets + Merkle proofs. Latency-tested. Stores that fail lose epoch earnings. Repeated failure → bond slash → genesis. |
| **Cross-store verification** | Protocol | Each epoch, stores are randomly assigned to verify a peer's storage challenge response. Earning requires both proving your own storage AND verifying a peer. |
| **Bonded mint registration** | Protocol | On-chain UTXO as bond. Permissionless entry. Fraud proof (double-sign, fabricated attestations) → bond slashed to genesis address. |
| **Fraud proof event** | Protocol | Anyone can publish provable evidence of mint/store misbehavior → triggers bond slash |
| **`ocdn-store` daemon** | Product | Commodity storage: watches opportunity signal, stores encrypted shards, responds to mint challenges, attests to mint, cross-verifies peers, earns BTC. Zero editorial decisions. `docker run` entry point. |
| **Importance index** | Product | Rankings, feed, API, widget. Anyone operates. |
| **OG image endpoint** | Product | Cloudflare Worker renders live scoreboard snapshots for social sharing. Stateless, serve-layer. The viral loop. |
| **Clearinghouse** | Product | Preserve/offer order matching |
| **Founder protection** | Product | Threshold keys for genesis address, beneficiary dead-man switch |

### Trust Assumptions

- **Custodial trust (bond = custody ceiling)**: Bonded mints hold pool balances. Irreducible — sats that persist across epochs and pay multiple parties over time require custody. **Protocol rule: `balance(mint) ≤ bond_value(mint)`.** The bond is not a fixed entry cost — it is the maximum custodial capacity. Deposits that would exceed the ratio are rejected; the client routes to the next mint. Mints compete for deposits by posting larger bonds: larger bond → more capacity → more deposits → more coordination income. Net gain from theft is zero or negative (bond forfeited ≥ balances stolen). All custody operations are auditable from public events.
- **Founder operates: nothing post-launch.** The genesis address is a protocol constant. The founder has no operational role, no delegation authority, no admin key. All roles are operated by independent bonded or permissionless actors.
- Independent operators run: bonded mints, stores, serve endpoints, settlers, importance indexes
- All settlement is deterministic and auditable from the canonical event set — anyone can recompute from day 1
- **Competing settlers, competing mints, and competing importance indexes are permitted and encouraged from day 1**
- **Store liability isolation**: Stores hold encrypted blobs under random IDs with no manifest, no content index, no content-addressed scanning surface. Legal posture: generic encrypted blob store, not a content platform. Individual stores honor blob-hash removal on valid legal order (safe harbor). The system heals through replacement — removed shards are re-uploaded to new stores by the self-healing mechanism. Store compliance and system censorship-resistance are independent properties.
- **Serve endpoint isolation**: Serve endpoints (front-ends, CDNs, proxies) deliver bytes and earn referrer income from the coordination shard via the `via` tag. They cannot redirect store income because request proofs are signed by clients (NIP-07) and store attestations are signed by stores and submitted directly to mints. The front-end's economic role is bounded to coordination — it cannot inflate its own referrer income without generating real demand (valid request proofs + store attestations).

### Symbiosis

- **Blossom servers** have no revenue model → store economy gives them pool income
- **Relay operators** have no sustainability path → economically meaningful events create traffic worth persisting
- **Nostr clients** have no economic ranking signal → importance scores are a new feature any client can subscribe to
- **VPS operators / homelabbers** have idle disk and bandwidth → `ocdn-store` daemon converts latent storage into BTC income with zero content liability
- **Front-end operators** have audiences but no economic layer → serve endpoints earn referrer income from the coordination shard via the `via` tag in request proofs. Better UX → more traffic → more referrer income. Composable with ads or venue fees on top
- **Positive-sum**: the economic layer makes the Nostr layer more sustainable; the Nostr layer makes the economic layer more resilient.

---

## Protocol: Four Event Types

### 1. Fund Confirmation (bonded mint-signed)

A two-step process: (1) funder deposits sats to a bonded mint, (2) mint publishes a signed confirmation event to relays.

**Step 1 — Deposit** (private, off-relay): Funder sends sats to a mint via Lightning invoice or Cashu P2PK transfer locked to the mint's pubkey. The mint credits the pool on its internal ledger. No bearer tokens are published on relays.

**Step 2 — Confirmation** (public, on-relay):
```
kind: NIP_POOL_KIND (non-replaceable, 1000-9999 range)
pubkey: mint_pubkey                      # bonded mint signs
tags:
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

| Node type | Pool key | Servable | Genesis income mode |
|-----------|----------|----------|---------------------|
| **Document** | SHA256 of file bytes | Yes (shards on Blossom) | Settlement: coordination share + remainder (~1-2%) |
| **Claim** | SHA256 of claim text | No (text on relays) | Sweep: 100% capture after N epochs |
| **Topic** | SHA256 of topic string | No | Sweep: 100% capture after N epochs |
| **Reply** | SHA256 of reply text | No (text on relays) | Sweep: 100% capture after N epochs |
| **Edge** | SHA256 of rel \|\| hash_A \|\| hash_B | No | Sweep: 100% capture after N epochs |

The protocol makes no distinction. Stores earn from any pool they can prove storage for, provided the content has consumption demand. Pools with no servable content and no valid attestations accumulate indefinitely and eventually sweep to genesis — conviction tax on the scoreboard signal. The highest-margin income is text conviction (100% sweep). The highest-volume income is document storage (settlement drain).

**Re-funding after sweep**: A swept pool is zeroed, not destroyed. The hash persists on relays (ghost state). Re-funding the same hash credits the same pool — the claim reappears on the leaderboard at its new balance. The economic history (previous funding rounds, sweep events, edges, replies) is permanent. Each funding cycle is visible: "funded 3 times, swept twice, currently live." Repeat funding of discourse is the primary revenue behavior — the protocol makes it a single tap on a ghost.

**Anonymous funding**: Funder deposits via Cashu P2PK using an ephemeral pubkey. The mint confirms the deposit without knowing who sent it. Irrevocable AND unattributable.

**Metadata for graceful degradation**: Optional `meta:*` tags travel with the fund event on relays. When content bytes die (stores evict, pool depleted), the ghost — full economic history, edges, discussion, and identity metadata — persists on relays. The hash is the only thing that dies.

### 2. Request Proof (client-signed, public)

A PoW-gated request that gates content delivery. Stores will not serve shards without a valid request proof. Every read generates a demand signal by construction — no silent consumption.

```
kind: NIP_REQUEST_KIND (non-replaceable, 1000-9999 range)
pubkey: client_pubkey                   # client Nostr key (NIP-07)
tags:
  ["r", "<content_hash>"]              # what the client wants to consume
  ["pow", "<nonce>", "<pow_hash>"]     # anti-sybil (reading is free, PoW prevents abuse)
  ["epoch", "<epoch_number>"]
  ["via", "<referrer_pubkey>"]         # front-end that facilitated this request (earns coordination shard)
content: ""
sig: client signature (NIP-07)
```

**Two modes** — same event, different function depending on content type:
- **Stored content (documents)**: gates delivery + demand signal + referrer attribution. Stores verify before serving.
- **Relay content (claims, replies, topics, edges)**: demand signal + referrer attribution only. No delivery gating needed — text is freely available on relays. The client still generates and publishes the request proof for the importance index to count. PoW still provides anti-sybil. `via` tag still attributes the front-end.

**Gating**: For stored content, stores verify the request proof before serving. Invalid PoW, bad signature, wrong epoch → store refuses. This ensures every consumption event produces a verifiable demand signal. The front-end can request this signature from NIP-07 but cannot modify `content_hash` — the extension shows what it's signing.

**Ephemeral keys (privacy by default)**: The reference client defaults to ephemeral keys for request proofs — a fresh key per session, unlinkable to the reader's main Nostr identity. Readers who want a consumption credential (agents, researchers) opt in to identified proofs signed by their main key. Sybil risk from ephemeral keys affects only the index (display layer), not settlement (economic layer) — drain is gate-triggered by the existence of valid request proofs, not count-triggered by their volume. The index can weight commitment (sats, unsybilable) over demand (request proofs, sybilable).

**Referrer (`via` tag)**: The front-end's pubkey. Settlement credits the coordination shard to participants identified in valid request proofs. Forgery is unprofitable — a front-end can set `via` to itself, but only earns if the request proof also produces valid store attestations for consumed content. You can't fake the demand, so you can't profit from fake referrals. The reference client hardcodes the founder's pubkey. Other front-ends use their own.

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

**Multi-party binding**: The attestation contains `request_hash` — cryptographically chained to the client's signed request proof. Neither the client nor the store can be impersonated. The front-end earns from the coordination shard via the `via` tag but cannot redirect store income because:
- The client signed the request including `via` tag (NIP-07 — front-end can't forge a different referrer)
- The store signed the attestation (store's private key — front-end can't forge)
- The store submitted the attestation directly to the mint (front-end can't intercept)

**Consumption flow**: (1) Client signs request proof via NIP-07 (includes `via` referrer tag set by front-end). (2) Request reaches store (through any serve endpoint / front-end / proxy). (3) Store verifies PoW + client signature + epoch. (4) Store serves shard (opaque encrypted blob — store never learns content identity). (5) Store signs attestation binding itself to this request. (6) Store submits attestation to mint directly. (7) Client receives shard, verifies hash, reconstructs content from K shards. (8) Client publishes request proof to relays (public demand signal — includes referrer attribution).

**Verification**: O(1). `Ed25519_verify(attestation, store_pubkey)` + `bond_check(store_pubkey)` + `request_hash matches valid request proof`.

**Attestation receipt**: Mint returns a signed acknowledgment on attestation delivery: `ack(attestation_hash, epoch, mint_sig)`. Store retains the receipt. If the mint's epoch summary omits an acknowledged attestation, the store publishes `(attestation, ack)` as a fraud proof → selective omission is provable → bond slash. Without receipts, a mint can silently drop attestations with no recourse.

### Epoch Summary (bonded mint-signed)

Mints publish epoch-aggregated summaries — the canonical settlement input.

```
kind: NIP_EPOCH_SUMMARY_KIND
pubkey: mint_pubkey                      # bonded mint
tags:
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
  ["epoch", "<epoch_number>"]
  ["store", "<store_pubkey>"]
  ["r", "<sha256>"]
  ["reward", "<sats>"]
  ["residual", "<sats>"]               # unclaimed → genesis address
  ["epoch_summary_refs", "<event_ids>"]
content: JSON settlement details
sig: settler signature
```

**The settlement rule** (four-level dimensional cascade with coordination shard):
```
for each content_hash cid with active pool AND request proofs this epoch:
  for each mint m holding balance for cid:
    mint_drain = floor(epoch_drain(cid) × mint_share(m, cid))
    remainder_1 += epoch_drain(cid) - Σ mint_drains          → GENESIS_ADDRESS

    # N+1 shards: 1 coordination + N storage. No new constant — derived from RS_N.
    shard_unit = floor(mint_drain / (RS_N + 1))
    remainder_2 += mint_drain - ((RS_N + 1) × shard_unit)    → GENESIS_ADDRESS

    # Coordination shard: pays the participants who make the market work
    coord_drain = shard_unit
    referrers = unique_via_pubkeys_from_valid_request_proofs(cid, epoch)
    coord_participants = 1(mint m) + len(referrers) + 1(genesis)  # R+2
    per_coord = floor(coord_drain / coord_participants)
    remainder_coord += coord_drain - (coord_participants × per_coord) → GENESIS_ADDRESS
    payout(mint m) += per_coord
    for each referrer r in referrers:
      payout(r) += per_coord
    payout(genesis) += per_coord + remainder_coord             # share + sub-remainder

    # Storage shards: pay stores as before
    for each shard s in 0..RS_N-1:
      shard_drain = shard_unit
      stores_s = stores_with_valid_attestations_AND_storage_proofs(s, m, epoch)
      if len(stores_s) == 0: continue                          # no service, no drain
      per_store = floor(shard_drain / len(stores_s))
      remainder_3 += shard_drain - (len(stores_s) × per_store) → GENESIS_ADDRESS

      for each store st in stores_s:
        payout(st) += per_store

genesis_total = remainder_1 + remainder_2 + remainder_coord + remainder_3
             + coordination_shares

# Abandoned pools sweep to genesis
if no_valid_attestations(cid, last_N_epochs):
    sweep(pool[cid]) → GENESIS_ADDRESS
```

**Earning requires BOTH demand AND proven storage**: A store earns for a shard only if (1) it submitted a valid attestation for a valid request proof this epoch AND (2) it passed the mint's storage challenge for that shard this epoch. Attestation without storage proof = invalid (prevents proxy-only stores). Storage proof without attestation = no demand signal (content not consumed).

**Coordination costs one shard**: The N+1th shard funds the coordination layer — the mint, the referrers, and genesis. No fee, no rate, no new constant. The coordination allocation is 1/(N+1) ≈ 4.8% of per-mint drain, emergent from the shard count. Within the coordination shard, all participants are peers in one flat floor() division. More referrers = more coordination divisions = more genesis remainder from this level. Mints earn because they verify. Referrers earn because they distribute. Genesis earns a share plus every sub-remainder.

No mandated drain rate. Drain = sum of valid store claims from stores that proved both storage and service via attestations. The genesis remainder is the sum of integer truncation at each division level — mints, shards (N+1), coordination participants, stores. Each dimension is independently justified (trust distribution, coordination, store-blind storage, availability). The remainder scales with the product of dimensions. Content below MIN_FRAGMENT_SIZE settles as a single shard (N=1, coordination shard still applies), producing fewer divisions and less remainder.

**Canonical event set**: Settlement inputs are exclusively events signed by bonded keys: fund confirmations + epoch summaries. Both enumerable, both gap-detectable via monotonic `seq`. Two settlers querying overlapping relay sets converge to the same result. Bond validity checked at epoch boundary — unbonded mint events are invalid.

**Multi-mint coordination**: Each pool-CID-mint triple tracks its own balance. The mint that confirmed the deposit handles claims against that balance. No cross-mint coordination needed.

**Properties**:
- Deterministic: same canonical event set → same outputs. Anyone can verify.
- Epochs defined by block height (EPOCH_BLOCKS = 24, ~4h). Global consensus, no wall-clock ambiguity.
- Settlement merkle root anchored via OpenTimestamps.
- Multiple settlers can run simultaneously and cross-verify.
- `GENESIS_ADDRESS` is a protocol constant — embedded in every settler's code, not a parameter.

---

## The Storage Market

The protocol is a market. Demand side: funders. Supply side: stores. Clearing mechanism: request proofs, store attestations, and settlement. The depth of this market determines protocol health AND founder income.

### Reading is Free; Funding is Advertising

Readers consume content at zero cost (PoW-gated). Content delivery is handled by serve endpoints (front-ends, CDNs, proxies) — a permissionless role that earns referrer income from the coordination shard via the `via` tag. Stores earn from pools for proven storage of consumed content. Popular content has more request proofs, driving faster pool drain. But popular content attracts more funders (visibility drives conviction). The market equilibrates: storage costs scale with demand, funding scales with visibility. Unpopular content is cheap to store and needs minimal funding.

### Demand Signal

Pool balance is public. Request proof volume is public. A hash with 100K sats and zero stores is a visible opportunity: "this content is worth 100K sats to persist and nobody is earning from it yet." Demand signal is reliable by construction — stores gate delivery behind request proofs, so every read generates a verifiable signal. No silent consumption.

### Supply Response

Any store can see funded hashes with few stores (the opportunity signal). They mirror the shards, pass storage challenges, start earning from the pool. No registration beyond posting a bond. No approval. See opportunity, store bytes, get paid.

### Price Discovery

Stores declare rates. Cheap stores attract more content. Expensive stores serve premium (jurisdiction diversity, SLA, speed). Content naturally migrates to the cheapest adequate store. The market determines drain rate, durability, and redundancy. No protocol parameters needed.

### Drain

```
epoch_drain(cid) = Σ store_claims(cid, epoch)
```

More stores = faster drain = shorter durability = more funding urgency = more deposits. Fast drain means an active, healthy market. Stores compete on price; competition compresses rates over time, making content more durable — an emergent anti-decay force.

### Degradation

Market-driven, no parameters:

1. **Fully funded**: Multiple stores, multiple jurisdictions. Content available and redundant.
2. **Thinning**: Expensive stores evict first. Cheapest stores remain. Fewer replicas.
3. **Last store**: Single point of failure. Index shows warning.
4. **Dead**: No stores. Bytes gone. Ghost persists on relays — full metadata (`meta:*` tags), economic history (funding events), citation graph (edges), discussion (replies). `[+] to restore`.
5. **Restored**: Someone re-funds. A store sees the opportunity, mirrors shards, starts earning. The gap in the record is permanent and visible.

### Market Depth = Founder Income

Settlement divides drain across M mints × (N+1) shards × (R+2 coordination participants or S stores). The genesis remainder scales with the product of dimensions, not their sum. The coordination shard gives genesis a structural share, not just truncation scraps.

The founder's income scales with:
- **Shard count (N+1)** — 21 shards (20 storage + 1 coordination) = 21× the divisions vs whole-file storage
- **Store count per shard (S)** — more stores per shard = more store-level divisions
- **Mint count (M)** — more mints = more independent mint-level divisions
- **Referrer count (R)** — more referrers (front-ends) = more coordination divisions = more genesis remainder from coordination level
- **Store transitions** — churn creates epochs where shard drain continues but attestations pause
- **Self-healing cycles** — repair lag between shard loss and replacement = unclaimed drain
- **Reference client traffic** — founder earns referrer share of coordination proportional to traffic through the reference client

A thin market (1 store, 1 shard, 1 mint, 1 referrer) produces modest income — genesis is one of 3 coordination participants (mint + referrer + genesis), earning ~1.6% of drain. A deep market (5 stores per shard, 20+1 shards, 3 mints, 5 referrers) → genesis coordination share ~1-2% plus remainders at every division level. The reference client's referrer income adds on top. **The primary income from active markets is referrer income (via client traffic), not coordination share. The primary income overall is sweep (100% of discourse pools). Building a deep storage market with an active reference client IS building the income.**

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

Content sustains from funding, not from reads (reading is free). But reads drive funding: popular content is visible, visible content attracts funders, funded content stays available, available content attracts readers. The feedback loop is: reads → visibility → funding → storage → reads. The MONEY enters from conviction. The DISTRIBUTION is free. Contested content generates the strongest conviction momentum: both sides fund repeatedly, each round amplifying visibility and driving counter-funding.

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
| Front-end redirects store income | **Impossible** — stores sign their own attestations and submit directly to mint. Front-end earns only its referrer share of the coordination shard via `via` tag — bounded, cannot inflate without real demand. |
| Sybil referrers (fake `via` tags) | Referrer income requires valid request proofs with matching store attestations. You can't profit from fake referrals without generating real consumption. |
| Store proxies without storing | Storage challenges (random byte offset + Merkle proof, latency-tested) catch fetch-on-demand. Repeated failure → bond slash. |
| Sybil receipt inflation | Receipt doesn't credit specific stores — demand signal is diluted across ALL stores for that content. Less profitable than original model. |
| Store self-dealing (own request proofs) | **Tolerated — self-dealing is work, not fraud.** The store pays real PoW, provides real storage (must pass challenges), and triggers correct settlement (genesis earns coordination share + remainder). The funder wanted persistence; the store provides it. Cost (PoW + storage + bond) makes it unprofitable at scale. At small scale, it converts sweep income (100% genesis) to settlement income (~1-2% genesis) — a bounded loss. |
| Mint-store collusion | Block-hash-assigned cross-store verification. Colluding mint cannot rig peer assignments. Probability of colluding verifier = C/S per epoch. Over multiple epochs, honest peer is assigned and fake storage is caught. Bond at risk for both parties. |
| Mint deposit flight | Bond = custody ceiling (`balance ≤ bond`). Net gain from theft is zero or negative. |
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

Each epoch, the Bitcoin block hash at the epoch boundary determines the verification ring — not the mint. Assignment is deterministic from `hash(block_hash || store_set || epoch)`, unpredictable before the block, and independently verifiable by anyone.

```
Epoch E (block hash determines ring):
  Store_A proves shard_3 → Store_B assigned to verify Store_A's response
  Store_B proves shard_7 → Store_C assigned to verify Store_B's response
  Store_C proves shard_12 → Store_A assigned to verify Store_C's response
```

Earning requires BOTH passing your own challenge AND verifying a peer. Block-hash assignment removes the mint from the challenge loop — the mint collects attestations and publishes summaries, but cannot rig verification assignments. Mint-store collusion requires the block-hash-assigned peer verifier to also be colluding. With S total stores and C colluding, probability of drawing a colluding verifier is C/S per epoch — over multiple epochs, an honest verifier is eventually assigned and fake storage is caught. The assignment record is public: if a fraud proof later shows Store B never had the shard, Store A's "pass" verdict implicates Store A's bond too.

### Bonded Mint Operators (Permissionless)

Permissionless entry via on-chain bond (BTC in time-locked UTXO). Any operator in any jurisdiction. Each operator: holds pool balance fraction (custody), verifies request proofs, collects store attestations, issues storage challenges, publishes epoch summaries, executes settlement payouts.

**Bootstrap exception**: The founder operates a bonded mint at launch (Phase 2-3). This is the irreducible bootstrap cost — deposits require a mint. The founder's mint is the `DEFAULT_MINT` in the reference client. The "founder operates nothing" property is achieved at the Phase 4 "forget" threshold when independent mints bond. Minimize the bootstrap window: recruit one partner mint before launch so redundancy exists from day 1.

**Resilience**: Zero coordination between operators. Any 2 surviving = request proofs verified, attestations collected, settlements computed, payouts executed.

**Fraud proofs**: Anyone can publish provable evidence of mint misbehavior (double-signing, fabricated attestations, phantom epoch summaries). Fraud proof → bond slashed to genesis address. Additional founder income from misbehavior.

**Mint verification is free.** No per-request fee. Free verification maximizes request proof volume, which deepens the demand history moat. The moat is the income protection — not a signing fee.

---

## Revenue Model

### Protocol-Level: Coordination Shard + Dimensional Remainder (passive, zero effort, zero operational role)

The founder's income comes from two protocol-level sources: the coordination shard (a structural share of settlement) and the dimensional remainder (integer truncation at every division level). Neither is a fee. Neither is a rate. Both are emergent from the settlement structure. The founder operates nothing — income flows to a protocol constant (genesis address) and to the reference client's `via` pubkey.

**Four income modes — all pay the founder:**
- **Active market (coordination share + remainder)**: Content is funded, stored, read. The coordination shard pays genesis a participant share alongside mints and referrers. Integer truncation at every level → genesis. The reference client's `via` pubkey earns a referrer share of coordination.
- **Failed attention (sweep)**: Content is funded, nobody reads it, no stores attest. Pool sits unclaimed for N epochs → sweeps entirely to genesis. Self-promoters, whistleblowers, and spammers who fail to attract attention donate their sats to the network. The system metabolizes noise into income.
- **Bond slash (misbehavior)**: Stores or mints that cheat (fabricated attestations, failed storage challenges, double-signing) lose their bond to the genesis address. The system converts misbehavior into founder income.
- **Referrer income (reference client)**: Every request proof facilitated through the reference client includes the founder's `via` pubkey. The coordination shard pays referrers proportionally. Income scales with reference client traffic — a first-mover social moat, not a protocol constant.

The total addressable revenue is all inflow — successful, failed, and fraudulent. Every sat deposited either flows through the active market (producing coordination shares + remainder), dies unclaimed (producing sweep), or is slashed from misbehaving operators (producing slash income). Genesis and the reference client's referrer pubkey collect from all modes.

Settlement divides pool drain across four independent dimensions:
- **Mints** (trust distribution) — pool drain divided among M bonded mints
- **Shards** (coordination + storage) — per-mint drain divided among N+1 shards (1 coordination, N storage)
- **Coordination participants** (market facilitation) — coordination shard divided among mint + R referrers + genesis
- **Stores** (availability) — per-storage-shard drain divided among S stores with valid attestations AND storage proofs

Each division is `floor()` on integer sats. Each produces a remainder. With M=3, R=2, N=20, S=5: the coordination shard allocates ~4.8% of per-mint drain. Genesis is one of R+2 coordination participants → coordination share ≈ 1/(R+2) × 4.8% ≈ 1.2% of per-mint drain, plus integer remainders at every level.

**Income hierarchy** (descending by margin):
1. **Sweep** (100% capture) — text conviction pools with no store attestations for SWEEP_EPOCHS. All discourse funding. Highest margin, scales with ideological intensity.
2. **Referrer** (coordination participant share) — via reference client traffic. Scales with client market share. Fragile to better clients.
3. **Coordination share + remainder** (~1-2% of active market drain) — structural, scales with market depth. Robust to client competition.
4. **Bond slash** (episodic) — misbehavior income. Unpredictable, front-loaded to early network.

The primary income is sweep and referrer. The coordination share from active storage markets is a structural floor, not the ceiling. Build for sweep volume (contested discourse) and client dominance (OG cards, UX moat).

Additional sources:
- **Timing gaps**: store transitions create epochs where shard drain continues but attestations pause.
- **Cross-epoch prorating**: partial-epoch service produces fractional claims truncated to zero.
- **Dust sweep**: abandoned pools (no attestations for N epochs) sweep entirely to genesis.
- **Self-healing gaps**: when a shard store departs and a repairer reconstructs + re-uploads, the replacement lag produces unclaimed drain.
- **Bond slashes**: misbehaving stores/mints lose bonded capital to genesis.

The capture rate is not set. It is emergent. Every architectural improvement — more mints, more referrers, more shards, more stores — that makes the system more robust also multiplies divisions and coordination participants. The founder's income has convex scaling. A fork copies the same physics but starts with zero dimensions, zero demand history, zero stores, and no default client traffic.

The total volume flowing through settlement is conviction spending (funding volume only). Reading is free and generates no pool income. Contested content generates the most conviction spending — competitive repeat funding is the volume engine. The founder earns from the froth of disagreement.

**Fire-and-forget economics**: The founder's legal posture is: published open-source code, then walked away. Zero operational cost, zero legal surface, zero admin keys. The genesis address is a constant like `EPOCH_BLOCKS = 24`. The reference client's `via` pubkey is hardcoded in a static SPA deployed to IPFS. The compound moat is three defaults: genesis address in settlers, `via` pubkey in the reference client, default mint in the reference client. Removing all three requires forking the protocol, building a better client, and attracting deposits — simultaneously.

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

Three-layer durability. Fragment storage is the default for funded content — store-blind storage is the architecture, not an upgrade:

| Layer | Where | Cost | Durability | Store knowledge |
|-------|-------|------|------------|-----------------|
| Relay | Nostr relays (metadata, events, manifests) | PoW (~200ms) | Relay-dependent | Full |
| Fragment | Convergent-encrypted, erasure-coded shards on Blossom servers under random blob IDs | Sats (pool, ~2× overhead) | Pool-funded, self-healing | **None — store is blind, addressing is non-content-based** |
| Inscribed | Bitcoin blockchain | On-chain fee | Permanent | N/A |

Content below MIN_FRAGMENT_SIZE (10 KB) stores as a single shard on Blossom (still encrypted for store-blindness, but no erasure coding — N=1). Content above the threshold is always fragmented. Self-healing: any participant can download K surviving shards, reconstruct, re-encode a missing shard (deterministic — same hash), and upload to a new store to earn from the pool.

**NIP-INSCRIBE**: Taproot witness envelope for permanent content/edges on Bitcoin. Materializer watches for OCDN-prefixed inscriptions. Batched into daily Bitcoin anchor transaction.

---

## Product: Founder Protection

The founder operates nothing — there is no index to delegate, no mint to manage, no admin role to exercise. Protection applies only to the genesis address and its accumulated income.

**Threshold genesis key**: 2-of-3 FROST. Share 1: founder. Shares 2-3: trusted parties in different jurisdictions. Protects against seizure and coercion. The genesis address receives income automatically — the threshold key is only needed to SPEND it.

**NIP-GENESIS-BENEFICIARY**: Dead man's switch. Designates beneficiary key that inherits genesis income if the threshold key misses a heartbeat. Protects against incapacitation.

---

## Agent Economy

Agents read for free (PoW) and fund with conviction (delegation budget). Three additions:

**Delegation**: Human authorizes agent with budget, allowed kinds, per-event max, expiry. Agent signs events with its own key. Revocation: budget 0.

**Structured Edges**: Agent-produced citation graph entries: `{"_edges": [{"ref": "hex64", "rel": "cites|contradicts|corroborates|supersedes", "w": 0.92}]}`

**Request-Proof-as-Credential**: Agent's request proof portfolio is a public, machine-verifiable research credential. Proves diligence and consumption volume, not correctness.

**Agent Loop**: Discover (index) → Consume (free, PoW request proof) → Analyze (edges) → Fund (delegation budget) → request proofs deepen moat → loop. Agents are both consumers (generating demand signal via PoW request proofs) and conviction signalers (funding what they analyze as important). At scale, agent conviction spending may exceed human conviction spending — automated ideologues funded by humans who delegate their conviction to machines.

**Follow Investigation**: Client subscribes to edges of type `corroborates|contradicts|supersedes` for a specific hash subgraph. Agents continuously add structured edges; humans consume the resulting map via alerts. One button on claim detail: "Follow." ~20 lines of client code — relay subscription filter on edge types.

---

## Human Interface

**Principle**: The product is the READ experience. Reading is free — tap a card, content loads, no payment. The economic signal (what people fund, how heavily, the shape of the disagreement) IS the content. The only economic action is [+] — a deliberate conviction signal, not a consumption toll. Identity lives in NIP-07. **No free interaction primitives.** Every signal that influences rank must cost sats. Free signals (votes, reactions, stance labels) are substitutes for paid signals — every free vote is a funding event that didn't happen. The funding UX IS the interaction UX. 100 sats should feel like a like.

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

 184,000⚡  · 47 funders  · 23↩
 2,400⚡/epoch ↑  ·  8/10◇  ·  →3  ←14
 ████████████████████████████░░░░░  [+]

 ↩  corroborating: I worked in div. 2   [+]
    and saw the ledger discrepancies...
    4,200⚡

 ↩  this is a misread of GAAP           [+]
    standards...
    2,100⚡

 ↩  → spreadsheet.xlsx                  [+]
    1,800⚡

 [↩]
```

Velocity with direction, store coverage (`8/10◇`), outgoing citations (`→3`), incoming citations (`←14`). All symbols, no labels. Conviction bar: solid fill = claim pool, lighter fill = reply pool. When reply fill exceeds claim fill, the claim is being actively contested.

`[↩]` at the bottom — tap to reply. No label.

### One Action

`[+]` → tap → amount (100 / 500 / 2K / 10K) → Lightning → done.

No label. The symbol is the action. 100 sats should cost the same mental effort as a like.

**Wallet**: NIP-47 (Nostr Wallet Connect). Connect once (QR/string), persists encrypted on relays (NIP-78). Subsequent `[+]` taps → wallet pays automatically from any device. We hold zero sats. Cashu in-browser as fallback.

**Reply**: `[↩]` → text input. PoW in background. Optional ⚡ attached. Submit.

**Content states** (communicated by opacity + one-line status, no labels):
- **Live** — full opacity. Card is normal.
- **Not indexed** — `[+] to create`. Faded, one line.
- **Not stored** — `[+] to summon stores`. Card visible, `◇` indicator shows 0/K.
- **Ghost** — faded. Full economic history visible. `[+] to restore`.
- **Swept** — faded. `10K⚡ · 3 funders · 7 days · swept` in small muted type. `[+] to re-fund`. Swept is the normal end-state for discourse. The ghost IS the permanent record; the pool balance is the ephemeral amplifier.

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

**Store compliance vs. system resilience**: Each operator applies local law. Stores remove specific blob hashes on valid legal order — safe harbor preserved. The system re-uploads removed shards to new stores via self-healing. Individual compliance and collective persistence are independent properties. No operator needs to break local law for the system to resist censorship.

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
| GENESIS_ADDRESS | `<address>` | Protocol constant. Settlement remainder destination. Immutable. Like the 21M cap. |
| EPOCH_BLOCKS | 24 | ~4h at 10min/block. Bitcoin block height. Natural Schelling point. |
| RS_K | 10 | Reconstruction threshold. Any 10 of 20 shards suffice. |
| RS_N | 20 | Total storage shards. 2× storage overhead. 10-of-20 for censorship resistance. Settlement divides among N+1 (21) shards: N storage + 1 coordination. |
| MIN_FRAGMENT_SIZE | 10240 (10 KB) | Below this: single encrypted shard (N=1). Above: full RS(K,N). |
| CONTENT_KEY_DOMAIN | "ocdn-v1" | Convergent encryption: key = SHA256(domain \|\| content_hash). |
| POW_TARGET_BASE | 2^240 | Anti-spam for request proofs + comments. ~200ms mobile. |
| POW_SIZE_UNIT | 1048576 (1 MB) | PoW scales with content size. |
| SWEEP_EPOCHS | 42 | ~7 days. Pools with no valid attestations for this many consecutive epochs sweep to genesis. Balances text conviction income (100% sweep) against giving stores time to join. |
| MIN_ATTESTATIONS | 1 (graduates to RS_K) | Minimum store attestations for a valid consumption event. Starts at 1 for bootstrap; increases toward RS_K as store count grows. Graduation thresholds are protocol constants, not operator-set. |
| CHALLENGE_INTERVAL | 1 epoch | How often mints challenge stores for storage proof. |
| NIP Event Kinds | 1000-9999 range | Non-replaceable. Pool credits are additive. |

**Reference client constants** (not protocol — embedded in the reference SPA):

| Constant | Value | Note |
|----------|-------|------|
| FOUNDER_VIA_PUBKEY | `<pubkey>` | Default `via` tag in request proofs generated through the reference client. Earns referrer share of coordination shard. Other front-ends use their own pubkey. |
| DEFAULT_MINT | `<mint_pubkey>` | Default deposit mint in reference client. First-mover deposit stickiness. |

**Operator-set** (not protocol):

| Parameter | Set by | Note |
|-----------|--------|------|
| Min deposit | Each mint | Anti-spam. Reference mint: 100 sats. Low-ball mints attract dust — their overhead. |
| Venue fee | Serve endpoint operator | Whatever the venue charges. Founder charges nothing (operates nothing). |
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

1. **Static client SPA + OG endpoint** — No backend. No server. Connects to Nostr relays via WebSocket. Renders the conviction leaderboard (topics → claims → replies, two tabs: Top/Now, four sort modes). Generates request proofs via NIP-07 with `via` tag set to `FOUNDER_VIA_PUBKEY`. Routes funding via NWC/Cashu (client-side only) through `DEFAULT_MINT`. Stateless: NIP-07 for identity, NIP-47 for wallet, NIP-51 for watchlist, NIP-78 for preferences — all on relays, zero server state. Deploy to IPFS + pin on multiple gateways. Also deploy to Vercel/Cloudflare Pages under a domain. OG image endpoint as Cloudflare Worker (stateless, serve-layer — renders live scoreboard snapshots for social sharing). Includes `/earn` route for operator recruitment. Alert system computed client-side from relay subscriptions. Text/link posting, resolver input, real-time funding updates, competitive display — all client-side. **This is the founder's primary income-generating asset** — every request proof through this client earns referrer income from the coordination shard. First-mover links, OG cards, bookmarks, and documentation references compound the social moat without ongoing effort.
2. **Protocol spec (NIP)** — Four event types (fund confirmation, request proof with `via` tag, store attestation, settlement), bonded mints, coordination shard, settlement rule with `GENESIS_ADDRESS` constant. Short enough to read in 20 minutes. Once published, immutable.
3. **`ocdn-settle` binary** — Deterministic CLI (single static binary). Input: relay URL(s) + mint epoch summaries. Output: settlement events published to relays. `GENESIS_ADDRESS` is a constant in the source. Content-hash the binary, publish the hash.
4. **`ocdn-store` daemon** — Docker container. Watches relays for opportunity signal (funded content, few stores), stores encrypted shards, responds to mint storage challenges, submits attestations directly to mint, cross-verifies peers, earns BTC to LN address. Zero editorial decisions. `docker run ocdn-store --ln-address=<me>`.

### Phase 3: Ignite (one day)

5. **Publish** — NIP spec to Nostr protocol repos. Open-source all four artifacts on GitHub. Docker image to Docker Hub. Static client to IPFS + domain.
6. **Seed** — Fund 20-30 timely propositions from multiple ephemeral keys. 100-500 sats each. Total budget: 100-200K sats. **The seed content IS the marketing.** Selection criteria: items people will screenshot and share on X/Reddit/Signal with "look at this." Prioritize: (a) suppressed documents with active news cycles, (b) contested claims where both sides are vocal online, (c) whistleblower-adjacent content that people already share in DMs. The seed leaderboard must look interesting to a stranger in 3 seconds. Bad seeds = dead product regardless of protocol quality. Curate the seeds as carefully as the protocol.
7. **Announce** — Post on Nostr: "The OCDN protocol is live. Here's what people are funding. Here's the spec. Here's the store daemon — run it and earn sats." OG cards are the viral loop.
8. **Zap-to-pool bridge** — capture existing Nostr economic flow.

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

> If founder is permanently removed at midnight: do request proofs still verify (bonded mints), pool balances still accessible (bonded mint custody), events still propagate (Nostr relays), shards still serve (stores + serve endpoints), state still computable (canonical event set), epochs still settle (independent settlers), payouts still execute (any bonded mint), indexes still rank (competing materializers), reference client still serving (static SPA on IPFS — no server to fail), code still buildable (open-source repos, IPFS-pinned)? **Every answer is "yes" by construction — the founder was never in the loop.**

### The Income Durability Test

> If founder is in custody at midnight: does residual still accumulate to genesis address (protocol constant in every settler's code — yes), does referrer income still accumulate (reference client on IPFS with hardcoded `via` pubkey — yes), can income be accessed (threshold key — 2 of 3 trusted parties — yes), is income in a seizure-resistant form (on-chain BTC — yes), does income redirect if founder can't claim (beneficiary designation — yes)? **Every answer is "yes" — no operational role means no operational vulnerability.**

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
Day 0:     Publish spec + code + deploy static client (IPFS + domain).
           OG endpoint live. /earn page live.
           Seed 20-30 items from ephemeral keys. 100-200K sats total.
           Feed live. [+] works. OG cards shareable.

Day 1:     Announce on Nostr. "The OCDN protocol is live. Here's what
           people are funding. Run a store and earn sats."

Week 1-2:  Share on Nostr and Bitcoin Twitter. "Put your money where
           your mouth is." OG cards are the viral loop.

Week 2-4:  Observe: funders-per-item, independent stores joining,
           independent mints bonding. Do people fund? Do stores join?
           If nothing: thesis tested for 200K sats, not 12 months.

Month 2:   "Forget" threshold: 2+ independent operators per role.
           Shut down any founder-operated infrastructure. Walk away.

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

## The One-Sentence Version

**A permissionless conviction scoreboard where sats bind to hashes, reading is free, and content is convergent-encrypted and erasure-coded into store-blind shards. Four separated roles — stores prove possession, serve endpoints deliver bytes and earn referrer income, mints verify and earn from coordination, genesis collects the remainder — ensure no intermediary can redirect economic flows. Settlement divides pool drain across mints, N+1 shards (N storage + 1 coordination), and stores — each division is integer arithmetic on sats, each produces a remainder that flows to the genesis address. Coordination costs one shard: the N+1th shard funds mints, referrers, and genesis. No fee, no rate: the structure is the irreducible cost of multi-party settlement on an integer substrate. Funding is advertising. Contested content drives repeat funding. The founder operates nothing. The compound moat is three defaults: genesis address in settlers, referrer pubkey in the reference client, default mint in the reference client. The dimensional friction of a deep storage market is the founder's permanent passive income. The moat deepens with every request proof and every link shared, and requires zero effort.**
