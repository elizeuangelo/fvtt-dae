/** Add character level or NPC challenge rating to dnd5e roll data. */
export function addLevelRollData(actorType, rollData) {
    if (!["character", "npc"].includes(actorType) || !rollData.details)
        return rollData;

    const level = actorType === "npc" ? rollData.details.cr : rollData.details.level;
    if (level == null)
        return rollData;

    return {
        ...rollData,
        details: {
            ...rollData.details,
            crOrLevel: level,
            effectiveLevel: actorType === "npc" ? level + 3 : level
        }
    };
}
