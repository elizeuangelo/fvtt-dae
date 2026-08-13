const MEDIUM_ARMOR_TYPE = "medium";

/**
 * Restore the canonical Stealth-disadvantage flag before actor effects and
 * equipped armor are evaluated again. This removes a value derived by an
 * earlier preparation pass without discarding a stored actor flag.
 *
 * @param {Actor} actor  Actor being prepared.
 */
export function restoreSourceStealthDisadvantage(actor) {
    const sourceValue = actor?._source?.flags?.["midi-qol"]?.disadvantage?.skill?.ste;
    const currentSkillFlags = actor?.flags?.["midi-qol"]?.disadvantage?.skill;
    if (sourceValue === undefined) {
        if (currentSkillFlags)
            delete currentSkillFlags.ste;
        return;
    }
    actor.flags["midi-qol"] ??= {};
    actor.flags["midi-qol"].disadvantage ??= {};
    actor.flags["midi-qol"].disadvantage.skill ??= {};
    actor.flags["midi-qol"].disadvantage.skill.ste = sourceValue;
}

/**
 * Temporarily apply an actor's DAE Dexterity-cap bonus to equipped medium
 * armor while dnd5e prepares Armor Class.
 *
 * @param {Actor} actor                   Actor whose equipped armor is being prepared.
 * @param {Function} prepareArmorClass    The dnd5e Armor Class preparation callback.
 * @returns {*}                           The callback's result.
 */
export function withMediumArmorDexCapBonus(actor, prepareArmorClass) {
    const bonus = Number(actor?.flags?.dae?.mediumArmorDexCapBonus);
    if (!Number.isFinite(bonus) || bonus === 0)
        return prepareArmorClass();
    const originalDexCaps = [];
    for (const item of actor?.itemTypes?.equipment ?? []) {
        if (!item.system?.equipped || item.system.type?.value !== MEDIUM_ARMOR_TYPE)
            continue;
        const dexCap = item.system.armor?.dex;
        if (!Number.isFinite(dexCap))
            continue;
        originalDexCaps.push([item, dexCap]);
        item.system.armor.dex = dexCap + bonus;
    }
    try {
        return prepareArmorClass();
    }
    finally {
        for (const [item, dexCap] of originalDexCaps)
            item.system.armor.dex = dexCap;
    }
}

/**
 * Test whether an actor has equipped armor that imposes Stealth disadvantage.
 * Medium armor is ignored when the corresponding DAE flag is enabled.
 *
 * @param {Actor} actor                  Actor whose equipment is being checked.
 * @param {boolean} usesItemProperties  Whether the dnd5e v3 item property Set is available.
 * @returns {boolean}
 */
export function hasArmorStealthDisadvantage(actor, usesItemProperties = true) {
    const ignoreFlag = actor?.flags?.dae?.ignoreMediumArmorStealthDisadvantage;
    const ignoreMediumArmor = [true, 1, "true", "1"].includes(ignoreFlag);
    return (actor?.items ?? []).some(item => {
        if (!item.system?.equipped)
            return false;
        const imposesDisadvantage = usesItemProperties
            ? item.system.properties?.has?.("stealthDisadvantage") === true
            : item.system.stealth === true;
        if (!imposesDisadvantage)
            return false;
        return !(ignoreMediumArmor && item.system.type?.value === MEDIUM_ARMOR_TYPE);
    });
}
