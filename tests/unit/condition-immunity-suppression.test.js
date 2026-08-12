import assert from "node:assert/strict";
import test from "node:test";

import {
    applyConditionImmunitySuppression,
    conditionImmunityMatches
} from "../../module/Systems/condition-immunity-suppression.js";

function createEffect({ disabled = false } = {}) {
    return {
        name: "poisoned",
        isSuppressed: false,
        disabled,
        _source: { disabled },
        get active() {
            return !this.disabled && !this.isSuppressed;
        }
    };
}

function determineConditionImmunitySuppression(effect, conditionImmunity) {
    // Mirrors the reset at the start of DAE's determineSuppression override.
    effect.isSuppressed = false;
    applyConditionImmunitySuppression(effect, conditionImmunity);
}

function snapshot(stage, effect) {
    return {
        stage,
        isSuppressed: effect.isSuppressed,
        disabled: effect.disabled,
        sourceDisabled: effect._source.disabled,
        active: effect.active
    };
}

test("condition immunity suppresses an enabled effect without disabling it", () => {
    const effect = createEffect();
    const stages = [];

    determineConditionImmunitySuppression(effect, { value: new Set(), custom: "" });
    stages.push(snapshot("Initial", effect));

    determineConditionImmunitySuppression(effect, {
        value: new Set(["poisoned"]),
        custom: ""
    });
    stages.push(snapshot("Matching immunity added", effect));

    determineConditionImmunitySuppression(effect, { value: new Set(), custom: "" });
    stages.push(snapshot("Immunity removed", effect));

    assert.deepEqual(stages, [
        {
            stage: "Initial",
            isSuppressed: false,
            disabled: false,
            sourceDisabled: false,
            active: true
        },
        {
            stage: "Matching immunity added",
            isSuppressed: true,
            disabled: false,
            sourceDisabled: false,
            active: false
        },
        {
            stage: "Immunity removed",
            isSuppressed: false,
            disabled: false,
            sourceDisabled: false,
            active: true
        }
    ]);
});

test("condition immunity never re-enables an intentionally disabled effect", () => {
    const effect = createEffect({ disabled: true });

    determineConditionImmunitySuppression(effect, {
        value: new Set(["poisoned"]),
        custom: ""
    });
    assert.deepEqual(snapshot("Matching immunity added", effect), {
        stage: "Matching immunity added",
        isSuppressed: true,
        disabled: true,
        sourceDisabled: true,
        active: false
    });

    determineConditionImmunitySuppression(effect, { value: new Set(), custom: "" });
    assert.deepEqual(snapshot("Immunity removed", effect), {
        stage: "Immunity removed",
        isSuppressed: false,
        disabled: true,
        sourceDisabled: true,
        active: false
    });
});

test("custom immunities are null-safe, normalized, and ignore empty entries", () => {
    assert.equal(conditionImmunityMatches("poisoned", { value: new Set() }), false);
    assert.equal(conditionImmunityMatches("poisoned", {
        value: new Set(),
        custom: " Frightened ; ; POISONED ; "
    }), true);
});
