(async () => {
	const TEST_NAME = 'DAE condition-immunity suppression regression';
	const TEST_STATUS = 'poisoned';

	const abort = (message) => {
		throw new Error(`${TEST_NAME}: ${message}`);
	};

	if (game.system.id !== 'dnd5e') {
		abort(`Expected dnd5e, found ${game.system.id}`);
	}

	if (!game.modules.get('dae')?.active) {
		abort('DAE is not active');
	}

	const sourceActor =
		canvas.tokens.controlled[0]?.actor ??
		game.user.character ??
		game.actors.find((actor) => ['character', 'npc'].includes(actor.type)) ??
		game.actors.contents[0];

	if (!sourceActor) {
		abort('No actor is available to use as a data template');
	}

	/*
	 * clone() creates an ephemeral Document. Nothing is created or
	 * updated in the world database.
	 */
	const testActor = await sourceActor.clone({
		name: `[TEST] ${sourceActor.name}`,
		items: [],
		effects: [],
	});

	testActor.updateSource({
		system: {
			traits: {
				ci: {
					value: [TEST_STATUS],
					custom: '',
				},
			},
		},
	});

	testActor.prepareData();

	const conditionImmunities = testActor.system.traits?.ci?.value;

	if (!(conditionImmunities instanceof Set)) {
		abort('Actor condition immunities are not represented by a Set');
	}

	const effect = new CONFIG.ActiveEffect.documentClass(
		{
			name: TEST_STATUS,
			img: 'icons/svg/poison.svg',
			disabled: false,
			transfer: false,
			changes: [],
			statuses: [],
		},
		{ parent: testActor },
	);

	const snapshot = (stage) => ({
		stage,
		isSuppressed: Boolean(effect.isSuppressed),
		disabled: Boolean(effect.disabled),
		sourceDisabled: Boolean(effect._source.disabled),
		active: Boolean(effect.active),
	});

	const stages = [snapshot('initial')];

	// Force the condition-immunity suppression branch.
	effect.determineSuppression();
	stages.push(snapshot('immunity present'));

	// Remove the reason for suppression and evaluate again.
	conditionImmunities.clear();
	effect.determineSuppression();
	stages.push(snapshot('immunity removed'));

	const [, withImmunity, afterRemoval] = stages;

	const checks = [
		{
			check: 'Effect is suppressed while immune',
			pass: withImmunity.isSuppressed === true,
		},
		{
			check: 'Suppression does not disable the effect',
			pass: withImmunity.disabled === false,
		},
		{
			check: 'Effect is unsuppressed after immunity removal',
			pass: afterRemoval.isSuppressed === false,
		},
		{
			check: 'Effect remains enabled after immunity removal',
			pass: afterRemoval.disabled === false,
		},
	];

	const passed = checks.every((check) => check.pass);

	const bugReproduced =
		withImmunity.isSuppressed === true &&
		withImmunity.disabled === true &&
		afterRemoval.isSuppressed === false &&
		afterRemoval.disabled === true;

	console.group(TEST_NAME);
	console.table(stages);
	console.table(checks);

	if (passed) {
		console.info('PASS: suppression never changed disabled.');
	} else if (bugReproduced) {
		console.error('BUG REPRODUCED: condition immunity permanently disabled the effect.');
	} else {
		console.error('FAIL: unexpected state transition; inspect the tables above.');
	}

	console.groupEnd();

	ui.notifications[passed ? 'info' : 'error'](
		passed
			? 'DAE suppression regression passed'
			: bugReproduced
				? 'DAE disabled-effect bug reproduced'
				: 'DAE suppression test produced an unexpected result',
	);

	return {
		passed,
		bugReproduced,
		stages,
		checks,
	};
})();
