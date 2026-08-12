const CONDITION = "poisoned";
const TEST_ACTOR_PREFIX = "[DAE REGRESSION TEST - DELETE ME]";

function activeEffectData({ disabled = false } = {}) {
    return {
        name: CONDITION,
        disabled,
        transfer: false,
        changes: [],
        statuses: []
    };
}

function verifyEnvironment() {
    if (!globalThis.game?.ready)
        throw new Error("Run this regression after the Foundry world is ready.");
    if (game.system.id !== "dnd5e")
        throw new Error(`Expected the dnd5e system, but ${game.system.id} is running.`);
    if (!game.modules.get("dae")?.active)
        throw new Error("The DAE module is not active.");
    if (typeof CONFIG.ActiveEffect.documentClass.prototype.determineSuppression !== "function")
        throw new Error("ActiveEffect.determineSuppression is unavailable.");

    return {
        foundry: game.version,
        system: `${game.system.id} ${game.system.version}`,
        dae: game.modules.get("dae").version
    };
}

function setEphemeralConditionImmunity(actor, enabled) {
    actor.updateSource({
        "system.traits.ci.value": enabled ? [CONDITION] : [],
        "system.traits.ci.custom": ""
    });
}

async function setPersistedConditionImmunity(actor, enabled) {
    await actor.update({
        "system.traits.ci.value": enabled ? [CONDITION] : [],
        "system.traits.ci.custom": ""
    });
}

function createEphemeralEffect(actor, { disabled = false } = {}) {
    return new CONFIG.ActiveEffect.documentClass(activeEffectData({ disabled }), {
        parent: actor
    });
}

async function createEphemeralActor() {
    const sourceActor = game.actors.contents.find(actor => ["npc", "character"].includes(actor.type));
    let actor;

    if (sourceActor) {
        actor = await sourceActor.clone({
            name: `${TEST_ACTOR_PREFIX} ephemeral`,
            items: [],
            effects: []
        }, { keepId: false });
    }
    else {
        const ActorClass = CONFIG.Actor.documentClass;
        const actorType = ActorClass.TYPES?.includes("npc") ? "npc" : ActorClass.TYPES?.[0];
        actor = new ActorClass({
            name: `${TEST_ACTOR_PREFIX} ephemeral`,
            type: actorType,
            items: [],
            effects: []
        });
    }

    setEphemeralConditionImmunity(actor, false);
    return actor;
}

function recordStage(rows, {
    scenario,
    stage,
    effect,
    expected,
    beforeDetermine,
    sameEffectInstance = true
}) {
    const actual = {
        isSuppressed: effect.isSuppressed,
        disabled: effect.disabled,
        sourceDisabled: effect._source?.disabled,
        active: effect.active
    };
    const pass = Object.entries(expected).every(([key, value]) => actual[key] === value);
    const row = {
        scenario,
        stage,
        uuid: effect.uuid,
        name: effect.name,
        sameEffectInstance,
        beforeSuppressed: beforeDetermine.isSuppressed,
        beforeDisabled: beforeDetermine.disabled,
        beforeSourceDisabled: beforeDetermine.sourceDisabled,
        ...actual,
        expectedSuppressed: expected.isSuppressed,
        expectedDisabled: expected.disabled,
        expectedSourceDisabled: expected.sourceDisabled,
        expectedActive: expected.active,
        pass
    };
    rows.push(row);
    return row;
}

function determineAndRecord(rows, options) {
    const { effect } = options;
    const beforeDetermine = {
        isSuppressed: effect.isSuppressed,
        disabled: effect.disabled,
        sourceDisabled: effect._source?.disabled
    };
    effect.determineSuppression();
    return recordStage(rows, { ...options, beforeDetermine });
}

async function runEphemeralRegression(rows) {
    const actor = await createEphemeralActor();
    const effect = createEphemeralEffect(actor);
    const enabledExpected = {
        isSuppressed: false,
        disabled: false,
        sourceDisabled: false,
        active: true
    };
    const suppressedExpected = {
        isSuppressed: true,
        disabled: false,
        sourceDisabled: false,
        active: false
    };

    setEphemeralConditionImmunity(actor, false);
    determineAndRecord(rows, {
        scenario: "ephemeral enabled effect",
        stage: "Initial",
        effect,
        expected: enabledExpected
    });

    setEphemeralConditionImmunity(actor, true);
    determineAndRecord(rows, {
        scenario: "ephemeral enabled effect",
        stage: "Matching immunity added",
        effect,
        expected: suppressedExpected
    });

    // Deliberately reuse the same effect instance without reset. This exposes
    // the sticky runtime mutation in unpatched 11.3.68.
    setEphemeralConditionImmunity(actor, false);
    determineAndRecord(rows, {
        scenario: "ephemeral enabled effect",
        stage: "Immunity removed (same instance)",
        effect,
        expected: enabledExpected
    });

    const intentionallyDisabled = createEphemeralEffect(actor, { disabled: true });
    const intentionallyDisabledExpected = {
        isSuppressed: false,
        disabled: true,
        sourceDisabled: true,
        active: false
    };
    const disabledAndSuppressedExpected = {
        ...intentionallyDisabledExpected,
        isSuppressed: true
    };

    setEphemeralConditionImmunity(actor, false);
    determineAndRecord(rows, {
        scenario: "ephemeral intentionally disabled control",
        stage: "Initial",
        effect: intentionallyDisabled,
        expected: intentionallyDisabledExpected
    });

    setEphemeralConditionImmunity(actor, true);
    determineAndRecord(rows, {
        scenario: "ephemeral intentionally disabled control",
        stage: "Matching immunity added",
        effect: intentionallyDisabled,
        expected: disabledAndSuppressedExpected
    });

    setEphemeralConditionImmunity(actor, false);
    determineAndRecord(rows, {
        scenario: "ephemeral intentionally disabled control",
        stage: "Immunity removed",
        effect: intentionallyDisabled,
        expected: intentionallyDisabledExpected
    });
}

async function runPersistedLifecycleRegression(rows) {
    if (!game.user.isGM)
        throw new Error("The persisted lifecycle regression must be run by a GM.");

    const ActorClass = CONFIG.Actor.documentClass;
    const actorType = ActorClass.TYPES?.includes("npc") ? "npc" : ActorClass.TYPES?.[0];
    let actor;

    try {
        actor = await ActorClass.create({
            name: `${TEST_ACTOR_PREFIX} ${Date.now()}`,
            type: actorType,
            items: [],
            effects: [],
            flags: {
                dae: {
                    conditionImmunityRegression: true
                }
            }
        }, { renderSheet: false });
        if (!actor)
            throw new Error("Foundry did not create the temporary regression actor.");

        await setPersistedConditionImmunity(actor, false);
        const [createdEffect] = await actor.createEmbeddedDocuments(
            "ActiveEffect",
            [activeEffectData()],
            { renderSheet: false }
        );
        if (!createdEffect)
            throw new Error("Foundry did not create the temporary regression effect.");

        const effectId = createdEffect.id;
        const originalEffectInstance = createdEffect;
        const enabledExpected = {
            isSuppressed: false,
            disabled: false,
            sourceDisabled: false,
            active: true
        };
        const suppressedExpected = {
            isSuppressed: true,
            disabled: false,
            sourceDisabled: false,
            active: false
        };

        let effect = actor.effects.get(effectId);
        determineAndRecord(rows, {
            scenario: "persisted actor lifecycle",
            stage: "Initial",
            effect,
            expected: enabledExpected,
            sameEffectInstance: effect === originalEffectInstance
        });

        await setPersistedConditionImmunity(actor, true);
        effect = actor.effects.get(effectId);
        determineAndRecord(rows, {
            scenario: "persisted actor lifecycle",
            stage: "Matching immunity added",
            effect,
            expected: suppressedExpected,
            sameEffectInstance: effect === originalEffectInstance
        });

        await setPersistedConditionImmunity(actor, false);
        effect = actor.effects.get(effectId);
        determineAndRecord(rows, {
            scenario: "persisted actor lifecycle",
            stage: "Immunity removed after actor preparation",
            effect,
            expected: enabledExpected,
            sameEffectInstance: effect === originalEffectInstance
        });
    }
    finally {
        if (actor?.id && game.actors.has(actor.id)) {
            await actor.delete({
                daeConditionImmunityRegressionCleanup: true
            });
        }
    }
}

function report(environment, rows) {
    const table = rows.map(row => ({
        scenario: row.scenario,
        stage: row.stage,
        isSuppressed: row.isSuppressed,
        disabled: row.disabled,
        "_source.disabled": row.sourceDisabled,
        active: row.active,
        beforeSuppressed: row.beforeSuppressed,
        beforeDisabled: row.beforeDisabled,
        beforeSourceDisabled: row.beforeSourceDisabled,
        sameInstance: row.sameEffectInstance,
        result: row.pass ? "PASS" : "FAIL"
    }));
    const failures = rows.filter(row => !row.pass);
    const pass = failures.length === 0;
    const matchingImmunity = rows.find(row =>
        row.scenario === "ephemeral enabled effect"
        && row.stage === "Matching immunity added");
    const afterRemoval = rows.find(row =>
        row.scenario === "ephemeral enabled effect"
        && row.stage === "Immunity removed (same instance)");
    const bugReproduced = matchingImmunity?.isSuppressed === true
        && matchingImmunity?.disabled === true
        && afterRemoval?.isSuppressed === false
        && afterRemoval?.disabled === true;

    console.group("DAE condition-immunity suppression regression");
    console.info("Environment", environment);
    console.table(table);
    if (pass)
        console.info("PASS: condition immunity suppresses without disabling the effect.");
    else if (bugReproduced)
        console.error("BUG REPRODUCED: condition immunity left the enabled effect disabled.");
    else
        console.error(`FAIL: ${failures.length} stage(s) did not match the expected transition.`, failures);
    console.groupEnd();

    const message = `DAE condition-immunity regression: ${pass ? "PASS" : "FAIL"}`;
    if (pass)
        ui.notifications.info(message);
    else
        ui.notifications.error(`${message}; see the developer console.`);

    return { pass, bugReproduced, environment, rows };
}

/**
 * Run the real libWrapper-installed DAE suppression override.
 *
 * @param {{includePersisted?: boolean}} options
 * @returns {Promise<{pass: boolean, bugReproduced: boolean, environment: object, rows: object[]}>}
 */
export async function runConditionImmunitySuppressionRegression({
    includePersisted = true
} = {}) {
    const environment = verifyEnvironment();
    const rows = [];

    await runEphemeralRegression(rows);
    if (includePersisted)
        await runPersistedLifecycleRegression(rows);

    return report(environment, rows);
}

globalThis.runDaeConditionImmunitySuppressionRegression =
    runConditionImmunitySuppressionRegression;
