import assert from "node:assert/strict";
import test from "node:test";

import { addLevelRollData } from "../../module/Systems/level-roll-data.js";

test("character roll data exposes level without changing the original data", () => {
    const rollData = { details: { level: 7 }, abilities: { str: { mod: 2 } } };
    const result = addLevelRollData("character", rollData);

    assert.equal(result.details.crOrLevel, 7);
    assert.equal(result.details.effectiveLevel, 7);
    assert.equal(result.abilities, rollData.abilities);
    assert.deepEqual(rollData.details, { level: 7 });
});

test("NPC roll data uses CR even when the NPC also has class levels", () => {
    const result = addLevelRollData("npc", { details: { cr: 0.25, level: 5 } });

    assert.equal(result.details.crOrLevel, 0.25);
    assert.equal(result.details.effectiveLevel, 3.25);
});

test("CR 0 is retained and unsupported actor types are unchanged", () => {
    const rollData = { details: { cr: 0, level: 4 } };
    const npcData = addLevelRollData("npc", rollData);

    assert.equal(npcData.details.crOrLevel, 0);
    assert.equal(npcData.details.effectiveLevel, 3);
    assert.equal(addLevelRollData("vehicle", rollData), rollData);
});
