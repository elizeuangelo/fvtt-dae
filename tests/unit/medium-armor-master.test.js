import assert from "node:assert/strict";
import test from "node:test";

import {
    hasArmorStealthDisadvantage,
    restoreSourceStealthDisadvantage,
    withMediumArmorDexCapBonus
} from "../../module/Systems/medium-armor-master.js";

function armor(type, { dex = 2, equipped = true, stealthDisadvantage = false } = {}) {
    return {
        _source: { system: { armor: { dex } } },
        system: {
            armor: { dex },
            equipped,
            properties: new Set(stealthDisadvantage ? ["stealthDisadvantage"] : []),
            stealth: stealthDisadvantage,
            type: { value: type }
        }
    };
}

test("medium armor Dexterity cap bonus applies only during AC preparation and only to equipped medium armor", () => {
    const medium = armor("medium");
    const light = armor("light", { dex: 99 });
    const heavy = armor("heavy", { dex: 0 });
    const unequippedMedium = armor("medium", { equipped: false });
    const actor = {
        flags: { dae: { mediumArmorDexCapBonus: 1 } },
        itemTypes: { equipment: [medium, light, heavy, unequippedMedium] }
    };

    const result = withMediumArmorDexCapBonus(actor, () => {
        assert.equal(medium.system.armor.dex, 3);
        assert.equal(light.system.armor.dex, 99);
        assert.equal(heavy.system.armor.dex, 0);
        assert.equal(unequippedMedium.system.armor.dex, 2);
        return "prepared";
    });

    assert.equal(result, "prepared");
    assert.equal(medium.system.armor.dex, 2);
});

test("medium armor Dexterity cap is restored if AC preparation throws", () => {
    const medium = armor("medium");
    const actor = {
        flags: { dae: { mediumArmorDexCapBonus: 1 } },
        itemTypes: { equipment: [medium] }
    };

    assert.throws(() => withMediumArmorDexCapBonus(actor, () => {
        throw new Error("AC preparation failed");
    }), /AC preparation failed/);
    assert.equal(medium.system.armor.dex, 2);
});

test("Stealth ignore flag cancels only medium armor disadvantage", () => {
    const medium = armor("medium", { stealthDisadvantage: true });
    const actor = {
        flags: { dae: { ignoreMediumArmorStealthDisadvantage: true } },
        items: [medium]
    };

    assert.equal(hasArmorStealthDisadvantage(actor), false);

    actor.items.push(armor("heavy", { stealthDisadvantage: true }));
    assert.equal(hasArmorStealthDisadvantage(actor), true);
});

test("Stealth ignore flag accepts DAE's numeric boolean representation", () => {
    const actor = {
        flags: { dae: { ignoreMediumArmorStealthDisadvantage: 1 } },
        items: [armor("medium", { stealthDisadvantage: true })]
    };

    assert.equal(hasArmorStealthDisadvantage(actor), false);
});

test("Stealth disadvantage remains without the ignore flag and supports the pre-v3 field", () => {
    const medium = armor("medium", { stealthDisadvantage: true });
    const actor = { flags: { dae: {} }, items: [medium] };

    assert.equal(hasArmorStealthDisadvantage(actor), true);
    assert.equal(hasArmorStealthDisadvantage(actor, false), true);
});

test("actor preparation clears stale armor-derived Stealth disadvantage", () => {
    const actor = {
        _source: { flags: {} },
        flags: {
            dae: { ignoreMediumArmorStealthDisadvantage: true },
            "midi-qol": { disadvantage: { skill: { ste: true } } }
        },
        items: [armor("medium", { stealthDisadvantage: true })]
    };

    restoreSourceStealthDisadvantage(actor);

    assert.equal(actor.flags["midi-qol"].disadvantage.skill.ste, undefined);
    assert.equal(hasArmorStealthDisadvantage(actor), false);
});

test("actor preparation preserves a stored Stealth disadvantage", () => {
    const actor = {
        _source: { flags: { "midi-qol": { disadvantage: { skill: { ste: true } } } } },
        flags: { "midi-qol": { disadvantage: { skill: { ste: false } } } }
    };

    restoreSourceStealthDisadvantage(actor);

    assert.equal(actor.flags["midi-qol"].disadvantage.skill.ste, true);
});
