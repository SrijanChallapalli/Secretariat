# Secretariat — ML / AI Technical Study Guide

Everything in this document is verified against the code as of 2026-08-02.
File paths are clickable references to the real implementation.

---

## 0. The 30-second frame

There are **three AI layers**, and the single most important architectural
point is that **each one sits on a deterministic floor and degrades
gracefully**:

| Layer | What it does | Runs where | If unavailable |
|---|---|---|---|
| XGBoost | Predicts career prize money (GBP) | Pure TypeScript, in-process | Formula-only valuation |
| Formula engine | Deterministic valuation from domain rules | Server | Always available |
| LLM (qwen-2.5-7b) | Natural-language "why" per breeding pick | 0G Compute, remote | Empty strings, scores still shown |

> **Lead with this.** "No model file? The app still values horses. No LLM
> credentials? You still get scores, just without prose. Nothing load-bearing
> depends on an external service being up."

---

## 1. The XGBoost model

### 1.1 What it predicts

**One number: a horse's career prize money in GBP.** Everything else —
valuations, breeding scores — is derived from that single prediction.

### 1.2 Training data

- `data/raw/all_races_combined.csv` — 3,911 individual race results (GB/IRE)
- `data/raw/unique_horses.csv` — 2,694 unique horses

Real columns: course, going, distance, surface, field size, finishing
position, starting price (`sp_dec`), weight carried, official rating, prize,
sire, dam, damsire.

### 1.3 Feature engineering (`scripts/ml/train_xgboost.py`)

A pandas `groupby("horse_id")` collapses each horse's many race rows into
**one row of career statistics**. 32 features total:

| Group | Features |
|---|---|
| Volume | `race_count`, `win_count`, `place_count`, `win_rate`, `place_rate` |
| Finish quality | `avg/std/best/worst_position`, `avg_norm_position` |
| Competition | `avg_class`, `best_class`, `avg_field_size`, `avg_sp`, `min_sp` |
| Ratings | `avg_official_rating`, `max_official_rating` |
| Conditions | `going_pct_{firm,good,good_to_firm,good_to_soft,soft}`, `surface_pct_turf` |
| Physical | `avg_weight`, `avg_distance`, `std_distance`, `age_last`, `sex_encoded` |
| Pedigree | `sire_encoded`, `damsire_encoded`, **`sire_avg_prize`, `damsire_avg_prize`** |

Two details worth knowing cold:

**`avg_norm_position`** = finishing position ÷ field size. Finishing 5th of 6
is bad; 5th of 20 is good. Raw position alone can't tell the difference.

**Target encoding on sire/damsire.** Each sire is represented by *the mean
prize money of its offspring in the training set*. That is how "good
bloodline" becomes a number a decision tree can split on. Sires with fewer
than 5 offspring collapse into an `"OTHER"` bucket to avoid overfitting to
tiny samples.

**`going_pct_*`** comes from a `pd.crosstab(..., normalize="index")` — the
*fraction* of a horse's runs on each ground type, not a count. So it's
comparable between a 3-race maiden and a 40-race veteran.

### 1.4 The target and the log transform

```python
TARGET_COL = "total_prize"
y_log = np.log1p(y_pos)          # train on log
# inference: Math.expm1(logPred)  # invert
```

**Why log?** Prize money spans £0 to £850,650. Under squared-error loss on
raw values, a single £850k horse dominates the gradient and the model
effectively ignores everything else. `log1p` compresses that to a ~13-unit
range so errors are proportional rather than absolute. `log1p` (not `log`)
because `log(0)` is undefined and most horses earn exactly £0.

### 1.5 Hyperparameters and results

```python
objective="reg:squarederror", n_estimators=500,
max_depth=6, learning_rate=0.05, subsample=0.8
```

| Metric | Value |
|---|---|
| 5-fold CV R² | **0.969 ± 0.0015** |
| Train MAE | ~£1,323 |
| Train median AE | £79 |
| Trees | 500 |

Top importances: `best_position` 0.446, `avg_class` 0.149,
`place_count` 0.134, `win_count` 0.043. Pedigree encodings ≈ 0.005.

> **Be honest about R² = 0.969.** That is suspiciously high, and you should
> say so before they do. The features are career aggregates and the target is
> career prize money — a horse's finishing record and its earnings are
> causally entangled. It is a **valuation signal, not a race-outcome
> predictor**. Framed correctly ("given this horse's record, what is its
> earning power worth?") that's fine. Framed as "we predict races" it's
> indefensible.

### 1.6 What gradient boosting actually is

Say this in your own words:

> Each tree is a shallow set of if/else rules. Tree 1 makes a rough guess.
> Tree 2 is trained to predict tree 1's *error*. Tree 3 predicts what's still
> wrong. Sum all 500 and you get the prediction. Learning rate 0.05 means each
> tree only contributes 5% of its correction, so 500 small steps beat 50 large
> ones. `max_depth=6` keeps each tree shallow so no single one overfits;
> `subsample=0.8` shows each tree 80% of the rows for the same reason.

**Why XGBoost and not a neural net?** 2,694 rows of tabular data. Gradient
boosted trees are state of the art at that scale; a neural net would overfit
and need orders of magnitude more data. Trees also export cleanly to a
dependency-free runtime (next section).

---

## 2. Inference — pure TypeScript, no Python

`server/src/xgboost-predictor.ts` (~230 lines)

Python trains and exports; **the server never runs Python**.

### 2.1 The artifacts (`server/data/`)

| File | Contents |
|---|---|
| `model.json` | 1.4 MB — XGBoost native JSON: per tree, arrays of `left_children`, `right_children`, `split_indices`, `split_conditions`, `base_weights` |
| `feature_config.json` | Feature order, sex map, sire/damsire encodings, **target percentile curve** |
| `training_report.json` | Metrics + importances |

These are committed via `.gitignore` negations (`server/data/*` then
`!server/data/model.json` …) so a fresh clone gets a working model while
generated training data stays ignored.

### 2.2 The tree walk

```typescript
function predictTree(tree: TreeNode, features: number[]): number {
  let nodeIdx = 0;
  while (tree.leftChildren[nodeIdx] !== -1) {      // -1 == leaf
    const featureVal = features[tree.splitIndices[nodeIdx]] ?? 0;
    nodeIdx = featureVal < tree.splitConditions[nodeIdx]
      ? tree.leftChildren[nodeIdx]
      : tree.rightChildren[nodeIdx];
  }
  return tree.baseWeights[nodeIdx];
}

// predictRaw: baseScore + Σ over 500 trees, then Math.expm1()
```

Start at the root, compare **one feature to one threshold**, branch, repeat to
a leaf. 500 times. Sum. Invert the log.

**Trade-off to state:** no Python runtime, no native bindings, no ONNX — runs
anywhere Node runs, sub-millisecond. Cost: locked to tree-based models in this
exact export format. Model and config are cached as module-level singletons
after first load.

**A parsing quirk worth mentioning** — XGBoost writes `base_score` as a string
like `"[5E-1]"`, so `loadModel` strips brackets and fixes the exponent
notation before `parseFloat`.

### 2.3 Unknown sires

`encodeSire()` looks the name up in the training-time table; anything unseen
falls back to the `"OTHER"` bucket's average. So the model degrades gracefully
on bloodlines it has never seen rather than throwing.

---

## 3. Where the outputs are used

### 3.1 Valuation — `ModelEngine` (`server/src/valuation-engine.ts`)

The GBP prediction becomes a **bounded multiplier** on the formula engine's
ADI valuation:

```typescript
const curve = this.predictor.getConfig().targetPercentiles;
const strength = curve ? mlSignalStrength(mlValueGBP, curve) : 0.5;
const mlMultiplier = ML_MULTIPLIER_MIN + strength * (ML_MULTIPLIER_MAX - ML_MULTIPLIER_MIN);
const adjustedValue = formulaResult.value * mlMultiplier;
```

`ML_MULTIPLIER_MIN = 0.6`, `ML_MULTIPLIER_MAX = 2.5` — deliberately narrow,
because the formula already prices wins, earnings and pedigree. The model is a
**corrective signal, not the dominant term**.

This runs inside the oracle pipeline, so **ML-influenced valuations are
committed on-chain** via `commitValuation` on every simulated event.
Kill switch: `VALUATION_ENGINE=formula`.

### 3.2 Breeding recommendations (`server/src/breeding-route.ts`)

The more interesting consumer. For **each candidate stallion** it predicts a
foal that does not exist:

1. `expectedOffspringTraits(sire, mare)` — averages the parents' trait vectors
2. Averages the two pedigree scores
3. Assumes `age: 3`, `sex: "C"` (colt)
4. Inherits **stallion's sire** and **mare's damsire** as bloodline features
5. Runs that synthetic horse through the model

That prediction is **25% of the ranking score**:

```
traits 25% + pedigree 20% + complement 15% + ML 25% − cost 10% + form 5%
```

- `traitMatch` = cosine similarity of trait vectors
- `complement` = does the stallion cover the mare's *weak* traits
- `costPenalty` = stud fee relative to the user's max
- `formBonus` = 0.05 if not injured

**It is fully deterministic** — no `Math.random` anywhere in the route.
Verified: three identical requests returned identical scores to six decimals.

---

## 4. The calibration bug — your best interview story

### 4.1 What was wrong

Both consumers converted GBP → multiplier like this:

```typescript
const mlMedian = 2500;                                  // "the training median"
const mlRatio = Math.max(0.1, Math.min(10, mlValueGBP / mlMedian));
const adjustedValue = formulaResult.value * (0.4 + 0.6 * mlRatio);
```

Two independent defects:

**(a) The constant was fabricated.** The comment claimed £2,500 was the
training median. The real distribution:

| | Prize money |
|---|---|
| median | **£0** |
| p75 | £1,840 |
| p90 | £7,746 |
| p95 | £18,520 |
| p99 | £120,055 |
| max | £850,650 |

Most racehorses never win prize money. £2,500 is roughly the **78th
percentile**, not the middle.

**(b) A linear ratio on a logarithmic quantity.** The 10× cap was reached at
£25,000 — which any competent racehorse clears. Everything above that
collapsed to one number.

### 4.2 The measurement that found it

Nothing crashed. No test failed. The bug was found by **logging intermediate
values across a sweep of six horses**:

| Horse | ML prediction | Multiplier (before) |
|---|---|---|
| maiden | £746 | 0.58× |
| modest | £7,856 | 2.29× |
| solid | £30,493 | **6.40× ← clamped** |
| good | £53,949 | **6.40× ← clamped** |
| elite | £66,844 | **6.40× ← clamped** |
| superstar | £91,983 | **6.40× ← clamped** |

The model ranked those correctly across a 3× spread. The blend threw it away
— exactly where breeding recommendations need discrimination.

### 4.3 The failed first fix (tell them this part)

The obvious fix is **percentiles**: map the prediction to where it ranks in
the population. Implemented it; the hard cap disappeared, but:

- A maiden with zero wins got a **1.83× boost**
- The top four *still* bunched: 2.43, 2.46, 2.47, 2.47

Same root cause, not yet fully absorbed: **when the median is £0, any positive
prediction is already above the 50th percentile**, and every good horse crams
into the top 2% of a population that is mostly zeros. Percentile stops
measuring "how good" and starts measuring "is it nonzero."

### 4.4 The actual fix

`mlSignalStrength()` — log-scale interpolation between two anchors taken from
the **real exported distribution** (p75 and p99):

```typescript
const l = Math.log1p(Math.max(0, valueGBP));
const t = (l - Math.log1p(lo)) / (Math.log1p(hi) - Math.log1p(lo));
return Math.max(0, Math.min(1, t));
```

Plus: the training script now **exports the target's percentile curve** so the
runtime reads real statistics instead of a hardcoded guess.

Result — monotonic across the whole range:

| Horse | Before | After |
|---|---|---|
| maiden | 0.58× | **0.60×** |
| modest | 2.29× | **1.26×** |
| solid | 6.40× | **1.88×** |
| good | 6.40× | **2.14×** |
| elite | 6.40× | **2.23×** |
| superstar | 6.40× | **2.38×** |

**The model never changed.** Same 500 trees, same R². Only the translation
from GBP to ADI was rewritten.

### 4.5 The kicker

The bug was **duplicated**. The breeding route had its own copy of the same
fabricated constant with a *tighter* clamp (saturating at £12,500), so the ML
term — 25% of the stallion ranking — contributed **nothing** to separating the
top two picks. Fixing one call site did not fix the other.

> **The real lesson:** the root cause wasn't the math, it was an **unverified
> magic number that got copy-pasted**. Any constant that claims a statistical
> property should be derived from the data, not typed in. That is exactly what
> the fix does now.

---

## 5. The LLM layer (`server/src/og-compute.ts`)

~80 lines. The standard `openai` SDK pointed at 0G Compute's OpenAI-compatible
proxy:

```typescript
new OpenAI({ baseURL: `${OG_COMPUTE_PROVIDER_URL}/v1/proxy`, apiKey: OG_COMPUTE_SECRET })
// model: qwen-2.5-7b-instruct, temperature 0.4, max_tokens 600
```

The prompt receives the **already-computed** score breakdowns and asks for 2–3
sentences per pick, `---`-separated.

> **Architectural point:** the LLM *explains* scores; it never *produces*
> them. Numbers stay deterministic and auditable; language is purely additive.
> Unconfigured (as locally) it returns empty strings and the UI omits prose.

Don't oversell this layer — it is small and currently inactive locally.

---

## 6. AI-adjacent systems

### 6.1 Biometric engine (`server/src/biometric-engine.ts`)

Deterministic, **not ML**, but it feeds the on-chain risk pipeline. Scores five
subsystems (heart, lungs, skeletal, musculature, joints), each with domain
modifiers:

- **Palmgren–Miner cumulative damage** on the skeletal score:
  `D = Σ(nᵢ / Nᵢ)` — genuine mechanical-engineering fatigue theory, applied to
  bone loading cycles
- X-Factor (enlarged heart gene) boosts the cardiac score
- MSTN "CC" genotype boosts sprint musculature

Output maps to a **risk score 1–6**; a 6 triggers the Lazarus circuit breaker
on-chain.

> **Caveat to volunteer:** `fatigueHistory` is never populated in the demo, so
> Miner damage is always 0.00, and the pipeline only runs a scan for
> `eventType === "BIOMETRIC"` — which the simulator never emits. The machinery
> is real; it isn't currently exercised.

### 6.2 The data flywheel — designed, not closed

- `event-indexer.ts` appends every on-chain event with a **full feature
  snapshot** to `training-events.jsonl`. This is real future training data and
  it *is* running.
- `prediction-log.ts` implements predicted-vs-actual accuracy tracking with a
  `GET /predictions/accuracy` endpoint — but **nothing ever calls
  `logPrediction`**. It is dead code.
- Nothing retrains automatically.

> **Honest framing:** "Collection is live, accuracy tracking is scaffolded,
> closing the retraining loop is future work."

### 6.3 The agent-safety story

"AI proposes, humans execute, contracts enforce." The advisor has its own
on-chain identity (`BreedingAdvisorINFT`) holding a **0G Storage root hash of
its model bundle** — weights, dataset, model card, code — so the intelligence
is user-owned and integrity-verifiable.

**See the NFT study guide, section 7** — the on-chain enforcement path
(`AgentExecutor`) had a real design flaw (a delegated executor could never act
for a user) which was found and fixed; the signed budget and deadline are now
genuinely enforced on-chain.

---

## 6b. The agent, end to end — how "Propose Breeding" actually works

> This is the piece that turns the model into a product. Know it cold; it is
> the most likely deep-dive target because it spans ML, contracts, and UX.

### 6b.0 "The agent" is four separable things

Being precise about this is the single most valuable framing you can offer:

| Piece | Where | What it is |
|---|---|---|
| **Identity** | `BreedingAdvisorINFT` (on-chain) | NFT holding name, version, specialization, and a 0G Storage root hash of the model bundle |
| **Intelligence** | `server/src/breeding-route.ts` + XGBoost | The scoring. Off-chain, in Node |
| **Orchestration** | `app/lib/agent-proposal.ts` | Decides *what to evaluate* |
| **Authority** | `AgentExecutor.sol` | Verifies a user-signed plan, enforces bounds on-chain |

**The agent has no key, no wallet, and no autonomy.** It cannot initiate
anything. That is the security story, and it is architectural rather than
policy — see §6b.2.

### 6b.1 The propose path

**Step 1 — Data acquisition (on-chain reads).**
`useHorsesWithListings()` multicalls `getHorseData(0..99)` and `listings(id)`.
A second multicall of `ownerOf(id)` builds `ownedTokenIds`, using
**lowercase-normalised comparison** — `ownerOf` returns EIP-55 checksummed
addresses and wagmi may supply different casing; a naive `===` silently yields
an empty set. (That exact bug is what the one Vitest file guards.)

**Step 2 — Eligibility filtering** (`app/lib/breeding-rules.ts`), mirroring the
contract's `require`s exactly:

```typescript
eligibleMares = owned && sex === FEMALE && !injured && breedingAvailable
eligibleStallions(mare) =
    sex === MALE && !injured && breedingAvailable
    && studFeeADI > 0 && !closelyRelated(stallion, mare)
```

`closelyRelated` is a **depth-2 recursive ancestry walk** replicating
`BreedingMarketplace._requireNotCloselyRelated`: parents and grandparents in
both directions, plus a sibling check on shared `sireId`/`damId`.

The founder guard matters: **token 0 is a real id**, so "no parent" is only
unambiguous when *both* ids are zero. Without it, all eight seeded founders
would look like siblings and nothing could breed.

**Step 3 — Scoring (server, one request per mare).** For each stallion the
server *synthesizes the unborn foal*:

```typescript
offspringTraits = sire.map((s,i) => Math.round(s*0.55 + dam[i]*0.45));
pedigreeScore   = (mare.pedigreeScore + stallion.pedigreeScore) / 2;
age: 3, sex: "C", sire: stallion.sire, damsire: mare.damsire
```

The 55/45 is deliberately **the same weighting the contract applies** in
`_computeOffspring`, so the prediction describes the foal that would actually
be minted — not an approximation of it. That foal goes through XGBoost, and
the result is blended:

```
0.25·traits + 0.20·pedigree + 0.15·complement + 0.25·ML − 0.10·cost + 0.05·form
```

- `traits` — cosine similarity of the two 8-dim trait vectors
- `complement` — for traits where the *mare* is below 0.8, the stallion's
  average: "does he cover her weaknesses"
- `ML` — `mlSignalStrength()`, the log-scaled mapping from §4

**Step 4 — Global ranking** (`buildAgentProposal`). This is the actual
difference from the breeding lab. The lab scores **one mare's** stallions; the
agent iterates **every eligible mare**, flattens every `(mare, stallion, score)`
triple into one array, sorts descending, and returns the top 3 across the whole
cross-product.

It simultaneously records *rejections* via `pairingBlockReason()`, which is what
powers the "N pairings ruled out → *Galileos Edge is a parent of TestFoal*"
disclosure. **The agent shows its work** rather than silently filtering — worth
demoing, because it makes the genetics rules visible.

Fallback: if the server is unreachable it uses `scoreStallions()` (client
heuristic, **no ML term**) and the UI badges it *"scored locally"*, so you are
never misled about which ran.

### 6b.2 The execute path

1. **Sign the EIP-712 plan.** The domain **must** include
   `verifyingContract` — OpenZeppelin's `_hashTypedDataV4` binds the domain
   separator to the contract address; omit it and `ECDSA.recover` returns a
   different signer and reverts. This was a live bug, invisible because the
   signature was never submitted.
2. **Approve ADI → the marketplace** (not the executor — the marketplace pulls
   the fee from *you*).
3. **`setApprovalForAll(agentExecutor, true)`** — one-time, revocable ERC-721
   operator grant. This is the authorization primitive.
4. **`AgentExecutor.execute(...)`** re-verifies on-chain:

```solidity
require(msg.sender == plan.user);
require(block.timestamp <= plan.deadline,             "Expired");
signer = _hashTypedDataV4(structHash).recover(signature);
require(signer == plan.user,                          "Invalid signature");
require(horseNFT.ownerOf(plan.mareTokenId) == plan.user, "Not mare owner");
(studFee,,,,) = marketplace.listings(plan.chosenStallionTokenId);
require(studFee <= plan.maxStudFeeADI && studFee <= plan.budgetADI, "Over budget");
marketplace.purchaseBreedingRightFor(stallion, seed, plan.user);
marketplace.breedFor(stallion, mare, name, salt, plan.user);
```

It reads the **live** stud fee rather than trusting the plan, so a stallion
owner raising their price between proposal and execution cannot exceed the cap
you signed.

The `*For` variants take an explicit `account`; authorization is
`msg.sender == account || isApprovedForAll(account, msg.sender)`, and every
economic effect keys to `account` — fee from you, right recorded to you,
**foal minted to you**. The executor is a pure conduit that never holds value.

### 6b.3 Where the intelligence actually lives

`BreedingAdvisorINFT` is an **identity and provenance record, not a brain**. It
stores a 0G Storage root hash of the model bundle so the intelligence is
user-owned and integrity-verifiable.

**The chain never executes the model.** If asked "is the AI on-chain?":

> The model's identity and integrity hash are on-chain; inference is off-chain,
> because running 500 gradient-boosted trees in the EVM would be economically
> absurd. What is on-chain is the commitment to *which* model produced the
> recommendation.

### 6b.4 Boundaries to volunteer

- Scoring is **sequential**, one HTTP round-trip per mare. Fine at 3 mares;
  needs parallelising at scale.
- The rules are **duplicated** client-side and on-chain *by design* — the
  contract is the authority, the client copy exists so a rejected pairing is a
  greyed-out option instead of a failed transaction. They live in one shared
  module (`breeding-rules.ts`) precisely so they cannot drift — the lesson from
  the ML constant that was copy-pasted into two call sites and fixed in only
  one (§4.5).
- Model inputs are still partly synthesized (§7).

---

## 7. The honest caveat: synthesized inputs

The model was trained on horses with **real race histories**. On-chain horses
have 8 trait values and a pedigree score — no race record. So
`featuresToXGBInput()` fabricates the gap:

```typescript
placeCount: Math.round(wins * 1.8),
avgPosition: races > 0 ? (wins > 0 ? Math.max(1, 5 - (wins/races)*4) : 6) : 0,
stdPosition: 2.5,        // constant
avgFieldSize: 8,         // constant
avgWeight: 128,          // constant
avgSp: 10, minSp: 3,     // constants
avgClass: Math.max(1, 6 - pedigreeScore / 2000),   // invented from pedigree
```

> **Say this before they find it:** "The model is trained on real data and the
> inference is genuine, but in the demo it's scored against partly synthesized
> features, because on-chain horses don't have race records yet. The event
> indexer is accumulating real ones."

---

## 8. Likely questions, with answers

**"Why XGBoost over a neural network?"**
2,694 rows of tabular data — GBTs are state of the art at that scale; a net
would overfit. Also exports to a dependency-free TS runtime.

**"Why reimplement inference instead of a Python service or ONNX?"**
One less runtime to deploy, sub-ms in-process latency, stable format. Cost:
tree models only.

**"How do you know it works?"**
5-fold CV during training. Determinism verified (identical outputs across
runs). Sensitivity verified — held trait vectors constant, varied only
pedigree, predictions moved £3,783 → £13,109 in the correct order.

**"Isn't R² 0.969 too high?"**
Yes, and here's why: career aggregates predicting career earnings are causally
entangled. It's a valuation signal, not a race predictor.

**"What's the weakest part of the ML?"**
Two things: the input synthesis for on-chain horses, and the calibration
constants (0.6–2.5 bounds, p75/p99 anchors) chosen by judgment rather than
backtesting.

**"What would you do next?"**
Wire `logPrediction` into the pipeline so accuracy is measured against
realized outcomes, then retrain on indexer data once enough real events
accumulate.

**"Walk me through what happens when a user clicks Propose Breeding."**
See §6b — chain reads, eligibility filtering against a client mirror of the
contract rules, per-mare server scoring on a synthesized foal, global ranking
across the cross-product, then an EIP-712 plan the contract re-verifies.

**"How is the ML prevented from doing damage?"**
It never touches money directly. Valuation goes through the oracle role;
breeding requires a user-signed plan and on-chain budget checks; the agent
wallet has rolling spend caps. (See NFT guide §7 for the caveat.)

---

## 9. File map for quick reference

| Path | Role |
|---|---|
| `scripts/ml/train_xgboost.py` | Training, feature engineering, artifact export |
| `server/data/model.json` | 500-tree model, XGBoost native JSON |
| `server/data/feature_config.json` | Feature order, encodings, percentile curve |
| `server/src/xgboost-predictor.ts` | TS inference, `mlSignalStrength()` |
| `server/src/valuation-engine.ts` | `FormulaEngine` + `ModelEngine` blend |
| `server/src/breeding-route.ts` | Stallion scoring, 25% ML weight |
| `server/src/og-compute.ts` | LLM explanations |
| `server/src/biometric-engine.ts` | Palmgren–Miner risk scoring |
| `server/src/event-indexer.ts` | Training-data accumulation |
| `server/src/prediction-log.ts` | Accuracy tracking (⚠ no callers) |
| `app/lib/agent-proposal.ts` | Agent proposal engine — ranks the full cross-product |
| `app/lib/breeding-rules.ts` | Shared eligibility rules (client mirror of the contract) |
| `app/components/agent/AgentProposalCard.tsx` | Proposal UI, incl. "ruled out" disclosure |
| `contracts/src/AgentExecutor.sol` | EIP-712 plan verification + on-chain bounds |
