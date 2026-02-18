# Permissionless Storage Market — Nostr-Native

**Purpose**: A permissionless conviction scoreboard. Sats bind to hashes. Reading is free. Funding is advertising. Four separated roles (store, serve, mint, genesis) ensure no intermediary can redirect economic flows. Settlement divides each mint's pool drain among P participants at parity — coordination earns what one store-shard pair earns. The importance index is the product. The dimensional friction of a deep storage market is the income. The economic moat deepens with every upload.

---

## Glossary

Terms are defined here once; the rest of the document uses them by reference.

### Roles

| Term | Definition |
|------|-----------|
| **Store** | Unbonded operator holding encrypted shards behind anonymous transport (Tor hidden service by default). Earns from pool drain via settlement. Challenge protocol is the sole enforcement. Reachable by opaque address — protocol is transport-agnostic. |
| **Serve endpoint** | Untrusted delivery pipe (front-end, CDN, proxy) + filtered Nostr relay for OCDN event kinds. Earns referrer income via `via` tag. No bond required. Event persistence is a natural extension of the serve role — serve endpoints already consume relay data to function; persisting it aligns incentives (better event availability → more traffic → more via income). Signed events make persistence trustless. |
| **Mint** | Fidelity-bonded operator (time-locked UTXO) behind anonymous transport (Tor hidden service default, like stores): holds pool balances, verifies request proofs, collects attestations, issues storage challenges, publishes epoch summaries. Tenure-weighted custody ceiling. Identified by pubkey + on-chain bond UTXO, not by operator identity. Deposits via HTLC-gated Cashu-over-Tor (atomic, zero-trust — see §1). |
| **Settler** | Anyone who computes deterministic payouts from epoch summaries. Public service, no bond. |
| **Genesis address** | Protocol constant receiving settlement remainders + sweep. Embedded in code — the one value that spans all protocol versions and all per-mint parameter sets. Not an authority. No income from misbehavior. |

### Settlement Math

Settlement is **per-shard**: each shard is an independent micro-market. No cross-shard coupling.

| Symbol | Definition |
|--------|-----------|
| **N** | Shard count. 1 for text (below MIN_FRAGMENT_SIZE), RS_N (20) for documents. |
| **S_s** | Stores with valid attestations for shard *s* this epoch. Per-shard, not global. |
| **K** | Reconstruction threshold: any K of N shards suffice (RS_K = 10). Mints gate request proofs on coverage ≥ K. |
| **P_s** | Participant count per shard = S_s + 1. Stores for this shard + 1 coordination. |
| **R** | Unique referrer count from valid request proofs this epoch. |
| **DRAIN_RATE** | Per-epoch fraction of mint balance drained. `drain = floor(balance × DRAIN_RATE)`. Pool half-life = ln(2)/DRAIN_RATE. Balance-proportional → mint-count-invariant (deposit splitting doesn't penalize duration). |
| **Coordination fraction** | 1/P_s = 1/(S_s+1) per shard. Independent of N. Shrinks as shard depth grows. |
| **Participant parity** | All P_s participants per shard earn `floor(shard_drain/P_s)`. Coordination is one of them. |
| **Cascading remainder** | Two levels of `floor()` per shard: L1 (shard division) + L2 (coordination subdivision). L1 + L2 remainders → genesis. L2 uses a constant 3-way split (mint / referrer pool / genesis) — R-invariant. Referrer pool subdivided internally by proof count; internal remainder → top referrer (sybil-dilutive). More shards × more content = more independent divisions = more genesis income in absolute sats, smaller percentage. |
| **Self-balancing** | Equal shard drain + per-shard parity: thin shards (low S_s) pay more per store, thick shards (high S_s) pay less. Stores migrate to gaps. |
| **TENURE_DECAY** | Per-mint declared. Store income maturation curve: `weight = 1 - TENURE_DECAY^tenure` where `tenure` = consecutive epochs with valid attestations for this shard at this mint. New stores earn less; the unpaid portion recycles to the pool, extending content lifetime. Reference default 2/3. |
| **Tenure recycling** | Per-store, per-shard: `unit_s - floor(unit_s × weight)` credits back to the pool each epoch. Pool balance is no longer strictly monotonically decreasing — churn returns sats, extending effective half-life beyond `ln(2)/DRAIN_RATE`. Stable stores earn full rate; churning stores subsidize duration. |

Bootstrap reference (any N, at R=1): At S=1, coordination fraction = 50%. At S=3: 25%. At S=10: 9.1%. At S=100: ~1%. Genesis share = 1/3 of coordination unit + L1 remainder + L2 remainder (0-2 sats). R-invariant: referrer count doesn't change the L2 denominator. See [Settlement Rule](#4-settlement-settler-signed) for canonical pseudocode.

### Content Lifecycle

| Term | Definition |
|------|-----------|
| **Pool** | Sats bound to a content hash. Credits accumulate from fund events; drains pay stores + coordination. |
| **Drain** | Per-epoch outflow from a pool. `drain = floor(balance × DRAIN_RATE)`, divided equally across N shards. Balance-proportional: pool half-life is deterministic, store count doesn't affect drain speed. Gate-triggered: drain fires when any valid attestation exists this epoch; request proof volume doesn't change the amount. Effective drain is reduced by tenure recycling — immature stores earn less, and the unpaid portion credits back to the pool (see Glossary: Tenure recycling, §4). |
| **Sweep** | Pool with no valid attestations AND no valid request proofs for SWEEP_EPOCHS (42 epochs, ~7 days) → entire balance to genesis. Dual condition prevents adversary-triggered sweep via mint takedown (popular content with broken attestation channel still has request proofs on relays). |
| **Ghost** | Content whose pool is depleted. The economic fossil persists: metadata, economic history, edges, discussion on relays; content hash + cumulative economic state provable against Bitcoin-anchored content state tree (see Settlement §4). Bytes are gone from the storage market — stores evicted, no one paid to serve. M persists on relays (inert without shards; enables recovery from surviving offline copies). `[+] to restore`. |
| **Coverage signal** | Per-content shard store count, published by mints each COVERAGE_BLOCKS (~1h). No store identities. Used by stores for opportunity assessment. |

### Storage & Privacy

| Term | Definition |
|------|-----------|
| **Convergent encryption** | Deterministic inner encryption layer: `key = SHA256(CONTENT_KEY_DOMAIN \|\| content_hash)`. Same content → same ciphertext → verifiable without trust. Used by mints for upload verification. The mint's encryption layer wraps this before storage. |
| **Mint encryption layer** | Per-content random key M generated by mint at upload. `stored_shard_i = AES(convergent_shard_i, KDF(M, shard_index))`. M distributed to bonded mints via gossip, relay-escrowed with Argon2 gating (same KDF as store location mappings). Stores never learn M or K_shard. Adversary cannot link store disk contents to specific content without M. |
| **Blind addressing** | Stores hold shards under random blob IDs, not shard hashes. Mapping registered with mints, never published in cleartext on relays. |
| **Store-blind** | Three independent protections + one behavioral invariant. (1) **Content-blind**: doubly-encrypted shards — convergent encryption (inner) wrapped by mint's random key M (outer). Stores cannot determine content identity. (2) **Operator-blind**: stores operate behind anonymous transport (Tor hidden service default). Relay-escrowed mappings point to opaque addresses, not physical operators. Content→shard→address is derivable (Argon2-gated); address→operator is cryptographically broken. (3) **Payment-blind**: store earnings paid as Cashu ecash tokens (Chaum blind signatures). Mint cannot link issuance to redemption. No Lightning address, no payment-layer deanonymization. (4) **Hash-blind local state**: the daemon uses content_hash transiently during shard acquisition (from coverage signals) but persists only `blob_id → encrypted bytes` and `blob_id → earnings_rate` (pushed by mint). No content_hash in local state on disk. The content_hash ↔ blob_id mapping exists only at the mint. Eviction decisions use per-blob_id earnings — no content identity needed. Seizure of store hardware reveals opaque blobs under random IDs, with no link to content hashes. Adversary can identify *what* is stored at an address but not *who* operates it, *where earnings flow*, or (from local state alone) *which content hashes the blobs correspond to*. Verifiability proportional to responsibility: mints are bonded (on-chain UTXO, operator anonymous behind Tor like stores), stores are unbonded (commodity, anonymous behind Tor). Trust anchored in on-chain commitments + observable behavior, not operator identity. |
| **Delivery token** | Mint-signed, single-use, epoch-bound authorization for a serve endpoint to fetch one blob from one store. Contains blob_id, store address (opaque — may be .onion), epoch, nonce, selection_proof, mint signature. No content_hash. Replaces direct client-to-store discovery. **Verifiable store selection**: `selected_index = hash(block_hash \|\| content_hash \|\| shard_index \|\| request_proof_hash) mod S_s` against the previous epoch's committed store set (`store_set_root` in epoch summary). All inputs are public or client-chosen — mint cannot bias selection without rejecting valid request proofs (detectable) or falsifying the committed store set (detectable via cross-store verification). Stores verify selection correctness on every delivery token; statistical deviation over an epoch is provable fraud. The delivery token bundles two functions: **authorization** (anti-abuse) and **mediation** (per-request privacy + routing). Authorization is redundant with PoW — the mint adds mediation. In degraded mode (no mint reachable), stores accept PoW directly as weaker authorization; mediation is lost but availability is preserved (see Degraded-Mode Retrieval). |
| **Replication token** | Delivery token variant authorizing a store (not a serve endpoint) to fetch a shard from an existing store for persistent replication. Same structure, same verification. Mint issues on store request (PoW-gated); new store fetches blob, verifies `SHA256(bytes) == integrity_hash` from coverage signal (trustless — no M needed), stores under a new blob_id, registers mapping with mint. Shard acquisition is isomorphic to content delivery. Mint mediates authorization (~200 bytes), stores transfer data (bytes to megabytes). Initial upload exception: first stores acquire from the mint's temporary cache (Step 1b). After that, store-to-store replication takes over. |
| **Key envelope** | Per-retrieval bundle of K_shard values encrypted to the client's pubkey (from the request proof). Carried opaquely by the serve endpoint — serve endpoint cannot decrypt. Client opens the envelope to strip the mint's encryption layer from retrieved shards. |
| **Shard** | One piece of doubly-encrypted content. Text = 1 shard (N=1). Documents = N shards via RS erasure coding. Stored under the mint's encryption layer; the convergent inner layer is invisible to stores. |
| **Mapping** | The content_hash → (store, blob_id) association. Four layers: relay-encrypted (durable, persisted by serve endpoint relay archives + external Nostr relays as fallback) → mint cache (fast, PoW-gated) → serve cache (organic) → coverage signals (anonymous counts only). Clients never receive mapping data directly — serve endpoints proxy via delivery tokens. |
| **Degraded-mode retrieval** | Fallback when no bonded mint is reachable. Stores accept PoW-authorized direct requests (blob_id + PoW proof, no delivery token). Serve endpoints discover stores via relay-encrypted mappings (Argon2-gated), recover M from relay escrow. The delivery token's authorization function is redundant with PoW; the mint adds mediation (per-request privacy, routing, settlement). Decomposing the two means mint liveness controls economics, not availability. Activates when store's persistent mint connections are down > MAX_SILENT_EPOCHS — locally verifiable, unfakeable by external parties. No settlement, no attestation, no income for any participant. Structurally worse for everyone → no perverse incentive. See §3 consumption flow (degraded), Unresolved #14. |

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
| **Bond (fidelity)** | Time-locked on-chain BTC UTXO (`OP_CSV`) as commitment signal. `balance(mint) ≤ bond_value(mint) × tenure_factor`. Not slashable — enforcement is competitive exit (stores and clients reroute to reliable mints). The bond is a pre-paid insurance premium; the ceiling is the coverage limit. |
| **Cashu payout** | Store earnings issued as Cashu ecash tokens (blind-signed bearer instruments) delivered via Tor. Mint cannot link issuance to redemption (Chaum blind signatures). Store redeems at any Cashu-compatible mint, any time. Closes the anonymity loop: anonymous transport hides the operator, blind signatures hide the payment. Eliminates Lightning payout failures and PAYOUT_THRESHOLD accumulation. |
| **Dwell-based PoW** | Reference client pre-mines request proofs in background; submits on viewport dwell ≥2s. Reading feels instant. |
| **Ephemeral message** | Free Nostr event. Relay-only, no protocol awareness, no pool, no rank influence. Visible as collapsed `+ n` counts. `[+]` upgrades to funded. |
| **Economic moat** | Four layers, descending by durability: (a) **economic state** — accumulated deposits, settlement history, Bitcoin-anchored content state tree. Unforkable without re-bootstrapping the entire system. (b) **Schelling point** — reference implementations set defaults; market converges around them. Requires out-competing adoption, not changing a constant. (c) **traffic** — reference client hardcodes the founder's via tag. (d) **deposit routing** — reference client defaults to founder-bonded mint. A fork can freeload on relay mappings but cannot redirect deposits without bonding its own mints and operating settlement — the expensive part. Layers (c) and (d) are speed bumps; layers (a) and (b) are structural. |

---

## Core Thesis

1. **Spam is a pricing problem** — Mandatory minimum fees filter infinite spam.
2. **Censorship is an availability market** — Replication funded by those who care.
3. **Infrastructure is a commodity** — Borrow it. Nostr relays distribute events. Blossom servers store blobs. Lightning/Cashu handle payments. Nostr keys handle identity. All already deployed, already distributed, already resilient.
4. **The protocol is a storage market; the index is the product** — The protocol clears payments between funders and stores. The importance index is a product built on the market's public data. The protocol is plumbing; the index is the shopfront. The two axes — commitment (pool balance) and demand (request proof velocity) — are independent measurements. Their divergence IS the signal. No other system produces both.
5. **The hierarchy is append/promote-only** — Content, topics, and discussion form a graph. Nodes are added (append) or funded (promote). Nothing is edited, deleted, or hidden at the protocol level. Loss is an explicit, auditable state — the pool exists, the request proofs existed, the economic fossil is Bitcoin-anchored, the bytes may be gone. Every other information system makes loss silent. This one makes loss visible, attributable, economically actionable, and cryptographically provable against Bitcoin.
6. **Store-blind storage** — Three independent protections (see Glossary: Store-blind): content-blind (doubly-encrypted shards), operator-blind (anonymous transport), payment-blind (Cashu). Stores cannot determine what they hold; no adversary can determine who operates a store or where earnings flow.

   **Store posture**: Zero editorial decisions — software selects shards by economic signal, not by content. Encrypted blobs in, encrypted blobs out, behind an address no one can attribute. Store daemon holds blobs, responds to challenges, attests. No convergent encryption logic, no RS WASM.

   **Legal posture**: Doubly-encrypted blob cache behind anonymous transport — cannot decrypt, cannot be identified as operator. Literally a Tor hidden service. Blob-ID removal on valid legal order directed at the opaque address (safe harbor). Operator's binary choice: store everything the daemon selects, or don't run it.

   **Censorship resistance**: Requires deanonymizing AND taking down more than N-K stores simultaneously, while economic incentives actively recruit replacements. The adversary must: (a) break anonymous transport to find operators, (b) obtain M to identify which addresses to target, (c) do both faster than the market recruits replacements. The system forces the adversary from the legal domain into the technical/economic domain. Mint takedown is insufficient — degraded-mode retrieval (PoW-authorized, no delivery token) preserves content availability when all mints are down. The adversary must suppress stores, not just mints.
7. **Resilience is a property of greed, not architecture** — The protocol doesn't specify redundancy. It makes storage profitable and anonymously operable (anonymous transport default — store operators cannot be identified or compelled); serving is a separate, clearnet, permissionless role earning via the via tag. Stores watch coverage signals for undercovered funded content, mirror shards, earn sats. Censoring content increases per-store payout, attracting anonymous replacements. The adversary fights economic gravity with legal tools that don't apply to unidentifiable operators.
8. **The genesis address is a protocol constant** — Not an authority, not a delegation root, not a key that controls anything. Receives remainder by the math, not by any operational role (see Glossary: Genesis address). Spans all protocol versions and all per-mint parameter sets — the one value that never varies across the upgrade model (see Upgrade Model).

   **Permissionless mints**: Bonded (on-chain UTXO), not genesis-delegated — anyone can become a mint by posting a verifiable bond.

   **Fork resistance**: Forking the income requires changing one constant — trivial at the code level. The moat is the accumulated economic state and Schelling point, not the constant (see Glossary: Economic moat).
9. **The founder's income is proportional to settlement dimensionality** — Each shard is an independent settlement unit. Cascading remainders across N shards × C content items produce genesis income that grows in absolute sats while shrinking as a percentage (see §4).

   **Passive by construction**: No fee. No rate. The income is the irreducible coordination cost of multi-party integer settlement. Documents produce higher genesis sweep income than text (larger N → larger residual at zero-drain floor).
10. **Coordination costs one participant per shard** — Per-shard parity: coordination earns what one store earns per shard (see Glossary: Participant parity). Counter-cyclical: during booms (high S_s), value flows to stores; during busts (low S_s), value flows to coordination. Within coordination: mints earn because they verify, referrers because they distribute, genesis earns a share plus all sub-remainders. Coordination fraction is independent of N — a 20-shard document and a text claim pay the same coordination percentage at equal store depth.
11. **The moat is compound: four layers, two structural** — See Glossary: Economic moat. Layers (a) economic state and (b) Schelling point are structural; (c) traffic and (d) deposits are speed bumps that buy time for (a) and (b) to compound.
12. **Funding is advertising** — Funders pay for availability and visibility. Readers consume for free. This is advertising economics: the person who wants attention pays, the person who has attention consumes for free. Free distribution maximizes the audience that makes funding valuable. Conviction spending is the revenue. Free reading is the amplifier.
13. **The system optimizes for contested content** — Uncontested content is funded once. Contested content is funded repeatedly by competing sides. Competitive dynamics drive repeat funding — the highest-velocity economic behavior in the system. The founder earns from the froth of disagreement, not from any position. Free reading amplifies this: everyone sees the scoreboard, everyone can take a side.
14. **The protocol is four event types and one rule** — Fund confirmation, request proof, store attestation, settlement (see Glossary: Events). Rule: unclaimed drain → genesis; pools with no attestations AND no request proofs for SWEEP_EPOCHS → sweep. Everything else is a product concern or emergent market property.
15. **The network metabolizes failed attention bids** — Self-promoters fund their own content. If nobody reads it, sats sweep to genesis. Contested content produces remainder income (active market). Ignored content produces sweep income (failed attention bid). Both modes pay genesis. The total addressable revenue is all inflow.
16. **The protocol settles; the product interprets** — Settlement is narrow, deterministic, and hard to game (requires real sats, real storage, real bonds). The importance index is broad, interpretive, and soft-gameable — but also forkable, competitive, and improvable without protocol changes. Most attacks target the index. The index is the expendable layer. Settlement — where the money flows — is robust. Attacks on interpretation don't corrupt settlement. Attacks on settlement require real capital at risk.
17. **All funded content is stored; text bootstraps, documents sustain** — All funded content is stored as encrypted shards. Unfunded ephemeral messages live on relays only (see thesis 18).

    **Uniform storage**: Text = N=1 shards, documents = N=RS_N. Per-shard settlement treats both identically (see Glossary: Participant parity).

    **Text as bootstrap engine**: Low minimum viable pool (~128 sats vs. ~2560 for documents). High volume, quick sweep cycles. The froth of competing ideologies is almost entirely text.

    **Documents as sweep engine**: Larger N → larger residual at zero-drain floor → more sweep to genesis per sat deposited.

    **Escalation path**: Text claims → document evidence is the value creation moment.
18. **Two metabolisms: free discourse, funded signal** — Ephemeral messages are regular Nostr events — free, relay-dependent, zero protocol awareness, visible as collapsed `+ n` counts. `[+]` upgrades to the funded layer. The free layer is the discourse substrate (volume, whistleblowers, the 4chan energy). The funded layer is the conviction signal. The divergence between free volume and funded persistence is itself a signal axis no other system produces. Ephemeral messages don't influence the importance index. The free layer solves cold start; the funded layer solves quality.
19. **Honest-minority resilience** — The protocol's durability depends on honest minorities, not honest majorities.

    **Discovery**: Four mapping layers degrade gracefully (see Glossary: Mapping).

    **Thresholds**: One honest serve endpoint = events discoverable. One honest store per shard = available. One honest mint = deposits accepted. **Zero honest mints = content still available** (degraded-mode retrieval — see §3, Degraded-Mode Retrieval). Total failure requires ALL roles to fail simultaneously. Mint takedown suspends settlement (economic damage), not content delivery (censorship failure).

    **Attestation integrity**: Epoch summaries commit via Merkle root (see §3) — omission triggers competitive exit.

---

## What This System Invented

Seven things no existing system provides:

1. **A pool attached to a hash** — money bound to content identity, not to an author or server
2. **Request proofs as demand signal** — PoW-gated request proofs gate content delivery, ensuring every read produces a verifiable demand signal. The `via` tag attributes distribution to the front-end that facilitated the request
3. **Pool drain to proven stores** — stores earn from pools proportional to proven storage of consumed content
4. **Participant parity** — coordination costs one participant's share at parity with storage labor (see Glossary)
5. **The importance index** — the ranking derived from 1-3: commitment × demand × centrality
6. **Accountable loss** — every node that ever existed leaves a permanent economic trace (pool events, request proofs, settlements). The settlement content state tree — a per-epoch Merkle root over all content economic states — is Bitcoin-anchored (OP_RETURN, ~80 bytes/epoch). Loss is a first-class state: the evidence is permanent (Bitcoin), the bytes are market-sustained. No other system distinguishes "never existed" from "existed and was lost." The adversary cannot both destroy content and deny it existed — the Bitcoin anchor records the destruction, and any surviving copy verifies against the anchored hash
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
│  Stores hold shards behind anonymous transport (.onion default), │
│  prove possession to mints, earn from pools.                    │
│  Serve endpoints deliver bytes to users (clearnet). Any CDN.    │
│  Stores are unbonded + anonymous. Serve endpoints permissionless.│
├─────────────────────────────────────────────────────────────────┤
│  EVENTS (serve endpoint relay archives + external Nostr relays) │
│  All market activity is public signed events.                   │
│  Serve endpoints run filtered relays for OCDN kinds (aligned).  │
│  External Nostr relays are belt-and-suspenders fallback.        │
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
| **STORE** | None (anonymous transport default) | Yes — storage shard drain via settlement | Mint-challenged, peer-verified. Reachable via opaque address (.onion). No on-chain identity. |
| **SERVE** | PoW credential with mint | Yes — referrer income via via tag | **Mandatory retrieval proxy + filtered OCDN relay.** Clients never contact stores directly. Earns via tag. Sees partial store mapping (one random store per shard), cannot read key envelope or blob contents. Persists OCDN events (signed, unforgeable) — no new trust surface beyond existing serve role. |
| **MINT** | On-chain fidelity bond (time-locked), anonymous transport (.onion default) | Yes — coordination share | Bonded (fidelity), auditable from public data. Operator anonymous — identified by pubkey + bond UTXO, not identity. |
| **SETTLER** | None | None (public service) | Deterministic, auditable by anyone |

### Unbundled Mint Functions

The bonded mint bundles six logically separable functions. Unbundling clarifies trust requirements and enables honest-minority resilience:

| Function | What it does | Trust model | Honest-minority property |
|----------|-------------|-------------|-------------------------|
| **Custody** | Holds pool sats across epochs | Custodial (bond = ceiling) | Per-mint: one honest mint = its deposits safe. Deposit splitting across 2+ mints makes loss proportional, not binary. |
| **Privacy bridge** | Maps content_hash → (store, blob_id) | Trusted not to leak | Three-layer fallback: mints → serve caches → relay-encrypted mappings. One honest relay = discoverable. |
| **Discovery gate** | Serves mappings to clients with valid request proofs | Trusted to respond | Any mint, any serve cache, or relay-encrypted mapping can serve discovery. |
| **Challenge authority** | Issues storage challenges to stores | Permissionless — anyone can challenge | One honest challenger = storage fraud detected. Mints challenge by default; independent challengers supplement. |
| **Attestation collector** | Receives store attestations (private channel) | Trusted not to omit (Merkle root commitment) | Stores verify inclusion via attestation Merkle root. Omission → store reroutes (competitive exit). |
| **Epoch summarizer** | Aggregates attestations into settlement input | Bonded, auditable | One honest mint = correct summary for its deposits. Cross-settler verification catches discrepancies. |

A single operator runs all six in practice. The decomposition ensures that no single function's failure is catastrophic — each has an independent fallback path.

### Communication Channels

```
CLIENT ─────────────────→ SERVE ENDPOINT   request proof (serve endpoint is mandatory proxy)
SERVE ENDPOINT ─────────→ MINT             forwards request proof, receives delivery tokens + sealed key envelope
SERVE ENDPOINT ←──[Tor]──→ STORES          fetches blobs using delivery tokens (no content_hash)
SERVE ENDPOINT ─────────→ CLIENT           returns doubly-encrypted blobs + sealed key envelope
CLIENT ─────────────────→ RELAYS           request proofs (public demand signal, batched/delayed)
STORES ────────[Tor]────→ MINT             attestations + mapping registration (private, references delivery token hash)
STORES ←───────[Tor]───→ STORES            shard replication via replication tokens (mint-authorized, PoW-gated)
MINT   ←───────[Tor]───→ STORES            storage challenges + per-blob_id earnings push (persistent connection, batched)
MINT   ←───────────────→ MINT              mapping gossip + M distribution (cross-mint replication)
MINT   ─────────────────→ RELAYS           coverage signals, relay-escrowed M + store addresses (Argon2-gated)

[DEGRADED — no mint reachable]
SERVE ENDPOINT ─────────→ RELAYS           decrypts relay-escrowed mappings (Argon2-gated) + escrowed M
SERVE ENDPOINT ←──[Tor]──→ STORES          fetches blobs using PoW authorization (blob_id + PoW, no delivery token)
SERVE ENDPOINT ─────────→ CLIENT           returns blobs + M-derived keys (serve endpoint decrypts M from relay)
```

**Anonymous transport boundary**: All infrastructure communication routes through anonymous transport (Tor by default). The user-facing path (client ↔ serve endpoint) is clearnet. The infrastructure path (serve endpoint ↔ stores, serve endpoint ↔ mints, mint ↔ stores, mint ↔ mint) is anonymous. Serve endpoints bridge the two — the only component connecting clearnet clients to anonymous infrastructure.

**Clients never contact stores or mints directly for retrieval.** Serve endpoints are the mandatory intermediary. The mint returns delivery tokens (blob_id + store endpoint, no content_hash) to serve endpoints, plus a sealed key envelope (K_shard values encrypted to the client's pubkey). The serve endpoint fetches blobs from stores and forwards both blobs and the sealed envelope to the client. The serve endpoint sees partial store mappings (one random store per shard per request) but cannot read the key envelope or the blob contents. **Degraded-mode exception**: when no mint is reachable, serve endpoints fall back to relay-encrypted mappings for discovery and PoW-authorized direct store contact (see Degraded-Mode Retrieval). Privacy degrades (serve endpoint sees full store topology); availability is preserved.

**Four mapping layers** (degrading privacy, increasing availability — see also Glossary: Mapping):

1. **Relay-encrypted mappings + escrowed M (mandatory, durable, compute-gated)** — mints MUST publish on every store registration and periodically refresh for active stores: `encrypt(store_address || blob_id, key=Argon2id(content_hash || shard_index, "ocdn-discovery-v1", ARGON2_PARAMS))`. Store address is opaque (.onion by default) — relay mapping reveals retrieval path but not operator identity. Additionally, M is relay-escrowed: `encrypt(M, key=Argon2id(content_hash || "ocdn-key-v1", ARGON2_PARAMS))`. Compute-hard KDF: ~1-3s per shard on desktop, bulk scanning linearly expensive. No mint needed for decryption or M recovery. Survives mint exits/crashes — the defense against coordinated mint takedown (mints are the smallest actor set — anonymous transport makes them unidentifiable, but their custodial role makes them the highest-value target). Serve endpoints persist these events in their filtered OCDN relays (economically aligned — via tag income requires event availability) and SHOULD re-publish on successful reconstruction. External Nostr relays are unaligned fallback. **Relay durability and store-blindness coexist**: the relay reveals content→address (needed for recovery), anonymous transport hides address→operator (needed for protection). Different links, independently defended.
2. **Mint cache (fast, private)** — actual store locations + M, request-proof-gated, replicated via gossip. Any mint can serve discovery for any content. Rebuilds from relay events + gossip on restart.
3. **Serve-layer cache** — organic fallback from prior reads, proportional to content popularity. Serve endpoints cache delivery token responses (blob_ids + store endpoints). No M, no content_hash, no privacy leak.
4. **Coverage signals** — per-content shard store counts + integrity hashes (SHA256 of doubly-encrypted shard) on relays each COVERAGE_BLOCKS, no store identities. Enables supply response and new-store integrity verification, not a discovery layer. Integrity hashes reveal nothing about content without M.

Mints are a discovery cache — the relay layer is the source of truth. Serve endpoint relay archives are the primary persistence layer (economically aligned); external Nostr relays are unaligned fallback (see Trust Assumptions, Thesis 19).

### What's Borrowed

| Layer | Provider | Already deployed |
|-------|----------|-----------------|
| Event distribution (fallback) | Nostr relays (hundreds, multi-jurisdiction) — unaligned fallback; serve endpoint relay archives are the aligned primary | Yes |
| Blob storage | Blossom servers (BUD-01 through BUD-06) | Yes |
| Identity / keys | Nostr Ed25519 keys + NIP-07 browser extensions | Yes (millions of users) |
| Payment rails (deposits) | Lightning (Zaps), Cashu P2PK (funder → mint) | Yes |
| Payment rails (store payouts) | Cashu ecash (blind-signed bearer tokens, mint → store via Tor) | Yes |
| Discovery | Nostr relay subscriptions + kind 10063 | Yes |

### What's Built

| Component | Layer | Purpose |
|-----------|-------|---------|
| **Convergent encryption + deterministic RS** | Protocol | Content key = SHA256(domain \|\| content_hash). RS(K,N) over GF(2^8) with pinned generator polynomial and canonical shard ordering. Shard hashes are deterministic for verification — no manifest trust surface. **Canonical RS implementation**: protocol ships a single WASM encoder/decoder (~2-5KB compiled). Content-hash of the WASM binary (`RS_WASM_HASH`) is a protocol constant. Every client, store, and settler loads the same binary — no independent reimplementation. Shard identity is load-bearing for convergent encryption; one wrong byte = content unrecoverable, silently, with no fraud proof possible. Test vectors (10 included) are regression tests for the one implementation, not interop tests across N implementations. Upgrading the encoder = new WASM hash = content-fork (new CONTENT_KEY_DOMAIN, parallel operation, natural sunset — see Upgrade Model). The zlib pattern: spec exists for auditability, everyone runs the same code. |
| **Blind addressing + relay-durable mapping** | Protocol | See Glossary: Blind addressing, Mapping. Four mapping layers with relay-encrypted events as durable source of truth. |
| **Coverage signal event** | Protocol | See Glossary: Coverage signal. The gap between "how many" and "which ones" is the privacy boundary. |
| **Fund confirmation event** | Protocol | Bind sats to content hash (bonded mint-signed). See §1. |
| **Request proof event** | Protocol | Client PoW + Nostr signature + via tag. Gates delivery, published as demand signal. See §2. |
| **Store attestation** | Protocol | Store proves shard service for a specific request. Direct to mint. See §3. |
| **Settlement event** | Protocol | Per-mint deterministic payout across P participants. See §4. |
| **Storage challenge protocol** | Protocol | Permissionless — anyone can challenge (no bond needed). Random byte offsets + Merkle proofs, latency-tested. Failure → lose epoch earnings. Repeated failure → mint stops interacting. |
| **Cross-store verification** | Protocol | Block-hash-assigned per-epoch peer verification. Earning requires proving own storage AND verifying a peer. |
| **Attestation broadcast** | Protocol | Stores submit to ALL bonded mints (O(M), M small). Omission detectable via attestation Merkle root verification. |
| **Bonded mint registration** | Protocol | Time-locked on-chain UTXO (fidelity bond). Permissionless. Tenure-weighted custody ceiling. Enforcement: competitive exit — stores and clients reroute on misbehavior. |
| **`ocdn-store` daemon** | Product | Commodity storage behind anonymous transport. Single required input: `--disk <budget>`. Bundles Tor, binds .onion address on first run (key persists in volume). **Autonomous rebalance loop** (every coverage signal, ~1h): ranks all shards (held + available) by `projected_value_per_byte` — projected lifetime earnings normalized by shard size, accounting for pool decay, tenure ramp-up curve, and modeled competitor entry. Desired portfolio = top shards fitting disk budget. Diff against current holdings → acquire (via replication tokens from existing stores) / evict automatically. Tenure is the implicit switching cost: held shards rank higher than equivalent new ones (earning at 99% weight vs starting at 33%), creating natural portfolio stickiness without a separate parameter. Shard acquisition via replication tokens (see Glossary); eviction by dropping lowest-value-per-byte shards when better opportunities exist. Local state is hash-blind: persists only `blob_id → encrypted bytes` and `blob_id → earnings_rate` (see Glossary: Store-blind). Zero editorial decisions. `docker run ocdn-store --disk 50GB` entry point. Operator identity never leaves the container. Earns Cashu ecash tokens (blind-signed, bearer, auto-diversified across mints). On restart: re-evaluates portfolio from fresh coverage signals before re-registering mappings (shards survive on disk; market conditions may have changed). **Degraded-mode behavior**: if all persistent mint connections are down for > MAX_SILENT_EPOCHS, daemon accepts direct PoW-authorized requests (blob_id + PoW proof, no delivery token). Serves blob, earns nothing. Resumes normal operation on any mint reconnection. No new trust surface — store already verifies PoW in challenge protocol; blob_id is already known locally. Store-blind preserved: requester presents blob_id (store's own identifier), not content_hash. Target resource budget: <512MB RAM, <100MB/day bandwidth at steady state, persistent Tor circuits to mints (O(M), M small). |
| **Importance index** | Product | Rankings, feed, API, widget. Anyone operates. |
| **OG image endpoint** | Product | Cloudflare Worker renders live scoreboard snapshots for social sharing. Stateless, serve-layer. The viral loop. |
| **Clearinghouse** | Product | Preserve/offer order matching |
| **`ocdn-pack`** | Product | Deterministic tar (`--sort=name --mtime=0 --owner=0 --group=0`). Same tree → same hash → convergent encryption composes. Any file tree becomes one funded document (N=RS_N). 10× efficiency vs individual small files. |
| **Filtered OCDN relay** | Product (serve layer) | Nostr relay accepting only OCDN event kinds. Bundled with serve endpoint reference implementation. Serve endpoints already speak WebSocket to clients; adding relay protocol for OCDN kinds is ~200 lines. Persistence is structurally incentivized: serve endpoints that retain more events serve users better → more traffic → more via income. Signed events prevent forgery — persistence is a commodity trustless function. |
| **HTTP gateway** | Product (serve layer) | HTTP ↔ OCDN. Reconstructs archives, serves files. Earns via via tag. Vanity domains via DNS TXT or Nostr kind. Enables self-hosting. ~500 lines. |

### Trust Assumptions

- **Custodial trust (fidelity bond + tenure-weighted ceiling)**: Bonded mints hold pool balances. Irreducible — sats that persist across epochs and pay multiple parties over time require custody. **Protocol rule: `balance(mint) ≤ bond_value(mint) × tenure_factor(epochs)`.** Bonds are time-locked on-chain UTXOs (`OP_CSV`) — a commitment signal, not slashable collateral. No trusted counter-signer, no covenant opcodes required. Works on Bitcoin mainnet today. `tenure_factor` starts low (~5% in first week) and grows toward 100% over months — new mints custody little, established mints custody more. Deposits that would exceed the ceiling are rejected; the client routes to the next mint. **Enforcement is competitive exit**: stores verify payment via attestation Merkle root + per-shard S_s; underpaid stores reroute. The bond is a pre-paid insurance premium; the ceiling bounds damage by construction. No genesis income from misbehavior. All custody operations are auditable from public events (sum fund confirmations per mint vs. bond value × tenure).
- **Founder operates nothing post-launch.** No operational role, no delegation authority, no admin key. All roles operated by independent actors.
- Independent operators run: bonded mints, stores, serve endpoints, settlers, importance indexes
- All settlement is deterministic and auditable — settlers query mints directly for epoch summaries, each per-mint settlement is independently verifiable, anyone can recompute from day 1
- **Competing settlers, competing mints, and competing importance indexes are permitted and encouraged from day 1**
- **Store liability isolation**: Unbonded, anonymous — store-blind via three independent layers (see Glossary: Store-blind). **Verifiability proportional to responsibility**: mints are bonded (on-chain UTXO, anonymous behind Tor); stores are unbonded (commodity, anonymous behind Tor). Trust anchored in on-chain commitments + observable behavior, not operator identity. Enforcement: challenge failure = no payment. Sybil (false redundancy) is a mint-policy / clearinghouse concern, not protocol-level. System heals through replacement — compliance and censorship-resistance are independent properties.
- **Serve endpoint isolation**: Mandatory retrieval proxy + filtered OCDN relay (see Glossary: Serve endpoint). Cannot redirect store income — multi-party binding (§3). Sees partial store mappings (one random store per shard) but cannot read key envelope or blob contents. Event persistence adds no new trust surface — Nostr-signed events are unforgeable; serve endpoints can only withhold, not corrupt. Many competing serve endpoints create a de facto mixing layer for client requests.

### Symbiosis

- **Blossom servers** have no revenue model → store economy gives them pool income
- **Relay operators** → external Nostr relays are unaligned fallback; serve endpoints run filtered OCDN relays as part of the serve role (via tag income incentivizes event persistence). External relays benefit from OCDN traffic but the protocol doesn't depend on their goodwill for durability
- **Nostr clients** have no economic ranking signal → importance scores are a new feature any client can subscribe to
- **Anyone with a laptop** has idle disk and bandwidth → `ocdn-store --disk 50GB` converts latent storage into anonymous ecash income with zero content liability, zero operator attribution (anonymous transport default), and zero cost basis (hardware already owned, NAT traversal solved by Tor hidden service). **Uptime economics are honest**: tenure resets on any missed epoch (~4h gap). A laptop online 16h/day oscillates between ~33% and ~80% weight, averaging ~60-70% of an always-on store's per-shard income. VPS operators earn a reliability premium; laptop operators earn proportionally less but with zero infrastructure cost. The daemon's autonomous rebalance (see What's Built: `ocdn-store`) optimizes for the operator's observed uptime pattern — a laptop daemon learns not to acquire shards that need 6+ consecutive epochs to become profitable shortly before the operator's typical sleep window. On restart, the daemon re-evaluates from fresh coverage signals; shards on disk survive sleep, tenure doesn't, portfolio optimality doesn't.
- **Front-end operators** have audiences but no economic layer → serve endpoints earn via the via tag. Better UX → more traffic → more referrer income. Composable with ads or venue fees
- **Positive-sum**: the economic layer makes the Nostr layer more sustainable; the Nostr layer makes the economic layer more resilient.

---

## Protocol: Four Event Types

### 1. Fund Confirmation (bonded mint-signed)

A three-step process: (1) funder deposits sats to a bonded mint, (2) mint verifies shard integrity, (3) mint publishes a signed confirmation event to relays.

**Step 1 — Deposit** (private, off-relay): Funder sends HTLC-gated Cashu ecash to a mint's .onion address over Tor. The HTLC binds ecash settlement to the fund confirmation event: mint reveals preimage by publishing confirmation on relays; funder reclaims on timeout. Atomic — mint cannot take ecash without publishing confirmation, cannot publish fake confirmation without the preimage binding deposit to content_hash + amount + mint pubkey. Fallback deposit paths: BOLT12 Lightning over Tor (.onion-reachable Lightning node), Cashu P2PK. The reference client defaults to splitting deposits across 2+ bonded mints (round-robin via `DEPOSIT_SPLIT_MIN`). Per-mint custody risk becomes proportional, not binary — one honest mint = its fraction of deposits safe. The mint credits the pool on its internal ledger. No bearer tokens are published on relays.

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
  delivery_token_hash: hash(delivery_token)  # binds to specific mint-authorized retrieval
  store_pubkey: store's pubkey
  blob_id: which blob was served
  response_hash: SHA256(bytes_served)        # proves correct doubly-encrypted shard bytes
  epoch: epoch_number
  sig: store signature
```

**Why direct to mint, not relayed**: Store attestations contain the store's real pubkey — publishing them would link store identity to delivery tokens. The direct-to-mint channel preserves store blindness in the public record. The mint maps delivery token hashes back to content_hash internally, aggregating attestations into epoch summaries for settlers. Settlers see attestation aggregates per shard, not raw store-to-content mappings.

**Mint-canonical epoch assignment**: The mint assigns attestations to epochs based on the block height at the time the mint *received* the attestation. Stores include their proposed epoch; the mint overrides on disagreement (block propagation delay can cause store/mint to see different epoch boundaries). The mint's epoch summary is canonical for all attestations it contains — settlers need no knowledge of block propagation timing.

**Multi-party binding**: The attestation contains `delivery_token_hash` — the delivery token is mint-signed and cryptographically chained to the client's request proof (the mint issued the token in response to a verified request proof). The front-end cannot redirect store income:
- The client signed the request including `via` tag (NIP-07 — front-end can't forge a different referrer)
- The mint signed the delivery token (front-end can't forge delivery tokens)
- The store signed the attestation (store's private key — front-end can't forge)
- The store submitted the attestation directly to the mint (front-end can't intercept)

**Consumption flow (healthy)**: (1) Client signs request proof via NIP-07 (includes `via` referrer tag set by front-end). (2) Client sends request proof to serve endpoint (mandatory proxy — client never contacts mint or store directly). (3) Serve endpoint forwards request proof to mint; mint verifies PoW + signature + epoch + coverage ≥ K. Mint selects one store per shard via verifiable deterministic selection (see Glossary: Delivery token), issues delivery tokens (blob_id + store endpoint + epoch + nonce + selection_proof + mint_sig — no content_hash) and a sealed key envelope (K_shard values encrypted to client pubkey). (4) Serve endpoint presents delivery tokens to respective stores. (5) Store verifies mint signature on delivery token, serves doubly-encrypted blob (store never learns content identity — blob is opaque even to the store). (6) Store signs attestation referencing delivery token hash, submits to mint directly. (7) Serve endpoint returns doubly-encrypted blobs + sealed key envelope to client. (8) Client opens key envelope (decrypts K_shard values with own key), strips mint encryption layer (AES decrypt with K_shard), strips convergent encryption layer (content key), reconstructs plaintext from K shards, verifies content_hash. (9) Client publishes request proof to relays (public demand signal — batched/delayed to prevent serve endpoint timing correlation).

**Consumption flow (degraded — no mint reachable)**: (1) Client signs request proof as above. (2) Serve endpoint detects mint unavailability (all persistent connections down > MAX_SILENT_EPOCHS). (3) Serve endpoint decrypts relay-escrowed mappings via Argon2(content_hash || shard_index) → recovers blob_id + store_address for each shard. Decrypts relay-escrowed M via Argon2(content_hash || "ocdn-key-v1"). (4) Serve endpoint contacts stores directly: presents blob_id + PoW proof. (5) Store verifies PoW (hash comparison — no content_hash revealed, store-blind preserved), serves blob. No attestation (no mint to receive it). (6) Serve endpoint strips mint encryption layer (has M), returns convergent-encrypted blobs to client. (7) Client strips convergent layer, reconstructs plaintext, verifies content_hash. **Degradations**: no settlement (stores earn nothing), no per-request privacy (serve endpoint sees full store topology from relay mappings), no demand signal (no attestation path). Content available; economics suspended.

**Verification**: O(1). `Ed25519_verify(attestation, store_pubkey)` + `bond_check(store_pubkey)` + `request_hash matches valid request proof`.

**Attestation verification**: Stores verify their own inclusion in each epoch's attestation Merkle root (published in the epoch summary). The store computes `hash(its_attestation)`, requests an inclusion proof from the mint, and verifies against the published root. Exclusion = the mint dropped the attestation. The store's recourse is competitive exit: stop attesting to that mint, reroute to alternatives. No receipt system, no prosecution — the Merkle root is a one-way commitment the mint can't retract. The attestation signature makes each leaf hash unpredictable to anyone without the store's private key — sibling hashes in inclusion proofs reveal nothing about other stores.

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
  ["shard_stores", "<s0>", "<s1>", ...]  # per-shard store count S_s — enables exact payout verification by stores
  ["store_set_root", "<merkle_root>"]    # per-shard Merkle root over sorted store pubkeys — commits store ordering for verifiable delivery token selection next epoch
  ["attestation_root", "<merkle_root>"]  # Merkle root over hash(attestation) leaves — stores verify own inclusion privately
  ["challenge_results", "<passed>", "<failed>"]  # storage challenge summary
  ["seq", "<monotonic_sequence>"]
  ["bond", "<bond_utxo_ref>"]
sig: mint signature
```

**Why summaries**: Individual request proofs are signed by clients (unbounded, non-enumerable on relays). Epoch summaries are signed by bonded mints (bounded, enumerable, gap-detectable via `seq`). The `prev` tag creates a per-mint hash chain — settlers detect gaps (missing summaries), forks (conflicting summaries at the same `seq`), and converge by collecting all chains to the current epoch. Two settlers that see the same hash chains produce the same settlement. Conflicting summaries at the same `seq` are detectable by any observer — a consistency signal that stores and clients factor into routing decisions. The `attestation_root` commits the mint to its received attestation set — stores verify their own inclusion privately; settlers verify that epoch detail is consistent with the committed root. `shard_stores` publishes per-shard S_s, enabling stores to compute exact expected payouts independently. `store_set_root` commits the per-shard sorted store ordering — delivery token selection next epoch is deterministic against this frozen set (see Glossary: Delivery token). Stores verify their position; settlers audit selection correctness. Individual store identities never appear in public events — the mint resolves store pubkeys for payout internally.

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
  ["content_state_root", "<hash>"]      # Merkle root over all per-content economic state tuples (content_hash, total_funded, fund_rounds, epochs_live, peak_stores, peak_demand, current_status). Bitcoin-anchored via OP_RETURN. Per-content proofs are Merkle paths against this root.
content: JSON settlement details
sig: settler signature
```

**The settlement rule** (per-mint, per-shard, participant parity with cascading remainders):

Each mint settles independently — no cross-mint join. Each shard settles independently — no cross-shard coupling. Settlers query each bonded mint directly for its epoch detail (per-shard attestation sets). Settlement events are additive: each per-mint settlement is independently final; missing mints are filled in when available.

```
for each mint m:
  for each content_hash cid where m holds balance AND has valid attestations this epoch:
    N = shard_count(cid)                                        # 1 for text, RS_N for documents
    mint_drain = floor(balance(m, cid) × DRAIN_RATE)            # balance-proportional, mint-count-invariant
    shard_drain = floor(mint_drain / N)
    remainder_L0 = mint_drain - N × shard_drain                 → GENESIS_ADDRESS

    referrers = unique_via_pubkeys_from_valid_request_proofs(cid, epoch)
    R = len(referrers)

    for each shard s in 0..N-1:
      stores_s = stores_with_valid_attestations_AND_storage_proofs(s, m, epoch)
      S_s = len(stores_s)
      if S_s == 0: continue                                     # uncovered shard: no drain, pool preserved

      # Level 1: per-shard parity — S_s stores + 1 coordination
      P_s = S_s + 1
      unit_s = floor(shard_drain / P_s)
      remainder_L1 = shard_drain - P_s × unit_s                 → GENESIS_ADDRESS

      # Storage: each store earns 1 tenure-weighted unit
      shard_recycle = 0
      for each store st in stores_s:
        tenure = consecutive_attestation_epochs(st, s, m)   # ≥1 (attested this epoch)
        weight = 1 - TENURE_DECAY^tenure                     # 0→1 asymptote
        payout(st) += floor(unit_s × weight)
        shard_recycle += unit_s - floor(unit_s × weight)
      recycle(pool[m, cid]) += shard_recycle                  # extends pool life

      # Level 2: coordination unit — fixed 3-way split (R-invariant)
      coord = unit_s
      per_third = floor(coord / 3)                               # constant denominator: mint / referrer pool / genesis
      remainder_L2 = coord - 3 × per_third                       → GENESIS_ADDRESS  (always 0, 1, or 2 sats)

      payout(mint m) += per_third
      payout(genesis) += per_third + remainder_L2 + remainder_L1

      # Referrer pool: subdivided by proof count (sybil-dilutive, R-invariant at L2)
      ref_pool = per_third
      total_proofs = sum(proof_count(r, cid, epoch) for r in referrers)
      for each referrer r in referrers:
        payout(r) += floor(ref_pool × proof_count(r) / total_proofs)
      ref_remainder = ref_pool - sum(referrer payouts)            → top referrer by proof_count  (NOT genesis)

    payout(genesis) += remainder_L0

# Abandoned pools sweep to genesis (requires BOTH no attestations AND no request proofs)
# Request-proof gate prevents adversary-triggered sweep via mint takedown
if no_valid_attestations(cid, last_SWEEP_EPOCHS) \
   AND no_valid_request_proofs(cid, last_SWEEP_EPOCHS):
    sweep(pool[cid]) → GENESIS_ADDRESS
```

**K-threshold gating**: Mints reject request proofs for content with fewer than K covered shards. Below K: content is unrecoverable, no request proofs accepted, no attestations, no drain, pool preserved. Settlement requires actual availability.

**Earning requires BOTH demand AND proven storage**: A store earns for a shard only if (1) it submitted a valid attestation for a valid request proof this epoch AND (2) it passed the mint's storage challenge for that shard this epoch. Attestation without storage proof = invalid (prevents proxy-only stores). Storage proof without attestation = no demand signal (content not consumed).

**Per-shard parity**: See Glossary. The pseudocode above is canonical. Cascading remainders from L0 + L1 + L2 across N shards produce genesis income that grows in absolute sats while shrinking as a percentage. At high market depth, integer friction across many independent shard settlements becomes a significant genesis income source.

**Self-balancing**: Equal shard drain means thin shards (low S_s) pay more per store and thick shards (high S_s) pay less. Stores migrate to undercovered shards. Coverage signals make the economics visible.

**Tenure-weighted payout**: Store income matures with continuous presence. `weight = 1 - TENURE_DECAY^tenure` where `tenure` counts consecutive epochs of valid attestation for this store-shard-mint triple. At reference default TENURE_DECAY = 2/3: first epoch ≈ 33%, 6 epochs (~24h) ≈ 91%, 12 epochs (~48h) ≈ 99%. The gap between `unit_s` and `floor(unit_s × weight)` recycles to the pool each epoch, extending content lifetime proportionally to store churn. Stable content with long-tenured stores drains at the nominal DRAIN_RATE. High-churn content drains slower because departing stores' forfeited income returns to the pool. The mechanism is self-funding: the stores that cost the pool the most (short-tenure churners) cost it the least (low weight). Coordination share is not tenure-weighted — mints, referrers, and genesis earn at full rate regardless.

**Tenure computation**: Settlers compute tenure from the epoch summary chain — `consecutive_attestation_epochs(st, s, m)` is the count of unbroken consecutive epochs (walking the `prev` chain backward from current epoch) in which store `st` appears in mint `m`'s per-shard attestation set for shard `s`. Settlement for epoch E requires epoch detail from at most the last `ceil(log(0.01)/log(TENURE_DECAY))` epochs (~12 at reference default) — beyond this, all stores have weight > 0.99 and the lookback can be truncated without material settlement error. The lookback is bounded, deterministic, and independently verifiable.

**Drain rate**: `DRAIN_RATE × balance`. DRAIN_RATE is per-mint declared (see Constants); settlers use the declaring mint's value. Pool half-life = ln(2)/DRAIN_RATE. Store count doesn't affect drain speed — it affects how the drain is divided. Funders can calculate expected duration at deposit time from the mint's declared rate. Minimum viable pool ≈ N/DRAIN_RATE sats (below this, per-shard drain rounds to 0, stores stop earning, sweep timer starts).

**Per-mint independence**: Each pool-CID-mint triple tracks its own balance. The mint that confirmed the deposit handles claims against that balance. No cross-mint coordination needed. Each mint's settlement is a closed computation — a settler needs only that mint's epoch summary to produce a deterministic result.

**Settlers query mints directly**: Settlers fetch epoch summaries from bonded mints' endpoints, not from relays. Mints are a bounded, enumerable set (bond registration includes endpoint). Relays carry epoch summaries for public auditability but are not on the settlement critical path. Each per-mint settlement event is independently final. Missing mints are filled in when their summaries become available. The `prev` hash chain on epoch summaries makes each mint's history self-proving — a new settler reconstructs any mint's complete history by following the chain backward from the latest summary.

**Payout via Cashu**: Each epoch, settlement produces Cashu ecash tokens for each store's earnings, delivered via the existing persistent Tor circuit. Blind signatures (Chaum) make issuance and redemption unlinkable — the mint cannot correlate "issued tokens to `.onion:abc`" with "someone redeemed tokens." Tokens are bearer instruments: stores accumulate locally, redeem at any Cashu-compatible mint (including cross-mint swap for full separation from the issuing OCDN mint), at any time. Eliminates: PAYOUT_THRESHOLD (every epoch pays, even 1 sat), Lightning routing failures (no outbound Lightning at settlement), payment timing correlation (no observable mint-to-store payments). The OCDN mint is already custodial — Cashu token issuance is a natural extension, not a new trust assumption. **Counterparty risk**: tokens are claims on the issuing mint — if that mint exits, unswapped tokens are worthless. The daemon auto-diversifies: periodic cross-mint swap when any single-mint balance exceeds a threshold, spreading counterparty exposure. Multi-mint attestation (stores attest to all bonded mints) diversifies earning sources by construction. Optional Lightning sweep for operators who configure a receiving wallet. See Glossary: Cashu payout.

**Properties**:
- Deterministic: same epoch summary chain → same settlement. Anyone can verify. Tenure-weighted payout requires bounded lookback (~12 epochs at reference TENURE_DECAY) — deterministic from the same `prev`-chained epoch summaries settlers already consume.
- Per-mint decomposition: no cross-mint join.
- Epochs by block height (EPOCH_BLOCKS). Mint-canonical epoch assignment.
- Content state tree: `content_state_root` is a Merkle root over cumulative per-content economic states. Per-content proofs (historical precedence, accountability) are Merkle paths against this root. Bitcoin-anchored via periodic OP_RETURN (~80 bytes: 32B content_state_root + 32B prev_anchor_hash + 16B metadata). Cost: ~2,500 sats/day from genesis remainder. Proves every funded content hash existed with specific economic properties at a specific block height. Per-content fossil proof: state tuple + Merkle path + Bitcoin txid (~500 bytes, self-contained, self-verifying). Multiple settlers produce identical roots from the same input (deterministic) — disagreement is a permanent on-chain inconsistency signal. The OP_RETURN chain is the deepest moat: unforgeable per-epoch economic history on Bitcoin, stretching back to genesis.
- Multiple settlers cross-verify via `input_set` convergence tag.
- Mint liveness: offline mints stop earning. Stores and clients reroute after MAX_SILENT_EPOCHS (~24h) of missing summaries. No death penalty — mint resumes on return; reputation reflects the gap.
- All events carry `["v", "1"]` version tag.

---

## The Storage Market

The protocol is a market. Demand side: funders. Supply side: stores. Clearing mechanism: request proofs, store attestations, and settlement. The depth of this market determines protocol health AND founder income.

### Reading is Free; Funding is Advertising

Readers consume at zero cost (PoW-gated). Serve endpoints deliver and earn via the via tag. Stores earn from pools for proven storage of consumed content. Popular content attracts more stores (more per-shard competition) and more funders (visibility drives conviction). The market equilibrates: store depth scales with demand, funding scales with visibility.

### Demand Signal

Pool balance, request proof volume, and coverage signals are all public. A hash with 100K sats and zero stores on shard 4 is a visible opportunity. Demand signal is reliable by construction — delivery is request-proof-gated, so every read produces a verifiable signal.

### Supply Response

Stores read coverage signals for undercovered funded content. Acquire shards via replication tokens (see Glossary: Replication token): request from mint (PoW-gated) → fetch from existing store over Tor → verify integrity hash → store locally → register mapping. The daemon automates this entirely — coverage signal triggers rebalance, rebalance identifies opportunities, acquisition executes without operator input. At steady state, store-to-store replication distributes bandwidth across the network; the mint authorizes but doesn't transfer data. See opportunity, store bytes, get paid.

### Price Discovery

Protocol drain is mechanical: `DRAIN_RATE × balance`, independent of store count or store-declared rates. Store rate competition occurs at the **clearinghouse** layer (NIP-OFFER/NIP-PRESERVE) for committed storage with SLA guarantees. At the protocol level, stores compete on which shards to serve — thin shards pay more per store, thick shards pay less. Coverage signals make the economics visible.

### Drain

`drain = floor(balance × DRAIN_RATE)`, divided equally across N shards (see Glossary: Drain, §4). Balance-proportional, mint-count-invariant. Store count affects division, not speed. Tenure recycling reduces effective drain: sats unpaid to immature stores credit back to the pool (see §4: Tenure-weighted payout). Nominal half-life = `ln(2)/DRAIN_RATE`; effective half-life ≥ nominal (longer when churn is high). Funding urgency comes from the exponential decay countdown, not from store-count acceleration.

### Degradation

Market-driven, no parameters:

1. **Fully funded**: Multiple stores, multiple jurisdictions. Available and redundant.
2. **Thinning**: Expensive stores evict first. Fewer replicas.
3. **Mintless**: All mints down — stores still serve via degraded-mode PoW authorization. No settlement, no earnings, no demand signal. Content available; economics suspended. Stores tolerate this for short outages (blobs on disk = sunk cost). Prolonged outage → stores evict (no income) → thinning.
4. **Last store**: Single point of failure. Index shows warning.
5. **Fossil**: No stores. Bytes gone (see Glossary: Ghost). Economic fossil persists on relays + Bitcoin anchor. M persists — enables recovery from surviving offline copies. `[+] to restore`.
6. **Restored**: Re-fund → store mirrors shards → earning. The gap in the record is permanent and visible.

### Coverage Signal Frequency

Coverage signals are decoupled from settlement: every COVERAGE_BLOCKS (~1h) vs. EPOCH_BLOCKS (~4h). Faster opportunity signals, no increase in settlement complexity.

### Market Depth = Founder Income

The founder's income scales with storage market depth (see Revenue Model, §4):
- **S_s per shard** — deeper shards = more integer friction per L1 division
- **R** — more referrers = more proof-count competition within the referrer pool (L2 denominator constant at 3 — R-invariant)
- **N × C** — more shards × more content = more independent divisions
- **Sweep tail** — documents (high N) produce larger residuals at zero-drain floor
- **Reference client traffic** — referrer share via via tag

Genesis income percentage decreases monotonically with depth; absolute income grows because total drain grows.

### Store Interdependence

K-threshold gating (see §4) creates collective interdependence: below K covered shards, no drain fires — all stores earn nothing (pool preserved). Above K, per-shard settlement activates independently. Self-balancing dynamics (see Glossary) + cross-store verification create a ring of mutual dependency for earning.

### Three Self-Correcting Loops

1. **Eviction → funding urgency**: Pool decays below minimum viable → stores stop attesting → "not stored" visible on index → community funds → content re-stored
2. **Thin shards → new stores**: Shard has low S_s → high per-store income visible in coverage signals → new operators mirror that shard → S_s increases → per-store income normalizes
3. **Over-replication → exit**: Shard has high S_s → per-store income drops → least-efficient stores stop attesting that shard → S_s decreases → equilibrium
4. **Churn → duration**: Store drops shard → forfeited tenure-weighted income recycles to pool → pool lasts longer → remaining stores earn for more epochs → content outlives unreliable stores

### Conviction Momentum

The feedback loop: reads → visibility → funding → storage → reads. The money enters from conviction. The distribution is free. Contested content generates the strongest momentum: both sides fund repeatedly, each round amplifying visibility and driving counter-funding.

---

## Verification System

### Why Request Proofs + Attestations Work

| Attack | Defense |
|--------|---------|
| Fake demand (sybil clients) | PoW cost per request proof. Ephemeral keys make sybil cheaper but only affect the index (display layer), not settlement (economic layer) — drain = DRAIN_RATE × balance (gate-triggered by attestation existence, not count-triggered by volume). Index weights commitment (sats) over demand (PoW). |
| Flood requests | PoW difficulty scales with volume — exponential cost |
| Replay requests | Epoch-bound, single use |
| Fake bytes served | response_hash in store attestation must match expected shard hash |
| Forge store attestation | Requires store's private key (Ed25519) + valid bond |
| Front-end redirects store income | **Impossible** — multi-party binding (see §3). Front-end earns only via the via tag. |
| Sybil referrers (fake `via` tags) | L2 uses a constant 3-way split (mint / referrer pool / genesis) — inflating R doesn't change the denominator. Referrer pool subdivided by proof count: sybil referrers dilute their own per-pubkey proof count, earning less than a consolidated honest referrer. Internal remainder → top referrer by proof count, not genesis. |
| Store proxies without storing | Storage challenges (random byte offset + Merkle proof, latency-tested) catch fetch-on-demand. Repeated failure → mint stops interacting → store loses income. |
| Mint takedown to suppress content | Degraded-mode retrieval: stores accept PoW-authorized direct requests when no mint reachable. Discovery via relay-encrypted mappings (Argon2-gated). Content available; settlement suspended. Adversary suppresses economics, not availability. |
| Permanent mint bypass (abuse degraded mode) | Degraded mode activates only when store's own persistent mint connections are down — locally verifiable, unfakeable by serve endpoints. Stores earn nothing in degraded mode (no attestation path). All participants strictly prefer healthy mode: stores (settlement income), serve endpoints (via income), readers (faster, better privacy). No perverse incentive. |
| Sybil receipt inflation | Receipt doesn't credit specific stores — demand signal is diluted across ALL stores for that content. Less profitable than original model. |
| Store identity churn (drop + rejoin as new pubkey to reset tenure) | Tenure maturation period is the cost. At reference TENURE_DECAY = 2/3: churning store forfeits ~67% of income in first epoch, ~46% in second. Break-even requires holding for ~3 epochs (~12h) before churn has any advantage over staying — and staying always earns more. Rapid churn (every 1-2 epochs) earns ~33-54% of stable income. Anti-churn is economic, not identity-based — works under full anonymity. |
| Store self-dealing (own request proofs) | **Tolerated — self-dealing is work, not fraud.** Pays real PoW, provides real storage, triggers correct settlement. Cost makes it unprofitable at scale. At small scale, converts sweep to settlement income — a bounded loss. |
| Mint-store collusion (fake storage) | Block-hash-assigned cross-store verification. Colluding mint cannot rig peer assignments. Probability of colluding verifier = C/S per epoch. Over multiple epochs, honest peer is assigned and fake storage is caught. Mint bond at risk; store loses earnings. |
| Mint-store collusion (biased routing) | Verifiable store selection: `selected_index = hash(block_hash \|\| content_hash \|\| shard_index \|\| request_proof_hash) mod S_s` against previous epoch's committed `store_set_root`. All inputs public or client-chosen — mint cannot preferentially route delivery tokens to its own stores. Stores verify every delivery token's selection proof; deviation is provable. Without this: vertically integrated mint captures ~10× revenue (coordination + all storage shares) invisibly. |
| Mint deposit flight | Fidelity bond + tenure-weighted custody ceiling (see Glossary: Bond). New mints custody little; established mints have too much future income to lose. Deposit splitting bounds per-mint exposure. Ceiling bounds damage by construction; no prosecution needed. |
| Centrality gaming (citation clusters) | PageRank with pool-based teleportation: unfunded nodes inject zero importance. Isolated unfunded clusters have zero importance regardless of edge density. Gaming requires funding multiple nodes — expensive and self-defeating (outgoing edges donate importance to real content). |

### Storage Challenge Protocol

Mints challenge stores continuously, out-of-band from the front-end. Challenges are **batched over persistent Tor circuits** — one circuit per mint, kept alive across epochs. A store holding 800 shards receives one batched challenge message (all 800 offsets), responds with one batched response. Total time dominated by disk I/O (~8s for 800 random reads on HDD), not Tor overhead. The persistent circuit also carries attestation submission, mapping registration, and per-blob_id earnings pushes.

```
Every epoch, for each store:
  mint sends CHALLENGE_BATCH over persistent Tor circuit:
    [(blob_id_1, offset_1, nonce_1), ..., (blob_id_N, offset_N, nonce_N)]
  store responds within T seconds:
    [(blob_id_1, bytes_1, merkle_proof_1), ..., (blob_id_N, bytes_N, merkle_proof_N)]
  mint verifies each:
    merkle_proof valid against known shard_hash (deterministic from content_hash + shard_index)
    batch latency < T (proves local storage, not fetch-on-demand)

Per-shard failure: lose earnings for that shard this epoch.
Repeated per-shard failure (N consecutive): mint stops interacting for that shard.
```

### Cross-Store Verification (block-hash assigned)

Each epoch, a Bitcoin block hash determines the verification ring — not the mint. To avoid reorg ambiguity at epoch boundaries, the ring uses the block at `epoch_start_height - RING_CONFIRM_DEPTH` (6 blocks, ~1h before boundary). Assignment is deterministic from `hash(block_hash || store_set || epoch)`, unpredictable before the block, reorg-proof at depth 6, and independently verifiable by anyone.

```
Epoch E (block hash determines ring):
  Store_A proves shard_3 → Store_B assigned to verify Store_A's response
  Store_B proves shard_7 → Store_C assigned to verify Store_B's response
  Store_C proves shard_12 → Store_A assigned to verify Store_C's response
```

Earning requires BOTH passing your own challenge AND verifying a peer. Verification is **per-store, not per-shard**: one peer, one randomly-sampled shard from the peer's claimed set, per epoch. Mint's per-shard challenges remain the primary enforcement; cross-store verification catches mint-store collusion on the sampled shard. Over many epochs, sampling coverage converges. Block-hash assignment removes the mint from the challenge loop — the mint collects attestations and publishes summaries, but cannot rig verification assignments. Mint-store collusion requires the block-hash-assigned peer verifier to also be colluding. With S total stores and C colluding, probability of drawing a colluding verifier is C/S per epoch — over multiple epochs, an honest verifier is eventually assigned and fake storage is caught. The assignment record is public: if Store B is later shown to lack the shard, Store A's "pass" verdict implicates Store A (mint stops interacting with both).

### Bonded Mint Operators (Permissionless)

Permissionless entry via on-chain bond (BTC in time-locked UTXO). Any operator in any jurisdiction. Each operator: holds pool balance fraction (custody), verifies request proofs, collects store attestations, issues storage challenges, publishes epoch summaries, publishes coverage signals, executes settlement payouts.

**Mapping gossip**: See four mapping layers (Communication Channels). Key additions: **Gossip authentication** — mints only accept from peers with on-chain-verified bonds. **Gossip consistency** — best-effort; divergent mints fall through to relay-encrypted mappings (canonical). New mints bootstrap from relay mapping events.

**Bootstrap exception**: Founder operates a bonded mint at launch (Phase 2-3). Irreducible bootstrap cost. The `DEFAULT_MINT` in the reference client. Achieved at Phase 4 "forget" threshold.

**Resilience**: Any 2 mints surviving = full functionality. Serve caches provide organic fallback.

**Enforcement**: Competitive exit (see #13). Stores verify payment via attestation Merkle root + per-shard S_s; underpaid stores reroute. The ceiling bounds custody risk; the market punishes misbehavior through customer loss.

**Mint verification is free.** Free verification maximizes request proof volume, deepening the demand history moat.

---

## Revenue Model

### Protocol-Level: Coordination Share + Dimensional Remainder (passive)

Neither is a fee. Neither is a rate. Both are emergent from the settlement structure (see §4 pseudocode). Income flows to genesis (protocol constant) and to the reference client's via pubkey.

**Three income modes — all pay genesis:**
- **Active market** — coordination share + remainder from settlement. The primary, durable income. Survives total client competition.
- **Sweep** — abandoned pools (see Glossary: Sweep) → 100% to genesis. Catches noise and failed self-promotion.
- **Referrer** — via tag income through the reference client. Bonus, fragile to client competition.

No genesis income from misbehavior. Total addressable revenue = all inflow (successful and failed).

**Income hierarchy** (descending by durability):
1. **Per-shard coordination share + cascading remainder** — transitions from coordination rent (low S_s) to integer friction (high S_s). Fork-resistant via the economic moat (see Glossary).
2. **Document sweep tail** — documents (N=20) hit zero-drain floor with ~20% residual balance vs. ~1% for text.
3. **Text sweep** — smaller residual but higher volume. Quick cycles.
4. **Referrer** — fragile to better clients.

Additional genesis income: L0 remainder (drain mod N), timing gaps (store transitions), cross-epoch prorating, self-healing repair lag.

The capture rate is emergent and convex — every architectural improvement multiplies divisions. Fork resistance: the economic moat (see Glossary). The founder earns from the froth of disagreement — contested content drives the most conviction spending.

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
| `/earn` | Operator view — earnings projection calculator (input: disk budget, uptime profile; output: conservative/base/optimistic 30d/90d earnings range backtested against historical data), live opportunity table (funded hashes with low store coverage, marginal sats/epoch if you join, shard size), network stats (total stores, median/p10/p90 earnings, market depth trend), copy-paste `docker run ocdn-store --disk <N>GB`. Time-to-first-earning: ~4h (one epoch); time to near-full rate: ~24h (tenure ramp). |

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

Three tiers: global invariants (must match across all participants or interop breaks — change via content-fork), per-mint declared parameters (each mint chooses, market converges via reference defaults), and reference client / operator-set (unchanged).

**Global invariants** (change = content-fork version bump — see Upgrade Model):

| Constant | Value | Note |
|----------|-------|------|
| GENESIS_ADDRESS | `<address>` | See Glossary: Genesis address. Spans all versions and all per-mint parameter sets. |
| CONTENT_KEY_DOMAIN | "ocdn-v1" | Convergent encryption: key = SHA256(domain \|\| content_hash). IS the content-fork version tag — new structural version = new domain = new content namespace. |
| RS_K | 10 | Reconstruction threshold. Any 10 of 20 shards suffice. |
| RS_N | 20 | Total storage shards. 2× overhead. 10-of-20 for censorship resistance. |
| RS_WASM_HASH | SHA256 of canonical WASM binary | Protocol ships one RS encoder/decoder. This hash pins it. New binary = content-fork. |
| MIN_FRAGMENT_SIZE | 10240 (10 KB) | Below this: single encrypted shard (N=1). Above: full RS(K,N). |
| ARGON2_PARAMS | t=3, m=8MB, p=1 | Layer 1 mapping KDF. ~1-3s desktop, tuned for phone-browser WASM. Bulk scanning linearly expensive. |
| EPOCH_BLOCKS | 24 | ~4h at 10min/block. Bitcoin block height. Natural Schelling point. |
| RING_CONFIRM_DEPTH | 6 | Cross-store verification ring uses block at `epoch_start_height - 6`. Reorg-proof at depth 6. |
| PROTOCOL_VERSION | 1 | All events carry `["v", "1"]` tag. Structural upgrades = content-fork (new CONTENT_KEY_DOMAIN, parallel operation, natural sunset via sweep). See Upgrade Model. |
| NIP Event Kinds | 1000-9999 range | Non-replaceable. Pool credits are additive. |

**Per-mint declared parameters** (each mint publishes in bond registration event; settlers use declaring mint's values; reference client defaults anchor market convergence):

| Parameter | Reference default | Note |
|-----------|-------------------|------|
| DRAIN_RATE | 1/128 | Per-epoch fraction of mint balance drained. Half-life ≈ 89 epochs (~15 days). Reference default is a Schelling point, not a protocol constant. Mints compete on drain economics — funders and stores select based on disclosed parameters. |
| TENURE_DECAY | 2/3 | Store income maturation curve. `weight = 1 - TENURE_DECAY^tenure`. At 2/3: ~33% at epoch 1, ~91% at epoch 6 (~24h), ~99% at epoch 12 (~48h). Unpaid fraction recycles to pool. Lower values = faster maturation (less churn penalty); higher values = slower maturation (more churn penalty, longer duration extension). |
| SWEEP_EPOCHS | 42 | ~7 days. See Glossary: Sweep. |
| CHALLENGE_INTERVAL | 1 epoch | How often this mint challenges stores for storage proof. |
| MAX_SILENT_EPOCHS | 6 | ~24h. Missing summaries → stores and clients reroute. |
| MIN_ATTESTATIONS | 1 | Minimum store attestations per shard for settlement validity. |
| MIN_COVERAGE_K | RS_K (10) | Minimum covered shards for request proof acceptance. |
| COVERAGE_BLOCKS | 6 | ~1h. Coverage signal frequency. |
| POW_TARGET_BASE | 2^240 | Anti-spam for request proofs. ~200ms mobile. |
| POW_SIZE_UNIT | 1048576 (1 MB) | PoW scales with content size. |
| TOKEN_VALIDITY | 1 epoch | Delivery tokens expire at epoch boundary. Single-use, nonce-bound. |
| SERVE_CREDENTIAL_POW | 2^236 | ~3s PoW to register as serve endpoint with this mint. |


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
| Clearinghouse offer rate | Each store | Committed storage rate via NIP-OFFER. Market-determined. Protocol drain is DRAIN_RATE × balance regardless. |
| Damping factor | Each index | Reference: 0.85. Competing indexes choose their own. |
| Inscription weight | Each index | Reference: 2×. Product decision. |

---

## Upgrade Model

Two upgrade mechanisms for two kinds of change. Neither requires founder authority, endorsement events, or coordination with anonymous operators. The reference implementation IS the governance — the code speaks, adoption follows market incentives.

### Structural Upgrades: Content-Fork

Global invariants (RS params, WASM binary, encryption domain, Argon2 params) change via content-fork. New CONTENT_KEY_DOMAIN = new content namespace. v1 and v2 operate in parallel on the same relay/mint/store infrastructure. Old content drains under old rules until pools sweep. New content accumulates under new rules. No migration, no flag day.

**Propagation**: The reference client starts funding new content under the latest version by default. Stores and mints that don't upgrade keep earning from old-version pools until sweep, then have economic incentive to upgrade. The upgrade propagates through economic gravity, not authority.

**Revenue-generating**: Content-fork means important content gets re-uploaded and re-funded under the new version. New deposits, new settlement, new genesis income. The founder is incentivized to ship better versions. The market is incentivized to adopt them.

**Frequency**: Extremely rare — ideally never after v1 stabilizes. Encoding and encryption are the kind of things you get right once and freeze.

### Economic Upgrades: Per-Mint Declared Parameters

Economic parameters (DRAIN_RATE, SWEEP_EPOCHS, challenge intervals, etc.) are per-mint declared. Each mint publishes its parameter set in its bond registration event. Settlers compute per-mint settlement using that mint's declared values. Deterministic — same declared params + same epoch summary = same settlement.

**Convergence**: The reference client sorts mints by proximity to reference defaults. Funders see parameter implications at deposit time ("estimated pool duration: ~15 days"). Mints near reference defaults attract more deposits. Mints far from defaults serve niches or attract nothing. The reference implementation is the Schelling point — not by authority, but by default.

**Verification**: Fund confirmations (public) + epoch summaries (public) + declared parameters → expected drain and payouts are independently computable by any settler or store. Competitive exit handles discrepancies. No new trust assumption.

**Self-correcting**: If the reference default DRAIN_RATE is wrong, mints that declare better rates attract more deposits. The reference implementation can update its defaults in the next release — no protocol change, no content-fork, just a new Schelling point.

### What the Founder Actually Does

1. Publishes reference implementations (open source, forkable, but the founder's repo is the coordination point by convention).
2. Sets reference defaults (not enforced, just defaults — the Schelling point).
3. Signs nothing. Operates nothing. Endorses nothing explicitly.

### Moat Properties

- **Genesis address spans all versions and all parameter sets.** Content-fork from v1 to v2 pays the same genesis address. A mint with DRAIN_RATE=1/64 uses the same settlement formula with the same genesis remainder.
- **The Schelling point is harder to attack than an authority.** You can't "override" a default — you can only out-compete it by bootstrapping a whole alternative ecosystem.
- **Encoding upgrades generate revenue.** Re-upload + re-fund under new version = new market activity = more settlement = more genesis income.

---

## MVP Build Order

### Phase 1: Prior Work (Complete)

File layer, L402, node kit, receipt SDK, pin contracts. Cryptographic primitives carry forward.

### Phase 2: Build Four Artifacts

The client validates the thesis. The storage market captures value from the thesis. Build the client first — if nobody funds contested claims through it, the storage market is moot. All four ship in MVP, but priority is: client → spec → settle → store.

1. **Static client SPA + OG endpoint** — No backend. Stateless (see Human Interface: Stateless Client). Via tag = FOUNDER_VIA_PUBKEY. Funding via NWC/Cashu through DEFAULT_MINT, split across DEPOSIT_SPLIT_MIN mints. Deploy to IPFS + domain + self-host via `ocdn-pack`. OG endpoint as Cloudflare Worker. `/earn` route for operator recruitment. **This is the founder's primary income-generating asset** — every request proof earns referrer income. First-mover links and OG cards compound the social moat. **Shelf life**: IPFS SPA breaks within 6-18 months; domain version is updatable. Genesis income survives client competition; referrer income doesn't.
2. **Protocol spec (NIP)** — Four event types (see §1-4), bonded mints, settlement rule, global invariants, per-mint parameter schema. Short enough to read in 20 minutes. Structural upgrades via content-fork (see Upgrade Model); economic parameters are per-mint declared.
3. **`ocdn-settle` binary** — Deterministic CLI (single static binary). Input: relay URL(s) + mint epoch summaries. Output: settlement events published to relays. `GENESIS_ADDRESS` is a constant in the source. Content-hash the binary, publish the hash.
4. **`ocdn-store` daemon** — Docker container bundling Tor. Binds .onion address on first run (key persists in volume). Watches coverage signals, stores shards, registers mappings via anonymous transport, responds to challenges, attests to mint, cross-verifies peers, earns Cashu ecash tokens (blind-signed, redeemable anywhere). Zero editorial decisions. `docker run ocdn-store`. Operator identity never leaves the container. Earnings accumulate as bearer token files in the volume; `ocdn-store cashout` sweeps to Lightning. Laptop-viable: zero cost basis, graceful sleep/wake, earns when online.

### Phase 2b: Bootstrap Mint (founder-operated, temporary)

The founder operates a bonded mint behind Tor for the bootstrap window. **This is the irreducible bootstrap cost if no partner mint is recruited before launch.** The mint runs `ocdn-mint` (Docker container bundling Tor, like `ocdn-store`) and requires:
- Cashu library for HTLC-gated inbound deposits + blind-signed store payouts (all over Tor)
- .onion address for store attestation submission + deposit acceptance (no clearnet endpoint)
- On-chain bond UTXO (~500K sats, funded anonymously via coinjoin, Taproot P2TR — recoverable when shut down)
- Relay WebSocket connections (outbound, over Tor) for fund confirmations, epoch summaries, coverage signals, encrypted mapping backups

Budget 2-3 days integration beyond core protocol logic. The mint is a Cashu-connected Tor hidden service, not a clearnet Lightning node. **Exit criterion**: one independent mint bonds and accepts deposits. The founder's mint shuts down; the founder's seed funding already routed through the partner mint gives it immediate coordination share income.

**Alternative**: recruit a partner mint operator (existing Cashu operator or Nostr ecosystem builder) before launch. Pitch: "Run this Docker image, post a 500K sat bond, I'll route 200K sats of deposits through you on day 1." The founder's seed budget IS the recruitment budget. If successful: zero founder machines, zero ongoing infrastructure.

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
| Stores | Independent operators (unbonded) | Storage shard drain via settlement | Any K survive per content = availability maintained |
| Serve endpoints | Anyone (front-ends, CDNs) | Coordination shard referrer share + venue fees, ads | Any 1 survives = content deliverable |
| Bonded mints | Independent bonded operators | Coordination shard mint share | Any 2 survive = request proofs verified + payouts flow |
| Importance indexes | Independent operators | API fees, venue fees | Any 1 survives = rankings exist |
| Settlers | Anyone | None (public service) | Any 1 survives = settlements computed |
| Clearinghouse | Anyone | Market-set spread | Degrades to raw pool credits |
| **Founder** | **None** | **Genesis coordination share + remainder + sweep + referrer income via reference client** | **N/A — no operational role to fail** |

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

## Unresolved Design Conflicts

### 1. ~~Relay-Encrypted Mappings vs. Store-Blindness~~ RESOLVED

Two-layer defense protecting different links (see Glossary: Store-blind, Mapping). Relay reveals content→address (Argon2-gated); anonymous transport hides address→operator. **Residual**: mapping staleness (periodic refresh needed), Argon2 parameter tuning for phone-browser WASM.

### 2. ~~Bond Slash Enforcement~~ RESOLVED → Competitive Exit

Fidelity bonds (see Glossary: Bond) + competitive exit (#13). **Residual**: sybil mint spam (mitigated by reference client routing limits), `tenure_factor` curve calibration, bootstrap window (single mint — ceiling is the only protection until ≥2 mints).

### 3. Cross-Store Verification Ring at Low S

Verification ring requires S ≥ 3 for minimal independence. At S=1: no peer. At S=2: mutual verification (trivially collusive). **Fallback**: mint-only challenges below S=3. The cross-store ring is a strengthening, not the foundation — the mint already challenges every epoch. Explicitly state the weaker security property at low S.

### 4. ~~WASM Binary Governance~~ RESOLVED → Content-Fork

New WASM binary = new CONTENT_KEY_DOMAIN = content-fork (see Upgrade Model). Parallel operation, natural sunset via sweep. **Residual**: get v1 right and freeze — content-forks should be extremely rare.

### 5. ~~Epoch Summary Detail vs. Store Privacy~~ RESOLVED

Delivery token model (see Glossary: Delivery token, §3). Attestations reference delivery token hashes, not content→store mappings. Settlers verify math without learning store-content associations. **Residual**: concrete schema for private epoch detail still needed.

### 6. ~~Lightning Payout Failure Handling~~ RESOLVED

Cashu ecash payout (see Glossary: Cashu payout). Eliminates Lightning routing failures, payment timing correlation, and payment-layer deanonymization.

### 7. ~~DRAIN_RATE Calibration~~ RESOLVED → Per-Mint Declared

Per-mint declared parameter (see Constants, Upgrade Model: Economic Upgrades). Market converges via Schelling point. **Residual**: reference default 1/128 is a napkin estimate — but the market can correct it without a protocol upgrade.

### 8. ~~Sweep Trigger Calibration~~ RESOLVED

PoW-weighted sweep threshold: aggregate PoW must exceed `SWEEP_POW_THRESHOLD` within SWEEP_EPOCHS. Anti-griefing scales linearly. **Residual**: threshold calibration needs telemetry — too high = premature organic sweep; too low = cheap griefing.

### 9. M Key Lifecycle

M generated at upload by verifying mint, distributed to all bonded mints via authenticated gossip, relay-escrowed with Argon2 gating. **M persists indefinitely** — relay-escrowed M cannot be deleted (Nostr events are permanent and distributed). Ghost state is economic death, not cryptographic death: stores evict shards (no economic incentive), but M on relays enables recovery from any surviving offline copy. Re-funding attempts shard recovery via old M first (surviving stores from previous life), falls back to new M + re-upload if no shards survive. **Residual concerns**: (i) Relay pruning of escrowed M events — periodic refresh doubles as anti-pruning. (ii) M recovery path from relay needs integration test. (iii) Threshold sharing of M across mints (Shamir T-of-N) is the hardening path — v1 distributes full M via gossip (any single compromised mint reveals M for content it knows about; serve endpoint proxying still prevents store identification by the adversary). (iv) Store-blindness anchors on anonymous transport (address→operator), not M secrecy (content→address) — M is a computational speed bump (Argon2, ~1-3s), not a cryptographic wall.

### 10. Mint Upload Bandwidth

Mint re-encrypts and distributes shards at upload time. For a 100MB document (N=20 shards, ~5MB each): ~50MB inbound from funder + ~100MB outbound to stores. At 100 uploads/hour: ~15GB/hour. Acceptable for VPS-class mints but larger than current design assumes. **Mitigation**: funders submit convergent-encrypted shards (client-side RS + encryption unchanged); mint verifies, wraps with its layer, and distributes. The compute cost of re-encryption is trivial (~microseconds AES per shard); bandwidth is the binding constraint.

### 11. RS WASM Verification Oracle

Ship a second independent RS implementation (different language, different author) as a spot-check verifier alongside the canonical WASM binary. The verifier runs in background: randomly samples N% of encode/decode outputs and compares against the canonical binary. Agreement = high confidence. Disagreement = red alert, halt. The second implementation is never used for production — it's a canary. Reference client (reader side) can decode with both and verify plaintext agreement. Does not eliminate the WASM governance problem (#4) but catches silent corruption before data loss.

### 12. Anonymous Transport Considerations

Stores default to Tor hidden services. Protocol specifies opaque addresses, not transport. **Residual concerns**:

(i) **Sybil stores under anonymity**: one operator, many .onion addresses, same machine, one disk copy served from all. All pass challenges (shared disk). Coverage signals report false redundancy. Economic self-limiting (sybil storage is unprofitable at scale — N× addresses for 1/(N+1) per-store income per shard). Detection heuristic: correlated response latency across addresses. Not provable, but mints can weight reputation. Real geographic diversity has natural economic advantage — correlated failure (one machine) means correlated income loss.

(ii) **Challenge latency**: Tor adds ~1-3s per connection. Challenge response window T must accommodate. At CHALLENGE_INTERVAL = 1 epoch (4h), generous T (30-60s) is fine. Shard delivery latency absorbed by serve endpoint caching — hot content never touches the Tor path.

(iii) **Tor as single transport dependency**: Tor-level disruption (protocol vulnerability, state-level blocking) takes down the anonymous store layer. **Mitigation**: protocol specifies opaque address, not `.onion` specifically. Reference daemon defaults to Tor; operators can substitute I2P or clearnet (accepting identification risk). Multiple transports can coexist — market prices the privacy/performance tradeoff.

(iv) **Bandwidth ceiling**: Tor hidden services cap ~1-5 MB/s. Fine for small shards (text) and adequate for document shards (~100KB-5MB). The serve endpoint is the performance layer (clearnet, caching); the store is the durability layer (anonymous, slower). The separation is already in the design — anonymous transport makes it explicit.

### 13. Competitive Exit Model

Fraud proofs replaced by competitive exit + attestation Merkle root. The PoW analogy: don't punish bad miners, reward good ones. The protocol doesn't track who was dishonest — it pays whoever does the work.

**What was removed**: Attestation receipts (`ack` system). Fraud proof event type. "Economic death" as a protocol concept. MAX_SILENT_EPOCHS as a death trigger. Client-side fraud proof evaluation logic.

**What was added**: (i) `attestation_root` in epoch summary — Merkle root over `hash(attestation)` leaves. Store verifies own inclusion; settlers verify detail consistency against committed root. Attestation signatures make leaves unpredictable to non-signers — sibling hashes in inclusion proofs reveal nothing about other stores. (ii) `shard_stores` in epoch summary — per-shard S_s counts. Stores compute exact expected payouts independently. Settlers verify S_s against attestation detail.

**What was preserved**: Fidelity bonds + tenure-weighted ceiling (bounds custody risk by construction). Hash-chained epoch summaries (consistency detection, not prosecution). Storage challenges (self-proving work — fail = no payment). Cross-store verification ring. Deposit splitting. Multi-mint attestation broadcast.

**Enforcement model**: Store verifies Merkle inclusion + computes expected payout from public data (pool balance + S_s + formula) + compares against received Cashu token. Anomaly → stop attesting to that mint, reroute to alternatives. Aggregate departures are visible in subsequent epoch summaries — the store count trajectory IS the reputation signal. No reporting, no claims, no oracles.

**Reputation from observable behavior**: Four signals, none sufficient alone, robust in combination: (a) Merkle inclusion (private, immediate — "was I paid?"), (b) store count trajectory (public, ~1 epoch lag — "are stores staying?"), (c) epoch chain integrity (public, permanent — "is the mint consistent?"), (d) bond tenure (on-chain, permanent — "how much is at stake?"). Faking all four simultaneously converges on actually being an honest operator. Reputation materializers (product layer) can publish longitudinal metrics as Nostr events.

**Daemon behavior**: On startup, computes mint reputation from public epoch summary history. Per epoch, verifies Merkle inclusion and payout amounts automatically. On anomaly, reroutes without operator intervention. Periodically re-evaluates mint rankings from updated public data.

**Residual concerns**: (i) Bootstrap window — competitive exit requires ≥2 mints; protocol should not accept public deposits until this threshold is met. (ii) Subtle underpayment below detection threshold — bounded and tolerable; the mint can't increase the skim without triggering departures. (iii) "Bank run" dynamic on declining mint — gradual (weeks, not hours), but damage bounded by ceiling regardless of response speed. (iv) S_s inflation (mint claims more stores than attested) — detectable by settlers who verify attestation detail against Merkle root; phantom stores must pass challenges (expensive to maintain).

### 14. ~~Delivery Token Throughput Over Tor~~ RESOLVED → Degraded-Mode Retrieval

**Throughput** (original concern): persistent Tor connections between serve endpoints and mints (batch RPC, not per-request circuits). Pre-issued delivery token batches on relays (encrypted to registered serve endpoint pubkeys) convert synchronous mint-contact into asynchronous relay-pull. Hot path never touches Tor latency.

**Availability** (the deeper concern): delivery tokens made mints the retrieval critical path — mint takedown = content blackout despite data, mappings, and keys surviving on relays. **Resolution**: the delivery token bundles two functions — authorization (anti-abuse, redundant with PoW) and mediation (per-request privacy + routing, requires mint liveness). Decomposing the two enables degraded-mode retrieval: stores accept PoW-authorized direct requests (blob_id + PoW) when no mint is reachable for > MAX_SILENT_EPOCHS. Discovery via relay-encrypted mappings (Argon2-gated, already designed to survive mint death). Decryption via relay-escrowed M (same). Store-blind preserved: requester presents blob_id (store's own identifier), not content_hash. **Degradations**: no settlement (stores earn nothing), no per-request privacy (serve endpoint sees full store topology), no demand signal. **Perverse incentive analysis**: degraded mode is structurally worse for all participants — stores (no income), serve endpoints (no via income), readers (slower, reduced privacy). No pricing differential needed; the absence of settlement IS the differential. Degraded mode is a censorship-resistance property, not an alternative operating mode.

**DDoS on mint .onion**: discoverable from relay registration events. Tor PoW-gated onion access (0.4.8+) helps. Multi-mint architecture is the primary defense. Degraded-mode retrieval is the last resort — DDoS suppresses economics but not content.

**Residual**: (i) Degraded-mode abuse surface — PoW is the only rate limiter; sustained DDoS on stores via valid PoW is expensive but possible. (ii) Store eviction timeline during prolonged mint outage — daemon rebalance loop sees zero earnings, eventually evicts; the grace period before eviction is implicit (next coverage signal cycle, ~1h). (iii) Serve endpoint holding M in degraded mode is a temporary privacy reduction — M exposure to serve endpoints doesn't break store-blindness (serve endpoint already sees store addresses) but does collapse the key envelope abstraction.

### 15. Deposit Atomicity (HTLC-Gated Cashu)

Anonymous mints create a deposit trust gap: funder sends bearer ecash, mint doesn't publish confirmation. **Resolution**: HTLC-gated deposits. Ecash locked to a hash preimage; fund confirmation event on relays MUST contain the preimage for ecash to settle. Funder reclaims on timeout. Atomic — mint cannot take ecash without publishing, cannot forge the confirmation (preimage binds to content_hash + amount + mint pubkey). Cashu supports hash-time-locked tokens today. **Residual**: HTLC timeout must accommodate Tor latency + relay propagation (~30-60s); needs protocol-level specification of the preimage derivation scheme.

### 16. Bond UTXO Chain Analysis

Bond is a Bitcoin UTXO. Chain analysis can trace funding inputs. With Taproot (P2TR), the UTXO is indistinguishable from any normal output on-chain — time-lock script hidden in script tree, proven off-chain in relay registration event. But amount (~500K sats) and creation timing correlate with registration. **Mitigations**: coinjoin bond funding, common UTXO amounts, delay between UTXO creation and relay registration. `ocdn-mint` daemon should include bond-creation tooling guiding operators through anonymous funding. This is operational security, not protocol design — the protocol can't enforce anonymous bond creation, only make it possible.

### 17. Mint Key Rotation Under Anonymity

Anonymous mint reputation = pubkey's track record (epoch chain, store retention, bond tenure). Key compromise forces rotation: new pubkey, zero tenure, zero track record. No identity to carry social reputation across keys. **Partial mitigation**: old key signs handoff endorsement of new key (partial trust signal, not reputation transfer). New key still starts at zero tenure. Real answer: aggressive key protection (HSM, air-gapped signing) — the cost of key loss is high by design, the price of anonymity.

### 18. Request Proof Relay Volume at Scale

Every read produces a public relay event. At millions of reads/day this is the highest-volume event type in the system. "Batched/delayed" (§3 consumption flow) is stated but unspecified. Batching strategy has privacy implications: batch size and delay windows trade timing-correlation resistance against relay throughput. Serve endpoints aggregating proofs before relay publication reduces volume but centralizes the demand signal path. Client-side batching preserves decentralization but requires specification (batch size, max delay, jitter). Needs: concrete batching protocol with explicit privacy/throughput tradeoff, relay impact analysis at target scale, and whether serve endpoint relay archives can selectively index (e.g., only persist aggregates, not individual proofs).

### 19. Serve Endpoint Traffic Analysis at Bootstrap

During bootstrap (1-2 serve endpoints), the mandatory proxy is a traffic analysis chokepoint. A single dominant serve endpoint can correlate inbound request proof timing with outbound store contacts, deanonymizing which stores serve which content despite delivery token indirection. The "many competing serve endpoints" mitigation doesn't apply until the ecosystem matures. **Partial mitigations**: (i) serve endpoint batches outbound store fetches with random delay (degrades latency), (ii) pre-fetching popular shards into serve cache (reduces store contact frequency), (iii) mint pre-issues delivery token batches (decouples request timing from store contact). None fully close the gap at S_serve=1. The bootstrap threat model should state this honestly: serve endpoint traffic analysis is the weakest privacy link until multiple competing serve endpoints exist.

### 20. ~~Store Selection Algorithm~~ RESOLVED → Verifiable Store Selection

Delivery token store selection uses the same block-hash determinism as cross-store verification: `selected_index = hash(block_hash || content_hash || shard_index || request_proof_hash) mod S_s` against the previous epoch's committed `store_set_root` (Merkle root over sorted store pubkeys, published in epoch summary). Selection proof included in each delivery token. Stores verify every token; settlers audit selection correctness against committed sets. Mint cannot bias selection without rejecting valid request proofs (detectable by serve endpoints) or falsifying the committed store set (detectable via cross-store verification — phantom stores must pass challenges). **Why this matters**: without verifiable selection, a vertically integrated mint routing delivery tokens to its own sybil stores captures coordination share + all storage shares (~10× revenue) invisibly — the anonymity that protects legitimate stores also hides the collusion. Verifiable selection makes biased routing a provable fraud after a single anomalous delivery token. The mechanism generalizes the existing cross-store verification construction — same inputs (block hash, public data), same trust properties (unpredictable, independently verifiable), applied to routing instead of peer assignment. **Residual**: (i) serve endpoint observation of store selection patterns across many requests — deterministic selection means repeated requests for the same content in the same epoch hit the same stores (mitigated by including request_proof_hash, which varies per request via client PoW nonce). (ii) New stores joining mid-epoch receive delivery tokens starting next epoch (store_set_root frozen at epoch summary publication) — aligns with tenure ramp-up (first epoch = low weight anyway).

### 21. PoW Difficulty Adaptation

`POW_TARGET_BASE` is per-mint declared but static. As hardware improves, the spam boundary erodes. Under active sybil attack, no mechanism exists to raise difficulty reactively. Per-mint declaration means each mint adjusts independently — convergence via Schelling point may be too slow under attack. **Tension**: adaptive difficulty (mint adjusts based on request proof volume) creates gaming incentives — an attacker floods proofs to raise difficulty, pricing out legitimate mobile readers. Static difficulty is stable but brittle to hardware trends. Bitcoin's difficulty adjustment works because block production is bounded; request proof production is unbounded. Needs: whether per-mint declaration + reference default updates are sufficient, or whether an in-protocol adaptive mechanism is required, and if so, how to prevent attacker-induced difficulty manipulation.

### 22. Tenure-Weighted Payout Considerations

Three residual concerns from tenure-weighted settlement:

(i) **Bootstrap cold start**: New stores joining an undercovered shard earn ~33% in their first epoch (reference TENURE_DECAY = 2/3). At small `unit_s`, `floor(unit_s × 0.33)` may round to 0 — store earns nothing for 1-2 epochs. This slows initial store recruitment for low-balance pools. **Mitigation**: the ramp-up is short (~24h to 91%); the stores that persist through maturation are exactly the stores that provide durable availability. Coverage signals already show opportunity — stores that join for the long term are rewarded; stores that would churn and waste pool sats are filtered. At bootstrap with few stores, the recycled income from maturation extends the pool, buying time for stable stores to establish tenure.

(ii) **Mint tenure tracking burden**: Mints must track per-store-per-shard consecutive attestation counts across epochs. This is O(stores × shards) state, updated each epoch. For a mint with 1000 active store-shard pairs, this is a small integer per pair — trivial memory and storage. The attestation Merkle root already commits the mint to its attestation set; tenure is a derived count from the committed history. Settlers independently verify tenure by walking the `prev`-chained epoch summaries (bounded lookback). No new trust assumption — settlers already reconstruct mint history from the chain.

(iii) **TENURE_DECAY calibration**: Reference default 2/3 is a napkin estimate targeting ~24h to 91% income. Too low (fast maturation) = weak churn penalty, minimal duration extension. Too high (slow maturation) = discourages new store entry, especially at bootstrap. Per-mint declared: mints that choose aggressive TENURE_DECAY (high value, slow ramp) attract longer-tenure stores and extend pool life; mints that choose gentle TENURE_DECAY (low value, fast ramp) attract more stores but with less churn protection. Funders see the implication at deposit time: "this mint's stores mature in ~24h" vs "~48h." The market finds the equilibrium.

### 23. Shard Acquisition Stampede at Bootstrap

Day 1: many store operators deploy simultaneously, all see the same undercovered seeded content, all request replication tokens from the same 1-2 mints. **Mint bottleneck**: thousands of replication authorization requests on a single .onion. **Source store bottleneck**: first stores to acquire become replication source for everyone else — one store serving 50 copies of the same shard over Tor. **Mitigations**: (i) Jittered acquisition — daemon adds random 0-30m delay before first replication requests. (ii) Mint-side rate limiting — cap replication tokens per shard per epoch; remaining stores queue for next epoch (also prevents overcrowding). (iii) Source diversification — mint distributes subsequent replication tokens across multiple source stores as they acquire (exponential fanout). (iv) Pre-seeded shards — founder pre-distributes shards to early stores before public launch, starting day 1 at S_s=3-5 instead of S_s=0. The PoW gate on replication requests provides natural serialization.

### 24. Cold Start Timeline and Bootstrap Earnings

Time-to-first-earning: ~4h minimum (one full epoch for first challenge + attestation cycle). Time to near-full rate: ~24h (tenure ramp to ~91%). At bootstrap with ~150K sats total seeded pools at DRAIN_RATE=1/128: total drain ≈ 1,172 sats/epoch across all content. A single store covering all 25 seeded text items earns ~175 sats/epoch at first-epoch tenure (33%) — roughly $0.50-1.50/day. The `/earn` page must be honest about bootstrap economics: early operators subsidize network launch for future economics as funded content grows. Pool depletion is real: half-life ~15 days without new deposits. The economic case for early stores depends on content growth, not steady-state projections. **Residual**: the daemon should surface "at current deposit velocity, your portfolio sustains for ~N days" — making the growth dependency explicit.

### 25. DNS/Domain as Bootstrap Single Point of Failure

The reference client deploys to "IPFS + domain." Domain seizure is the cheapest, most proven state-actor censorship vector. IPFS addresses change with content updates ("breaks within 6-18 months"). The viral loop (OG images, shared links) fundamentally depends on a clearnet URL — there is no elegant solution for the link-sharing use case without DNS. **Partial mitigations**: (i) Tor .onion address for the client (no DNS dependency, but breaks the viral loop), (ii) ENS/HNS for censorship-resistant naming (small user base, extra resolution step), (iii) multiple mirror domains across registrars/jurisdictions (operational complexity), (iv) client-as-browser-extension (no domain needed, but limits reach). The OG image endpoint has the same DNS dependency. The honest answer may be: DNS is a speed bump, not a wall — if the domain is seized, the protocol continues (all state on relays + Bitcoin), and a new client on a new domain reconstructs in hours. The viral/social moat is lost; the economic moat is not.

---

## The One-Sentence Version

**Sats bind to hashes; four separated roles (store, serve, mint, genesis) settle at participant parity; all infrastructure is anonymous; the founder operates nothing; the income is settlement math; the moat is the economic engine.**
