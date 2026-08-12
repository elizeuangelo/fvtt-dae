/**
 * Test whether an Active Effect name matches one of an actor's condition
 * immunities. D&D5e stores configured immunities in `value` and user-entered
 * immunities as a semicolon-delimited `custom` string.
 *
 * @param {string} effectName
 * @param {{value?: Iterable<string>, custom?: string} | undefined} conditionImmunity
 * @returns {boolean}
 */
export function conditionImmunityMatches(effectName, conditionImmunity) {
    const customImmunities = String(conditionImmunity?.custom ?? "")
        .split(";")
        .map(value => value.trim().toLocaleLowerCase())
        .filter(Boolean);
    const immunities = new Set([
        ...(conditionImmunity?.value ?? []),
        ...customImmunities
    ]);
    const statusId = String(effectName ?? "no effect").toLocaleLowerCase();
    const capitalizedStatusId = statusId.length > 0
        ? `${statusId[0].toLocaleUpperCase()}${statusId.slice(1)}`
        : statusId;

    return immunities.has(statusId)
        || immunities.has(`Convenient Effect: ${capitalizedStatusId}`);
}

/**
 * Apply only the condition-immunity portion of DAE's suppression decision.
 * Other suppression causes are evaluated by the caller.
 *
 * @param {{name?: string, isSuppressed: boolean, disabled: boolean}} effect
 * @param {{value?: Iterable<string>, custom?: string} | undefined} conditionImmunity
 * @returns {boolean} Whether condition immunity matched the effect.
 */
export function applyConditionImmunitySuppression(effect, conditionImmunity) {
    const isConditionImmune = conditionImmunityMatches(effect.name, conditionImmunity);
    if (isConditionImmune) {
        effect.isSuppressed = true;
    }
    return isConditionImmune;
}
