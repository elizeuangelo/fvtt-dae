# DAE condition-immunity suppression regression

Run this test as a GM after the world is ready, with D&D5e and DAE active.
Open the browser developer console and execute:

```js
await import(`/modules/dae/tests/foundry/condition-immunity-suppression.js?v=${Date.now()}`)
    .then(module => module.runConditionImmunitySuppressionRegression());
```

The default run performs two isolated checks:

1. It clones a world NPC or character as an ephemeral document (or constructs
   an ephemeral NPC if the world contains no suitable actor), then evaluates
   the same Active Effect instance across the no-immunity, matching-immunity,
   and removed-immunity stages.
2. It creates a temporary world actor to exercise Foundry's persisted update
   and preparation lifecycle. The actor name starts with
   `[DAE REGRESSION TEST - DELETE ME]`, and the actor is deleted in `finally`.

Every stage records the pre-invocation and post-invocation values of
`isSuppressed`, `disabled`, and `_source.disabled`, plus `active` and whether
Foundry retained the same effect object. The table reports `PASS` or `FAIL` for
each transition, and the returned result distinguishes the known
`bugReproduced` transition from an unexpected failure. A separate intentionally
disabled ephemeral effect verifies that the regression fix does not re-enable
it.

To run only the non-persisted reproduction:

```js
await runDaeConditionImmunitySuppressionRegression({ includePersisted: false });
```
