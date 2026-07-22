# #25 — Explicit next-state (prime) semantics for acceptors

**Milestone:** v2 strict profile · **Depends on:** #21 (declared model shape), #23 (keyed acceptors) · **Status:** implemented (Phase 5.5)

> **Implemented in** `lib/sam-strict.js` (`SamFrameError`) and `lib/sam-instance.js` (frozen pre-state, `next` draft, `unchanged`, per-step union frame check, double-prime, atomic commit, `lastStep().primed`/`.unchanged`, and `manifest().acceptors.frames` per-acceptor prime/frame reporting). Covered by `test/v2/next-state.test.js` (15 tests); the #20–#24 strict suites were migrated to the `next`-draft contract. Full suite green (237).

## Observed failure

| Observed failure | Root cause in v1 | v2 fix | Issue |
|---|---|---|---|
| Order-dependent acceptors: a later assignment silently reads an earlier assignment's *new* value, so statement order changes the transition's meaning; transpiled specs disagree with the code; "which variables did this step actually leave alone" is unrecoverable without parsing bodies | Acceptors mutate `model` in place — there is one slot per variable, serving as both the pre-state (`x`) and the next-state (`x'`) value, disambiguated only by read-vs-write position and only in the developer's head | Split the two namespaces: a **frozen pre-state** (`model`, unprimed) and a **write-only next-state draft** (`next`, primed), committed atomically as the single synchronized step | #25 |

## Motivation

SAM's acceptor is a next-state relation in the TLA+ sense: given the current state and a proposal, it determines the next state. TLA+ makes that relation explicit through **primed variables** — `x` is the value before the step, `x'` the value after — and it makes it *total*: every declared variable has a prime in every step, either assigned (`term' = term + 1`) or held (`UNCHANGED term`, which is just `term' = term`). A variable an action fails to mention is left unconstrained, and TLA+ discipline treats that as the bug it usually is.

v1 has no prime. The acceptor mutates `model` directly, so `model.term` denotes both `term` and `term'` depending on which side of an assignment you are on:

```js
// v1 / current strict — one slot, two meanings
ElectionTimeout: model => (proposal, { reject }) => {
  if (model.role === 'leader') return reject('leaders do not time out')
  model.role = 'candidate'
  model.term += 1
  model.votedFor = tallyFor(model.term)   // reads term' — almost certainly meant term
}
```

Three consequences, all convention-where-it-should-be-construction:

1. **Read-your-writes is the default.** The last line reads the *already-incremented* term. Whether that is correct is invisible; reordering the statements changes the transition. In TLA+ the two readings are different formulas (`votedFor'` in terms of `term` vs `term'`) and you are forced to choose.
2. **The frame is implicit and unchecked.** Nothing records that `votedFor` and `log` were meant to be `UNCHANGED` this step versus forgotten. This is the same silent-omission family as #20 (dropped payload), one level up: a generated or hand-edited acceptor that quietly fails to constrain a variable is indistinguishable from one that deliberately leaves it alone.
3. **The step is not a value.** Because writes land in `model` as they execute, there is no primed record a transpiler, determinism checker, or step log can read off directly — mutation order is entangled with mutation result.

#21 already supplies the substrate: `modelShape` is SAM's `VARIABLES`, and the strict Proxy in `sam-instance.js` already records `stepWrites`/`stepMutations` per step. What is missing is the pre-state/next-state *separation* — the prime itself.

## Design

**This is the strict-profile acceptor contract, not an alternative form.** In the strict profile the next-state semantics are canonical: `model` is the frozen pre-state and all writes go through `next`. There is no signature to detect and no in-place strict variant to coexist with — construction over convention (principle #2). In-place mutation remains a **default-mode (v1)** feature only. (This supersedes the in-place strict acceptor body shown in the V2-PLAN API sketch; that sketch predates #25.)

The signature is the existing strict keyed-acceptor form (curried `model => (proposal, stepApi) =>`, #23) with the pre-state frozen and `next` + `unchanged` added to the step API — no new positional argument, so nothing is inferred from arity:

```js
acceptors: {
  ElectionTimeout: model => (proposal, { reject, next, unchanged }) => {
    // model    : frozen pre-state — unprimed (variable-level: top-level writes throw)
    // proposal : the schema-validated payload (#20)
    // next     : write-only draft      — primed   (shape-checked per #21)
    if (model.role === 'leader') return reject('leaders do not time out')
    next.role = 'candidate'
    next.term = model.term + 1
    next.votedFor = tallyFor(model.term)   // unambiguously the OLD term
    unchanged('log')                       // required: every shape var must be assigned or framed
  }
}
```

Mechanics (reuse existing machinery):

- **`model` is frozen at the variable level** — a proxy over the live (not-yet-committed) model whose top-level observable writes throw `SamShapeError`. This is what makes "reads are pre-state" a construction guarantee rather than a habit, and it is what forces migration of existing strict acceptors from `model.x =` to `next.x =`. The freeze is deliberately **shallow**: mutating *inside* a variable (`model.nodes[k].field = v`) is not trapped — it bypasses the prime discipline entirely and is caught only by the #31/S2 deep-change snapshot fallback (classified `mutated` with `deep: true`, invisible to `primed`/`mutations`). Deep-freezing was considered and rejected: it would break the documented top-level-replacement idiom and the deep-change classification tests. The strict idiom is: read nested state freely, build a fresh value, assign `next.<var>`.
- **`next` is the shape-checking Proxy** already built in `sam-instance.js:143`, retargeted from `model` to a fresh draft object. Same `checkShapeWrite` type/nullable/undeclared-key enforcement, same `stepWrites`/`stepMutations` recording.
- **Commit is the existing single synchronized step**: after all keyed and `'*'` acceptors run and no rejection fired, `Object.assign(model, draft)` for the primed keys. Reactors/naps see the committed model, unchanged from today.

### Frame policy: explicit is the strict default

Every shape variable has a prime every step; the only question is who writes the `UNCHANGED` conjuncts for the untouched ones. In the strict profile the answer is the author, always — a variable's fate is never left to a silent convention.

- **Explicit frame — the strict default.** Every `modelShape` variable must be *accounted for* by the step: assigned in `next`, or named via `unchanged('log', 'votedFor')`. A variable left neither assigned nor declared unchanged throws `SamFrameError` at commit. This is TLA+'s actual rule (`x'` is unconstrained unless the action assigns it or states `UNCHANGED x`), and it is what makes "a dropped variable is a construction-time failure" true by default — the same silent-omission family as #20, closed the same way. `unchanged()` accepts names, `unchanged('*')` frames all remaining unmentioned variables for the rare genuinely-read-only step. Names are validated: `unchanged('rolle')` (a typo for a variable not in `modelShape`) throws `SamFrameError` immediately rather than silently failing to frame `role`.
- **The frame is per-step, not per-acceptor.** A proposal can run its keyed acceptor plus any `'*'` broadcast acceptors; together they are the step's next-state relation. Completeness is checked once at commit over the **union** of all assignments and `unchanged(...)` declarations from the acceptors that ran — so a broadcast acceptor touching only `auditLog` need not frame variables the keyed acceptor owns. Two acceptors assigning the *same* variable in one step is a `SamFrameError` (double-prime — a conflicting next-state constraint), not last-write-wins.
- **Implicit frame is default-mode only.** Outside strict mode, an unassigned variable is carried forward from pre-state automatically (matching v1 in-place behavior). It is *not* available in strict mode — offering it would reintroduce the exact "unmentioned = forgotten-or-intended?" ambiguity the strict profile exists to remove.

The frame policy never changes what the transpiler emits: the framework always knows the full variable set (`modelShape`) and the primed set (`stepWrites`), so the untouched variables become the `UNCHANGED <<...>>` clause either way. Explicit frame governs whether the *author* had to be exhaustive — and in strict mode they must be.

## Tooling & manifest

- `instance.lastStep()` gains a primed view: `{ intent, primed: { term: { from, to } }, unchanged: [...], rejections, classification }` — the observable next-state relation, per step, read straight off the draft. **(implemented)**
- `instance.manifest().acceptors.frames` reports, per keyed acceptor (broadcast/array under `'*'`), `{ primes: [...], unchanged: [...], unchangedAll }` — variables it assigns vs. the ones it declares unchanged — so the SAM→TLA+ transpiler recovers `UNCHANGED` clauses from structure, without parsing bodies. **(implemented)** Attribution is structural (each `next.<var>` write and `unchanged(...)` call is tagged with the acceptor that made it) and accrues from execution, converging under domain exploration; it is empty before any intent fires.
- The determinism checker can now run an acceptor twice against the same frozen pre-state and compare `next` drafts — a pure `(pre-state, proposal) → primed record` function, with no in-place side effects to reset between runs.

## Acceptance (TDD — failing tests first, `test/v2/*.test.js`)

1. **Read-your-writes regression.** An acceptor sets `next.term = model.term + 1` then `next.votedFor` from `model.term`; assert `votedFor` used the *pre-state* term. The in-place idiom cannot express this correctly; the `next`-draft form passes. (This is the #25 study defect.)
2. **Frozen pre-state.** Writing to `model` inside an acceptor throws `SamShapeError` (the frozen-model set trap), not a bare `TypeError`.
3. **Shape enforcement on the draft.** Undeclared / ill-typed `next.<key>` throws `SamShapeError` — parity with the in-place strict Proxy.
4. **Explicit frame is the strict default.** A step that neither assigns nor `unchanged()`-declares a shape variable (across all acceptors that ran) throws `SamFrameError` at commit; naming it via `unchanged(...)` (or `unchanged('*')`) passes and leaves it at its pre-state value. Two acceptors assigning the same variable in one step also throws `SamFrameError` (double-prime).
5. **Implicit frame is refused in strict mode.** The default-mode carry-forward behavior is not silently available under `strict: true` — the omission is the failure, not a convenience.
6. **Manifest / step log.** `manifest()` reports each acceptor's prime set and frame without body parsing; `lastStep().primed` matches the committed change set.
7. **Backward-compat gate.** The v1 (default-mode) suite stays green bit-for-bit — in-place mutation is untouched there. Strict-mode acceptors adopt the next-state contract: writing to the frozen `model` throws, and the `#20`–`#24` strict examples are migrated to `next.<var> =` as part of this issue. No arity sniffing anywhere.

## Scope: primes are per-variable, not per-field

The prime/frame semantics operate at the granularity of a `modelShape` **variable** (a top-level key) — the same granularity as TLA+ `VARIABLES`. A step assigns `next.<var>` or leaves it `UNCHANGED`; that is the whole obligation the framework tracks.

When a variable *is* an object or array, how you compute its next value is ordinary application code, and deliberately so. The framework does not model primes *into* nested structure, does not diff sub-fields, and takes no position on functional-vs-mutating construction of a variable's contents — assigning `next.log` a value the author built by whatever means (spread, map, a helper, a mutated copy) is the author's concern. Reaching inside a variable to prime individual fields is a per-case problem better solved by custom code than by a general mechanism; attempting to generalize it would import TLA+'s record/function-update machinery for little benefit and a lot of surface area. `next.<var>` is a genuine value assignment at commit; nothing below that line is the library's business.

(The freeze matches this granularity: `model.log` is readable and `model.log = v` throws, but the freeze does not extend *into* the value — `model.log.push(e)` is not trapped. In-place nested mutation bypasses the prime discipline and surfaces only as a #31/S2 deep-change (`deep: true`), so the strict idiom is to build a fresh value and assign `next.log`.)

## Resolved: no signature detection

The strict profile makes the next-state form canonical, so there is nothing to detect. `model` is frozen and writes go to `next` whenever the contract is active; there is no in-place strict variant to distinguish by arity or flag. This keeps the profile true to construction-over-convention: the correct form is the *only* form, and the wrong one (writing `model`) is a loud throw, not a silently-tolerated alternative.

**Activation gate: `strict: true` AND a declared `modelShape`.** The shape *is* the variable set primes range over — without it there is no frame to check and no draft to type-check, so a strict instance that has not declared a shape keeps in-place mutation. This is not a loophole in practice: `instance.validate()` already fails strict specs without a `modelShape`, so any validated strict spec is in next-state mode.

**Unhandled intents throw.** A fired intent that no acceptor constrains (nothing assigned, nothing declared unchanged) leaves the entire frame empty and throws `SamFrameError` with `unhandledIntent` set and a message naming the intent — superseding, in next-state mode, #22's dev-warning classification for this case at the intent level. This is TLA+'s own verdict (every variable unconstrained = spec error) applied with the strict profile's loudness; `lastStep()` still records the step as `unhandled` for tooling.

## Non-goals

- No change to default (v1) mode or to the reactive loop order. In-place mutation lives on in default mode.
- No dual strict acceptor surface. There is exactly one strict acceptor contract (frozen `model` + `next`); migrating existing strict alpha acceptors to it is part of this issue, not an optional path.
