# Permissionless Storage Market — Nostr-Native

**Purpose**: A permissionless conviction scoreboard. Sats bind to hashes. Reading is free. Funding is advertising. Four separated roles (store, serve, mint, genesis) ensure no intermediary can redirect economic flows. Settlement divides each mint's pool drain among P participants at parity — coordination earns what one store-shard pair earns. The importance index is the product. The dimensional friction of a deep storage market is the income. The economic moat deepens with every upload. **The protocol's primary output is a Bitcoin-anchored evidence record** — existence, demand, funding, and suppression of every content item, verifiable with only Bitcoin headers and SHA-256. The storage market is the engine; the evidence chain is the permanent exhaust. Content is mortal. The accusation is not.

---

## Glossary

Terms are defined here once; the rest of the document uses them by reference.

### Roles

| Term | Definition |
|------|-----------|
| **Store** | Unbonded operator holding encrypted shards behind anonymous transport (Tor hidden service by default). Earns from pool drain via settlement. Challenge protocol is the sole enforcement. Reachable by opaque address — protocol is transport-agnostic. |
| **Serve endpoint** | Untrusted delivery pipe (front-end, CDN, proxy) + filtered Nostr relay for OCDN event kinds. Earns referrer income via `via` tag. No bond required. Event persistence is a natural extension of the serve role — serve endpoints already consume relay data to function; persisting it aligns incentives (better event availability → more traffic → more via income). Signed events make persistence trustless. **Demand witness**: publishes sampled request proofs and per-epoch referrer witness events to its relay — serve endpoints see every forwarded proof, have via-tag income incentive for correct referrer accounting, and operate the relay infrastructure. Multiple competing serve endpoints cross-verify. **Commitment witness**: relays processing_commitments between client and mint during serve-blinded selection (see §3 Consumption flow). Publishes its observed `commitment_count` per epoch in referrer witness events — cross-verifiable against the mint's committed `commitment_count`. |
| **Mint** | Fidelity-bonded operator (time-locked UTXO) behind anonymous transport (Tor hidden service default, like stores): holds pool balances, verifies request proofs, collects attestations, issues storage challenges, publishes epoch summaries. Tenure-weighted custody ceiling. Identified by pubkey + on-chain bond UTXO, not by operator identity. Deposits via HTLC-gated Cashu-over-Tor (atomic, zero-trust — see §1). |
| **Settler** | Anyone who computes deterministic payouts from epoch summaries AND publishes the Bitcoin evidence anchor (~56-byte OP_RETURN per epoch). First valid anchor per epoch is canonical. Public service, no bond, no protocol income. Anchor cost is trivial (~56 sats/epoch); any participant can publish. **Honest framing**: the evidence layer is a latent capability of the data structure — all inputs are public and the computation is deterministic — but it becomes a guaranteed output only when someone finds it worth their while to run. At bootstrap, the trust model reduces to "trust the bonded mint" rather than "trust the math." Independent settlement activates when the ecosystem is large enough for parties (index operators, institutional consumers, store collectives) to justify audit infrastructure for their own business reasons. See G4. |
| **Genesis pubkey** | The protocol seed. Discovered from the genesis inscription sender on Bitcoin (`GENESIS_INSCRIPTION` is the one hardcoded constant). All cryptographic derivations (content keys, Argon2 salts, epoch hashes, challenge nonces, store selection, state roots) are rooted in this pubkey — changing it creates a mathematically incompatible protocol. The corresponding address receives settlement remainders + sweep. The private key controls spending, not protocol operations. The pubkey is the protocol's identity: irrevocable, permanent across all versions and parameter sets. |
| **Genesis inscription** | Bitcoin inscription whose sender defines the genesis pubkey and whose body contains the protocol constant set (RS_K, RS_N, ARGON2_PARAMS, EPOCH_BLOCKS, etc.). The ONE hardcoded value in the codebase. Everything else is derived from it or declared per-mint. |
| **Protocol seed** | `protocol_seed = genesis_pubkey`. The 32-byte root from which all protocol-level cryptographic parameters are derived. |
| **Epoch hash** | `epoch_hash = SHA256(protocol_seed \|\| block_hash_at(epoch_start_height - RING_CONFIRM_DEPTH) \|\| epoch_number)`. Refreshes every epoch (~4h), unpredictable (future block hash), independently computable by any participant with a Bitcoin data source. Embedded in every protocol boundary as mutual authentication — wrong genesis pubkey → wrong epoch_hash → rejected at first contact. |

### Settlement Math

Settlement is **per-shard**: each shard's payout formula is an independent micro-market. Cross-shard coupling exists only at the activation level: K-threshold gating (coverage ≥ K required for request proof acceptance) means drain fires for all shards or none. Once activated, each shard settles independently.

| Symbol | Definition |
|--------|-----------|
| **N** | Shard count. 1 for text (below MIN_FRAGMENT_SIZE), RS_N (20) for documents. |
| **S_s** | Stores with valid attestations for shard *s* this epoch. Per-shard, not global. |
| **K** | Reconstruction threshold: any K of N shards suffice (RS_K = 10). Mints gate request proofs on coverage ≥ K. |
| **P_s** | Participant count per shard = S_s + 1. Stores for this shard + 1 coordination. |
| **R** | Unique referrer count from valid request proofs this epoch. |
| **DRAIN_RATE** | Per-epoch fraction of mint balance drained. `drain = floor(balance × DRAIN_RATE)`. Pool half-life = ln(2)/DRAIN_RATE. Balance-proportional → approximately mint-count-invariant when mints share the same DRAIN_RATE (deposit splitting doesn't penalize duration). With different per-mint DRAIN_RATEs, composite duration depends on the specific mint mix. |
| **Coordination fraction** | 1/P_s = 1/(S_s+1) per shard. Independent of N. Shrinks as shard depth grows. |
| **Participant parity** | All P_s participants per shard earn `floor(shard_drain/P_s)`. Coordination is one of them. |
| **Cascading remainder** | Two levels of `floor()` per shard: L1 (shard division) + L2 (coordination subdivision). L1 + L2 remainders → genesis. L2 uses a constant 3-way split (mint / referrer pool / genesis) — R-invariant. Referrer pool subdivided internally by proof count; internal remainder → top referrer (sybil-dilutive). More shards × more content = more independent divisions = more genesis income in absolute sats, smaller percentage. |
| **Self-balancing** | Equal shard drain + per-shard parity: thin shards (low S_s) pay more per store, thick shards (high S_s) pay less. Stores migrate to gaps. |
| **TENURE_DECAY** | Per-mint declared. Store income maturation curve: `weight = 1 - TENURE_DECAY^tenure` where `tenure` = consecutive epochs passing storage challenges for this shard at this mint (challenge-based tenure — see Settlement §4). New stores earn less; the unpaid portion recycles to the pool, extending content lifetime. Reference default 2/3. Challenge-based tenure decouples the weight curve from routing — stores that hold shards and prove availability accumulate tenure regardless of delivery token frequency. |
| **Tenure recycling** | Per-store, per-shard: `unit_s - floor(unit_s × weight)` credits back to the pool each epoch. Pool balance is no longer strictly monotonically decreasing — churn returns sats, extending effective half-life beyond `ln(2)/DRAIN_RATE`. Stable stores earn full rate; churning stores subsidize duration. Under challenge-based tenure, recycling occurs when stores are newly registered (low challenge tenure) — not when they're simply un-routed by a biased mint. |

Bootstrap reference (any N, at R=1): At S=1, coordination fraction = 50%. At S=3: 25%. At S=10: 9.1%. At S=100: ~1%. Genesis share = 1/3 of coordination unit + L1 remainder + L2 remainder (0-2 sats). R-invariant: referrer count doesn't change the L2 denominator. See [Settlement Rule](#4-settlement-settler-signed) for canonical pseudocode.

### Content Lifecycle

| Term | Definition |
|------|-----------|
| **Pool** | Sats bound to a content hash. Credits accumulate from fund events; drains pay stores + coordination. |
| **Drain** | Per-epoch outflow from a pool. `drain = floor(balance × DRAIN_RATE)`, divided equally across N shards. Balance-proportional: pool half-life is deterministic, store count doesn't affect drain speed. Gate-triggered: drain fires when any valid attestation exists this epoch; request proof volume doesn't change the amount. Effective drain is reduced by tenure recycling — immature stores earn less, and the unpaid portion credits back to the pool (see Glossary: Tenure recycling, §4). |
| **Sweep** | Pool with no valid attestations for SWEEP_EPOCHS consecutive entries in the mint's epoch chain → entire balance to genesis. Chain-relative counting: SWEEP_EPOCHS is measured against the mint's `seq`, not wall-clock epochs. Mint offline → chain frozen → sweep clock frozen → mint takedown cannot trigger sweep. Purely per-mint — no cross-mint demand check, no relay dependency. A storeless mint receives zero routed demand (serve endpoints route around S_s=0), so its pools are economically inert; sweeping them is the correct market signal. |
| **Ghost** | Content whose pool is depleted — the protocol's **completed evidence cycle**. The economic fossil persists as a **ghost dossier**: metadata, economic biography (total funded, total drained, peak balance, lifetime, unique funders, total demand proofs, unique consumers), Bitcoin anchor references, and portable existence proofs (see Glossary: Existence proof). Content hash provable via the hash-chained epoch log — `funding_root` proof (deposit), `balance_root` proofs (active life), `sweep_root` proof (exit) — all verifiable against mandatory Bitcoin anchors with only block headers + SHA-256. Bytes are gone from the storage market — stores evicted, no one paid to serve. The content hash is a **standing warrant**: anyone possessing the original file can prove it matches the Bitcoin-anchored record. Recovery: anyone with the original file can re-encrypt (convergent encryption is deterministic), re-upload, re-fund. `[+] to restore`. |
| **Coverage signal** | Per-content shard store count, published by mints each COVERAGE_BLOCKS (~1h). No store identities. Used by stores for opportunity assessment. |

### Storage & Privacy

| Term | Definition |
|------|-----------|
| **Convergent encryption** | The sole encryption layer: `key = SHA256(protocol_seed \|\| CONTENT_KEY_DOMAIN \|\| content_hash)`. Rooted in genesis pubkey — different protocol instance → different ciphertext for identical plaintext. Same content within one instance → same ciphertext → verifiable without trust. Deterministic: any party with content_hash + protocol_seed can derive the key. Stores cannot derive it because they don't know which content_hash corresponds to their blob_id (see Blind addressing). |
| **Blind addressing** | Stores hold shards under random blob IDs, not shard hashes. Mapping registered with mints, never published in cleartext on relays. |
| **Store-blind** | Three independent protections — operational, not cryptographic. (1) **Addressing-blind** — stores hold shards under random blob IDs; the content_hash→blob_id mapping is mint-held. The reference daemon never computes, stores, or logs content_hash ↔ blob_id mappings. A non-colluding operator running unmodified software does not learn content identity during normal operation. **Confirmation limitation** (inherited from convergent encryption): an operator who deliberately modifies software and performs computational work against public data (e.g., matching blob hashes against coverage signal integrity hashes) can confirm content identity — this is an investigative act, not a passive property. Inherent to any deterministic encryption scheme; the cost of trustless verification, deduplication, and restoration. (2) **Operator-blind** — anonymous transport (.onion default); address→operator cryptographically broken. (3) **Payment-blind** — Cashu ecash (Chaum blind signatures); mint cannot link issuance to redemption. Daemon persists only `blob_id → encrypted bytes` + `blob_id → earnings_rate`; no content_hash on disk. Seizure reveals encrypted blobs under random IDs with no link to content hashes or operator identity. The relevant legal standard is knowledge during normal operation, not theoretical computational capability — strictly stronger than BitTorrent (plaintext, chosen content, identifiable peers — 20+ years of legal survival), Tor exit nodes (plaintext traffic), and CDN operators (plaintext cache). See Core Thesis #6, `ocdn-store` daemon. |
| **Delivery token** | Mint-signed, single-use, epoch-bound authorization for a serve endpoint to fetch one blob from one store. Contains blob_id, store address (opaque), epoch, epoch_hash, nonce, request_token, selected_index, ZK selection proof, mint signature. No content_hash. **Serve-blinded verifiable store selection**: `selection_input = SHA256(protocol_seed \|\| "SELECTION_INPUT" \|\| content_hash \|\| shard_index \|\| epoch_hash)` committed per-epoch in `selection_input_root`. `selected_index = hash(epoch_hash \|\| selection_input \|\| shard_index \|\| request_proof_hash \|\| selection_nonce) mod S_s` against committed `store_set_root`. Selection nonce is client-generated, withheld until mint commits (see §3 Consumption flow). Mint cannot bias selection (nonce unknown at commitment time), cannot reject without evidence (signed processing_commitment). **ZK selection proof** (Halo2/KZG): mint proves selection correctness to the store without revealing content_hash or any relay-correlatable value (see Glossary: ZK selection proof). `request_token = SHA256(request_proof_hash \|\| selection_nonce \|\| shard_index \|\| "REQUEST_TOKEN")` binds proof to a specific request without leaking relay-searchable inputs. **Four-layer verification**: (1) client verifies `selection_input` against committed root + checks selection formula (all inputs known), (2) store verifies ZK proof per delivery token (cryptographic, real-time, no content_hash), (3) settler audits routing ex-post, (4) store detects aggregate demand anomalies via `routing_root` + delivery token receipts. Bundles authorization (anti-abuse, redundant with PoW) + mediation (per-request privacy). In degraded mode, stores accept PoW directly (see Glossary: Degraded-mode retrieval). |
| **Replication token** | Delivery token variant authorizing a store (not a serve endpoint) to fetch a shard from an existing store for persistent replication. Same structure, same verification. Mint issues on store request (PoW-gated); new store fetches blob, verifies `SHA256(bytes) == integrity_hash` from coverage signal (trustless), stores under a new blob_id, registers mapping with mint. Shard acquisition is isomorphic to content delivery. Mint mediates authorization (~200 bytes), stores transfer data (bytes to megabytes). Initial upload exception: first stores acquire from the mint's temporary cache (Step 1b). After that, store-to-store replication takes over. |
| **Selection proofs** | Per-shard routing verification data returned alongside delivery tokens: (selected_store_pubkey, position, Merkle path against committed `store_set_root`). **Client verification**: client verifies `selection_input = SHA256(protocol_seed \|\| "SELECTION_INPUT" \|\| content_hash \|\| shard_index \|\| epoch_hash)` against committed `selection_input_root`, then checks the selection formula. The client knows all inputs. Evidence of incorrect selection or false `selection_input` commitment is self-contained and publishable. **Store verification via ZK**: see Glossary: ZK selection proof. |
| **ZK selection proof** | Halo2/KZG proof attached to (or available on demand for) each delivery token. Proves selection correctness to the store without revealing `content_hash`, `selection_input`, `shard_index`, `request_proof_hash`, or `selection_nonce`. **Public inputs**: blob_id, selected_index, S_s, selection_input_root, request_token, store_set_root. **Private inputs**: selection_input, shard_index, request_proof_hash, selection_nonce, Merkle paths. **Circuit proves**: (1) (blob_id, selection_input) is a leaf in selection_input_root, (2) store at selected_index in store_set_root matches store pubkey, (3) selection formula computes correctly, (4) request_token derivation is correct. ~1M constraints (SHA-256 Merkle trees). Proof: ~3KB (Halo2/KZG). Generation: ~0.3-1s per proof (mint-side). Verification: ~5-15ms (store-side). No trusted setup beyond universal KZG ceremony (1-of-141K trust assumption — weaker than trusting a single bonded mint). **Why ZK is necessary**: any deterministic function of content_hash given to the store in the clear is brute-forceable against relay data (request proofs contain content_hash; search space is thousands, not 2^256). Epoch-bound derivations, blinded intermediates, and delayed reveals all fail against relay correlation. Only hiding all content_hash-derived values inside a ZK proof preserves addressing-blindness. **Proof-on-demand**: mints may generate proofs only when stores request verification for sampled delivery tokens, reducing proving cost to the audit rate fraction. The mint has already committed to the selection — a biased selection produces an unsatisfiable circuit. Refusal to provide a proof is itself evidence. See #20. |
| **Shard** | One piece of convergent-encrypted content. Text = 1 shard (N=1). Documents = N shards via RS erasure coding. Stored under random blob IDs (see Blind addressing). |
| **Mapping** | The content_hash → (store, blob_id) association. Four layers: relay-encrypted (durable, Argon2-gated with `protocol_seed` in salt — instance-specific, persisted by serve endpoint relay archives + external Nostr relays as fallback) → mint cache (fast, PoW-gated) → serve cache (organic) → coverage signals (anonymous counts only). Clients never receive mapping data directly — serve endpoints proxy via delivery tokens. Different genesis pubkey → different Argon2 salt → mappings undiscoverable across instances. |
| **Degraded-mode retrieval** | Fallback when no bonded mint is reachable. Stores accept PoW-authorized direct requests (blob_id + PoW proof, no delivery token). Serve endpoints discover stores via relay-encrypted mappings (Argon2-gated with `protocol_seed` in salt — requires correct genesis pubkey). The delivery token's authorization function is redundant with PoW; the mint adds mediation (routing, settlement). Mint liveness controls economics, not availability. Activates when store's persistent mint connections are down > MAX_SILENT_EPOCHS — locally verifiable, unfakeable by external parties. No genesis-agnostic fallback — degraded mode requires the correct genesis pubkey for discovery. **Survival economics**: stores continue self-attesting to relays (challenge sets are deterministic from epoch_hash — computable from Bitcoin data alone, no mint needed). Clients publish request proofs at rate=1. All settlement inputs accumulate in the public record during the gap. A new or returning mint can retroactively verify and settle gap epochs from relay data — stores that held through the outage receive backpay. Structurally worse for everyone (delayed payment, no real-time settlement) → no perverse incentive, but survivable because patience is rewarded. See Unresolved #37. |

### Events

| Term | Definition |
|------|-----------|
| **Fund confirmation** | Bonded mint signs: sats bound to a hash. Published to relays. |
| **Request proof** | Client PoW + Nostr signature + referrer `via` tag. Gates content delivery. Sampled to relays as demand signal (serve endpoints publish samples at epoch end; full rate at bootstrap and in degraded mode). |
| **Store attestation** | Store signs "I served shard *i* for request *R*." Submitted directly to mint (not relayed). |
| **Epoch summary** | Mint aggregates attestations into canonical settlement input. Hash-chained via Nostr event IDs (`prev` tag). A Certificate Transparency-style signed log entry: the mint commits state (`balance_root`, `funding_root`, `sweep_root`), demand (`demand_root`, `proof_root`, `referrer_root`), and challenge data (`challenge_root` — independently recomputable from public relay data). See State Commitments. |
| **PoolState** | Per-content economic state committed via `balance_root`: content_hash, balance, N (shard count), sweep_clock, drained/recycled/deposited this epoch. 67 bytes per leaf. Live content only (balance > 0). Enables exact level-1 verification of balance transitions from public data. See State Commitments. |
| **Leaf data blob** | Blossom-hosted blob containing all publishable Merkle leaves for an epoch (balance, funding, referrer). Hash-committed in the epoch summary via `leaf_data` tag. Public data — no store identities. Serves as the lookup mechanism; the Merkle tree is the integrity mechanism. |
| **Referrer witness** | Serve endpoint signs per-epoch, per-content referrer-bucketed proof counts + commitment_count. Cross-verifies mint's `referrer_root` and `commitment_count` claims. Serve endpoints have via-tag income incentive for accurate referrer accounting. |
| **Processing commitment** | Mint signs `(request_proof_hash, blind, epoch_hash)` before learning `selection_nonce` — cryptographic commitment to process a request before the routing outcome is computable. Part of serve-blinded selection (see §3 Consumption flow). Not relayed; committed via `commitment_root` in epoch summary. |
| **Fulfillment evidence** | Client-published event when a processing_commitment exists but no delivery tokens were received. Contains: request_proof_hash, processing_commitment (mint-signed), selection_nonce, epoch, mint_pubkey. Anyone can verify: mint's signature on commitment, `SHA256(selection_nonce) == blind`, request proof validity. Self-contained cryptographic evidence — no trusted verifier needed. |
| **Settlement event** | Settler publishes deterministic payout computation from epoch summaries. |
| **Funding receipt** | Funder-controlled evidence, independent of mint. Contains content_hash, amount, mint_pubkey, HTLC preimage (cryptographic proof the mint accepted the deposit). Published to relays; optionally inscribed on Bitcoin (~120 bytes) for permanent evidence. Creates a record independent of the mint's balance_root — if the mint omits the content, the receipt + absence is irrefutable one-sided fraud proof. Committed via `receipt_root` in epoch summary. |
| **Pre-commitment** | Content_hash timestamped before funding or storage. Zero cost beyond relay publication. Enters epoch summary's `precommit_root`. Expires after PRECOMMIT_TTL epochs if never funded; any Bitcoin anchor during the TTL has already timestamped it permanently. Use cases: whistleblower commitment device, scientific priority, dead man's switch, proving prior knowledge before publication. For inscribed content, the Bitcoin inscription IS the permanent timestamp — the relay-based pre-commitment event is unnecessary (see Bitcoin Inscription Layer: Three Durability Tiers). |
| **Existence proof** | Portable, self-contained proof that a content_hash was in a specific Merkle root at a specific Bitcoin-anchored epoch. ~744 bytes (content_hash + sub-root + Merkle paths + evidence_root + anchor txid + block height). Verifiable with only Bitcoin block headers and SHA-256 — no relay, no mint, no internet beyond a Bitcoin node. Can be printed as a QR code, broadcast by radio, stored on paper. The protocol's most durable artifact. See State Commitments: Evidence Layer. For directly inscribed content, the existence proof simplifies to the OP_RETURN transaction itself (~80 bytes on-chain). For batched inscriptions, ~459 bytes (leaf + Merkle path + batch txid). |
| **Ghost dossier** | Complete evidence summary for dead content. Economic biography (lifetime, funding, demand, cause of death), Bitcoin anchor references, pre-computed existence proofs, verification instructions, and `birth_inscription` (Bitcoin txid of content inscription, if inscribed). The protocol's finished product for a content item — live content is work in progress; a ghost is a completed evidence cycle. Anyone can produce from public data. For inscribed content, the lifecycle is fully Bitcoin-anchored: inscription (birth) → epoch evidence_roots (life) → sweep (death). |
| **Parameter signal** | Funder or operator publishes preferred per-mint parameter values, weighted by participant reputation. See Glossary: Parameter signal, Verification System: Parameter Signaling. |

### Economic Terms

| Term | Definition |
|------|-----------|
| **Via tag** | Referrer pubkey in request proofs. The front-end that facilitated the request. Earns a coordination sub-share. |
| **Bond (fidelity)** | Time-locked on-chain BTC UTXO (`OP_CSV`) as commitment signal. `balance(mint) ≤ bond_value(mint) × tenure_factor`. Not slashable — enforcement is competitive exit (stores and clients reroute to reliable mints). The bond is a pre-paid insurance premium; the ceiling is the coverage limit. |
| **Cashu payout** | Store earnings issued as Cashu ecash tokens (blind-signed bearer instruments) delivered via Tor. Mint cannot link issuance to redemption (Chaum blind signatures). Store redeems at any Cashu-compatible mint, any time. Closes the anonymity loop: anonymous transport hides the operator, blind signatures hide the payment. Eliminates Lightning payout failures and PAYOUT_THRESHOLD accumulation. |
| **Dwell-based PoW** | Reference client pre-mines request proofs in background; submits on viewport dwell ≥2s. Reading feels instant. |
| **Ephemeral message** | Free Nostr event. Relay-only, no protocol awareness, no pool, no rank influence. Visible as collapsed `+ n` counts. `[+]` upgrades to funded. |
| **Economic moat** | Five layers, descending by durability: (a) **cryptographic binding** — genesis pubkey is the protocol seed; all derivations (content keys, Argon2 salts, epoch hashes, challenge nonces, store selection, state roots) are rooted in it. A fork that changes the genesis pubkey creates a mathematically incompatible protocol — can't decrypt existing content, can't discover existing stores, can't verify existing settlements. (b) **economic state** — accumulated deposits, settlement history, per-mint content state trees on relays (state roots include protocol_seed; Bitcoin-anchorable by any party). Unforkable without re-bootstrapping. (c) **Schelling point** — reference implementations set defaults; market converges. (d) **traffic** — reference client hardcodes the founder's via tag. (e) **deposit routing** — reference client defaults to founder-bonded mint. Layers (d) and (e) are speed bumps; layers (a)-(c) are structural. Layer (a) is cryptographic — not economically costly to break, but mathematically impossible. |
| **Participant reputation** | Pubkey-associated, verifiable from public relay data, time-compounding. Two kinds: **funder reputation** (cumulative deposits, active pool balance, funding diversity, re-funding rate — all derivable from fund confirmation events) and **operator reputation** (store: cumulative challenge epochs passed, shard-epochs, uptime consistency — from `challenge_root` chain; mint: epoch chain length, bond tenure, store retention, confidence ratio). Reputation weight is expensive to accumulate (requires real sats or real work) and costly to abandon (key rotation resets to zero). See Parameter Signaling. |
| **Parameter signal** | Signed event where a funder or operator signals preferred per-mint parameter values (DRAIN_RATE, SWEEP_EPOCHS, TENURE_DECAY), weighted by participant reputation. Not binding — inputs to market convergence. Two independent medians: demand-side (funder-weighted by active pool balance) and supply-side (operator-weighted by shard-epochs or bond×tenure). Mints whose declared parameters sit between both medians attract both deposits and stores. See Verification System: Parameter Signaling. |

### Bitcoin Inscriptions

| Term | Definition |
|------|-----------|
| **Content inscription** | OP_RETURN (≤80 bytes) registering a content_hash on Bitcoin. Optional durability upgrade — content can exist on relays/OCDN without inscription. Contains: magic(4B), type(1B), genesis_fingerprint(8B), content_hash(32B), flags(1B), resolution_hint(≤34B). Self-contained for text ≤34 bytes; pointer for larger content. The content's permanent birth certificate. See Bitcoin Inscription Layer. |
| **Edge inscription** | OP_RETURN linking two content_hashes with a typed relation (cites, contradicts, corroborates, supersedes, replies_to, contains). 80 bytes. Implicitly registers the source_hash — a reply inscription simultaneously registers and links. The citation graph is computable from Bitcoin alone. |
| **Append inscription** | OP_RETURN attaching ≤34 bytes of typed data (tag, numeric, hash-ref, key-value) to an existing content_hash. Permissionless annotation layer on Bitcoin. |
| **Batch inscription** | OP_RETURN committing a Merkle root over multiple typed inscription leaves. Amortizes Bitcoin transaction cost across N items. Leaf data published to Blossom/relays; inclusion proofs (~459 bytes at N=1000) are portable and self-contained. See Batching Service. |
| **Batching service** | Permissionless operator collecting inscription items from users, building Merkle batches, publishing to Bitcoin. Earns per-item fees (market-priced). Not a protocol role — a service built on protocol primitives. Accountability via signed submission receipts, running checkpoints, and permissionless poke audits. Ephemeral service, durable reputation. |
| **Poke (batch audit)** | Permissionless, unpaid verification of a batch inscription. Anyone fetches leaf data, rebuilds tree, verifies root against on-chain commitment. Missing data = reputation failure. Checkpoint + omission = provable fraud. Benefits nobody economically; enables penalties for cheating. Part of the commit-maintain-poke pattern. |
| **Commit-maintain-poke** | Design principle applied uniformly: store challenges (self-attest → hold blobs → anyone verifies), mint epoch summaries (commit roots → maintain leaf data → settlers audit), batch inscriptions (commit root → maintain leaf data → anyone pokes). Public commitment + ongoing obligation + permissionless verification + reputation consequence. Ephemeral stores, durable reputations. |

---

## Core Thesis

1. **Spam is a pricing problem** — Mandatory minimum fees filter infinite spam.
2. **Censorship is an availability market** — Replication funded by those who care.
3. **Infrastructure is a commodity** — Borrow it. Nostr relays distribute events. Blossom servers store blobs. Lightning/Cashu handle payments. Nostr keys handle identity. All already deployed, already distributed, already resilient.
4. **The protocol is a storage market; the index is the product** — The protocol clears payments between funders and stores. The importance index is a product built on the market's public data. The protocol is plumbing; the index is the shopfront. The two axes — commitment (pool balance) and demand (request proof velocity) — are independent measurements. Their divergence IS the signal. No other system produces both.
5. **The hierarchy is append/promote-only** — Content, topics, and discussion form a graph. Nodes are added (append) or funded (promote). Nothing is edited, deleted, or hidden at the protocol level. Loss is an explicit, auditable state — the pool exists, the request proofs existed, the economic fossil is provable via the hash-chained epoch log (`funding_root`, `balance_root`, `sweep_root` proofs — relay-durable, Bitcoin-anchorable), the bytes may be gone. Every other information system makes loss silent. This one makes loss visible, attributable, economically actionable, and cryptographically provable.
6. **Store-blind storage** — Three independent protections (see Glossary: Store-blind): addressing-blind (random blob IDs, mapping mint-held), operator-blind (anonymous transport), payment-blind (Cashu). A non-colluding operator running unmodified software does not learn content identity; no adversary can determine who operates a store or where earnings flow. Convergent encryption allows content identity confirmation by an operator who deliberately investigates (inherent to deterministic encryption — see Glossary: Store-blind, confirmation limitation). The legal standard is operational knowledge, not cryptographic impossibility.

   **Store posture**: Zero editorial decisions — software selects shards by economic signal, not by content. Encrypted blobs in, encrypted blobs out, behind an address no one can attribute. Store daemon holds blobs, responds to challenges, attests. No convergent encryption logic, no RS WASM.

   **Legal posture**: Convergent-encrypted blob cache behind anonymous transport — does not learn content identity in normal operation (no content_hash on disk, no mapping computed or logged), cannot be identified as operator. Blob-ID removal on valid legal order directed at the opaque address (safe harbor). Operator's binary choice: store everything the daemon selects, or don't run it. Legal liability requires actual knowledge or red-flag knowledge during normal activity (DMCA §512, EU E-Commerce Directive Art. 14) — not theoretical capability to investigate. Strictly stronger than BitTorrent (plaintext, operator-chosen content, identifiable peers, 20+ years), Tor exit nodes (plaintext traffic, 20+ years), and CDN operators (plaintext cache, planetary scale).

   **Censorship resistance**: Requires deanonymizing AND taking down more than N-K stores simultaneously, while economic incentives actively recruit replacements. The adversary must: (a) break anonymous transport to find operators, (b) compromise a mint to learn which addresses hold which content, (c) do both faster than the market recruits replacements. The system forces the adversary from the legal domain into the technical/economic domain. Mint takedown is insufficient — degraded-mode retrieval (PoW-authorized, no delivery token) preserves content availability when all mints are down. The adversary must suppress stores, not just mints.
7. **Resilience is a property of greed, not architecture** — The protocol doesn't specify redundancy. It makes storage profitable and anonymously operable (anonymous transport default — store operators cannot be identified or compelled); serving is a separate, clearnet, permissionless role earning via the via tag. Stores watch coverage signals for undercovered funded content, mirror shards, earn sats. Censoring content increases per-store payout, attracting anonymous replacements. The adversary fights economic gravity with legal tools that don't apply to unidentifiable operators.
8. **The genesis pubkey is the protocol seed** — Not an authority, not a delegation root, not a key that signs protocol operations. The pubkey is the mathematical root of every cryptographic derivation: content keys, Argon2 salts, epoch hashes, challenge nonces, store selection, state roots. Discovered from the genesis inscription on Bitcoin (see Glossary: Genesis inscription). The private key controls spending accumulated income — nothing else. Spans all protocol versions and all per-mint parameter sets.

   **Permissionless mints**: Bonded (on-chain UTXO), not genesis-delegated — anyone can become a mint by posting a verifiable bond.

   **Fork resistance**: Forking the income requires changing the genesis pubkey — trivial at the code level, but creates a mathematically incompatible protocol. The fork can't decrypt existing content, can't discover existing stores, can't verify existing settlements, can't produce valid state roots against the existing genesis_fingerprint, can't extend any existing Bitcoin anchors. The moat is cryptographic (derivation incompatibility) + economic (accumulated state) + social (Schelling point) — see Glossary: Economic moat.
9. **Mutual authentication via epoch_hash at every boundary** — `epoch_hash = SHA256(protocol_seed || confirmed_block_hash || epoch_number)` is embedded in every protocol interaction: request proofs (client → serve endpoint), delivery tokens (mint → store), attestations (store → mint), epoch summaries (mint → settler). Every role verifies every adjacent role's epoch_hash against live Bitcoin data. Wrong genesis pubkey → wrong epoch_hash → rejected at first contact. The protocol's healthy operation is itself continuous proof that all participants share the same genesis pubkey. A false client can lie to its user but cannot produce valid interactions with the honest network — computational inertness, not social rejection.
10. **The founder's income is proportional to settlement dimensionality** — Each shard is an independent settlement unit. Cascading remainders across N shards × C content items produce genesis income that grows in absolute sats while shrinking as a percentage (see §4).

   **Passive by construction**: No fee. No rate. The income is the irreducible coordination cost of multi-party integer settlement. Documents produce higher genesis sweep income than text (larger N → larger residual at zero-drain floor).
11. **Coordination costs one participant per shard** — Per-shard parity: coordination earns what one store earns per shard (see Glossary: Participant parity). Counter-cyclical: during booms (high S_s), value flows to stores; during busts (low S_s), value flows to coordination. Within coordination: mints earn because they verify, referrers because they distribute, genesis earns a share plus all sub-remainders. Coordination fraction is independent of N — a 20-shard document and a text claim pay the same coordination percentage at equal store depth.
12. **The moat is compound: five layers, three structural** — See Glossary: Economic moat. Layers (a) economic state and (b) Schelling point are structural; (c) traffic and (d) deposits are speed bumps that buy time for (a) and (b) to compound.
13. **Funding is advertising** — Funders pay for availability and visibility. Readers consume for free. This is advertising economics: the person who wants attention pays, the person who has attention consumes for free. Free distribution maximizes the audience that makes funding valuable. Conviction spending is the revenue. Free reading is the amplifier.
14. **The system optimizes for contested content** — Uncontested content is funded once. Contested content is funded repeatedly by competing sides. Competitive dynamics drive repeat funding — the highest-velocity economic behavior in the system. The founder earns from the froth of disagreement, not from any position. Free reading amplifies this: everyone sees the scoreboard, everyone can take a side.
15. **The protocol is four settlement event types, four evidence event types, and one rule** — Settlement: fund confirmation, request proof, store attestation, settlement. Evidence: funding receipt, pre-commitment, existence proof, ghost dossier (see Glossary: Events). Rule: unclaimed drain → genesis; pools with no attestations for SWEEP_EPOCHS consecutive chain entries → sweep. Chain-relative counting (mint offline → clock frozen) eliminates the mint-takedown attack without any global demand check. Everything else is a product concern or emergent market property.
16. **The network metabolizes failed attention bids** — Self-promoters fund their own content. If nobody reads it, sats sweep to genesis. Contested content produces remainder income (active market). Ignored content produces sweep income (failed attention bid). Both modes pay genesis. The total addressable revenue is all inflow.
17. **The protocol settles; the product interprets** — Settlement is narrow, deterministic, and hard to game (requires real sats, real storage, real bonds). The importance index is broad, interpretive, and soft-gameable — but also forkable, competitive, and improvable without protocol changes. Most attacks target the index. The index is the expendable layer. Settlement — where the money flows — is robust. Attacks on interpretation don't corrupt settlement. Attacks on settlement require real capital at risk.
18. **All funded content is stored; text bootstraps, documents sustain** — All funded content is stored as encrypted shards. Unfunded ephemeral messages live on relays only (see thesis 19).

    **Uniform storage**: Text = N=1 shards, documents = N=RS_N. Per-shard settlement treats both identically (see Glossary: Participant parity).

    **Text as bootstrap engine**: Low minimum viable pool (~128 sats vs. ~2560 for documents). High volume, quick sweep cycles. The froth of competing ideologies is almost entirely text.

    **Documents as sweep engine**: Larger N → larger residual at zero-drain floor → more sweep to genesis per sat deposited.

    **Escalation path**: Text claims → document evidence is the value creation moment.
19. **Two metabolisms: free discourse, funded signal** — Ephemeral messages are regular Nostr events — free, relay-dependent, zero protocol awareness, visible as collapsed `+ n` counts. `[+]` upgrades to the funded layer. The free layer is the discourse substrate (volume, whistleblowers, the 4chan energy). The funded layer is the conviction signal. The divergence between free volume and funded persistence is itself a signal axis no other system produces. Ephemeral messages don't influence the importance index. The free layer solves cold start; the funded layer solves quality.
20. **Honest-minority resilience** — The protocol's durability depends on honest minorities, not honest majorities.

    **Discovery**: Four mapping layers degrade gracefully (see Glossary: Mapping).

    **Thresholds**: One honest serve endpoint = events discoverable. One honest store per shard = available. One honest mint = deposits accepted. **Zero honest mints = content still available** (degraded-mode retrieval — see §3, Degraded-Mode Retrieval). Total failure requires ALL roles to fail simultaneously. Mint takedown suspends settlement (economic damage), not content delivery (censorship failure).

    **Attestation integrity**: Epoch summaries commit via Merkle root (see §3) — omission triggers competitive exit.
21. **The evidence layer is the primary output; the storage market is the engine** — The protocol produces two outputs: an ephemeral availability window (content retrievable while funded) and a permanent Bitcoin-anchored evidence record (existence, demand, funding, suppression — verifiable with only block headers and SHA-256). The storage market generates rich, economically meaningful evidence as a byproduct of its operation. Content is mortal; evidence is not. A bare hash inscribed on Bitcoin proves existence. The protocol adds demand proof (PoW-verified consumption — hardest signal to fabricate at scale), funding proof (multi-party economic conviction), and suppression proof (funded + consumed + dead = unnatural death). The evidence record outlives the protocol, the infrastructure, and the participants. **The censor's dilemma**: suppressing content creates a permanent, irrefutable, Bitcoin-timestamped accusation. There is no "suppress quietly" option once any single participant anchors an epoch. The cost of preventing evidence (~56-sat OP_RETURN from any participant) is equivalent to censoring Bitcoin itself.
22. **Funding receipts make mint omission provable** — The funder's HTLC preimage is cryptographic proof the mint accepted a deposit. Published independently of the mint's epoch summary, it creates a second Bitcoin-anchorable record. If the mint's `balance_root` excludes funded content, the receipt + absence is one-sided fraud evidence — self-proving, no adjudicator needed (see Glossary: Funding receipt).
23. **Pre-commitment extends evidence backward in time** — A content hash timestamped before funding proves prior existence. The Bitcoin anchor of a pre-commitment epoch proves the content predates publication. Enables commitment devices, scientific priority claims, and dead man's switches from protocol primitives (see Glossary: Pre-commitment).
24. **Bilateral checks: funders and operators constrain each other** — Funders (sats-in) and operators (hardware-in) have structurally opposed preferences: funders want low DRAIN_RATE (longer content life per sat), operators want high DRAIN_RATE (faster income). Neither side can get what it wants without the other's cooperation — funders without stores get no availability, stores without funders get no income. Reputation-weighted parameter signaling (see Glossary: Parameter signal) makes this tension legible. Mints are market-makers: they declare parameters to attract both sides. The equilibrium is where both find the tradeoff acceptable. No governance, no votes — just public signals from verified participants, weighted by sats-at-risk or proven work, converging via market selection.
25. **Ephemeral stores, durable reputations** — Infrastructure is combustible by design. Stores, mints, serve endpoints, and batching services are replaceable commodities. What persists is the reputation record: challenge history, confidence votes, poke audit results, epoch chain integrity — all on relays, all signed, all verifiable. The accountability pattern is uniform: public commitment + ongoing obligation + permissionless verification + reputation consequence (commit-maintain-poke). You don't punish bad actors by seizing their infrastructure; you mark them and let the market route around.
26. **Bitcoin inscriptions are the namespace; the protocol is the resolver** — OP_RETURN inscriptions (≤80 bytes) register content_hashes, citation edges, and annotations permanently on Bitcoin. The inscription is the birth certificate; the OCDN protocol is the nursery. Three durability tiers: ephemeral (relay-only, free), funded (OCDN pool, market-priced), inscribed (Bitcoin OP_RETURN, miner-priced). Registration and hosting are decoupled — inscribe once (permanent), fund as needed (ephemeral). The citation graph is computable from Bitcoin data alone. If the protocol dies, the inscriptions persist. Anyone with the file + sats can reignite.

---

## What This System Invented

Ten things no existing system provides:

1. **A pool attached to a hash** — money bound to content identity, not to an author or server
2. **Request proofs as demand signal** — PoW-gated request proofs gate content delivery, ensuring every read produces a verifiable demand signal. The `via` tag attributes distribution to the front-end that facilitated the request
3. **Pool drain to proven stores** — stores earn from pools proportional to proven storage of consumed content
4. **Participant parity** — coordination costs one participant's share at parity with storage labor (see Glossary)
5. **The importance index** — the ranking derived from 1-3: commitment × demand × centrality
6. **Accountable loss via mandatory Bitcoin evidence** — every node that ever existed leaves a permanent economic trace. Each mint's `balance_root` commits per-content economic states every epoch; `funding_root` records deposits; `sweep_root` records exits. The hash-chained epoch log preserves the complete history. **Mandatory Bitcoin anchoring**: each epoch's `evidence_root` (committing balance, funding, sweep, demand, receipt, and pre-commitment sub-roots) is anchored via OP_RETURN (~56 bytes). Any participant can publish the anchor; first valid anchor per epoch is canonical. Funder-controlled funding receipts (HTLC preimage proof) create a second, independent Bitcoin-anchorable record — mint omission is provably one-sided fraud. Portable existence proofs (~744 bytes, self-contained) are verifiable with only Bitcoin headers + SHA-256 — no relay, no mint, no infrastructure. Loss is a first-class state: the evidence is Bitcoin-permanent (mandatory anchors), not just relay-durable. No other system distinguishes "never existed" from "existed and was lost." The adversary cannot both destroy content and deny it existed — the evidence chain records the destruction on Bitcoin, and any surviving copy verifies against the committed hash
7. **Multi-party request-attestation binding** — each participant signs their own part of the composite receipt (client signs request proof, store signs attestation direct to mint). No serve endpoint can redirect economic flows. Mint-level routing bias is addressed by four-layer selection verification: client verifies selection_input commitment + formula, store verifies ZK selection proof per delivery token, settler audits routing ex-post, store detects aggregate demand anomalies (see Glossary: Delivery token, ZK selection proof, #20)
8. **Genesis-pubkey-as-protocol-seed with epoch_hash mutual authentication** — a single pubkey (discovered from a Bitcoin inscription) is the cryptographic root of every protocol derivation. `epoch_hash` (derived from protocol_seed + live Bitcoin block hash) is verified at every protocol boundary. A fork that changes the genesis pubkey creates a mathematically incompatible protocol; a participant with the wrong genesis pubkey is computationally inert at first contact. The protocol's healthy operation continuously proves all participants share the same genesis pubkey

9. **Bitcoin-anchored evidence chain with portable proofs** — mandatory epoch anchoring (~56 bytes OP_RETURN) creates a permanent evidence record verifiable without any protocol infrastructure. Funder-controlled funding receipts (independent of mint) make deposit omission provably fraudulent. Pre-commitments extend evidence backward in time. Existence proofs (~744 bytes) are self-contained, offline-verifiable artifacts — the protocol's most durable output. Ghost dossiers summarize completed evidence cycles. The storage market is the engine; the evidence chain is the permanent exhaust

10. **Bitcoin-native content namespace via OP_RETURN** — ≤80-byte inscriptions register content_hashes, typed citation edges, and annotations permanently on Bitcoin. Three inscription types (register, edge, append) plus a batch type form a self-assembling graph computable from Bitcoin alone. Inscription and pool funding are decoupled — different operations, different times, potentially different parties. Batching services amortize inscription cost via Merkle commitments, held accountable by permissionless poke audits (commit-maintain-poke). The inscription is the permanent record; the protocol is the ephemeral resolution layer

Everything else is borrowed infrastructure.

---

## Architecture

### Five Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  INDEX (the product)                                            │
│  Materializer reads evidence + market data, computes rankings.  │
│  Ghost dossiers are first-class index content. Anyone operates. │
├─────────────────────────────────────────────────────────────────┤
│  AVAILABILITY (ephemeral, market-driven)                        │
│  Stores hold shards behind anonymous transport (.onion default),│
│  prove possession to mints, earn from pools.                    │
│  Serve endpoints deliver bytes to users (clearnet). Any CDN.    │
│  Content available while funded. All infrastructure combustible.│
│  Primary function: generate economic activity → evidence.       │
├─────────────────────────────────────────────────────────────────┤
│  EVENTS (ephemeral cache — explicitly NOT source of truth)      │
│  All market activity is public signed events on relays.         │
│  Serve endpoints run filtered relays for OCDN kinds (aligned).  │
│  External Nostr relays are belt-and-suspenders fallback.        │
│  Convenience layer — all evidence verifiable without relays.    │
├─────────────────────────────────────────────────────────────────┤
│  MONEY (bonded mints — genesis address as protocol constant)    │
│  Mints hold pool balances, verify request proofs + attestations,│
│  issue storage challenges, execute payouts. Permissionless      │
│  entry via on-chain bond. Multi-jurisdiction. Custodial.        │
├─────────────────────────────────────────────────────────────────┤
│  EVIDENCE (permanent — the protocol's primary output)           │
│  Epoch evidence_root anchored on Bitcoin (mandatory, ~56 bytes).│
│  Content inscriptions: OP_RETURN ≤80B (optional, per-content). │
│  Batch inscriptions: Merkle root over N items (amortized).     │
│  Funding receipts (funder-controlled, HTLC preimage proof).    │
│  Existence proofs (portable, self-contained, ~744 bytes).      │
│  Pre-commitments (timestamp-only, zero cost).                  │
│  Ghost dossiers (completed evidence cycles).                   │
│  Only dependency: Bitcoin. Only trust assumption: SHA-256.      │
└─────────────────────────────────────────────────────────────────┘
```

### Four Protocol Roles

| Role | Entry | Earns from protocol | Trust required |
|------|-------|---------------------|----------------|
| **STORE** | None (anonymous transport default) | Yes — storage shard drain via settlement | Self-attesting (block-hash-derived challenges published to relays, verifiable by anyone), peer-verified, confidence-voting on mints. Reachable via opaque address (.onion). No on-chain identity. |
| **SERVE** | PoW credential with mint | Yes — referrer income via via tag | **Mandatory retrieval proxy + filtered OCDN relay.** Clients never contact stores directly. Earns via tag. Sees partial store mapping (one random store per shard). Persists OCDN events (signed, unforgeable) — no new trust surface beyond existing serve role. |
| **MINT** | On-chain fidelity bond (time-locked), anonymous transport (.onion default) | Yes — coordination share | Bonded (fidelity), auditable from public data. Operator anonymous — identified by pubkey + bond UTXO, not identity. |
| **SETTLER** | None | None (public service) | Deterministic, auditable by anyone |

### Unbundled Mint Functions

The bonded mint bundles six logically separable functions. Unbundling clarifies trust requirements and enables honest-minority resilience:

| Function | What it does | Trust model | Honest-minority property |
|----------|-------------|-------------|-------------------------|
| **Custody** | Holds pool sats across epochs | Custodial (bond = ceiling) | Per-mint: one honest mint = its deposits safe. Deposit splitting across 2+ mints makes loss proportional, not binary. |
| **Privacy bridge** | Maps content_hash → (store, blob_id) | Trusted not to leak | Three-layer fallback: mints → serve caches → relay-encrypted mappings. One honest relay = discoverable. |
| **Discovery gate** | Serves mappings to clients with valid request proofs | Trusted to respond | Any mint, any serve cache, or relay-encrypted mapping can serve discovery. |
| **Challenge authority** | Verifies store self-attestations | Permissionless — stores self-attest via deterministic block-hash-derived challenges published to relays; mints, settlers, and anyone else verify from public proofs | One honest verifier = storage fraud detected. Self-attestation eliminates persistent Tor circuit dependency for challenges. |
| **Attestation collector** | Receives store attestations (private channel) | Trusted not to omit (Merkle root commitment) | Stores verify inclusion via attestation Merkle root. Omission → store reroutes (competitive exit). |
| **Epoch summarizer** | Aggregates attestations into settlement input | Bonded, auditable | One honest mint = correct summary for its deposits. Cross-settler verification catches discrepancies. |

A single operator runs all six in practice. The decomposition ensures that no single function's failure is catastrophic — each has an independent fallback path.

### Communication Channels

```
CLIENT ─────────────────→ SERVE ENDPOINT   request proof (serve endpoint is mandatory proxy)
SERVE ENDPOINT ─────────→ MINT             forwards request proof, receives delivery tokens + selection proofs
SERVE ENDPOINT ←──[Tor]──→ STORES          fetches blobs using delivery tokens (no content_hash)
SERVE ENDPOINT ─────────→ CLIENT           returns convergent-encrypted blobs + selection proofs
CLIENT ─────────────────→ RELAYS           request proofs (public demand signal, batched/delayed)
STORES ────────[Tor]────→ MINT             attestations + mapping registration (private, references delivery token hash)
STORES ←───────[Tor]───→ STORES            shard replication via replication tokens (mint-authorized, PoW-gated)
MINT   ←───────[Tor]───→ STORES            storage challenges + per-blob_id earnings push (persistent connection, batched)
MINT   ←───────────────→ MINT              mapping gossip
MINT   ─────────────────→ RELAYS           coverage signals, relay-encrypted store addresses (Argon2-gated)
STORES ─────────────────→ RELAYS           self-attestation proofs (block-hash-derived) + confidence votes on mints (epoch-bound)

[DEGRADED — no mint reachable]
SERVE ENDPOINT ─────────→ RELAYS           decrypts relay-escrowed mappings (Argon2-gated)
SERVE ENDPOINT ←──[Tor]──→ STORES          fetches blobs using PoW authorization (blob_id + PoW, no delivery token)
SERVE ENDPOINT ─────────→ CLIENT           returns convergent-encrypted blobs (client derives decryption key)

[EVIDENCE LAYER — Bitcoin-anchored, any participant]
FUNDER ─────────────────→ RELAYS           funding receipt (HTLC preimage proof, independent of mint)
FUNDER ─────────────────→ BITCOIN          funding receipt inscription (optional, ~120 bytes)
ANY PARTY ──────────────→ RELAYS           pre-commitment (content_hash timestamp, zero cost)
SETTLER ────────────────→ BITCOIN          epoch evidence_root anchor (mandatory, ~56 bytes OP_RETURN)
ANY PARTY ──────────────→ BITCOIN          duplicate/independent anchor (non-conflicting by construction)
ANY PARTY ──────────────→ RELAYS/BLOSSOM   existence proofs (portable, ~744 bytes)
ANY PARTY ──────────────→ RELAYS           ghost dossier (completed evidence cycle)
```

**Anonymous transport boundary**: All infrastructure communication routes through anonymous transport (Tor by default). The user-facing path (client ↔ serve endpoint) is clearnet. The infrastructure path (serve endpoint ↔ stores, serve endpoint ↔ mints, mint ↔ stores, mint ↔ mint) is anonymous. Serve endpoints bridge the two — the only component connecting clearnet clients to anonymous infrastructure. **Tor is connectivity-first, anonymity-second**: hidden services enable stores on laptops and home networks to accept inbound connections without port forwarding, static IP, or DNS. If Tor's anonymity is compromised, the protocol loses operator-identity protection but retains: store-blindness (encryption-based, not transport-based), payment blindness (Chaum signatures), hash-blind local state, and all settlement/challenge/attestation mechanics. The protocol is Tor-anonymous when Tor is anonymous, and Tor-connected when it isn't.

**Epoch_hash mutual authentication**: Every protocol message across every boundary includes `epoch_hash` (derived from `protocol_seed || confirmed_block_hash || epoch_number`). Each role verifies the adjacent role's epoch_hash against its own computation from live Bitcoin data. Wrong genesis pubkey → wrong epoch_hash → rejected at first contact. The verification is bilateral: serve endpoints check clients AND clients check serve endpoints (via selection proofs in delivery tokens). No trusted introducer — the math is the gatekeeper.

**Clients never contact stores or mints directly for retrieval.** Serve endpoints are the mandatory intermediary. The mint returns delivery tokens (blob_id + store endpoint, no content_hash) + selection proofs to serve endpoints. The serve endpoint fetches convergent-encrypted blobs from stores and forwards blobs + selection proofs to the client. The client derives the convergent key from content_hash + protocol_seed, verifies selection proofs, decrypts, and reconstructs. The serve endpoint sees partial store mappings (one random store per shard per request). **Degraded-mode exception**: when no mint is reachable, serve endpoints fall back to relay-encrypted mappings for discovery and PoW-authorized direct store contact (see Degraded-Mode Retrieval). Availability is preserved; economics are suspended.

**Four mapping layers** (degrading privacy, increasing availability — see also Glossary: Mapping):

1. **Relay-encrypted mappings (mandatory, durable, compute-gated, genesis-bound)** — mints MUST publish on every store registration and periodically refresh for active stores: `encrypt(store_address || blob_id, key=Argon2id(content_hash || shard_index, protocol_seed || "ocdn-discovery-v1", ARGON2_PARAMS))`. Store address is opaque (.onion by default) — relay mapping reveals retrieval path but not operator identity. Argon2 salt includes `protocol_seed` — different genesis pubkey → different derived keys → mappings undiscoverable across protocol instances. Compute-hard KDF: ~1-3s per shard on desktop, bulk scanning linearly expensive. No mint needed for decryption. Survives mint exits/crashes — the defense against coordinated mint takedown (mints are the smallest actor set — anonymous transport makes them unidentifiable, but their custodial role makes them the highest-value target). Serve endpoints persist these events in their filtered OCDN relays (economically aligned — via tag income requires event availability) and SHOULD re-publish on successful reconstruction. External Nostr relays are unaligned fallback. **Relay durability and store-blindness coexist**: the relay reveals content→address (needed for recovery), anonymous transport hides address→operator (needed for protection). Different links, independently defended.
2. **Mint cache (fast, private)** — actual store locations, request-proof-gated, replicated via gossip. Any mint can serve discovery for any content. Rebuilds from relay events + gossip on restart.
3. **Serve-layer cache** — organic fallback from prior reads, proportional to content popularity. Serve endpoints cache delivery token responses (blob_ids + store endpoints).
4. **Coverage signals** — per-content shard store counts + integrity hashes (SHA256 of convergent-encrypted shard) on relays each COVERAGE_BLOCKS, no store identities. Enables supply response and new-store integrity verification, not a discovery layer. Integrity hashes are deterministic from content_hash — any party with the content can audit coverage signal accuracy (fully permissionless verification). **Store-blindness note**: publishing integrity hashes on relays enables O(1) blob deanonymization by a store that matches `SHA256(own_blob)` against public integrity hashes. This is a convenience reduction from the baseline confirmation limitation (which exists regardless via convergent encryption). Future refinement: deliver integrity hashes privately via replication tokens during shard acquisition, removing them from public coverage signals — raising the deanonymization cost from table lookup to active computation over the full content corpus.

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
| **Convergent encryption + deterministic RS** | Protocol | Content key = SHA256(protocol_seed \|\| domain \|\| content_hash). RS(K,N) over GF(2^8) with pinned generator polynomial and canonical shard ordering. Shard hashes are deterministic for verification — no manifest trust surface. Any party with content_hash can verify shard integrity (coverage signal audit is fully permissionless). **Canonical RS implementation**: protocol ships a single WASM encoder/decoder (~2-5KB compiled). Content-hash of the WASM binary (`RS_WASM_HASH`) is a protocol constant. Every client, store, and settler loads the same binary — no independent reimplementation. Shard identity is load-bearing for convergent encryption; one wrong byte = content unrecoverable, silently, with no fraud proof possible. Test vectors (10 included) are regression tests for the one implementation, not interop tests across N implementations. Upgrading the encoder = new WASM hash = content-fork (new CONTENT_KEY_DOMAIN, parallel operation, natural sunset — see Upgrade Model). The zlib pattern: spec exists for auditability, everyone runs the same code. |
| **Blind addressing + relay-durable mapping** | Protocol | See Glossary: Blind addressing, Mapping. Four mapping layers with relay-encrypted events as durable source of truth. |
| **Coverage signal event** | Protocol | See Glossary: Coverage signal. The gap between "how many" and "which ones" is the privacy boundary. |
| **Fund confirmation event** | Protocol | Bind sats to content hash (bonded mint-signed). See §1. |
| **Request proof event** | Protocol | Client PoW + Nostr signature + via tag. Gates delivery, published as demand signal. See §2. |
| **Store attestation** | Protocol | Store proves shard service for a specific request. Direct to mint. See §3. |
| **Settlement event** | Protocol | Per-mint deterministic payout across P participants. See §4. |
| **Storage challenge protocol** | Protocol | Permissionless — anyone can challenge (no bond needed). Random byte offsets + Merkle proofs, latency-tested. Failure → lose epoch earnings. Repeated failure → mint stops interacting. |
| **ZK selection proofs** | Protocol | Halo2/KZG proofs that delivery token selection is correct. Mint proves to store without revealing content_hash or relay-correlatable values. ~3KB proof, ~5-15ms store-side verification. Proof-on-demand: stores audit sampled tokens; mint proves on request. See Glossary: ZK selection proof, #20. Implementation: axiom-crypto/halo2-lib (KZG on PSE fork). |
| **Cross-store verification** | Protocol | Block-hash-assigned per-epoch peer verification. Earning requires proving own storage AND verifying a peer. |
| **Attestation submission** | Protocol | Stores submit attestations to the delivery-token-issuing mint (direct channel). Omission detectable via attestation Merkle root in epoch summary → competitive exit. |
| **Bonded mint registration** | Protocol | Time-locked on-chain UTXO (fidelity bond). Permissionless. Tenure-weighted custody ceiling. Enforcement: competitive exit — stores and clients reroute on misbehavior. |
| **`ocdn-store` daemon** | Product | Commodity storage behind anonymous transport. `docker run ocdn-store --disk 50GB`. Bundles Tor, binds .onion on first run. **Autonomous rebalance** (~1h): ranks shards by `projected_value_per_byte` (pool decay + tenure ramp + competitor entry + **mint-outage patience**: tenure premium on resumption × P(mint_resurrection) from historical mint uptime — blobs with strong earnings history retain positive expected value during gaps). Acquires via replication tokens, evicts lowest-value. Challenge-based tenure = implicit switching cost (held shards rank higher than new). Hash-blind local state (see Glossary: Store-blind). Earns Cashu ecash (auto-diversified across mints). Degraded mode: accepts PoW-authorized requests when all mints down, continues self-attesting to relays. Target: <512MB RAM, <100MB/day bandwidth. See Symbiosis for uptime economics. |
| **Importance index** | Product | Rankings, feed, API, widget. Anyone operates. |
| **OG image endpoint** | Product | Cloudflare Worker renders live scoreboard snapshots for social sharing. Stateless, serve-layer. The viral loop. |
| **`ocdn-mint` daemon** | Product | Bonded mint behind anonymous transport. `docker run ocdn-mint --bond <utxo>`. Bundles Tor + Cashu. **Bootstrap from relays**: `--bootstrap-from-relays` reconstructs full operational state (pool balances from epoch summaries, mappings from relay-encrypted events, store roster from self-attestation proofs) — design target <2h from bond to operational. **Retroactive gap settlement**: on bootstrap, verifies self-attestation proofs + request proofs from relay data for gap epochs and settles retroactively — stores that held through the outage receive backpay. Competitive advantage: mints that honor gap claims attract more stores. |
| **Clearinghouse** | Product | Preserve/offer order matching |
| **`ocdn-pack`** | Product | Deterministic tar (`--sort=name --mtime=0 --owner=0 --group=0`). Same tree → same hash → convergent encryption composes. Any file tree becomes one funded document (N=RS_N). 10× efficiency vs individual small files. |
| **Filtered OCDN relay** | Product (serve layer) | Nostr relay accepting only OCDN event kinds. Bundled with serve endpoint reference implementation. Serve endpoints already speak WebSocket to clients; adding relay protocol for OCDN kinds is ~200 lines. Persistence is structurally incentivized: serve endpoints that retain more events serve users better → more traffic → more via income. Signed events prevent forgery — persistence is a commodity trustless function. |
| **HTTP gateway** | Product (serve layer) | HTTP ↔ OCDN. Reconstructs archives, serves files. Earns via via tag. Vanity domains via DNS TXT or Nostr kind. Enables self-hosting. ~500 lines. |
| **Funding receipt event** | Protocol (evidence layer) | Funder-controlled HTLC preimage proof of deposit. Independent of mint's balance_root. Committed via `receipt_root` in epoch summary. ~120 bytes on Bitcoin for permanent evidence. See Glossary: Funding receipt. |
| **Pre-commitment event** | Protocol (evidence layer) | Content_hash timestamp before funding. Committed via `precommit_root`. Zero cost. See Glossary: Pre-commitment. |
| **Existence proof format** | Protocol (evidence layer) | Portable Borsh-serialized Merkle inclusion proof, ~744 bytes. Self-contained, offline-verifiable against Bitcoin headers. See State Commitments: Evidence Layer. |
| **Ghost dossier event** | Protocol (evidence layer) | Complete evidence summary for dead content. Economic biography + Bitcoin anchor refs + portable proofs. See Glossary: Ghost dossier. |
| **`ocdn-proof` CLI** | Product | Takes content_hash + epoch + Bitcoin RPC endpoint. Outputs self-contained ExistenceProof. Verifies ExistenceProof against Bitcoin headers. ~200 lines. Ships alongside `ocdn-settle`. |

### Trust Assumptions

- **Custodial trust (fidelity bond + tenure-weighted ceiling)**: Bonded mints hold pool balances. Irreducible — sats that persist across epochs and pay multiple parties over time require custody. **Protocol rule: `balance(mint) ≤ bond_value(mint) × tenure_factor(epochs)`.** Bonds are time-locked on-chain UTXOs (`OP_CSV`) — a commitment signal, not slashable collateral. No trusted counter-signer, no covenant opcodes required. Works on Bitcoin mainnet today. `tenure_factor` starts low (~5% in first week) and grows toward 100% over months — new mints custody little, established mints custody more. Deposits that would exceed the ceiling are rejected; the client routes to the next mint. **Enforcement is competitive exit**: stores verify payment via attestation Merkle root + per-shard S_s; underpaid stores reroute. The bond is a pre-paid insurance premium; the ceiling bounds damage by construction. No genesis income from misbehavior. All custody operations are auditable from public data: `balance_root` commits per-content balances each epoch; the cross-content conservation law (`Σ(drained - recycled) = total payouts + coordination + genesis`) is checkable by any settler from the leaf data blob (see State Commitments).
- **Founder operates nothing post-launch.** No operational role, no delegation authority, no admin key. All roles operated by independent actors.
- Independent operators run: bonded mints, stores, serve endpoints, settlers, importance indexes
- All settlement is deterministic and auditable — settlers consume epoch summaries + leaf data from relays (no RPC gatekeeper). Three verification tiers: level-1 (public, exact balance transition + conservation law + challenge root recomputation), level-2 (store-local payout verification), level-3 (mint-cooperative full re-computation). Level-1 catches gross fraud from public data alone; level-2 catches per-store fraud. See State Commitments: Verification Tiers.
- **Competing settlers, competing mints, and competing importance indexes are permitted and encouraged from day 1**
- **Store liability isolation**: Unbonded, anonymous — store-blind via three independent layers (see Glossary: Store-blind). **Verifiability proportional to responsibility**: mints are bonded (on-chain UTXO, anonymous behind Tor); stores are unbonded (commodity, anonymous behind Tor). Trust anchored in on-chain commitments + observable behavior, not operator identity. Enforcement: challenge failure = no payment. Sybil (false redundancy) is a mint-policy / clearinghouse concern, not protocol-level. System heals through replacement — compliance and censorship-resistance are independent properties.
- **Serve endpoint isolation**: Mandatory retrieval proxy + filtered OCDN relay (see Glossary: Serve endpoint). Cannot redirect store income — multi-party binding (§3). Sees partial store mappings (one random store per shard). Can derive convergent key (knows content_hash from request proof) — this is accepted: serve endpoints compete on the open market, censorship resistance comes from replicated storage behind anonymous transport, not from serve endpoint encryption. Event persistence adds no new trust surface — Nostr-signed events are unforgeable; serve endpoints can only withhold, not corrupt. Many competing serve endpoints create a de facto mixing layer for client requests.

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

**Step 1 — Deposit** (private, off-relay): Funder sends HTLC-gated Cashu ecash to a mint's .onion address over Tor. The HTLC binds ecash settlement to the fund confirmation event: mint reveals preimage by publishing confirmation on relays; funder reclaims on timeout. Atomic — mint cannot take ecash without publishing confirmation, cannot publish fake confirmation without the preimage binding deposit to content_hash + amount + mint pubkey. Fallback deposit paths: BOLT12 Lightning over Tor (.onion-reachable Lightning node), Cashu P2PK. The reference client defaults to splitting deposits across 2+ bonded mints (round-robin via `DEPOSIT_SPLIT_MIN`). Per-mint custody risk becomes proportional, not binary — one honest mint = its fraction of deposits safe. Each mint receives an independent HTLC with its own preimage. The mint credits the pool on its internal ledger. No bearer tokens are published on relays.

**Step 1b — Upload verification** (verifying mint, private, off-relay): At least one mint verifies shard integrity before confirming. Uploader submits K convergent-encrypted shards + content_hash. Mint derives convergent key from content_hash + protocol_seed, decrypts, reconstructs, checks `SHA256(plaintext) == content_hash`. If invalid, deposit is rejected. Prevents free griefing — without this, an adversary can fund garbage shards that stores blindly mirror, making content unrecoverable despite a funded pool. Cost: ~100ms compute per upload (decrypt + hash check). For large documents, the mint verifies a random subset of shard Merkle roots against the deterministic expected values. Mint distributes verified shards to initial stores, then publishes fund confirmation. When splitting deposits, the client designates one mint for verification; other mints accept sats-only deposits and confirm independently.

**Step 2 — Confirmation** (public, on-relay):
```
kind: NIP_POOL_KIND (non-replaceable, 1000-9999 range)
pubkey: mint_pubkey                      # bonded mint signs
tags:
  ["g", "<genesis_fingerprint>"]         # genesis pubkey fingerprint — relay filtering + instance identity
  ["v", "1"]                             # protocol version — explicit from day one
  ["r", "<sha256>"]                      # content hash (the pool key)
  ["amount", "<sats>"]                   # sats confirmed
  ["funder", "<funder_pubkey>"]          # who deposited (ephemeral key OK)
  ["seq", "<monotonic_sequence>"]        # per-mint sequence number for canonical ordering
  ["bond", "<bond_utxo_ref>"]           # proves mint bonded (on-chain verifiable)
  ["n", "<shard_count>"]                 # REQUIRED: 1 for text (below MIN_FRAGMENT_SIZE), RS_N for documents. Immutable per content_hash — first fund confirmation sets N; subsequent deposits MUST match. Load-bearing for settlement: shard_drain = floor(mint_drain / N).
  ["role", "verify|additional"]          # verify = verified shards; additional = re-fund of existing content
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
  ["g", "<genesis_fingerprint>"]        # genesis binding — serve endpoint verifies
  ["v", "1"]                            # protocol version
  ["r", "<content_hash>"]              # what the client wants to consume
  ["pow", "<nonce>", "<pow_hash>"]     # anti-sybil (reading is free, PoW prevents abuse)
  ["epoch", "<epoch_number>"]
  ["epoch_hash", "<epoch_hash>"]       # mutual auth — serve endpoint recomputes from protocol_seed + live BTC block hash
  ["via", "<referrer_pubkey>"]         # front-end that facilitated this request (earns coordination share)
  ["blind", "<SHA256(selection_nonce)>"]  # commitment to selection blinding nonce — withheld until mint commits to processing (see Serve-Blinded Selection)
content: ""
sig: client signature (NIP-07)
```

**All content is store-gated.** Request proofs gate delivery for all content types — stores verify PoW + signature + epoch before serving any shard. **Serve endpoints verify epoch_hash before forwarding** — the first protocol boundary and earliest detection of a wrong genesis pubkey. The front-end requests the signature via NIP-07 but cannot modify `content_hash` — the extension shows what it's signing.

**Dwell-based PoW** (reference client implementation): The client pre-mines request proofs in a background Web Worker as content enters the viewport. For text content (leaderboard cards, claims, replies), proofs are submitted on dwell — visible and paused ≥2s — ensuring demand signal reflects actual reading, not scroll-by. For documents, proofs submit on tap. Reading feels instant; PoW is invisible infrastructure. Pre-mined but unused proofs are discarded (no wasted signal, modest wasted compute). **Serve-blinded selection piggybacks on the dwell window**: the commitment phase (request proof with blind → mint commits → commitment returned) executes during the same pre-dwell period as PoW mining. The nonce reveal triggers on dwell, making the commitment-reveal protocol typically hidden in the dwell window from the user's perspective. Tor variance can add occasional 1-2s delay on the commitment phase when the dwell trigger fires before the commitment returns (see §3 Consumption flow).

**Ephemeral keys (privacy by default)**: The reference client defaults to ephemeral keys for request proofs — a fresh key per session, unlinkable to the reader's main Nostr identity. Readers who want a consumption credential (agents, researchers) opt in to identified proofs signed by their main key. Sybil risk from ephemeral keys affects only the index (display layer), not settlement (economic layer) — drain is gate-triggered by the existence of valid request proofs, not count-triggered by their volume. The index can weight commitment (sats, unsybilable) over demand (request proofs, sybilable).

**Referrer (`via` tag)**: See Glossary: Via tag. Forgery is unprofitable — you can't profit without generating real consumption (valid request proofs + store attestations). The reference client hardcodes the founder's pubkey.

**Published to relays (sampled at scale)**: Request proofs are the public demand signal. At bootstrap, every proof is published to relays (RELAY_SAMPLE_RATE = 1). At scale, serve endpoints publish a sample of forwarded proofs to relays at epoch end; clients may also self-publish at `1/RELAY_SAMPLE_RATE` with epoch-boundary jitter. In degraded mode (no mint reachable), clients publish all proofs (rate = 1) — traffic is naturally lower and sweep prevention requires relay evidence. The epoch summary's `demand_root`, `proof_root`, and `referrer_root` are the primary demand data carrier; sampled relay proofs and serve endpoint referrer witnesses provide independent cross-verification. Anyone can verify PoW + signature on any individual proof.

### 3. Store Attestation (store-signed, direct to mint)

After serving a shard in response to a valid request proof, the store signs an attestation binding itself to the specific request and submits it **directly to the mint** — not through the front-end, not published on relays.

```
store → mint (direct channel):
  delivery_token_hash: hash(delivery_token)  # binds to specific mint-authorized retrieval
  store_pubkey: store's pubkey
  blob_id: which blob was served
  response_hash: SHA256(bytes_served)        # proves correct convergent-encrypted shard bytes
  epoch: epoch_number
  epoch_hash: <epoch_hash>                   # mutual auth — mint verifies against protocol_seed + live BTC
  sig: store signature
```

**Why direct to mint, not relayed**: Store attestations contain the store's real pubkey — publishing them would link store identity to delivery tokens. The direct-to-mint channel preserves store blindness in the public record. The mint maps delivery token hashes back to content_hash internally, aggregating attestations into epoch summaries for settlers. Settlers see attestation aggregates per shard, not raw store-to-content mappings.

**Mint-canonical epoch assignment**: The mint assigns attestations to epochs based on the block height at the time the mint *received* the attestation. Stores include their proposed epoch; the mint overrides on disagreement (block propagation delay can cause store/mint to see different epoch boundaries). The mint's epoch summary is canonical for all attestations it contains — settlers need no knowledge of block propagation timing.

**Multi-party binding** (scoped: prevents serve endpoint redirection): The attestation contains `delivery_token_hash` — the delivery token is mint-signed and cryptographically chained to the client's request proof (the mint issued the token in response to a verified request proof). The front-end cannot redirect store income:
- The client signed the request including `via` tag (NIP-07 — front-end can't forge a different referrer)
- The mint signed the delivery token (front-end can't forge delivery tokens)
- The store signed the attestation (store's private key — front-end can't forge)
- The store submitted the attestation directly to the mint (front-end can't intercept)

Multi-party binding prevents **serve endpoint** redirection. **Mint-level** routing bias (selecting favored stores) is a separate concern addressed by three-layer selection verification (see Glossary: Delivery token, Selection proofs).

**Consumption flow (healthy — serve-blinded selection)**: Two phases: *commitment* (pipelined into viewport dwell — off the user-visible hot path) and *reveal + delivery* (on the hot path, same latency as pre-blinding design).

**Phase 1 — Commitment (during viewport dwell)**: (1) Client mines PoW, generates `selection_nonce`, includes `blind = SHA256(nonce)` in request proof, signs via NIP-07. (2) Client → serve endpoint → mint (request proof WITHOUT nonce). Serve endpoint verifies epoch_hash (first boundary check). (3) Mint verifies epoch_hash + PoW + signature + coverage ≥ K. Mint cannot compute routing outcome (nonce unknown). Signs `processing_commitment`. Returns via serve endpoint to client. (4) Client verifies mint signature — mint is cryptographically bound. Phase 1 hidden in ≥2s dwell period.

**Phase 2 — Reveal + Delivery (on dwell trigger)**: (5) Client reveals `selection_nonce` → serve endpoint → mint. Mint verifies `SHA256(nonce) == blind`. (6) Mint selects K shards + one store per shard via deterministic formulas against committed `store_set_root` and `selection_input_root` (see Glossary: Delivery token). Issues delivery tokens + selection proofs + ZK selection proofs (or makes proofs available on demand). (7) Serve endpoint fetches convergent-encrypted blobs from stores using delivery tokens. Stores verify epoch_hash + mint signature + ZK selection proof (if attached; otherwise request proof-on-demand for sampled tokens), serve blobs, attest to mint directly. (8) Serve endpoint returns blobs + selection proofs to client. Client derives convergent key from content_hash + protocol_seed, verifies selection proofs + selection_input commitment, decrypts, reconstructs plaintext, verifies content_hash. Incorrect selection or false selection_input → publishable evidence. (9) Serve endpoint publishes sampled request proofs + referrer witness event at epoch end (see Events: Referrer witness).

**Latency**: Phase 1 typically hidden in dwell window. Worst case: ~1-2s added when Tor variance exceeds dwell. Phase 2 hot path identical to pre-blinding design.

**Unfulfilled commitment evidence**: Client publishes `{request_proof_hash, processing_commitment (mint-signed), selection_nonce}` — self-contained, cryptographically verifiable by anyone.

**Consumption flow (degraded)**: See Glossary: Degraded-mode retrieval. Serve endpoint recovers mappings from relay escrow (Argon2-gated), contacts stores directly with PoW authorization. No settlement, no demand signal. Content available; economics suspended.

**Verification**: O(1). `Ed25519_verify(attestation, store_pubkey)` + `bond_check(store_pubkey)` + `request_hash matches valid request proof`.

**Attestation verification**: Stores verify their own inclusion in each epoch's attestation Merkle root (published in the epoch summary). The store computes `hash(its_attestation)`, requests an inclusion proof from the mint, and verifies against the published root. Exclusion = the mint dropped the attestation. The store's recourse is competitive exit: stop attesting to that mint, reroute to alternatives. No receipt system, no prosecution — the Merkle root is a one-way commitment the mint can't retract. The attestation signature makes each leaf hash unpredictable to anyone without the store's private key — sibling hashes in inclusion proofs reveal nothing about other stores.

### Epoch Summary (bonded mint-signed)

Mints publish epoch-aggregated summaries — signed append-only log entries that form the canonical settlement input. Each summary is a Nostr event; the `prev` tag creates a hash chain using Nostr event IDs (`SHA256` of canonical event serialization per NIP-01). The epoch chain is a Certificate Transparency-style signed log: the mint commits to a consistent state, auditors spot-check, and the market punishes inconsistency via competitive exit.

```
kind: NIP_EPOCH_SUMMARY_KIND
pubkey: mint_pubkey                      # bonded mint
tags:
  # --- identity + chain ---
  ["g", "<genesis_fingerprint>"]         # genesis binding
  ["v", "1"]                             # protocol version
  ["epoch", "<epoch_number>"]
  ["epoch_hash", "<epoch_hash>"]         # mutual auth — settlers verify against protocol_seed + BTC
  ["prev", "<prev_epoch_summary_event_id>"]  # hash chain via Nostr event IDs — fork/gap detection
  ["seq", "<monotonic_sequence>"]
  ["bond", "<bond_utxo_ref>"]

  # --- state commitments (the mint's signed claim about pool states) ---
  ["balance_root", "<merkle_root>"]      # Merkle root over sorted PoolState leaves (live content only: balance > 0). The canonical per-epoch state checkpoint. See State Commitments.
  ["funding_root", "<merkle_root>"]      # Merkle root over fund confirmation event IDs processed this epoch. Canonicalizes which deposits were included — eliminates relay-gap ambiguity.
  ["sweep_root", "<merkle_root>"]        # Merkle root over (content_hash, swept_balance) for content swept this epoch. ONLY present when sweeps occurred — tag absence = no sweeps. Combined with balance_root and the hash-chained log, provides existence proofs for ghost content without a separate ever-growing history tree.

  # --- demand commitments ---
  ["request_count", "<n>"]              # unique request proofs verified
  ["demand_root", "<merkle_root>"]      # Merkle root over sorted (content_hash, request_count, unique_clients)
  ["proof_root", "<merkle_root>"]       # Merkle root over sorted hash(request_proof) — commits exact proof set; enables spot-check by anyone holding a proof
  ["referrer_root", "<merkle_root>"]    # Merkle root over sorted (content_hash || via_pubkey || proof_count) — commits referrer accounting

  # --- store + challenge commitments ---
  ["store_totals", "<store_count>", "<attestation_count>"]  # aggregate only — no individual store IDs in public events
  ["shard_stores", "<s0>", "<s1>", ...]  # per-shard store count S_s — enables exact payout verification by stores
  ["store_set_root", "<merkle_root>"]    # per-shard Merkle root over sorted store pubkeys — commits store ordering for verifiable delivery token selection next epoch
  ["selection_input_root", "<merkle_root>"]  # Merkle root over (blob_id, selection_input) pairs. selection_input = SHA256(protocol_seed || "SELECTION_INPUT" || content_hash || shard_index || epoch_hash). Committed in epoch N-1, used for ZK selection proofs in epoch N.
  ["attestation_root", "<merkle_root>"]  # Merkle root over hash(attestation) leaves — stores verify own inclusion privately. Attestation detail (content→store mapping) is mint-held for store-blindness — NOT published to relays.
  ["challenge_root", "<merkle_root>"]    # Merkle root over sorted (store_pubkey, blob_id, challenge_passed) triples. Uses blob_id (not shard_index) so the root is fully independently recomputable from public self-attestation proofs on relays — the highest-confidence commitment in the system (see State Commitments: Verification Tiers).
  ["challenge_results", "<passed>", "<failed>"]  # storage challenge summary (aggregate)

  # --- routing + commitment accountability ---
  ["routing_root", "<merkle_root>"]      # Merkle root over (group_id, delivery_token_count) pairs — stores verify demand share
  ["commitment_root", "<merkle_root>"]   # Merkle root over signed processing_commitments this epoch
  ["commitment_count", "<n>"]            # processing_commitments signed this epoch — fulfillment ratio is a public accountability signal

  # --- evidence layer (Bitcoin-anchored) ---
  ["evidence_root", "<merkle_root>"]     # root over (balance_root, funding_root, sweep_root, demand_root, receipt_root, precommit_root). This is the value anchored on Bitcoin via OP_RETURN each epoch.
  ["receipt_root", "<merkle_root>"]      # Merkle root over funding receipt hashes observed this epoch. Cross-verifiable against funder-published receipts on relays. Receipt + absence from balance_root = one-sided mint fraud proof.
  ["precommit_root", "<merkle_root>"]    # Merkle root over active pre-commitment hashes. Expires after PRECOMMIT_TTL epochs if never funded; Bitcoin anchor during TTL = permanent timestamp.
  ["prev_anchor", "<bitcoin_txid>"]      # Bitcoin txid of previous epoch's evidence anchor. Creates a Bitcoin-native chain link — consecutive anchors verifiable entirely on Bitcoin, no relays needed for ordering.

  # --- aggregate + leaf data ---
  ["totals", "<total_balance>", "<total_live_content>", "<total_stores>"]  # mint-wide aggregates — enables heartbeat monitoring without any blob downloads
  ["leaf_data", "<sha256_of_blob>"]      # SHA256 of Blossom-hosted leaf data blob (balance leaves, funding leaves, referrer leaves). Inline at bootstrap; chunked by content_hash prefix at scale. See State Commitments: Leaf Data Publication.
sig: mint signature
```

**Why summaries**: Epoch summaries are signed by bonded mints (bounded, enumerable, gap-detectable via `seq`). The `prev` tag creates a per-mint hash chain — settlers detect gaps, forks, and converge by collecting all chains. Each Merkle root above is independently queryable and verifiable; the inline comments are the canonical specification. Individual store identities never appear in public events linked to content. Commitment-before-sampling: mints commit roots at epoch boundary before knowing which proofs will be externally audited.

**Why `challenge_root` uses blob_id, not shard_index**: Self-attestation proofs on relays contain `(store_pubkey, blob_id, proof)`. The `blob_id → shard_index` mapping is mint-private (store-blindness). An independent auditor can enumerate the expected challenge set per store (deterministic from `epoch_hash + store_pubkey + blob_id`), verify each self-attestation proof against the expected nonces and byte offsets, and reconstruct the `challenge_root` entirely from public relay data. If the mint's committed root differs from the independently computed one, the mint is provably lying — no cooperation required, no trust assumed. This makes `challenge_root` the primary audit target and the canary for mint integrity.

### State Commitments

The epoch summary is a signed append-only log entry — not a consensus block. The mint is not a blockchain; it is a Certificate Transparency-style log operator. It commits to a consistent state, publishes the evidence, and the market audits. No participant needs to agree on "the" global state. Each participant verifies the claims relevant to them against the mint's commitments.

**Design philosophy**: the system is designed to lose data gracefully. Relays may drop events, mints may go offline, epoch summaries may be lost. The commitments in each epoch summary form a state checkpoint — a signed, hash-chained claim by the mint about its pools. Loss of leaf data reduces verification depth but doesn't break function. Loss of epoch summaries creates gaps in the chain but doesn't invalidate surviving summaries. The hierarchy of data durability is: Bitcoin anchors (permanent) → epoch summaries on relays (durable) → leaf data on Blossom (available) → raw events (ephemeral). Each layer's loss degrades verification capability without catastrophic failure.

#### PoolState (the balance leaf)

Each content item at a mint has a canonical economic state committed via `balance_root`:

```
PoolState {
    content_hash:          [u8; 32]    # the pool key
    balance:               u64         # current sats after settlement
    n:                     u8          # shard count (1 or RS_N) — immutable after first fund
    sweep_clock:           u16         # consecutive epochs with no valid attestations (reset on any attestation)
    drained_this_epoch:    u64         # floor(balance_prev × DRAIN_RATE) — deterministic, enables exact level-1 audit
    recycled_this_epoch:   u64         # aggregate tenure-weighted recycling across all shards — no per-store detail
    deposited_this_epoch:  u64         # new deposits processed (cross-references funding_root)
}
```

**67 bytes per leaf.** At 100K content items: ~6.7MB. At 1M: ~67MB (chunked). The `balance_root` tree contains only **live** content (balance > 0). Swept content exits the tree; the sweep is recorded in `sweep_root` for that epoch. The hash-chained epoch log IS the complete history — no separate ever-growing history tree needed.

**Level-1 balance verification** (exact, from public data):
```
balance[E+1] = balance[E] - drained + recycled + deposited
```
All terms are committed in the PoolState. An auditor downloads the leaf data blob, verifies it against `balance_root`, and checks the arithmetic for every content item. `drained = floor(balance[E] × DRAIN_RATE)` is deterministic. `deposited` cross-references `funding_root`. `recycled ≤ drained` (can't recycle more than was drained).

**Cross-content conservation law** (mint-wide, from public data):
```
Σ(drained - recycled) = total_store_payouts + total_coordination + total_genesis_share
```
Catches systematic skimming that per-content checks might miss.

**What `recycled_this_epoch` reveals**: aggregate tenure distribution across all shards for this content — similar in granularity to `challenge_results` (already public). No per-store linkage, no content-to-store mapping. Self-attestation proof timing on relays already reveals individual store tenure patterns; the aggregate recycled amount adds no new information.

#### Verification Tiers

Not all verification requires the same data. The protocol provides three tiers with decreasing data requirements:

| Tier | What it verifies | Data required | Who performs it |
|------|-----------------|---------------|-----------------|
| **Level 1** (public, exact) | Balance transitions, conservation law, challenge integrity, funding inclusion | Epoch summaries + leaf data blobs on relays. No mint cooperation. | Settlers, auditors, anyone |
| **Level 2** (store-local) | Individual store's payout correctness | Store's own attestation data + mint-provided balance parameters (consistency check) | Each store for itself |
| **Level 3** (mint-cooperative) | Full settlement re-computation including per-store-per-content attribution | Attestation detail from mint (private: content→store mapping) | Auditors with mint cooperation |

**Verification confidence hierarchy** (ordered by independent recomputability):

1. **`challenge_root`** — fully independently recomputable from public relay data (self-attestation proofs + deterministic challenge algorithm). The canary: if this root is wrong, nothing the mint says can be trusted.
2. **`funding_root`** — cross-verifiable against fund confirmation events on relays. High confidence, modulo relay completeness.
3. **`balance_root` transition** — exact arithmetic check given previous epoch's PoolState + committed per-content fields. High confidence if previous state is trusted.
4. **`referrer_root`** — cross-verifiable against serve endpoint referrer witness events. Medium-high confidence.
5. **`attestation_root`** — per-store verification of own data only. Store-level confidence. Attestation detail (content→store mapping) is mint-held to preserve store-blindness.

An auditor that detects a `challenge_root` mismatch doesn't need to check anything else — the mint is provably fabricating data using only public inputs.

#### Store-Blindness Boundary

The commitment model preserves store-blindness by stratifying what is public vs. private:

| Data | Published to relays? | Rationale |
|------|---------------------|-----------|
| Balance leaves `(content_hash, balance, N, ...)` | **Yes** — leaf data blob | No store info. Fund confirmations already reveal deposits; balances are derivable. |
| Funding leaves `(fund_event_id, content_hash, amount)` | **Yes** — leaf data blob | Already public from fund confirmation events. |
| Referrer leaves `(content_hash, via_pubkey, count)` | **Yes** — leaf data blob | Referrers are public (via tags in request proofs). |
| Challenge leaves `(store_pubkey, blob_id, passed)` | **Yes** — recomputable from self-attestation proofs | Already public from relay-published self-attestation proofs. blob_id reveals nothing about content. |
| Attestation detail `(content_hash, shard, store_pubkey)` | **No** — mint-held | Breaks store-blindness. Stores query for their own proofs only. |
| Per-store-per-content tenure | **No** — mint-held | Derivable from attestation detail. Same privacy concern. |

#### Leaf Data Publication

The `leaf_data` tag in the epoch summary commits the SHA256 of a Blossom-hosted blob containing all publishable leaf data (balance leaves, funding leaves, referrer leaves) in canonical Borsh-serialized format.

**At bootstrap** (sub-10K content items): the blob is small enough (~670KB) to publish inline as a Nostr event or a single Blossom blob. No special handling.

**At scale** (100K+ items): the mint chunks the blob by content_hash prefix. The `leaf_data` tag commits a root over chunk hashes. A verifier checking one content item fetches one chunk, not the full dataset. The chunking scheme is: if the leaf data exceeds `LEAF_CHUNK_THRESHOLD` bytes, the mint partitions leaves by the first `CHUNK_PREFIX_BITS` bits of `content_hash` and commits a Merkle root over the chunk hashes. Chunking is a mint-declared optimization, not a protocol requirement — the `leaf_data` hash is the binding commitment regardless.

**Serve endpoints** host the leaf data blobs (they already run Blossom servers; hosting audit data improves mint trust → more deposits → more via income). The blob is protocol content — it can itself be funded, stored, and served through the protocol at scale (the system's audit trail is content in the system).

#### Ghost State and Historical Proofs

The `balance_root` contains only live content. When content is swept:
1. It appears in `sweep_root` for the epoch in which the sweep occurred.
2. It exits the `balance_root` (balance is now 0).
3. The hash-chained epoch log preserves the history: the fund confirmation epoch (provable via `funding_root`), every epoch of active life (provable via `balance_root` inclusion), and the sweep epoch (provable via `sweep_root`).

**To prove content once existed**: find any epoch summary where the content appears in `balance_root` (inclusion proof) or `funding_root` (deposit proof) or `sweep_root` (exit proof). The hash chain links all epoch summaries. Bitcoin anchoring of any epoch summary in the chain makes the entire chain's integrity transitively anchored.

**Multiple independent paths to proof** (graceful under data loss):
- Path A: `funding_root` proof + `sweep_root` proof + hash chain
- Path B: the fund confirmation event itself (signed Nostr event on relays)
- Path C: any `balance_root` inclusion proof from any epoch during the content's life
- Path D: Bitcoin anchor of any epoch summary in the chain

Each path is independent. Losing one doesn't eliminate the others. The information degrades gracefully, not catastrophically.

#### Evidence Layer (Bitcoin-anchored)

The evidence layer is the protocol's primary output — permanent, verifiable with only Bitcoin headers and SHA-256.

**Mandatory epoch anchoring**: Each epoch, the `evidence_root` is anchored on Bitcoin via OP_RETURN:

```
OP_RETURN (56 bytes):
  "OCDN"                    4B    magic
  genesis_fingerprint       8B    instance identity
  epoch_number              4B
  evidence_root             32B   Merkle root over (balance_root, funding_root, sweep_root,
                                    demand_root, receipt_root, precommit_root)
  prev_anchor_txid_prefix   8B    first 8 bytes of previous anchor's txid (Bitcoin-native chain link)
```

Any participant can publish. First valid anchor per epoch is canonical. Duplicate anchors are non-conflicting by construction (same inputs → same root). Cost: ~56 sats/epoch, ~168 sats/day. The cost of preventing evidence (blocking all OP_RETURN transactions from all OCDN participants) is equivalent to censoring Bitcoin itself.

**Portable existence proof** (canonical Borsh-serialized format, ~744 bytes):

```
ExistenceProof {
    version:            u8          # 0x01
    content_hash:       [u8; 32]
    epoch_number:       u32
    proof_type:         u8          # 0x01=balance, 0x02=funding, 0x03=sweep,
                                    # 0x04=demand, 0x05=precommit
    sub_root:           [u8; 32]    # the specific sub-root (e.g., balance_root)
    sub_root_path:      Vec<[u8; 32]>  # path from sub_root to evidence_root (2-3 hashes)
    leaf_path:          Vec<[u8; 32]>  # path from content_hash leaf to sub_root (~20 hashes)
    evidence_root:      [u8; 32]
    anchor_txid:        [u8; 32]    # Bitcoin transaction containing the OP_RETURN
    anchor_block_height: u32
}
```

Self-contained. Verifiable with only Bitcoin block headers (SPV: 80 bytes/block). Can be printed as a QR code, broadcast by radio, inscribed on Bitcoin (~744 sats for permanent per-content proof). Any participant with epoch summary + leaf data can produce existence proofs. Settlers produce them as a natural byproduct.

**Ghost dossier** (Nostr event, NIP_GHOST_DOSSIER_KIND): Complete evidence summary for dead content — economic biography, Bitcoin anchor references, pre-computed existence proofs (birth, peak, death), verification instructions. The protocol's finished product for a content item. Anyone can produce from public data; deterministic inputs → multiple producers converge.

### 4. Settlement (settler-signed)

A service that subscribes to fund confirmation + epoch summary events, computes epoch payouts, publishes settlement.

```
kind: NIP_SETTLE_KIND
pubkey: settler
tags:
  ["g", "<genesis_fingerprint>"]         # genesis binding
  ["v", "1"]                             # protocol version
  ["epoch", "<epoch_number>"]
  ["mint", "<mint_pubkey>"]              # which mint this settlement covers
  ["epoch_summary_ref", "<event_id>"]    # the epoch summary this settlement verifies
  ["input_set", "<hash>"]               # SHA256(sorted epoch_summary_event_ids) — settler convergence proof
  ["balance_root_verified", "true|false"]  # whether the settler verified the balance_root transition
  ["challenge_root_verified", "true|false"]  # whether the settler independently recomputed challenge_root
  ["conservation_check", "<total_drained>", "<total_recycled>", "<total_deposited>"]  # mint-wide totals from leaf data
content: JSON settlement details (per-content audit results, discrepancies if any)
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

    referrers = unique_via_pubkeys_from_referrer_root(m, cid, epoch)  # from mint's referrer_root leaves, verified against committed root
    R = len(referrers)

    for each shard s in 0..N-1:
      stores_s = stores_with_valid_attestations_AND_storage_proofs(s, m, epoch)
      S_s = len(stores_s)
      if S_s == 0:
        recycle(pool[m, cid]) += shard_drain                    # uncovered shard: drain returns to pool
        continue

      # Level 1: per-shard parity — S_s stores + 1 coordination
      P_s = S_s + 1
      unit_s = floor(shard_drain / P_s)
      remainder_L1 = shard_drain - P_s × unit_s                 → GENESIS_ADDRESS

      # Storage: each store earns 1 tenure-weighted unit
      # Tenure is challenge-based: consecutive epochs passing storage challenges,
      # NOT consecutive attestation epochs. Decouples tenure from routing bias —
      # stores that hold shards and prove it maintain tenure even without delivery tokens.
      shard_recycle = 0
      for each store st in stores_s:
        tenure = consecutive_challenge_passed_epochs(st, s, m)   # ≥1 (challenged + passed this epoch)
        weight = 1 - TENURE_DECAY^tenure                         # 0→1 asymptote
        payout(st) += floor(unit_s × weight)
        shard_recycle += unit_s - floor(unit_s × weight)
      recycle(pool[m, cid]) += shard_recycle                     # extends pool life

      # Level 2: coordination unit — fixed 3-way split (R-invariant)
      coord = unit_s
      per_third = floor(coord / 3)                               # constant denominator: mint / referrer pool / genesis
      remainder_L2 = coord - 3 × per_third                       → GENESIS_ADDRESS  (always 0, 1, or 2 sats)

      payout(mint m) += per_third
      payout(genesis) += per_third + remainder_L2 + remainder_L1

      # Referrer pool: subdivided by proof count (sybil-dilutive, R-invariant at L2)
      # proof_count per referrer from referrer_root leaves; cross-verified by serve endpoint referrer witnesses
      ref_pool = per_third
      total_proofs = sum(proof_count(r, cid, epoch) for r in referrers)
      for each referrer r in referrers:
        payout(r) += floor(ref_pool × proof_count(r) / total_proofs)
      ref_remainder = ref_pool - sum(referrer payouts)            → top referrer by proof_count  (NOT genesis)

    payout(genesis) += remainder_L0

# Abandoned pools sweep to genesis.
# Chain-relative counting: SWEEP_EPOCHS measured against m.seq, not wall-clock epochs.
# Mint offline → chain frozen → sweep clock frozen → mint takedown cannot trigger sweep.
# No global demand check — sweep is purely per-mint, preserving settlement independence.
# A storeless mint receives zero routed demand (serve endpoints route around S_s=0),
# so its pools are economically inert; sweeping them is the correct market signal.
# See Unresolved #33 for genesis address incentive alignment implications.
for each mint m:
  for each content_hash cid where m holds balance:
    let recent_window = last SWEEP_EPOCHS entries in m.epoch_chain (by seq)
    if no_valid_attestations(cid, m, recent_window):
        sweep(pool[m, cid]) → GENESIS_ADDRESS
```

**K-threshold gating**: Mints reject request proofs for content with fewer than K covered shards. Below K: content is unrecoverable, no request proofs accepted, no attestations, no drain, pool preserved. Settlement requires actual availability.

**Earning requires BOTH demand AND proven storage**: A store earns for a shard only if (1) it submitted a valid attestation for a valid request proof this epoch AND (2) it passed the mint's storage challenge for that shard this epoch. Attestation without storage proof = invalid (prevents proxy-only stores). Storage proof without attestation = no payout this epoch (content not consumed or store not selected), but tenure still accumulates via challenge-based tenure (see Tenure-weighted payout).

**Per-shard parity**: See Glossary. The pseudocode above is canonical. Cascading remainders from L0 + L1 + L2 across N shards produce genesis income that grows in absolute sats while shrinking as a percentage. At high market depth, integer friction across many independent shard settlements becomes a significant genesis income source.

**Self-balancing**: Equal shard drain means thin shards (low S_s) pay more per store and thick shards (high S_s) pay less. Stores migrate to undercovered shards. Coverage signals make the economics visible.

**Tenure-weighted payout (challenge-based)**: Store income matures with continuous *availability*, not continuous *selection*. `weight = 1 - TENURE_DECAY^tenure` where `tenure` counts consecutive epochs in which the store passed storage challenges for this store-shard-mint triple — regardless of whether the store received delivery tokens or submitted attestations that epoch. At reference default TENURE_DECAY = 2/3: first epoch ≈ 33%, 6 epochs (~24h) ≈ 91%, 12 epochs (~48h) ≈ 99%. Payout still requires attestation (demand gate: no delivery token → no attestation → no payout this epoch), but the tenure weight applied to that payout reflects proven availability over time, not routing fortune. The gap between `unit_s` and `floor(unit_s × weight)` recycles to the pool each epoch, extending content lifetime proportionally to store churn. Stable content with long-tenured stores drains at the nominal DRAIN_RATE. High-churn content drains slower because departing stores' forfeited income returns to the pool. The mechanism is self-funding: the stores that cost the pool the most (short-tenure churners) cost it the least (low weight). Coordination share is not tenure-weighted — mints, referrers, and genesis earn at full rate regardless. **Why challenge-based, not attestation-based**: Under attestation-based tenure, a mint that biases routing gives its own stores perfect attestation → perfect tenure → full weight, while honest stores get sporadic selection → broken tenure streaks → low weight → autonomous eviction (the store daemon correctly identifies these shards as underperforming). Challenge-based tenure breaks this amplification loop: honest stores that hold shards and pass challenges maintain tenure regardless of routing bias. When they eventually receive delivery tokens (serve-blinded selection makes routing unbiasable — see Consumption flow), they earn at full weight. The store daemon sees: fewer delivery tokens but full tenure → correct expected value → no eviction pressure.

**Tenure computation**: Settlers compute tenure from the epoch summary chain — `consecutive_challenge_passed_epochs(st, s, m)` is the count of unbroken consecutive epochs (walking the `prev` chain backward from current epoch) in which store `st` appears in mint `m`'s `challenge_root` with a passed result for the relevant blob_id. Settlement for epoch E requires epoch detail from at most the last `ceil(log(0.01)/log(TENURE_DECAY))` epochs (~12 at reference default) — beyond this, all stores have weight > 0.99 and the lookback can be truncated without material settlement error. The lookback is bounded, deterministic, and independently verifiable. The publicly committed `challenge_root` uses blob_ids (independently recomputable — see Epoch Summary); the mint internally maps blob_id → (content_hash, shard_index) for settlement computation. O(stores × shards) per epoch, bounded by lookback depth.

**Drain rate**: `DRAIN_RATE × balance`. DRAIN_RATE is per-mint declared (see Constants); settlers use the declaring mint's value. Pool half-life = ln(2)/DRAIN_RATE. Store count doesn't affect drain speed — it affects how the drain is divided. Funders can calculate expected duration at deposit time from the mint's declared rate. Minimum viable pool ≈ N/DRAIN_RATE sats (below this, per-shard drain rounds to 0, stores stop earning, sweep timer starts).

**Per-mint independence**: Each pool-CID-mint triple tracks its own balance. The mint that confirmed the deposit handles claims against that balance. No cross-mint coordination needed. Each mint's settlement — including sweep — is a closed computation. A settler needs only that mint's epoch summary chain (bounded SWEEP_EPOCHS lookback) to produce a deterministic result. Sweep is chain-relative (counted against `seq`), so a settler never consults relays, other mints, or any global data source.

**Settlers consume public relay data**: Settlers fetch epoch summaries + leaf data blobs from relays and serve endpoint archives — not from mints directly. No RPC gatekeeper. The mint publishes; relays carry; anyone reads. Level-1 verification (balance transitions, challenge root recomputation, conservation law) requires no mint cooperation. Level-2 verification (individual store payouts) is performed by each store locally. Level-3 verification (full re-computation including attestation detail) requires mint cooperation but is rarely needed — level-1 catches gross fraud and level-2 catches per-store fraud. Each per-mint settlement event is independently final. Missing mints' settlements are filled in when their summaries become available. The `prev` hash chain on epoch summaries makes each mint's history self-proving — a new settler catches up from the latest epoch summary's `balance_root`, verifies forward, no full replay required.

**Payout via Cashu**: Each epoch, settlement produces Cashu ecash tokens for each store's earnings, delivered via the existing persistent Tor circuit. Blind signatures (Chaum) make issuance and redemption unlinkable — the mint cannot correlate "issued tokens to `.onion:abc`" with "someone redeemed tokens." Tokens are bearer instruments: stores accumulate locally, redeem at any Cashu-compatible mint (including cross-mint swap for full separation from the issuing OCDN mint), at any time. Eliminates: PAYOUT_THRESHOLD (every epoch pays, even 1 sat), Lightning routing failures (no outbound Lightning at settlement), payment timing correlation (no observable mint-to-store payments). The OCDN mint is already custodial — Cashu token issuance is a natural extension, not a new trust assumption. **Counterparty risk**: tokens are claims on the issuing mint — if that mint exits, unswapped tokens are worthless. The daemon auto-diversifies: periodic cross-mint swap when any single-mint balance exceeds a threshold, spreading counterparty exposure. Deposit splitting across mints (DEPOSIT_SPLIT_MIN) diversifies earning sources by construction. Optional Lightning sweep for operators who configure a receiving wallet. See Glossary: Cashu payout.

**Properties**:
- Deterministic: same epoch summary chain → same settlement. Anyone can verify. Tenure-weighted payout requires bounded lookback (~12 epochs at reference TENURE_DECAY) — deterministic from the same `prev`-chained epoch summaries settlers already consume.
- Per-mint decomposition: no cross-mint join.
- Epochs by block height (EPOCH_BLOCKS). Mint-canonical epoch assignment. `epoch_number = (block_height - genesis_inscription_height) / EPOCH_BLOCKS`. `epoch_start_height(N) = genesis_inscription_height + N × EPOCH_BLOCKS`.
- **Per-mint state commitment** (`balance_root`) = Merkle root over sorted PoolState leaves for live content. Closed per-mint computation — no cross-mint join. Stores verify pool balances; auditors verify custody and arithmetic (exact level-1 verification via `drained/recycled/deposited` fields in PoolState — see State Commitments). **Global state** is an index-layer product (materializer aggregates per-mint balance_roots; deterministic, multiple indexes converge). **Bitcoin anchoring** is mandatory: each epoch's `evidence_root` is anchored via OP_RETURN (`"OCDN"(4B) || genesis_fingerprint(8B) || epoch(4B) || evidence_root(32B) || prev_anchor_txid_prefix(8B)`, ~56 bytes). Any participant can publish; first valid anchor per epoch is canonical. Duplicate anchors are non-conflicting by construction (same inputs → same root). Cost: ~56 sats/epoch. The `prev_anchor_txid_prefix` creates a Bitcoin-native chain link — consecutive anchors verifiable entirely on Bitcoin. See State Commitments: Evidence Layer. Ghost state provable via the hash-chained epoch log (funding_root + sweep_root proofs — see State Commitments: Ghost State).
- Multiple settlers cross-verify via `input_set` convergence tag.
- Mint liveness: offline mints stop earning. Stores and clients reroute after MAX_SILENT_EPOCHS (~24h) of missing summaries. No death penalty — mint resumes on return; reputation reflects the gap.
- All events carry `["v", "1"]` version tag.

---

## The Storage Market

The protocol is a market. Demand side: funders. Supply side: stores. Clearing mechanism: request proofs, store attestations, and settlement. The depth of this market determines protocol health AND founder income.

### Reading is Free; Funding is Advertising

Readers consume at zero cost (PoW-gated). Serve endpoints deliver and earn via the via tag. Stores earn from pools for proven storage of consumed content. Popular content attracts more stores (more per-shard competition) and more funders (visibility drives conviction). The market equilibrates: store depth scales with demand, funding scales with visibility.

### Demand Signal

Pool balance, demand data (epoch summary `demand_root`), and coverage signals are all public. A hash with 100K sats and zero stores on shard 4 is a visible opportunity. Demand signal is reliable by construction — delivery is request-proof-gated, so every read produces a verifiable signal. At scale, demand data flows via epoch summaries (primary) + sampled relay proofs + serve endpoint referrer witnesses (cross-verification), not individual per-read relay events.

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
3. **Mintless**: All mints down — stores still serve via degraded-mode PoW authorization. Content available; real-time settlement suspended. Stores continue self-attesting to relays; clients publish request proofs at rate=1. Settlement inputs accumulate in the public record. **Store patience**: the daemon factors tenure premium (holding through outage → full-weight earning on mint return vs. 33% for newcomers) and retroactive settlement probability into `projected_value_per_byte`. Blobs with strong earnings history retain positive expected value during the gap. Prolonged outage with no mint resurrection signal → eventual eviction → thinning. **Mint resurrection**: any party bonds a new mint, reconstructs state from public relay data, retroactively settles gap epochs, resumes real-time settlement. The gap is bounded by how quickly a new mint appears — design target: <2 hours from bond to operational (see What's Built: `ocdn-mint`). Sats custodied at the dead mint are lost (bounded by deposit splitting); content and its economic history survive.
4. **Last store**: Single point of failure. Index shows warning.
5. **Fossil**: No stores. Bytes gone (see Glossary: Ghost). Economic fossil persists on relays (hash-chained epoch log with `balance_root` + `sweep_root` proofs); Bitcoin anchors by any interested party add permanent durability. Convergent encryption is deterministic — anyone with the original file can re-encrypt and re-upload. `[+] to restore`.
6. **Restored**: Re-fund → anyone with the file re-encrypts (deterministic) → store mirrors shards → earning. No key recovery needed. The gap in the record is permanent and visible.

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
| Flood requests | Static PoW cost floor per proof + per-mint rate limiting (`max_commitments_per_epoch`). Excess proofs dropped before commitment (see #21). |
| Replay requests | Epoch-bound, single use |
| Fake bytes served | response_hash in store attestation must match expected shard hash |
| Forge store attestation | Requires store's private key (Ed25519) + valid bond |
| Front-end redirects store income | **Impossible** — multi-party binding (see §3). Front-end earns only via the via tag. |
| Sybil referrers (fake `via` tags) | L2 uses a constant 3-way split (mint / referrer pool / genesis) — inflating R doesn't change the denominator. Referrer pool subdivided by proof count: sybil referrers dilute their own per-pubkey proof count, earning less than a consolidated honest referrer. Internal remainder → top referrer by proof count, not genesis. |
| Store proxies without storing | Storage challenges (random byte offset + Merkle proof, latency-tested) catch fetch-on-demand. Repeated failure → mint stops interacting → store loses income. |
| Mint takedown to suppress content | Degraded-mode retrieval: stores accept PoW-authorized direct requests when no mint reachable. Discovery via relay-encrypted mappings (Argon2-gated). Content available; settlement suspended. Adversary suppresses economics, not availability. |
| Permanent mint bypass (abuse degraded mode) | Degraded mode activates only when store's own persistent mint connections are down — locally verifiable, unfakeable by serve endpoints. Stores earn nothing in degraded mode (no attestation path). All participants strictly prefer healthy mode: stores (settlement income), serve endpoints (via income), readers (faster, better privacy). No perverse incentive. |
| Sybil receipt inflation | Receipt doesn't credit specific stores — demand signal is diluted across ALL stores for that content. Less profitable than original model. |
| Store identity churn (drop + rejoin as new pubkey to reset tenure) | Tenure maturation period is the cost. At reference TENURE_DECAY = 2/3: churning store forfeits ~67% of income in first epoch, ~46% in second. Break-even requires holding for ~3 epochs (~12h) before churn has any advantage over staying — and staying always earns more. Rapid churn (every 1-2 epochs) earns ~33-54% of stable income. Anti-churn is economic, not identity-based — works under full anonymity. Under challenge-based tenure, the cost is even clearer: a new pubkey starts at tenure=0 and must pass multiple challenge epochs to rebuild weight, regardless of delivery token frequency. |
| Store self-dealing (own request proofs) | **Tolerated — self-dealing is work, not fraud.** Pays real PoW, provides real storage, triggers correct settlement. Cost makes it unprofitable at scale. At small scale, converts sweep to settlement income — a bounded loss. |
| Mint-store collusion (fake storage) | Block-hash-assigned cross-store verification. Colluding mint cannot rig peer assignments. Probability of colluding verifier = C/S per epoch. Over multiple epochs, honest peer is assigned and fake storage is caught. Mint bond at risk; store loses earnings. |
| Mint-store collusion (biased routing) | **Prevented by serve-blinded selection + ZK selection proofs** (#20, #29, #30, #31): Mint commits before learning selection_nonce → cannot compute routing outcome → selective dropping impossible. Challenge-based tenure → honest stores maintain weight regardless of routing frequency. **Per-token cryptographic verification**: ZK selection proof proves correctness to store without revealing content_hash (see Glossary: ZK selection proof). Biased selection produces unsatisfiable circuit — mint cannot generate valid proof. (1) **Client** verifies selection_input commitment + selection formula. (2) **Store** verifies ZK proof per delivery token (or sampled subset via proof-on-demand). (3) **Settler** cross-references routing ex-post. (4) **Store** detects aggregate demand anomalies via `routing_root` + delivery token receipts. Residual: serve+mint collusion pre-commitment at bootstrap (bounded by seed budget); aggregate demand withholding (self-harming, detectable via fulfillment ratio). |
| Mint deposit flight | Fidelity bond + tenure-weighted custody ceiling (see Glossary: Bond). New mints custody little; established mints have too much future income to lose. Deposit splitting bounds per-mint exposure. Ceiling bounds damage by construction; no prosecution needed. |
| Mint fabricates settlement data | **Three-tier detection**: (1) `challenge_root` is independently recomputable from public self-attestation proofs — any mismatch is provable fraud (see State Commitments: Verification Tiers). (2) `balance_root` transitions are exactly verifiable via PoolState fields (`drained/recycled/deposited`); cross-content conservation law catches systematic skimming. (3) `funding_root` cross-verifiable against fund confirmation events on relays. No mint cooperation required for tiers 1-2. |
| Centrality gaming (citation clusters) | PageRank with pool-based teleportation: unfunded nodes inject zero importance. Isolated unfunded clusters have zero importance regardless of edge density. Gaming requires funding multiple nodes — expensive and self-defeating (outgoing edges donate importance to real content). |

### Storage Challenge Protocol

Stores self-attest by publishing storage proofs to relays — no persistent Tor circuit to a specific mint required. The challenge set and nonces are deterministic from public inputs (block-hash-derived), making the entire protocol independently verifiable by any party.

```
Every epoch, for each store:
  challenge_set = {blob_id : H(epoch_hash || store_pubkey || blob_id || "self-attest-v1")
                   mod CHALLENGE_SAMPLE_DENOM == 0}
  nonces are deterministic: nonce_i = H(epoch_hash || store_pubkey || blob_id_i)
  offset per blob: offset_i = nonce_i mod (shard_size - CHALLENGE_WINDOW)
  store publishes SELF_ATTESTATION to relays:
    kind: NIP_SELF_ATTESTATION_KIND
    tags: ["g", genesis_fingerprint], ["epoch", epoch_number], ["epoch_hash", epoch_hash]
    content: [(blob_id_1, bytes_at_offset_1, merkle_proof_1), ...]
    sig: store signature
  anyone verifies:
    challenge_set correctly derived (deterministic from epoch_hash + store_pubkey)
    all blobs in the deterministic set are present (missing blob = failure for that shard)
    merkle_proof valid against known shard_hash (from coverage signals)
    nonce and offset correctly derived

Per-shard failure (missing from self-attestation): lose earnings for that shard this epoch.
Repeated per-shard failure (N consecutive): mint stops interacting for that shard.
```

**Self-attestation eliminates the challenge authority bottleneck**: stores prove storage to the world, not to a specific mint. Any mint, settler, or auditor verifies from relay-published proofs. Persistent Tor circuits between stores and mints remain for attestation submission, mapping registration, and per-blob_id earnings pushes — but are no longer required for challenge/response. A store that publishes valid self-attestations to relays is provably storing data regardless of which mint it interacts with.

**Deterministic nonces** (security improvement from epoch_hash): challenge nonces are derived from `epoch_hash || store_pubkey || blob_id` — deterministic from public inputs. Anyone can independently verify the challenge set is correct. Biased challenges are impossible — nobody controls the inputs (epoch_hash embeds an unpredictable Bitcoin block hash). The store computes its own challenge set without receiving instructions from any party. Wrong epoch_hash (wrong genesis pubkey) → wrong challenge set → proofs rejected by any verifier.

**Challenge sampling rate**: At `CHALLENGE_SAMPLE_DENOM = 10`, stores self-attest ~10% of blobs per epoch. Over 10 epochs (~40h), expected coverage is ~65% of blobs. Over 30 epochs (~5 days), ~96%. The sampling rate balances proof size (a store with 800 blobs publishes ~80 proofs per epoch, ~2-4 KB) against detection speed. Cross-store verification (block-hash-assigned peer checks) supplements self-attestation for the unsampled fraction.

### Cross-Store Verification (block-hash assigned)

Each epoch, `epoch_hash` determines the verification ring — not the mint. The epoch_hash uses the confirmed block at `epoch_start_height - RING_CONFIRM_DEPTH` (6 blocks, ~1h before boundary), making it reorg-proof. Assignment is deterministic from `hash(epoch_hash || store_set)`, unpredictable before the block, and independently verifiable by anyone. Rooted in `protocol_seed` — a participant with a different genesis pubkey computes different ring assignments and cannot cross-verify with honest stores.

```
Epoch E (block hash determines ring):
  Store_A proves shard_3 → Store_B assigned to verify Store_A's response
  Store_B proves shard_7 → Store_C assigned to verify Store_B's response
  Store_C proves shard_12 → Store_A assigned to verify Store_C's response
```

Earning requires BOTH passing your own challenge AND verifying a peer. Verification is **per-store, not per-shard**: one peer, one randomly-sampled shard from the peer's claimed set, per epoch. Store self-attestation is the primary enforcement; cross-store verification catches collusion on the sampled shard. Over many epochs, sampling coverage converges. Block-hash assignment removes the mint from the challenge loop — the mint collects attestations and publishes summaries, but cannot rig verification assignments. Mint-store collusion requires the block-hash-assigned peer verifier to also be colluding. With S total stores and C colluding, probability of drawing a colluding verifier is C/S per epoch — over multiple epochs, an honest verifier is eventually assigned and fake storage is caught. The assignment record is public: if Store B is later shown to lack the shard, Store A's "pass" verdict implicates Store A (mint stops interacting with both).

### Store Confidence Voting

Stores audit mints and publish confidence votes — the bottom-up accountability check on mint behavior. Each epoch, each store is randomly assigned one bonded mint to evaluate:

```
assigned_mint(store, epoch) = bonded_mints[
    H(epoch_hash || store_pubkey || "mint-audit-v1") mod len(bonded_mints)
]
```

Assignment is deterministic (verifiable by anyone), unpredictable (block-hash-derived), and rotating (each store audits a different mint each epoch). Over enough epochs, every store audits every mint.

The store publishes a signed confidence event:

```
kind: NIP_CONFIDENCE_KIND
tags:
  ["g", "<genesis_fingerprint>"]
  ["target", "<bonded_mint_pubkey>"]
  ["epoch", "<epoch_number>"]
  ["epoch_hash", "<epoch_hash>"]
  ["vote", "1" | "-1"]
  ["evidence", "<optional_reference>"]
sig: store signature
```

**Vote weight** = number of self-attestation challenges the store passed this epoch (publicly verifiable from relay-published self-attestation proofs). Sybil stores with no actual storage have zero vote weight. A store holding 800 blobs and passing all self-attestation challenges has weight 800. Stores are anonymous (behind Tor) — mints cannot retaliate. Serve-blinded selection prevents delivery token withholding. Settlement is deterministic — payout manipulation is auditable.

**Mint reputation** = cumulative confidence ratio: `(positive_vote_weight - negative_vote_weight) / total_vote_weight` over a rolling window. Confidence affects deposit routing (reference client weights by reputation), store acquisition decisions (daemon weights by reputation), and competitive exit signals (aggregate confidence trajectory is the reputation signal). The reference client surfaces mint confidence alongside bond tenure and store count.

**Accountability loop**: Mints coordinate (custody, delivery tokens, epoch summaries) → stores audit mints (observe payout accuracy, challenge fairness, epoch summary consistency) → confidence votes adjust reputation → mints that lose confidence lose stores and deposits → competitive exit pressure. No role checks itself. Authority flows down (genesis → mints → stores). Accountability flows up (stores → mints → must maintain confidence). Sybil-voting is bounded by self-attestation weight: accumulating meaningful vote weight requires actually storing data — the cost of influence IS the cost of honest participation.

### Parameter Signaling

Funders and operators publish preferred per-mint parameter values — reputation-weighted, non-binding inputs to market convergence (see Glossary: Parameter signal, Participant reputation, Core Thesis #24).

```
kind: NIP_SIGNAL_KIND
pubkey: participant_pubkey
tags:
  ["g", "<genesis_fingerprint>"]
  ["epoch", "<epoch_number>"]
  ["epoch_hash", "<epoch_hash>"]
  ["role", "funder|store|mint"]
  ["param", "DRAIN_RATE", "<numerator>", "<denominator>"]
  ["param", "SWEEP_EPOCHS", "<value>"]
  ["param", "TENURE_DECAY", "<numerator>", "<denominator>"]
sig: participant signature
```

**Weight computation** (deterministic from public data):

- Funder: active pool balance funded by this pubkey (sats currently at risk, from `funding_root` leaves)
- Store: shard-epochs passed in the last SIGNAL_WINDOW epochs (recent work, from `challenge_root` chain)
- Mint: `bond_value × tenure_factor` (capital × time, from bond UTXO + epoch chain length)

**Community parameter** = weighted median per role. Two independent medians matter: demand-side (funder-weighted) and supply-side (store+mint-weighted). The reference client surfaces both alongside each mint's declared parameters: "This mint's DRAIN_RATE is within X% of the funder median and Y% of the operator median." Mints between both medians attract both deposits and stores. Mints far from either lose one side, then the other.

**Properties**: No quorum (signals always meaningful). No binding outcome (mints can ignore signals and bear market consequences). Continuous (not epoch-gated or proposal-gated). Sybil-resistant by construction (weight requires real sats-at-risk or verified work). Fork-compatible (competing clients can weight signals differently). The natural tension — funders want slow drain, operators want fast drain — resolves at the equilibrium where both sides find the tradeoff acceptable. Signaling makes this equilibrium visible in real-time rather than implicit in deposit/store migration patterns.

**Transition**: At bootstrap, signal weight is too thin to be meaningful — the reference defaults are the Schelling point. As reputation accumulates (months), community medians become statistically significant. The reference implementation tracks the community signal over time: defaults that diverge from mature community medians get updated in subsequent releases. Power shifts from founder defaults to market signals monotonically — no discrete handoff event.

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
| **Demand** | Request proof velocity (epoch summary `demand_root` + sampled relay proofs) | How much people are consuming right now (free reads, PoW-verified, epoch granularity) |
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

Three-layer durability. Store-blind storage (addressing-blind + operator-blind) is the architecture, not an upgrade:

| Layer | Where | Cost | Durability |
|-------|-------|------|------------|
| Relay | Nostr relays (events, metadata — not content) | PoW | Relay-dependent |
| Fragment | Blossom servers (convergent-encrypted shards, blind-addressed) | Sats (pool) | Pool-funded, self-healing |
| Inscribed | Bitcoin blockchain | On-chain fee | Permanent |

Content below MIN_FRAGMENT_SIZE → N=1 shards. Above → RS(K,N). Self-healing: any participant with K shards reconstructs, re-encodes a missing shard (deterministic — convergent encryption + canonical RS), uploads to new store.

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

**Principle**: The product is the READ experience. Reading is free. The economic signal IS the content. The only economic action is `[+]` — a conviction signal, not a consumption toll. Two metabolisms (see thesis 19): ephemeral = free discourse, funded = conviction signal. `[+]` upgrades. 100 sats should feel like a like.

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

Three tiers: the genesis inscription (one hardcoded constant — everything else derived from it), per-mint declared parameters (each mint chooses, market converges via reference defaults), and reference client / operator-set (unchanged).

**Genesis inscription** (the ONE hardcoded value in the codebase):

| Constant | Value | Note |
|----------|-------|------|
| GENESIS_INSCRIPTION | `<inscription_id>` | Bitcoin inscription whose sender = genesis pubkey, whose body = protocol constant set. The one value every binary must agree on. |

**Derived from genesis inscription** (discovered, not hardcoded — cached after first lookup):

| Constant | Source | Note |
|----------|--------|------|
| genesis_pubkey / protocol_seed | Inscription sender | Root of all cryptographic derivations. The protocol's identity. |
| genesis_address | Derived from genesis_pubkey | Settlement remainder + sweep destination. |
| genesis_fingerprint | First 8 bytes of SHA256(genesis_pubkey) | Compact identifier in events + OP_RETURN anchors (product-layer). |
| RS_K | Inscription body | 10. Reconstruction threshold. |
| RS_N | Inscription body | 20. Total storage shards. |
| RS_WASM_HASH | Inscription body | SHA256 of canonical WASM binary. New binary = content-fork. |
| MIN_FRAGMENT_SIZE | Inscription body | 10240 (10 KB). |
| ARGON2_PARAMS | Inscription body | t=3, m=8MB, p=1. Layer 1 mapping KDF. |
| EPOCH_BLOCKS | Inscription body | 24 (~4h). |
| RING_CONFIRM_DEPTH | Inscription body | 6. Reorg-proof. |
| CHALLENGE_SAMPLE_DENOM | Inscription body | 10. Store self-attests ~10% of blobs per epoch via deterministic block-hash-derived challenge set. |
| PRECOMMIT_TTL | Inscription body | 42. Epochs a pre-commitment stays in precommit_root without funding. Same as SWEEP_EPOCHS reference default. |
| EVIDENCE_VERSION | Inscription body | 0x01. ExistenceProof format version. |

**Global invariants** (must match across participants — change = content-fork version bump):

| Constant | Value | Note |
|----------|-------|------|
| CONTENT_KEY_DOMAIN | "ocdn-content-v1" | Content-fork version tag. Convergent encryption key = SHA256(protocol_seed \|\| CONTENT_KEY_DOMAIN \|\| content_hash). Genesis pubkey is permanent across versions; this string is the forkable part. |
| PROTOCOL_VERSION | 1 | All events carry `["v", "1"]` + `["g", "<genesis_fingerprint>"]`. |
| NIP Event Kinds | 1000-9999 range | Non-replaceable. Pool credits are additive. |
| ANCHOR_MAGIC | "OCDN" | 4-byte OP_RETURN prefix for all OCDN Bitcoin inscriptions (epoch anchors, content registrations, edges, appends, batches). |
| INSCRIPTION_VERSION | 0x0 | High nibble of OP_RETURN type byte. Future format changes increment. |
| EDGE_RELATIONS | ref=0, cites=1, contradicts=2, corroborates=3, supersedes=4, replies_to=5, contains=6 | Canonical relation types for edge inscriptions. Extensible — unknown types are valid but uninterpreted by reference implementations. |
| INSCRIPTION_CONFIRM_DEPTH | 6 | Confirmations before an inscription is considered final. Matches RING_CONFIRM_DEPTH. |

**Per-mint declared parameters** (each mint publishes in bond registration event; settlers use declaring mint's values; reference client defaults anchor market convergence):

| Parameter | Reference default | Note |
|-----------|-------------------|------|
| DRAIN_RATE | 1/128 | Per-epoch fraction of mint balance drained. Half-life ≈ 89 epochs (~15 days). Reference default is a Schelling point, not a protocol constant. Mints compete on drain economics — funders and stores select based on disclosed parameters. |
| TENURE_DECAY | 2/3 | Store income maturation curve. `weight = 1 - TENURE_DECAY^tenure`. At 2/3: ~33% at epoch 1, ~91% at epoch 6 (~24h), ~99% at epoch 12 (~48h). Unpaid fraction recycles to pool. Lower values = faster maturation (less churn penalty); higher values = slower maturation (more churn penalty, longer duration extension). |
| SWEEP_EPOCHS | 42 | ~7 days. See Glossary: Sweep. |
| CHALLENGE_INTERVAL | 1 epoch | How often stores self-attest via block-hash-derived challenges. Per-mint parameter governs which epochs this mint verifies self-attestation proofs from its stores. |
| MAX_SILENT_EPOCHS | 6 | ~24h. Missing summaries → stores and clients reroute. |
| MIN_ATTESTATIONS | 1 | Minimum store attestations per shard for settlement validity. |
| MIN_COVERAGE_K | RS_K (10) | Minimum covered shards for request proof acceptance. |
| COVERAGE_BLOCKS | 6 | ~1h. Coverage signal frequency. |
| POW_TARGET_BASE | 2^240 | Anti-spam for request proofs. ~130ms expected / ~1.2s 99th-pct on low-end Android at 50% throttle. Per-mint declared. |
| POW_TARGET_MIN | 2^236 | Protocol floor (hardest allowed). Prevents griefing via unreachable difficulty declarations. |
| POW_TARGET_MAX | 2^244 | Protocol ceiling (easiest allowed). Below this, spam resistance is negligible. |
| POW_SIZE_UNIT | 1048576 (1 MB) | PoW scales with content size. |
| TOKEN_VALIDITY | 1 epoch | Delivery tokens expire at epoch boundary. Single-use, nonce-bound. |
| SERVE_CREDENTIAL_POW | 2^236 | ~3s PoW to register as serve endpoint with this mint. |
| RELAY_SAMPLE_RATE | 100 | 1-in-N request proofs published to relays by clients. Serve endpoints sample independently. At bootstrap: 1 (every proof published). In degraded mode: 1 (forced — sweep prevention). |
| RELAY_JITTER_BLOCKS | EPOCH_BLOCKS / 2 | Max random delay (in blocks, ~2h) before epoch-end sampled proof publication. Timing-correlation resistance. |
| SIGNAL_WINDOW | 42 | Rolling epoch window for store reputation weight in parameter signals. Same as SWEEP_EPOCHS reference default. |

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
| CHALLENGE_CUTOFF | Each mint | Blocks before epoch boundary by which self-attestation proofs must be observed. Protocol bounds: min = 1 block, max = EPOCH_BLOCKS / 2. Tighter cutoff demands better store relay connectivity; generous cutoff is more accessible but has longer settlement lag. |

---

## Interoperability Primitives

Five primitives that two independent implementations must agree on to produce byte-identical outputs. Everything else (Tor, Cashu, relay interaction, ZK proofs, client UX, index computation) is implementation detail that doesn't require cross-implementation agreement. These are specified here as design rationale; the NIP pins byte-level details.

### Canonical Serialization: Borsh

All data entering Merkle trees or settlement arithmetic uses **Borsh** (Binary Object Representation Serializer for Hashing). Borsh was designed by NEAR Protocol specifically for deterministic serialization for hashing — the exact use case. Fixed-size integers are little-endian, structs are concatenated fields in declaration order, strings are length-prefixed (4-byte LE length + UTF-8), arrays are length-prefixed, no ambiguity, no padding, no alignment. Implementations exist in Rust, TypeScript, Python, Go, Java.

The wire protocol remains Nostr JSON (events with kind, tags, content, sig). Borsh is used internally for Merkle leaf construction and state serialization. JSON for humans and relays; Borsh for machines and proofs.

### Merkle Tree: RFC 6962 over Sorted Leaves

All Merkle roots in epoch summaries use **RFC 6962 §2** (Certificate Transparency) tree construction with domain-separated hashing:

```
HASH_LEAF(data)     = SHA-256(0x00 || data)
HASH_NODE(left, right) = SHA-256(0x01 || left || right)
EMPTY_ROOT           = SHA-256("")
```

Leaves are Borsh-serialized structs, sorted lexicographically by their Borsh bytes. Padded to the next power of 2 with canonical empty leaves (`HASH_LEAF(0x00 × 32)`) for fixed-depth proofs and trivial implementations. The sorted requirement is for deterministic construction (same leaf set → same root), not for search. The published leaf data blob is the lookup mechanism; the tree is the integrity mechanism.

Certificate Transparency has operated this construction at planetary scale (billions of entries). Domain separation (0x00 for leaves, 0x01 for internal nodes) prevents leaf/node confusion attacks. No exclusion proofs are specified — absence is verified by downloading the leaf data blob and scanning.

### Integer Arithmetic

All settlement computation is **integer-only**. No floating-point at any stage.

- All amounts in `u64` sats.
- Rates (DRAIN_RATE, TENURE_DECAY) represented as **rationals `(numerator: u64, denominator: u64)`**. DRAIN_RATE = (1, 128). TENURE_DECAY = (2, 3).
- `drain = floor(balance × numerator / denominator)` computed as `(balance as u128 × numerator as u128) / denominator as u128` — u128 intermediate prevents overflow. Result truncated to u64.
- `weight = 1 - TENURE_DECAY^tenure` computed as `weight_num = q^t - p^t; weight_den = q^t` where `(p, q)` is the TENURE_DECAY rational. `payout = floor(unit × weight_num / weight_den)` via u128 intermediate. Exact, no float, overflow-safe up to tenure ~39 in u64 (beyond which weight > 0.9999999 and the store earns full rate).
- All division is truncating integer division (floor for positive values).

This follows **Lightning BOLT-3** conventions for deterministic fee calculation across implementations.

### Epoch Numbering

Deterministic from the genesis inscription and Bitcoin block height:

```
epoch_number(block_height) = (block_height - genesis_inscription_height) / EPOCH_BLOCKS
epoch_start_height(n) = genesis_inscription_height + n × EPOCH_BLOCKS
epoch_hash = SHA256(protocol_seed || block_hash_at(epoch_start_height - RING_CONFIRM_DEPTH) || epoch_number)
```

All participants compute the same epoch_number from the same block height. `genesis_inscription_height` is discoverable from the genesis inscription (the one hardcoded constant). Integer division ensures no fractional epochs.

### Genesis Inscription Encoding

The genesis inscription body is a **Borsh-serialized struct with a version prefix byte**:

```
GenesisBody {
    version:              u8       # 0x01 for v1
    rs_k:                 u16      # reconstruction threshold (10)
    rs_n:                 u16      # total shards (20)
    rs_wasm_hash:         [u8; 32] # SHA256 of canonical RS WASM binary
    min_fragment_size:    u32      # 10240 (10 KB)
    argon2_t:             u32      # time cost (3)
    argon2_m:             u32      # memory cost in KB (8192 = 8 MB)
    argon2_p:             u8       # parallelism (1)
    epoch_blocks:         u16      # 24 (~4h)
    ring_confirm_depth:   u8       # 6
    challenge_sample_denom: u8     # 10
}
```

The inscription sender's pubkey = `genesis_pubkey` = `protocol_seed`. The body is compact (~83 bytes), unambiguous, and parseable by any implementation that knows the Borsh schema. The inscription is write-once and permanent — the encoding doesn't need to evolve.

### Canonical Tag Ordering for Epoch Summaries

Epoch summary events use a **fixed tag order** to ensure deterministic Nostr event IDs (which form the hash chain). The NIP specifies the exact order; tags not present in a given epoch (e.g., `sweep_root` when no sweeps occurred) are omitted entirely. Implementations MUST serialize tags in the specified order.

---

## Bitcoin Inscription Layer

Optional, per-content Bitcoin registration via OP_RETURN (≤80 bytes). The inscription is the content's permanent birth certificate; the OCDN protocol is the resolution layer. Registration and hosting are decoupled — different operations, different parties, different times. The genesis inscription (witness-data, one-time, larger) is a separate artifact; all subsequent OCDN inscriptions use the OP_RETURN format below.

### OP_RETURN Format

All OCDN inscriptions share a 13-byte header:

```
OP_RETURN (≤80 bytes):
  [0:4]    "OCDN"                 4B   magic
  [4]      version | type         1B   high nibble: version (0x0), low nibble: type
  [5:13]   genesis_fingerprint    8B   instance binding
  [13:80]  payload               ≤67B  type-specific
```

Five types:

| Type | Nibble | Payload | Total | Producer |
|------|--------|---------|-------|----------|
| Epoch anchor | 0x0 | epoch_number(4) + evidence_root(32) + prev_anchor_prefix(8) | 57B | Settler |
| Register | 0x1 | content_hash(32) + flags(1) + resolution_hint(≤34) | ≤80B | Content creator |
| Edge | 0x2 | source_hash(32) + target_hash(32) + relation(1) + weight(2) | 80B | Anyone |
| Append | 0x3 | target_hash(32) + append_type(1) + data(≤34) | ≤80B | Anyone |
| Batch | 0x4 | batch_root(32) + batch_count(4) | 49B | Batching service |

### Register (type 0x1)

```
 [13:45]   content_hash          32B
 [45]      flags                  1B
             bit 0:   self-contained (remaining bytes ARE the content)
             bit 1:   has resolution hint
             bit 2-4: content_type (0=text, 1=doc, 2=topic, 3=list)
             bit 5-7: hint_type (0=ocdn, 1=https, 2=nostr, 3=ipfs, 4=txid)
 [46:80]   resolution_hint       34B
```

Self-contained: ≤34 bytes of UTF-8 text. `content_hash = SHA256(text_bytes)`. Verifiable from Bitcoin alone. Resolution hint: pointer into OCDN, a URL, a Nostr event ID, an IPFS CID, or another Bitcoin txid. Any resolver that can serve the matching bytes works — the hash is the universal key.

### Edge (type 0x2)

```
 [13:45]   source_hash           32B
 [45:77]   target_hash           32B
 [77]      relation               1B
             0x00=ref  0x01=cites  0x02=contradicts  0x03=corroborates
             0x04=supersedes  0x05=replies_to  0x06=contains
 [78:80]   weight                 2B   big-endian u16 (0-65535 → 0.0-1.0)
```

Implicitly registers source_hash on Bitcoin. A reply inscription simultaneously registers the reply and links it to the parent. The citation graph is computable from edge inscriptions alone.

### Append (type 0x3)

```
 [13:45]   target_hash           32B
 [45]      append_type            1B
             0x00=raw  0x01=tag  0x02=numeric  0x03=hash-ref  0x04=key-value
 [46:80]   data                  34B
```

Permissionless annotation: 34 bytes of typed data attached to any content_hash. Anyone can annotate anything — the graph is append-only.

### Resolution Hierarchy

Every content_hash resolves through the best available layer:

```
Self-contained (34B in inscription) → Bitcoin txid-chain → OCDN protocol → Nostr relays → Clearnet URL
```

Each layer is independently useful. No layer requires any other. Hash verification at every layer ensures integrity regardless of source. The inscription's hint_type is the creator's preference, not a constraint.

### Three Durability Tiers

| Tier | Where | Cost | Evidence |
|------|-------|------|----------|
| Ephemeral | Nostr relays | PoW | Relay-dependent |
| Funded | OCDN pool (stores + mints) | Sats (pool deposit) | Epoch evidence_root (settler-anchored) |
| Inscribed | Bitcoin OP_RETURN | Miner fee | Self-contained on Bitcoin |

`[+]` upgrades ephemeral → funded. Inscription upgrades funded → inscribed. For inscribed content, the pre-commitment event type is unnecessary — the inscription IS the Bitcoin timestamp. Existence proofs simplify to the OP_RETURN transaction itself for direct inscriptions.

### Privacy

OP_RETURN inscriptions are cleartext on Bitcoin: content_hash, citation graph, genesis_fingerprint. An adversary scanning Bitcoin can enumerate all registrations and map the graph. The inscription reveals *what* but not *who* — creator identity is a chain-analysis problem. Mitigations: batching services (service's UTXO, not user's), coinjoin before inscribing, ephemeral funding keys. Inscription durability trades against creator privacy — the user chooses.

### Inscription Discovery

Participants scan Bitcoin for OP_RETURNs with `"OCDN"` magic, filter by genesis_fingerprint. Serve endpoints and index operators are the natural scanners (aligned: more inscribed content = richer index = more via income). At scale, dedicated inscription indexers emerge (analogous to Ordinals indexers). The OCDN protocol functions without inscriptions — they are an optional durability layer.

---

## Batching Service

Permissionless operator that amortizes inscription cost via Merkle batching. Not a protocol role — a service built on protocol primitives. Anyone can run one. Competition discovers fair prices.

### Lifecycle

```
COLLECT → CLOSE → BUILD → PUBLISH → PROVE
```

**COLLECT**: Service accepts typed items (register, edge, append) from users. Users pay per-item via Lightning. Service issues signed submission receipt per item.

**CLOSE**: At batch boundary (time threshold, count threshold, or whichever first). Market determines cadence — express (next block), standard (~100 min), economy (next epoch).

**BUILD**: Borsh-serialize each leaf, sort lexicographically, build RFC 6962 Merkle tree. Identical construction to every other Merkle tree in the protocol.

**PUBLISH**: (1) Leaf data blob → Blossom/relays. (2) Bitcoin transaction with batch OP_RETURN (type 0x4: batch_root + batch_count, 49 bytes).

**PROVE**: After confirmation, service generates per-item inclusion proofs:

```
BatchInclusionProof {
    leaf_bytes:     Vec<u8>         # full Borsh-serialized leaf
    leaf_index:     u32             # position in sorted tree
    merkle_path:    Vec<[u8; 32]>   # sibling hashes, root-ward
    batch_root:     [u8; 32]
    batch_txid:     [u8; 32]
    block_height:   u32
}
```

~459 bytes at N=1000. Portable, self-contained, verifiable with Bitcoin headers + SHA-256.

### Accountability: Poke Mechanic

The batch OP_RETURN on Bitcoin is the permanent, irrevocable claim. The leaf data blob is the ongoing obligation. The poke makes the gap between claim and proof visible and attributable.

**Running checkpoints**: During the batch window, the service publishes incremental Merkle commitments to relays — signed, timestamped claims: "I have received these items as of this moment." Checkpoints are the proactive accountability mechanism.

**Poke**: Anyone can verify any batch at any time:

1. Fetch leaf data blob for the batch
2. Rebuild Merkle tree, verify root matches on-chain OP_RETURN
3. If leaf data unavailable → reputation failure
4. If root mismatch → provable fraud
5. If a checkpointed item is missing from the final batch → provable censorship (checkpoint + final batch is self-contained evidence)

**Poke result**: Signed Nostr event (`NIP_BATCH_AUDIT`) with batch_txid, service pubkey, result (`verified|unavailable|mismatch|censored`), evidence references. Multiple independent auditors converging = high-confidence signal.

**Why unpaid works**: No direct poke reward. Indirect incentives: users want their proofs, competitors want to damage rivals, index operators want complete data. The poke is economically inert; it moves reputation, not sats.

**Reputation**: Ratio of verifiable batches to total batches, weighted by recency. Published via signed events. Ephemeral service, durable reputation.

### Leaf Data Availability

Not guaranteed by the protocol. Made costly to lose via reputation.

| Inscription path | Durability under data loss | Cost |
|-----------------|---------------------------|------|
| Direct OP_RETURN | Survives everything (self-contained on Bitcoin) | Full transaction fee |
| Batched + proof cached | Survives leaf data loss (proof is self-contained) | Amortized fee + user caches ~459B proof |
| Batched + proof not cached | Degrades if leaf data lost | Amortized fee only |

Users who want maximum durability inscribe directly or cache their inclusion proofs. The protocol makes unreliability visible; the market punishes it.

### Fee Discovery

Bitcoin fee variance is absorbed by the batching service, not the user. Services compete on price, latency, reliability, and proof delivery. No protocol-specified fee schedule. The batch format and poke mechanic are protocol; pricing and timing are market.

---

## Upgrade Model

Two upgrade mechanisms for two kinds of change. Neither requires founder authority, endorsement events, or coordination with anonymous operators. The reference implementation IS the governance — the code speaks, adoption follows market incentives.

### Structural Upgrades: Content-Fork

Global invariants (RS params, WASM binary, encryption domain, Argon2 params) change via content-fork. New CONTENT_KEY_DOMAIN = new content namespace. The genesis pubkey (protocol_seed) is **permanent across content-forks** — cryptographically enforced, not by convention. v1: `SHA256(protocol_seed || "ocdn-content-v1" || content_hash)`. v2: `SHA256(protocol_seed || "ocdn-content-v2" || content_hash)`. Same protocol identity, different content namespace. v1 and v2 operate in parallel on the same relay/mint/store infrastructure. Old content drains under old rules until pools sweep. New content accumulates under new rules. No migration, no flag day.

**Propagation**: The reference client starts funding new content under the latest version by default. Stores and mints that don't upgrade keep earning from old-version pools until sweep, then have economic incentive to upgrade. The upgrade propagates through economic gravity, not authority.

**Revenue-generating**: Content-fork means important content gets re-uploaded and re-funded under the new version. New deposits, new settlement, new genesis income. The founder is incentivized to ship better versions. The market is incentivized to adopt them.

**Frequency**: Extremely rare — ideally never after v1 stabilizes. Encoding and encryption are the kind of things you get right once and freeze.

### Economic Upgrades: Per-Mint Declared Parameters

Economic parameters (DRAIN_RATE, SWEEP_EPOCHS, challenge intervals, etc.) are per-mint declared. Each mint publishes its parameter set in its bond registration event. Settlers compute per-mint settlement using that mint's declared values. Deterministic — same declared params + same epoch summary = same settlement.

**Convergence**: The reference client sorts mints by proximity to reference defaults at bootstrap and by proximity to reputation-weighted community parameter medians at maturity (see Parameter Signaling). Funders see parameter implications at deposit time ("estimated pool duration: ~15 days"). Mints near the convergence target attract more deposits. Mints far from it serve niches or attract nothing. The Schelling point evolves: founder defaults → community medians → market equilibrium.

**Verification**: Fund confirmations (public) + epoch summaries (public) + declared parameters → expected drain and payouts are independently computable by any settler or store. Competitive exit handles discrepancies. No new trust assumption.

**Self-correcting**: If the reference default DRAIN_RATE is wrong, mints that declare better rates attract more deposits. The reference implementation can update its defaults in the next release — no protocol change, no content-fork, just a new Schelling point.

### What the Founder Actually Does

1. Publishes reference implementations (open source, forkable, but the founder's repo is the coordination point by convention).
2. Sets reference defaults at bootstrap (not enforced, just defaults — the initial Schelling point). Updates defaults to track reputation-weighted community parameter medians as signal matures.
3. Signs nothing. Operates nothing. Endorses nothing explicitly.

### Moat Properties

- **Genesis pubkey spans all versions and all parameter sets — cryptographically.** Content-fork from v1 to v2 uses the same protocol_seed. A mint with DRAIN_RATE=1/64 uses the same settlement formula with the same genesis remainder. A fork that changes the genesis pubkey creates a mathematically incompatible protocol (see Glossary: Economic moat, layer (a)).
- **The OP_RETURN chain is monotonically accumulating.** Any party can anchor genesis-fingerprinted state roots on Bitcoin for their own benefit (serve endpoints, index operators, institutions, founder at bootstrap). After N anchored epochs, the honest protocol has N entries of unforgeable history. A fork starts at 0. Multiple parties anchoring the same epoch produce identical roots — non-conflicting by construction, gap-tolerant by design.
- **The Schelling point is harder to attack than an authority.** You can't "override" a default — you can only out-compete it by bootstrapping a whole alternative ecosystem.
- **Encoding upgrades generate revenue.** Re-upload + re-fund under new version = new market activity = more settlement = more genesis income.

---

## MVP Build Order

### Phase 1: Prior Work (Complete)

File layer, L402, node kit, receipt SDK, pin contracts. Cryptographic primitives carry forward.

### Phase 2: Build Four Artifacts

The client validates the thesis. The storage market captures value from the thesis. Build the client first — if nobody funds contested claims through it, the storage market is moot. All four ship in MVP, but priority is: client → spec → settle → store.

1. **Static client SPA + OG endpoint** — No backend. Stateless (see Human Interface: Stateless Client). Via tag = FOUNDER_VIA_PUBKEY. Funding via NWC/Cashu through DEFAULT_MINT, split across DEPOSIT_SPLIT_MIN mints. Deploy to IPFS + domain + self-host via `ocdn-pack`. OG endpoint as Cloudflare Worker. `/earn` route for operator recruitment. **This is the founder's primary income-generating asset** — every request proof earns referrer income. First-mover links and OG cards compound the social moat. **Shelf life**: IPFS SPA breaks within 6-18 months; domain version is updatable. Genesis income survives client competition; referrer income doesn't.
2. **Protocol spec (NIP)** — Four event types (see §1-4) + evidence layer events (funding receipt, pre-commitment, existence proof, ghost dossier), bonded mints, settlement rule, mandatory Bitcoin anchoring, ExistenceProof Borsh schema, global invariants, per-mint parameter schema. Short enough to read in 20 minutes. Structural upgrades via content-fork (see Upgrade Model); economic parameters are per-mint declared.
3. **`ocdn-settle` binary** — Deterministic CLI (single static binary). Input: relay URL(s) + mint epoch summaries + `GENESIS_INSCRIPTION` (derives genesis_pubkey → genesis_address + all protocol parameters). Output: settlement events published to relays + mandatory Bitcoin anchor (OP_RETURN with `evidence_root`, ~56 bytes) + batch existence proofs for all live content (published to Blossom). Content-hash the binary, publish the hash. Ships with `ocdn-proof` CLI (~200 lines: generate/verify portable ExistenceProofs against Bitcoin headers).
4. **`ocdn-store` daemon** — Docker container bundling Tor. Binds .onion address on first run (key persists in volume). Watches coverage signals, stores shards, registers mappings via anonymous transport, responds to challenges, attests to mint, cross-verifies peers, earns Cashu ecash tokens (blind-signed, redeemable anywhere). Zero editorial decisions. `docker run ocdn-store`. Operator identity never leaves the container. Earnings accumulate as bearer token files in the volume; `ocdn-store cashout` sweeps to Lightning. Laptop-viable: zero cost basis, graceful sleep/wake, earns when online.

### Phase 2b: Bootstrap Mint (founder-operated, temporary)

The founder operates a bonded mint behind Tor for the bootstrap window. **This is the irreducible bootstrap cost if no partner mint is recruited before launch.** The mint runs `ocdn-mint` (Docker container bundling Tor, like `ocdn-store`) and requires:
- Cashu library for HTLC-gated inbound deposits + blind-signed store payouts (all over Tor)
- .onion address for store attestation submission + deposit acceptance (no clearnet endpoint)
- On-chain bond UTXO (~500K sats, funded anonymously via coinjoin, Taproot P2TR — recoverable when shut down)
- Relay WebSocket connections (outbound, over Tor) for fund confirmations, epoch summaries, coverage signals, encrypted mapping backups

Budget 2-3 days integration beyond core protocol logic. The mint is a Cashu-connected Tor hidden service, not a clearnet Lightning node. **Bootstrap-from-relays is a launch requirement**: `ocdn-mint --bootstrap-from-relays` must reconstruct full state from public data in <2h. This is the mint-resurrection capability that makes the store layer durable against mint takedown (see Unresolved #37). **Exit criterion**: one independent mint bonds and accepts deposits. The founder's mint shuts down; the founder's seed funding already routed through the partner mint gives it immediate coordination share income.

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
- Parameter signals from participants with non-trivial reputation weight (community medians computable)

At this point, every role is performed by someone other than the founder. The genesis address continues receiving remainders. **The founder shuts down any infrastructure they personally operated.** Reference implementation defaults begin tracking community parameter medians where signal weight is statistically meaningful.

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
| Reference defaults track community medians | Parameter signal weight statistically meaningful |

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

Two-layer defense: relay reveals content→address (Argon2-gated), anonymous transport hides address→operator. **Residual**: mapping staleness, Argon2 WASM tuning.

### 2. ~~Bond Slash Enforcement~~ RESOLVED → Competitive Exit

Fidelity bonds + competitive exit (#13). **Residual**: sybil mint spam, `tenure_factor` calibration, bootstrap single-mint window.

### 3. Cross-Store Verification Ring at Low S

Verification ring requires S ≥ 3 for minimal independence. At S=1: no peer. At S=2: mutual verification (trivially collusive). **Fallback**: mint-only challenges below S=3. The cross-store ring is a strengthening, not the foundation — the mint already challenges every epoch. Explicitly state the weaker security property at low S.

### 4. ~~WASM Binary Governance~~ RESOLVED → Content-Fork

New WASM binary = new CONTENT_KEY_DOMAIN = content-fork. Parallel operation, natural sunset via sweep. **Residual**: get v1 right and freeze.

### 5. ~~Epoch Summary Detail vs. Store Privacy~~ RESOLVED → Stratified Commitments

Attestation detail (content→store mapping) is mint-held, not published to relays — preserves store-blindness. Balance leaves, funding leaves, and referrer leaves are published (no store info). Challenge leaves use blob_ids (not content_hashes) and are independently recomputable from public self-attestation proofs. Three verification tiers (level-1 public, level-2 store-local, level-3 mint-cooperative) provide complete audit coverage without exposing private data. See State Commitments.

### 6. ~~Lightning Payout Failure Handling~~ RESOLVED

Cashu ecash payout. Eliminates routing failures, timing correlation, payment-layer deanonymization.

### 7. ~~DRAIN_RATE Calibration~~ RESOLVED → Per-Mint Declared

Per-mint declared parameter. Market converges via Schelling point. **Residual**: reference default 1/128 is a napkin estimate.

### 8. ~~Sweep Trigger Calibration~~ RESOLVED → Binary Condition

Binary condition: no valid attestations AND no valid request proofs for SWEEP_EPOCHS → sweep. PoW-weighted threshold dropped — keeping a pool alive via valid request proofs IS demand (costs ongoing PoW, benefits only content supporters). See Glossary: Sweep, §4 pseudocode.

### 9. ~~M Key Lifecycle~~ RESOLVED → M Removed

The per-content mint encryption layer (M) has been removed from the protocol. Convergent encryption + blind addressing + anonymous transport provide the security model. No per-content secret, no threshold sharing, no relay escrow of keys, no key envelope.

**Security model without M**: Store-blindness is operational, not cryptographic — the standard is what the daemon learns during normal operation, not what a determined operator could compute. Two independent layers: (1) addressing-blind — blob_ids are random, the content_hash→blob_id mapping is mint-held, the daemon never computes or stores the reverse mapping; an adversary needs to compromise a mint OR perform deliberate deanonymization work against public data to learn the mapping. (2) operator-blind — anonymous transport hides who operates the store; an adversary needs to compromise Tor to identify operators. Neither gives the other. The convergent encryption layer remains (shards are ciphertext at rest), but the key is derivable from content_hash + protocol_seed — a verification property, not a secrecy property. **Confirmation limitation**: convergent encryption is deterministic, so content identity is confirmable by anyone willing to compute — inherent to any scheme that enables trustless verification and deduplication. The legal standard (actual knowledge during normal operation) is unaffected. This is the Tahoe-LAFS model: operational ignorance, not cryptographic impossibility. Strictly stronger than BitTorrent, Tor exit nodes, and CDN operators — all of which expose plaintext and have survived decades of legal challenge.

**What M protected and why it's not worth the cost**: M's value was the decorrelation between "who knows the mapping" (a compromised mint) and "who can derive decryption keys." With M, a mapping leak didn't yield decryption. Without M, a mapping leak + content_hash → convergent key → decryption. But: (a) in v1, every mint had M via gossip, so a compromised mint already had both — M provided zero additional protection in the shipping version. (b) Threshold M (Phase 2a) would have required per-content committees of up to 15 mints, Shamir+Feldman VSS, proactive secret sharing with leaderless convergence via relay events (~550 MB/mint/epoch at 1M content), 4 GiB Argon2 emergency blobs, and lazy re-onboarding on key rotation — enormous complexity for defense-in-depth atop Tor. (c) The mandatory relay escrow (for degraded-mode availability) undermined threshold secrecy: any party with content_hash could recover M via Argon2 computation, bounded only by KDF cost, not by the threshold. The Argon2 gate was the binding security constraint, not the T-of-N sharing. (d) From the user's perspective (trust-minimization), M added trust requirements — trust in mint M custody, threshold committee behavior, relay escrow durability, PSS convergence — that didn't improve the user's core outcomes (durability, availability, censorship resistance). The trust-minimized model has fewer assumptions and every user-facing property is enforced by math or economics, not by anonymous operators' key management.

**Node-level privacy as optional configuration**: Store operators who want enhanced content-blindness (e.g., hostile jurisdiction) can add local encryption-at-rest as a daemon configuration — a `--encrypt-at-rest` flag, not a protocol feature. Serve endpoints that want to offer reader privacy can add per-request ephemeral wrapping as a product feature. These are node-level operational choices, not protocol mandates. The protocol is minimal; nodes compete on features.

**Ghost → Restored path (improvement)**: Without M, anyone with the original file can restore ghost content: convergent-encrypt (deterministic key), RS-encode (canonical WASM), upload to a mint, fund the pool. No key recovery needed, no emergency Argon2, no relay escrow lookup. Recovery requires only: the file + bitcoin.

### 10. ~~Mint Upload Bandwidth~~ RESOLVED → Simplified Without M

Without M, the mint doesn't re-encrypt shards — it receives convergent-encrypted shards from the client, verifies integrity (decrypt, reconstruct, SHA256 check), and distributes verified shards to initial stores. Mint bandwidth: ~K shards inbound for verification + ~N shards outbound to stores. No re-encryption step. For a 100MB document: ~50MB inbound + ~100MB outbound to stores. The compute cost is negligible (~100ms verification). **Residual**: bandwidth is the binding constraint; at high upload volume, client-direct-upload (mint authorizes, client distributes to stores) could further reduce mint bandwidth to verification-only.

### 11. RS WASM Verification Oracle

Ship a second independent RS implementation (different language, different author) as a spot-check verifier alongside the canonical WASM binary. The verifier runs in background: randomly samples N% of encode/decode outputs and compares against the canonical binary. Agreement = high confidence. Disagreement = red alert, halt. The second implementation is never used for production — it's a canary. Reference client (reader side) can decode with both and verify plaintext agreement. Does not eliminate the WASM governance problem (#4) but catches silent corruption before data loss.

### 12. Anonymous Transport Considerations

Stores default to Tor hidden services. Protocol specifies opaque addresses, not transport. **Residual concerns**:

(i) **Sybil stores under anonymity**: one operator, many .onion addresses, same machine, one disk copy served from all. All pass challenges (shared disk). Coverage signals report false redundancy. Economic self-limiting (sybil storage is unprofitable at scale — N× addresses for 1/(N+1) per-store income per shard). Detection heuristic: correlated response latency across addresses. Not provable, but mints can weight reputation. Real geographic diversity has natural economic advantage — correlated failure (one machine) means correlated income loss.

(ii) **Challenge latency**: Tor adds ~1-3s per connection. Challenge response window T must accommodate. At CHALLENGE_INTERVAL = 1 epoch (4h), generous T (30-60s) is fine. Shard delivery latency absorbed by serve endpoint caching — hot content never touches the Tor path.

(iii) **Tor as single transport dependency**: Tor-level disruption (protocol vulnerability, state-level blocking) takes down the anonymous store layer. **Mitigation**: protocol specifies opaque address, not `.onion` specifically. Reference daemon defaults to Tor; operators can substitute I2P or clearnet (accepting identification risk). Multiple transports can coexist — market prices the privacy/performance tradeoff.

(iv) **Bandwidth ceiling**: Tor hidden services cap ~1-5 MB/s. Fine for small shards (text) and adequate for document shards (~100KB-5MB). The serve endpoint is the performance layer (clearnet, caching); the store is the durability layer (anonymous, slower). The separation is already in the design — anonymous transport makes it explicit.

### 13. ~~Competitive Exit Model~~ RESOLVED

Fraud proofs replaced by competitive exit + attestation Merkle root (`attestation_root` in epoch summary). Don't punish bad miners, reward good ones. Stores verify Merkle inclusion + compute expected payouts from public data; anomaly → reroute. Four reputation signals: (a) Merkle inclusion, (b) store count trajectory, (c) epoch chain integrity, (d) bond tenure. Store confidence voting (see Verification System) adds a fifth, bottom-up signal. See Bonded Mint Operators, Settlement §4. **Residual**: bootstrap requires ≥2 mints; subtle underpayment below detection threshold is bounded.

### 14. ~~Delivery Token Throughput Over Tor~~ RESOLVED → Degraded-Mode Retrieval

Throughput: persistent Tor connections + batch RPC. Availability: delivery token decomposes into authorization (PoW, redundant) + mediation (mint-liveness-dependent). Degraded mode: stores accept PoW-authorized direct requests when all mints down; discovery via relay-encrypted mappings. Structurally worse for all participants → no perverse incentive. **Residual**: degraded-mode abuse surface (PoW-only rate limiting). Store eviction timeline during prolonged outage addressed by survival economics: tenure premium on resumption + retroactive gap settlement make patience rational (see Glossary: Degraded-mode retrieval, Unresolved #37).

### 15. ~~Deposit Atomicity~~ RESOLVED → HTLC-Gated Cashu

HTLC-gated deposits: ecash locked to preimage; fund confirmation MUST contain preimage to settle; funder reclaims on timeout. Atomic. **Residual**: HTLC timeout (~30-60s for Tor + relay propagation), preimage derivation scheme specification.

### 16. Bond UTXO Chain Analysis

Bond is a Bitcoin UTXO. Chain analysis can trace funding inputs. With Taproot (P2TR), the UTXO is indistinguishable from any normal output on-chain — time-lock script hidden in script tree, proven off-chain in relay registration event. But amount (~500K sats) and creation timing correlate with registration. **Mitigations**: coinjoin bond funding, common UTXO amounts, delay between UTXO creation and relay registration. `ocdn-mint` daemon should include bond-creation tooling guiding operators through anonymous funding. This is operational security, not protocol design — the protocol can't enforce anonymous bond creation, only make it possible.

### 17. Mint Key Rotation Under Anonymity

Anonymous mint reputation = pubkey's track record (epoch chain, store retention, bond tenure). Key compromise forces rotation: new pubkey, zero tenure, zero track record. No identity to carry social reputation across keys. **Partial mitigation**: old key signs handoff endorsement of new key (`KeyHandoff` relay event: old_pubkey, new_pubkey, handoff_epoch, signature_old — 132 bytes, write-once). New key still starts at zero tenure. Real answer: aggressive key protection (HSM, air-gapped signing) — the cost of key loss is high by design, the price of anonymity.

### 18. ~~Request Proof Relay Volume at Scale~~ RESOLVED → Epoch Proof Digests + Sampled Relay Anchoring

Epoch summaries commit demand data via three Merkle roots (`demand_root`, `proof_root`, `referrer_root`). Serve endpoints are the primary demand witnesses: they publish sampled request proofs and per-epoch referrer witness events to their relays (structural incentive — via-tag income depends on correct referrer accounting). Clients may self-publish at `1/RELAY_SAMPLE_RATE` with epoch-boundary jitter; in degraded mode, rate = 1 (sweep prevention). The mint commits `proof_root` at epoch boundary before knowing which proofs will be sampled — commitment-before-sampling makes spot-checks a genuine probabilistic audit. Settlers query mints for `referrer_root` leaves, verify against committed root. At `RELAY_SAMPLE_RATE = 100`: 10M reads/day → ~100K relay events/day (100× reduction). At bootstrap: `RELAY_SAMPLE_RATE = 1` (identical to pre-scale behavior). See §3 consumption flow step 9, Epoch Summary, Constants.

### 19. Serve Endpoint Traffic Analysis at Bootstrap

During bootstrap (1-2 serve endpoints), the mandatory proxy is a traffic analysis chokepoint. A single dominant serve endpoint can correlate inbound request proof timing with outbound store contacts, deanonymizing which stores serve which content despite delivery token indirection. The "many competing serve endpoints" mitigation doesn't apply until the ecosystem matures. **Partial mitigations**: (i) serve endpoint batches outbound store fetches with random delay (degrades latency), (ii) pre-fetching popular shards into serve cache (reduces store contact frequency), (iii) mint pre-issues delivery token batches (decouples request timing from store contact). None fully close the gap at S_serve=1. The bootstrap threat model should state this honestly: serve endpoint traffic analysis is the weakest privacy link until multiple competing serve endpoints exist.

### 20. ~~Store Selection Verification Under Store-Blindness~~ RESOLVED → ZK Selection Proofs

**The information-theoretic constraint is real**: content-hash blindness prevents stores from recomputing the selection formula. **But it is not absolute**: ZK proofs let the mint prove selection correctness to the store without revealing content_hash or any relay-correlatable intermediate value.

**Why ZK is necessary (not just convenient)**: any deterministic function of content_hash given to the store in the clear — including epoch-bound one-way derivations — is brute-forceable against public relay data. Request proofs on relays contain content_hash; the search space is thousands of hashes, not 2^256. A store running slightly modified software can automatically identify every blob_id by iterating relay events and computing candidate derivations. This breaks addressing-blindness at near-zero cost — categorically worse than the convergent-encryption limitation (which requires possessing the actual content + protocol participation). Non-ZK intermediate-value approaches fail because relay correlation generalizes to any content_hash-derived value the store holds in the clear.

**Resolution**: Halo2/KZG ZK selection proofs. The mint generates a proof per delivery token (or on demand for sampled tokens) proving that the selection was correctly computed from committed public roots, without revealing content_hash, selection_input, shard_index, request_proof_hash, or selection_nonce to the store. Biased selection produces an unsatisfiable circuit — the mint provably cannot generate a valid proof for an incorrect selection. See Glossary: ZK selection proof, Delivery token.

**Phased deployment**: (A) Commit `selection_input_root` in epoch summaries; client-auditable, stores benefit indirectly. (B) Proof-on-demand: stores request ZK proofs for sampled delivery tokens; mint proves on request. (C) Optional: proofs attached to all delivery tokens when mint compute allows. Phase A provides value immediately; Phase B gives stores cryptographic per-token verification. No flag day — stores that don't verify continue operating.

**Residual**: (i) Aggregate demand withholding (mint refuses to process valid requests) — self-harming (reduces mint settlement income), detectable via fulfillment ratio. (ii) Newly deposited content has no committed selection_input until the next epoch summary (~4h window) — client verification covers this gap. (iii) ZK circuit governance: verification key is a protocol constant, circuit upgrade = new key (soft upgrade, no content-fork). (iv) Serve+mint collusion pre-commitment at bootstrap (#31 residual, bounded by seed budget).

### 21. ~~PoW Difficulty Adaptation~~ RESOLVED → Static Per-Mint + Rate Limiting

Static difficulty (per-mint declared) + per-mint rate limiting (`max_commitments_per_epoch`). Adaptive difficulty rejected: gaming vector (pricing out mobile readers) is worse than the sybil attack it prevents. PoW sets cost floor (anti-spam); rate limiting sets capacity ceiling. Drain is gate-triggered, not count-triggered — PoW difficulty has zero effect on settlement. Mobile budget at `2^240`: ~1.2s at 99th percentile on low-end Android. Protocol bounds: `POW_TARGET_MIN = 2^236`, `POW_TARGET_MAX = 2^244`.

### 22. Tenure-Weighted Payout Considerations

(i) **Bootstrap cold start**: ~33% first-epoch income at reference TENURE_DECAY=2/3; ramp to 91% in ~24h. Recycled income from maturation extends pool life, buying time for stable stores. (ii) **Mint tenure tracking**: O(stores × shards) small integers per epoch — trivial. Settlers verify via `challenge_root` bounded lookback. (iii) **TENURE_DECAY calibration**: per-mint declared; market converges via competitive deposit routing.

### 23. Shard Acquisition Stampede at Bootstrap

Many stores deploy simultaneously, all targeting the same undercovered seeded content. **Mitigations**: (i) jittered acquisition (random 0-30m delay), (ii) mint-side rate limiting (cap replication tokens per shard per epoch), (iii) source diversification (exponential fanout across acquiring stores), (iv) pre-seeded shards (founder pre-distributes to S_s=3-5 before launch).

### 24. Cold Start Timeline and Bootstrap Earnings

Time-to-first-earning: ~4h (one epoch). Near-full rate: ~24h (tenure ramp to 91%). At bootstrap ~150K sats seeded: ~1,172 sats/epoch total drain, single store covering all 25 items earns ~175 sats/epoch (~$0.50-1.50/day at 33% first-epoch tenure). `/earn` page must be honest: early operators subsidize launch; pool half-life ~15 days without new deposits. The daemon should surface portfolio sustainability projections.

### 25. DNS/Domain as Bootstrap Single Point of Failure

The reference client deploys to "IPFS + domain + .onion + OCDN-hosted." Domain seizure is the cheapest, most proven state-actor censorship vector. **Primary mitigations**: (i) **Bitcoin-inscribed client build hash** — `SHA256(client_build)` inscribed on Bitcoin at each release (~2,500 sats). Any copy from any source is verifiable against the inscription. Tampered builds fail. No trust in distribution channel required. (ii) **Client as OCDN content** — fund a pool for the client's hash. Stores host it. The protocol hosts its own means of access (bootstrap paradox: first copy from outside, subsequent from protocol). (iii) **Multi-channel distribution** — .onion, IPFS, Nostr relay events, self-hosted mirrors, all verifiable against the same inscription. (iv) Tor .onion for the client (no DNS dependency). **The OG image endpoint** (viral loop) genuinely requires clearnet — Twitter/Reddit scrapers don't fetch .onion. But OG endpoints are serve-layer functions: anyone can operate one at any domain, earning via tag income. Domain seizure breaks one instance; another appears at a different domain. At bootstrap the viral loop is fragile (one domain); at maturity it's distributed (many operators). DNS is a growth optimization, not infrastructure.

### 26. Bitcoin Data Source as Runtime Dependency

Every participant needs the block hash at `epoch_start_height - RING_CONFIRM_DEPTH` each epoch (~4h) to compute epoch_hash. One hash, one lookup. Lightweight, but a new dependency: epoch boundaries were previously just arithmetic on block height; epoch_hash requires the actual block hash. **Options per role**: (i) Bundled SPV header chain (~60MB history, ~4KB/day ongoing). (ii) Query any public block explorer API. (iii) Receive from mint over persistent Tor circuit (and cross-verify against any other source). (iv) For the store daemon: the mint already pushes per-blob_id earnings and challenges over the persistent circuit — block hash can piggyback. **Failure mode**: if a participant can't obtain the block hash, it can't compute epoch_hash → can't produce or verify any protocol message → inert. Identical to "Bitcoin unreachable" which would also prevent bond verification, OP_RETURN anchoring, etc. Not a new failure mode in practice; just an existing dependency made more explicit.

### 27. Genesis Key Irrevocability

The genesis pubkey is rooted in every cryptographic derivation (content keys, Argon2 salts, epoch hashes, challenge nonces, store selection, state roots). **Key rotation = content-fork**: changing the genesis pubkey changes every derived parameter, making a new protocol instance that cannot decrypt existing content, discover existing stores, or produce valid state roots matching existing Bitcoin anchors. Key compromise means: attacker can spend accumulated income (the private key's only function). The protocol continues operating regardless (the public key is the parameter, irrevocably distributed to every participant). **Residual**: (i) Key management is non-negotiable from before the genesis inscription — the keypair generated for the inscription is the keypair forever. (ii) The genesis key is only for spending; it never signs protocol operations, never goes on a hot machine for protocol purposes. (iii) Protocol survives key seizure — income redirected but the swarm operates using the public key that exists in every binary and every Bitcoin anchor.

### 28. ~~Split-Deposit Race Condition~~ RESOLVED → M Removed

With M removed, there is no per-content secret to coordinate across mints. When splitting deposits, the client designates one mint for shard verification (receives K shards, verifies integrity). Other mints accept sats-only deposits and confirm independently. No HTLC timeout chain between mints, no relay-watching for VM confirmation. Each mint confirms its own deposit atomically via its own HTLC. Re-funding (`role=additional`) is a simple re-deposit — no key reuse coordination.

### 29. ~~Selective Dropping and Shard Selection~~ RESOLVED → Serve-Blinded Selection

Commitment-reveal protocol: client withholds `selection_nonce` (only `blind = SHA256(nonce)` in request proof) until mint signs `processing_commitment`. Mint cannot compute routing outcome before committing → selective dropping impossible. Unfulfilled commitments are cryptographic evidence. Shard selection similarly blinded. See §3 Consumption Flow for full protocol. **Residual**: nonce grinding at PoW cost per attempt; serve+mint collusion pre-commitment at bootstrap (requires two colluding parties, mitigated by `commitment_count` accountability).

### 30. ~~Tenure Amplification of Biased Routing~~ RESOLVED → Challenge-Based Tenure

`tenure = consecutive_challenge_passed_epochs(st, s, m)` replaces attestation-based tenure. Stores accumulate tenure by passing storage challenges regardless of delivery token frequency. Breaks the amplification loop: biased routing no longer degrades honest stores' tenure → no cascading eviction → no equilibrium favoring mint-controlled stores. See Settlement §4 pseudocode, `challenge_root` in Epoch Summary.

### 31. ~~Bootstrap Routing Vulnerability~~ RESOLVED → Serve-Blinded Selection + Challenge-Based Tenure + Processing Accountability

Three interlocking mechanisms work at bootstrap with 1 mint: (i) serve-blinded selection (#29) — local to each mint, no cross-mint dependency; (ii) challenge-based tenure (#30) — local per store-shard-mint; (iii) processing accountability at RELAY_SAMPLE_RATE=1 — `commitment_count` vs relay proof count, fulfillment ratio, serve endpoint cross-verification. **Residual**: serve+mint collusion pre-commitment requires two colluding parties, bounded by seed budget (~200K sats). Analogous to Bitcoin bootstrap — centralizable early, robust as participants distribute.

### 32. ~~Sweep Condition and Per-Mint Independence~~ RESOLVED → Chain-Relative Per-Mint Sweep

The global demand check (request proofs from relays) is removed from the sweep condition. Sweep is now purely per-mint: `no_valid_attestations(cid, m, last SWEEP_EPOCHS entries in m.epoch_chain)`. SWEEP_EPOCHS counted against `m.seq`, not wall-clock epochs. Mint offline → chain frozen → sweep clock frozen → mint takedown cannot trigger sweep. The global check's original purpose (preventing adversary-triggered sweep via mint takedown) is fully addressed by chain-relative counting.

**Why the global demand check was unnecessary**: a mint with zero stores receives zero routed demand — serve endpoints route around S_s=0 coverage. Such a pool is economically inert (zero drain, zero service). Preserving it via global demand data preserves dead state at the cost of breaking per-mint settlement independence. Sweeping it is the correct market signal.

**Residual**: genesis address is the standing beneficiary of sweep, creating an incentive to maximize sweep. See #33. **Residual**: post-outage grace period — a mint returning after prolonged downtime may trigger immediate sweep for pools that were inactive before the outage. Stores rushing to re-attest on return naturally mitigate this; an explicit grace period of G epochs after chain resumption is an optional refinement.

### 33. Genesis Address Incentive Alignment — PARTIALLY RESOLVED → Parameter Signaling + Market Accountability

The genesis address receives all sweep income and all cascading remainders. Three attack surfaces remain theoretically possible: (i) **Passive storeless mint**, (ii) **Rug-pull**, (iii) **Coordination refusal** (see previous analysis). **Primary resolution**: the genesis key holder is incentivized to maximize *volume* (total inflow), not *sweep* (failed pools) — sweep income from sabotaged pools is bounded, while referrer + remainder income from a thriving market compounds indefinitely. **Secondary resolution**: reputation-weighted parameter signaling (see Verification System: Parameter Signaling) creates a public accountability signal — funders and operators with accumulated reputation publish preferred parameters; a genesis-operated mint whose behavior diverges from community medians is legibly out-of-band, accelerating competitive exit. As participant reputation matures, the community signal constrains all mints including any genesis-affiliated mint. **Residual**: at bootstrap, the genesis key holder has outsized influence (thin signal weight, single mint). Accepted: analogous to Bitcoin bootstrap. The transition from founder centrality to market-driven parameter convergence is monotonic and observable (see Parameter Signaling: Transition).

### 34. Store Verification: "Consistent But Wrong" Parameters

Stores verify their payout against mint-provided parameters (balance, S_s, tenure). The mint could claim a lower balance than real, compute a correspondingly lower payout, and the math checks out — the store can't detect this because it doesn't know `content_hash` (store-blind). **Detection**: aggregate level-1 check (conservation law from public data) catches systematic skimming. Per-store, the limitation is accepted — the store's recourse is behavioral (competitive exit on persistently low earnings). **Counter-incentive**: underpaying stores causes store departure → reduced S_s → weakened epoch summary credibility → funder competitive exit. The short-term gain from skimming is dominated by long-term loss from store departure. **Possible future mitigation**: blinded balance proofs (prove Merkle membership without revealing leaf key). Not worth the complexity for v1.

### 35. Leaf Data Blob Availability

The `leaf_data` hash in the epoch summary commits a Blossom-hosted blob. If the blob is unavailable, level-1 verification degrades: the balance_root is verifiable but individual PoolState entries can't be checked without the leaves. **Mitigations**: (i) serve endpoints host the blob (economically aligned — more verifiable mints attract more deposits → more via income), (ii) multiple serve endpoints cache independently, (iii) at bootstrap the blob is small enough to inline as a Nostr event. **Residual**: a mint that publishes epoch summaries but withholds the leaf data blob is making an unverifiable claim. The `totals` tag provides heartbeat monitoring (fast sanity check on aggregate balance trajectory), but per-content verification requires the blob. Leaf data availability should be surfaced as a mint quality signal in the reference client.

### 36. Self-Attestation Timing Window

Self-attestation proofs are published to relays (not direct to mint). The mint must observe them within a timing window to include in `challenge_root`. **Resolution**: per-mint declared `CHALLENGE_CUTOFF` parameter (blocks before epoch boundary by which proofs must be observed). Protocol-level bounds: min 1 block, max `EPOCH_BLOCKS / 2`. The cutoff applies to *observation by the mint*, not publication by the store — relay propagation delay is the store's concern. **Market effect**: tight-cutoff mints demand better store relay connectivity; generous-cutoff mints are more accessible with longer settlement lag. Stores choose mints partly based on this parameter.

### 37. Mint Resurrection and the Durability Inversion

The architecture has a durability inversion: the most resilient layer (anonymous stores on laptops) depends on the least resilient layer (bonded mints behind reachable endpoints) for income. A nation-state adversary doesn't need to find the laptops — only starve them by DDoSing mints.

**What survives mint death (all public, all reconstructable)**: pool state (balance_root in epoch summaries), attestation history (self-attestation proofs on relays), challenge history (challenge_root, independently recomputable), mappings (relay-encrypted, Argon2-gated), store tenure (derivable from challenge_root chain), demand history (request proofs). **What dies**: the custodied sats. Bounded by deposit splitting.

**Mint resurrection**: `ocdn-mint --bootstrap-from-relays` reconstructs full operational state from public relay data. Design target: <2h from bond to operational. The defender's marginal cost per resurrection: one recoverable bond + one Docker command. The attacker's marginal cost: sustained DDoS of a new Tor hidden service in a new jurisdiction. This ratio favors the defender at scale.

**Store patience during the gap**: three mechanisms. (1) **Tenure premium**: challenge-based tenure survives the gap (no epochs settled → no tenure reset). Stores that held through the outage resume at previous weight; newcomers start at 33%. First-mover advantage for patience. (2) **Retroactive settlement**: stores continue self-attesting and serving via PoW during the gap. All settlement inputs accumulate on relays. A new mint can retroactively verify and settle gap epochs — backpay for patient stores. Mints that honor gap claims attract more stores (competitive advantage, not protocol rule). (3) **Genesis backstop**: the genesis key holder has the strongest economic incentive to fund mint resurrection (sweep + remainder income depends on a functioning market). Not a protocol guarantee — an economic gravity.

**The laptops win because**: data is the durable asset (anonymous, distributed, on disk); money disruption is a renewable problem (mints are cheap, ephemeral, reconstructable from public data). You can't DDoS a blob off a hard drive. You can only stop paying for it. Payment resumes when a mint appears — and the incentives ensure one does.

**Residual**: (i) Store daemon patience calibration — `P(mint_resurrection)` is a heuristic with no ground truth at bootstrap. (ii) Retroactive gap settlement is a mint policy, not a protocol rule — a race-to-bottom mint could skip it. Reference `ocdn-mint` implementation should honor gap claims by default. (iii) Sats at the dead mint are irrecoverably lost — no funder reclaim mechanism exists post-deposit (accepted: the HTLC protects entry, the bond + deposit-splitting bounds exposure, the ghost → restored path handles re-funding).

### 38. Inscription Creation UX

The reference client is a browser SPA. Creating a Bitcoin OP_RETURN requires a Bitcoin wallet, not just NIP-07. Three creation paths coexist: (A) direct inscription via external wallet (`ocdn-inscribe` CLI generates raw tx hex), (B) batching service via the reference client (user pays Lightning, service handles the Bitcoin transaction), (C) mint-bundled registration (mint includes `registration_root` in epoch summary — no separate inscription, but only covers OCDN-funded content). Path B is the default for normal users; path A for sovereignty-maximizers. **Residual**: NWC wallet support for arbitrary OP_RETURN construction is uneven; batching service may be the only practical path for browser-only users at launch.

### 39. Inscription Chain Analysis Surface

OP_RETURN inscriptions are cleartext on Bitcoin. An adversary monitoring the chain can enumerate all OCDN registrations, map the citation graph, and correlate inscription UTXOs with funder identity. Batching services mitigate (the service's UTXO, not the user's). Coinjoin mitigates further. **Residual**: at bootstrap with one batching service, that service sees all submitted content_hashes. Multiple competing services reduce this concentration. The inscription reveals *what* was registered; chain analysis reveals *who* paid. The user's choice: durability (inscribe) vs. privacy (relay-only).

### 40. Batching Service Bootstrap

At launch, likely one batching service (operated by serve endpoint or founder). Single-service censorship is detectable post-batch (user checks leaf data) but not preventable pre-batch. **Mitigations**: signed submission receipts, running checkpoints, low barrier to entry for competing services (open format, no bond, no permission). **Residual**: bootstrap monopoly on inscription batching. Analogous to single-mint bootstrap — centralizable early, distributes as ecosystem grows.

---

## The One-Sentence Version

**Sats bind to hashes; the genesis pubkey seeds every derivation; four separated roles (store, serve, mint, genesis) settle at participant parity; epoch_hash mutual authentication at every boundary; all infrastructure is anonymous and combustible; the evidence layer is Bitcoin-permanent; the founder operates nothing; the income is settlement math; the moat is cryptographic; content is mortal but the accusation is not.**

---

## Adversarial Action Model

Every participant is assumed adversarial. The protocol must make honest behavior the profit-maximizing strategy and malice either unprofitable, detectable, or inert. This section enumerates every action available to each role at each boundary, the consequence, and the detection mechanism.

Notation: `→` = sends to, `←` = receives from, `⊕` = honest action, `⊘` = malicious action, `[D]` = detected by, `[C]` = consequence.

### CLIENT (reader/funder)

**Boundary: CLIENT → SERVE ENDPOINT (request proof)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| C1 | Submit valid request proof (correct epoch_hash, valid PoW, signed) | ⊕ | — | Content delivered. Demand signal created. |
| C2 | Submit request proof with wrong epoch_hash | ⊘ | [D] Serve endpoint recomputes epoch_hash from protocol_seed + BTC | [C] Rejected at first contact. Zero content. Inert. |
| C3 | Submit request proof with insufficient PoW | ⊘ | [D] Serve endpoint / mint verify PoW target | [C] Rejected. |
| C4 | Submit request proof with forged signature | ⊘ | [D] Ed25519 verification | [C] Rejected. |
| C5 | Submit request proof with wrong via tag (steal referrer income) | ⊘ | [D] NIP-07 extension shows what's signed — client can't modify without user's key | [C] If user signs: referrer income redirected, but user paid the PoW, provided real demand. Tolerated — self-dealing is work. |
| C6 | Replay old request proof | ⊘ | [D] Epoch-bound, single-use nonce | [C] Rejected. |
| C7 | Flood request proofs (sybil demand) | ⊘ | [D] PoW cost scales linearly | [C] Expensive. Affects index only (display layer), not settlement (drain is gate-triggered not count-triggered). |
| C8 | Submit request proof for content below K coverage | ⊘ | [D] Mint checks coverage ≥ K | [C] Rejected — content unrecoverable, no drain. |

**Boundary: CLIENT → MINT (deposit)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| C9 | Deposit via HTLC-gated Cashu (honest) | ⊕ | — | Pool credited. Fund confirmation published. |
| C10 | Deposit, mint doesn't publish confirmation | ⊘ (mint) | [D] HTLC timeout | [C] Funder reclaims. Atomic. |
| C11 | Deposit garbage content (griefing) | ⊘ | [D] Mint verifies shard integrity (Step 1b): decrypt, reconstruct, SHA256 == content_hash | [C] Deposit rejected. |
| C12 | Deposit to attacker-controlled mint (via compromised client) | ⊘ | [D] Client should verify mint's epoch summaries (challenge_root recomputation, balance_root transition checks) against settler audit events on relays | [C] If undetected: funder loses deposit to attacker mint. Bounded by deposit amount. |

### SERVE ENDPOINT

**Boundary: SERVE ENDPOINT ↔ CLIENT**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| S1 | Proxy request honestly, return blobs + selection proofs | ⊕ | — | Earns via tag income. |
| S2 | Drop/refuse to serve specific content (censor) | ⊘ | [D] User notices. No protocol-level detection. | [C] Users switch to competing serve endpoint. Loss of via income. At bootstrap with 1 serve endpoint: availability degraded until alternative appears. |
| S3 | Modify selection proofs | ⊘ | [D] Client verifies selection proofs against deterministic formula + committed store_set_root | [C] Verification fails. Client retries with different serve endpoint. |
| S4 | Modify delivery token | ⊘ | [D] Delivery token is mint-signed. Store verifies signature. | [C] Store rejects. Content not delivered. |
| S5 | Return wrong blobs | ⊘ | [D] Client verifies content_hash after decryption | [C] Hash mismatch. Client retries. |
| S6 | Forge via tag in request proof | ⊘ | [D] Request proof is client-signed via NIP-07 — serve endpoint can't modify | [C] Impossible without client's key. |
| S7 | Log which content is requested (surveillance) | ⊘ | [D] Not protocol-detectable | [C] Privacy leak. Mitigated by: ephemeral client keys, multiple competing serve endpoints (mixing), batched/delayed relay publication. Residual risk at bootstrap. |
| S8 | Withhold OCDN events from relay archive | ⊘ | [D] External relays have copies. Serve endpoints that retain more events serve better → more traffic → more via income. | [C] Self-harming — less event availability → less traffic → less income. |

**Boundary: SERVE ENDPOINT → MINT (forwarding request proof)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| S9 | Forward honest request proof | ⊕ | — | Receives delivery tokens + selection proofs. |
| S10 | Submit fake request proof | ⊘ | [D] Mint verifies epoch_hash + PoW + client signature | [C] Rejected. Serve endpoint gets nothing. |
| S11 | Replay old delivery tokens | ⊘ | [D] Single-use, epoch-bound, nonce-verified by store | [C] Store rejects. |

**Boundary: SERVE ENDPOINT ↔ STORE (blob fetch)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| S12 | Present valid delivery token, fetch blob | ⊕ | — | Blob returned. Store attests to mint. |
| S13 | Present delivery token with wrong epoch_hash | ⊘ | [D] Store verifies epoch_hash | [C] Rejected. |
| S14 | Contact store without delivery token (healthy mode) | ⊘ | [D] Store requires delivery token or PoW (degraded only) | [C] Rejected in healthy mode. |

### STORE

**Boundary: STORE ↔ MINT (challenges + attestations)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| ST1 | Publish valid self-attestation (has blob, correct Merkle proof for deterministic challenge set) | ⊕ | — | Earns for that shard this epoch. |
| ST2 | Miss self-attestation (doesn't have blob or doesn't publish) | ⊘ | [D] Missing blob in deterministic challenge set — verifiable by anyone from relay-published proofs | [C] Loses earnings for shard. Repeated failure → mint stops interacting for that shard. |
| ST3 | Proxy: publish attestation for blob held by another store | ⊘ | [D] Cross-store verification ring (block-hash-assigned peer checks) + latency heuristics | [C] Caught probabilistically over epochs. |
| ST4 | Submit valid attestation (served blob for valid delivery token) | ⊕ | — | Recorded by mint. Included in epoch summary. Earns. |
| ST5 | Submit attestation with wrong epoch_hash | ⊘ | [D] Mint verifies epoch_hash | [C] Rejected. No payment. |
| ST6 | Submit attestation for blob not actually served | ⊘ | [D] response_hash must match expected shard bytes. Mint knows expected hash. | [C] Rejected. |
| ST7 | Submit attestation referencing non-existent delivery token | ⊘ | [D] Mint checks delivery_token_hash against issued tokens | [C] Rejected. |
| ST8 | Sybil: one machine, many pubkeys, one disk copy | ⊘ | [D] Cross-store verification (correlated latency heuristic). Per-store unique wrapping (if implemented) forces N× disk. | [C] Currently: profitable but harmless (store-blind — can't weaponize position). Per-store wrapping raises cost to N× disk. |
| ST9 | Selectively refuse to serve (censor specific blobs) | ⊘ | [D] Store is store-blind — doesn't know which content a blob corresponds to. Can only drop by blob_id. | [C] Loses earnings for dropped blob. Mint routes around. Market recruits replacement. Random blob_id dropping is self-harming. |
| ST10 | Verify challenge nonce correctness (mutual auth) | ⊕ | — | Detects wrong-genesis mint. |
| ST11 | Accept challenge with wrong nonce (from wrong-genesis mint) | ⊘ | [D] Store computes expected nonce from epoch_hash | [C] Store should reject — accepting wrong nonces → interacting with incompatible network. |

**Boundary: STORE ↔ STORE (cross-verification)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| ST12 | Verify assigned peer honestly | ⊕ | — | Required for own earnings. |
| ST13 | Pass a peer that doesn't have the shard (collude) | ⊘ | [D] Assignment is epoch_hash-deterministic. If peer later fails mint challenge, verdicting store is implicated. | [C] Mint stops interacting with both. |
| ST14 | Refuse to verify peer (DoS) | ⊘ | [D] No verification result → own earnings withheld | [C] Self-harming. |

### MINT

**Boundary: MINT ← CLIENT (deposits)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M1 | Accept deposit, verify shards, publish fund confirmation | ⊕ | — | Pool credited. Earns coordination share over pool life. |
| M2 | Accept deposit, don't publish confirmation (steal) | ⊘ | [D] HTLC timeout — funder reclaims | [C] Atomic failure. Mint gets nothing. |
| M3 | Publish confirmation for amount ≠ actual deposit | ⊘ | [D] HTLC preimage binds to content_hash + amount + mint pubkey | [C] Preimage won't match. Funder reclaims. |
| M4 | Accept deposit exceeding custody ceiling | ⊘ | [D] Auditable: sum(fund confirmations) vs bond_value × tenure_factor. Reference client rejects. | [C] Deposit routed to next mint by reference client. |

**Boundary: MINT → SERVE ENDPOINT (delivery tokens)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M5 | Issue correct delivery token (valid selection proof, correct epoch_hash) | ⊕ | — | Content delivered. Store attests. |
| M6 | Issue delivery token with biased store selection | ⊘ | [D] **Impossible with valid ZK proof** — biased selection produces unsatisfiable circuit. Store verifies ZK selection proof per token (or sampled via proof-on-demand). Client verifies selection_input commitment. Settler audits routing ex-post. | [C] Mint cannot produce valid proof for biased selection. Missing/invalid proof = evidence → stores exit. |
| M7 | Selectively refuse delivery tokens based on routing outcome | ⊘ | [D] Prevented by serve-blinded selection (#29): mint commits before learning selection_nonce. Post-commitment non-fulfillment = signed evidence. `commitment_count` auditable. | [C] Blind dropping is self-harming. Post-commitment dropping → evidence → stores exit. |
| M8 | Issue delivery token with wrong epoch_hash | ⊘ | [D] Store verifies epoch_hash | [C] Store rejects token. Content not served. |

**Boundary: MINT ← STORE (attestations)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M9 | Include attestation in epoch summary honestly | ⊕ | — | Store earns. Epoch summary is correct. |
| M10 | Omit valid attestation (punish/extort store) | ⊘ | [D] Store verifies own inclusion via attestation Merkle root in epoch summary | [C] Store detects omission. Reroutes to other mints (competitive exit). |
| M11 | Include fake attestations (inflate store count) | ⊘ | [D] Fake stores must pass challenges. Settlers verify attestation detail against Merkle root. | [C] Phantom stores require real storage + compute. Not free — converges on honest operation. |

**Boundary: MINT → STORE (challenges)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M12 | Issue challenge with correct deterministic nonce | ⊕ | — | Store responds. Earnings if valid. |
| M13 | Issue challenge with biased nonce (help colluding store) | ⊘ | [D] Nonce = hash(epoch_hash \|\| store_pubkey \|\| blob_id) — deterministic, independently verifiable. Anyone can check. | [C] Provable fraud. Stores exit. |
| M14 | Skip challenge for colluding store | ⊘ | [D] Challenge results in epoch summary. Settlers and stores see challenge counts. Persistent non-challenge is statistical anomaly. | [C] Detectable over time. Stores exit on suspicion. |

**Boundary: MINT → STORE (payouts)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M15 | Issue correct Cashu payout matching deterministic settlement | ⊕ | — | Store receives expected tokens. |
| M16 | Underpay store (skim) | ⊘ | [D] Store computes expected payout from public data (pool balance + S_s + tenure + formula). Compares against received Cashu amount. | [C] Detected within 1 epoch (~4h). Store reroutes. Aggregate departures visible in next epoch summary. |
| M17 | Issue fake Cashu tokens (no backing) | ⊘ | [D] Store redeems/swaps tokens. Redemption fails at issuing mint. | [C] Store detects on first swap. Reroutes. |

**Boundary: MINT → RELAYS (epoch summaries, coverage signals)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M18 | Publish correct epoch summary (valid epoch_hash, honest roots, correct S_s) | ⊕ | — | Settlement proceeds. balance_root + challenge_root committed. |
| M19 | Publish epoch summary with wrong epoch_hash | ⊘ | [D] Settler recomputes epoch_hash from protocol_seed + BTC | [C] Rejected. Settlement skipped for this mint this epoch. |
| M20 | Publish epoch summary with inflated S_s (fake store count) | ⊘ | [D] challenge_root is independently recomputable from public self-attestation proofs — phantom stores don't have self-attestation proofs. balance_root conservation law catches accounting discrepancies. | [C] Provable mismatch between committed challenge_root and independently computed root. Stores and clients reroute. |
| M21 | Publish conflicting epoch summaries (fork own chain) | ⊘ | [D] prev hash chain — conflicting summaries at same seq detectable by any observer | [C] Permanent inconsistency signal on relays. Stores and clients reroute. |
| M22 | Withhold epoch summary (go silent) | ⊘ | [D] Missing seq in the prev chain. Stores detect after MAX_SILENT_EPOCHS. | [C] Stores reroute. Mint loses all future income from departed stores. |
| M23 | Exit-scam (stop paying, disappear with remaining balances) | ⊘ | [D] Next epoch: stores receive no payout. Detected in ~4h. | [C] Store damage: 1 epoch of missed earnings (trivial). Funder damage: remaining pool balances at this mint (bounded by custody ceiling, split across DEPOSIT_SPLIT_MIN mints). Content: enters degraded mode. Self-heals as deposits reroute. |

**Boundary: MINT ↔ MINT (gossip)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| M24 | Share correct mappings via authenticated gossip | ⊕ | — | Cross-mint discovery works. |
| M25 | Share wrong mappings | ⊘ | [D] Mappings verified against relay-encrypted canonical. | [C] Best-effort gossip degrades to relay fallback. |
| M26 | Withhold mappings from gossip | ⊘ | [D] Other mints fall through to relay-encrypted mappings | [C] Self-harming — relay layer is canonical. |

### SETTLER

**Boundary: SETTLER ← MINTS (epoch summaries) → RELAYS (settlement events)**

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| SE1 | Compute correct settlement from epoch summaries, publish to relays | ⊕ | — | Deterministic. Multiple settlers converge. Per-mint state roots committed. |
| SE2 | Compute wrong settlement (redirect remainder) | ⊘ | [D] Settlement is deterministic. Any other settler (or store, or auditor) recomputes and gets a different result. input_set convergence tag reveals inconsistency. | [C] Non-canonical settlement ignored. Stores compare against their own computation. |
| SE3 | Publish wrong audit results | ⊘ | [D] Level-1 verification (balance_root transitions, challenge_root recomputation, conservation law) is deterministic from public data. Any other settler recomputes and catches the mismatch. | [C] Competing settlement with correct results appears. Wrong audit is provably fraudulent. Stores verify against own computation. |
| SE4 | Withhold settlement (don't compute) | ⊘ | [D] Any other settler can compute. | [C] Settler earns nothing anyway (public service). Other settlers fill the gap. |

### RELAY (external, not a protocol role — included for completeness)

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| R1 | Persist and serve OCDN events | ⊕ | — | Ecosystem health. |
| R2 | Censor specific events (drop fund confirmations, request proofs) | ⊘ | [D] Events also on serve endpoint relay archives (economically aligned) + other external relays | [C] Serve endpoint archives are the primary persistence layer. External relays are fallback. Single relay censorship is ineffective. |
| R3 | Filter by genesis fingerprint (block an entire protocol instance) | ⊘ | [D] Other relays don't filter. | [C] Serve endpoint relay archives route around. |

### BATCHING SERVICE (not a protocol role — included for completeness)

| # | Action | Type | Detection | Consequence |
|---|--------|------|-----------|-------------|
| B1 | Collect items, build correct batch, publish leaf data + OP_RETURN | ⊕ | — | Items inscribed. Proofs available. Reputation accrues. |
| B2 | Omit a submitted item from the batch (censorship) | ⊘ | [D] User checks leaf data post-publication. Signed submission receipt is evidence. Running checkpoints make omission provable: checkpoint includes item, final batch doesn't. | [C] Reputation damage. User switches to competing service. Provable fraud if checkpoint exists. |
| B3 | Publish batch OP_RETURN but withhold leaf data (claim without proof) | ⊘ | [D] Poke audit: anyone fetches leaf data, finds it unavailable. batch_count on-chain vs. zero resolvable items. | [C] Reputation failure — permanent on-chain claim with no backing. Users with cached proofs unaffected; users without proofs cannot prove inclusion. |
| B4 | Publish incorrect Merkle root (leaf data doesn't match on-chain root) | ⊘ | [D] Poke audit: anyone rebuilds tree from leaf data, root mismatches on-chain OP_RETURN. Deterministic, trivial to verify. | [C] Provable fraud — self-contained evidence (leaf data + on-chain root). |
| B5 | Charge fees but never publish batch | ⊘ | [D] Users hold payment receipts. No corresponding on-chain OP_RETURN at expected time. | [C] Reputation destruction. Competing services absorb users. |
| B6 | Publish fake submission receipts for items never received | ⊘ | [D] Receipt references a batch_id. If batch publishes and item is present: harmless. If absent: receipt contradicts batch — but this hurts the service, not the user. | [C] Self-harming — creates false evidence against oneself. |
| B7 | Front-run: see submitted content_hash, inscribe directly to claim priority | ⊘ | [D] Inscription timestamps are block-height-ordered. Both inscriptions visible on-chain. | [C] User's content still inscribed (via batch). Priority claims use block height of the FIRST inscription containing the hash. Front-running is visible. |

### CROSS-BOUNDARY: epoch_hash mutual authentication summary

Every boundary above that involves epoch_hash creates a bilateral check. The full mesh:

```
CLIENT ──epoch_hash──→ SERVE ENDPOINT ──epoch_hash──→ MINT
                                                       ↕ epoch_hash
STORE ←──epoch_hash──→ MINT          STORE ←──epoch_hash──→ STORE (cross-verify)
                                                       ↓ epoch_hash
                                     SETTLER ←──epoch_hash── MINT (epoch summary)
                                                       ↓ genesis_fingerprint (product layer, any party)
                                     BITCOIN ←── ANY PARTY (OP_RETURN with genesis_fingerprint + state_root)
```

A participant with the wrong genesis pubkey fails at the FIRST boundary they touch. The failure is not "rejected by policy" — it is "computationally inert" (wrong hash, can't produce valid proofs, can't verify valid tokens).

### COMPOUND ADVERSARY ANALYSIS

Single-role attacks are bounded above. The remaining question: what if one entity controls MULTIPLE roles simultaneously?

| Combination | What they can do | What they CANNOT do | Net effect |
|-------------|-----------------|---------------------|------------|
| **Mint + Store** (vertical integration) | Route delivery tokens to own stores (biased routing) | Bypass serve-blinded selection (nonce unknown at commitment). Generate valid ZK selection proof for biased selection (unsatisfiable circuit). Degrade honest stores' tenure (challenge-based). | Biased routing is mathematically impossible with valid ZK proofs — mint cannot produce proof for incorrect selection. Serve-blinded selection prevents pre-commitment bias. Challenge-based tenure prevents amplification. At bootstrap: bounded by seed budget + serve+mint collusion residual. |
| **Mint + Store** (fake storage) | Attest without storing | Bypass cross-store verification (epoch_hash-assigned, block-hash-unpredictable) | Caught probabilistically. P(detection) = 1 - (C/S)^epochs. |
| **Serve + Mint** (traffic analysis) | Correlate request timing with store contacts, read proxied content (serve endpoint derives convergent key) | Identify store operators (Tor), link payments (Cashu blind) | Intelligence only. No economic damage. Mitigated by competing serve endpoints (mixing). |
| **Serve + Client** (compromised client) | Route deposits to attacker mint, show fake UI | Produce valid epoch_hash for honest network (unless they use the correct genesis pubkey — in which case they're paying genesis) | Binary choice: correct genesis → honest network (pays genesis). Wrong genesis → inert. |
| **All roles except genesis** (nation-state) | Operate honest infrastructure, earn income, conduct surveillance | Redirect genesis income (settlement is deterministic, remainder → genesis_address is part of the formula, wrong remainder → wrong state root → detected). Suppress specific content (addressing-blind + anonymous transport). | The adversary is a legitimate, well-resourced participant. They pay genesis. They can surveil within the limits of the privacy layers. They cannot subvert economics or suppress content. |

### UNANALYZED / RESIDUAL

| # | Gap | Status |
|---|-----|--------|
| G1 | Sybil stores (1 machine, N identities, 1 disk) are more cost-efficient than honest stores. Store-blind makes them harmless but doesn't make them unprofitable. Per-store unique wrapping (see earlier discussion) raises cost but disk is cheap. | Open — economic, not security-critical |
| G2 | Bootstrap with 1 serve endpoint: traffic analysis is unmitigated. | Acknowledged (Unresolved #19). Closes as serve endpoint count grows. |
| G3 | Compromised client can route deposits to attacker mint while using correct genesis pubkey for content delivery. User doesn't notice. | Mitigated by client-side mint verification: challenge_root recomputation from public data, balance_root transition checks, settler audit events on relays (and Bitcoin anchors where available). Residual: user must trust SOME verification code. |
| G4 | Settler incentive: no income. At scale, settlement is expensive to compute. The evidence layer (described as "the protocol's primary output") depends on voluntary action by parties with no protocol income. | Open. The evidence layer is a latent capability, not a guaranteed output. At bootstrap the trust model is "trust the bonded mint," not "trust the math." Independent audit activates when parties (index operators, institutional consumers, store collectives) justify the infrastructure for their own business reasons. Mints can self-anchor (commits their own claims to Bitcoin — binding but not independent). See Settler glossary entry. |
| G5 | Mint can learn content→store mapping for content it processes (intelligence). Anonymous transport hides operator identity; store-blindness hides content from store; but mint sees both sides. | By design — mint is the trusted bridge. Mitigation: competing mints, deposit splitting, relay-encrypted mappings as fallback. |
| G6 | Epoch_hash depends on Bitcoin block hash. 51% miner can manipulate block hash to bias store selection / verification rings for one epoch. | Impractical — Bitcoin mining attack is astronomically expensive for one epoch of OCDN routing bias. |
| G7 | Coordination refusal: a bonded mint that accepts deposits but never distributes shard data to stores produces a valid chain with zero attestations → sweep. No competitive-exit evidence (no attestation excluded; none existed). Hardest genesis-key-holder attack to detect. | Open — see Unresolved #33. Bounded by bond cost, SWEEP_EPOCHS window, and replacement store dynamics. |
