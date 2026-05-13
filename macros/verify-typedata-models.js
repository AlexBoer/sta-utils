/**
 * verify-typedata-models.js
 *
 * Paste into the Foundry browser console, or save/import as a Script macro.
 *
 * Tests that sta-utils + sta-officers-log TypeDataModel fields are correctly
 * registered, accessible on live actors/items, writable, and that stale flags
 * don't override system.* values.
 *
 * Requires GM permissions for write/regression tests.
 */
(async () => {
  const results = [];
  const pass = (msg) => results.push({ ok: true, msg });
  const fail = (msg) => results.push({ ok: false, msg });
  const skip = (msg) => results.push({ ok: null, msg });

  // ── 1. Schema Registration ───────────────────────────────────────────────

  const charModel = CONFIG.Actor.dataModels?.character;
  if (charModel?.defineSchema) {
    pass("CONFIG.Actor.dataModels.character is registered");
    const schema = charModel.defineSchema();
    // sta-utils fields
    for (const f of ["fatiguedAttribute", "fatiguedTraitUuid"]) {
      schema[f]
        ? pass(`CharacterData schema has field: ${f}`)
        : fail(`CharacterData schema MISSING field: ${f}`);
    }
    // sta-officers-log fields
    for (const f of [
      "currentMissionLogId",
      "usedCallbackThisMission",
      "pendingShipBenefits",
    ]) {
      schema[f]
        ? pass(`CharacterData schema has field: ${f}`)
        : fail(`CharacterData schema MISSING field: ${f}`);
    }
  } else {
    fail("CONFIG.Actor.dataModels.character is NOT registered");
  }

  const shipModel = CONFIG.Actor.dataModels?.starship;
  if (shipModel?.defineSchema) {
    const s = shipModel.defineSchema();
    s?.reservePowerSystem
      ? pass("StarshipData schema has field: reservePowerSystem")
      : fail("StarshipData schema MISSING field: reservePowerSystem");
  } else {
    fail("CONFIG.Actor.dataModels.starship is NOT registered");
  }

  const craftModel = CONFIG.Actor.dataModels?.smallcraft;
  if (craftModel?.defineSchema) {
    const s = craftModel.defineSchema();
    s?.reservePowerSystem
      ? pass("SmallCraftData schema has field: reservePowerSystem")
      : fail("SmallCraftData schema MISSING field: reservePowerSystem");
  } else {
    fail("CONFIG.Actor.dataModels.smallcraft is NOT registered");
  }

  const traitModel = CONFIG.Item.dataModels?.trait;
  if (traitModel?.defineSchema) {
    const s = traitModel.defineSchema();
    s?.isFatigue
      ? pass("TraitData schema has field: isFatigue")
      : fail("TraitData schema MISSING field: isFatigue");
  } else {
    fail("CONFIG.Item.dataModels.trait is NOT registered");
  }

  // ── 2. Migration Version ─────────────────────────────────────────────────

  try {
    const mv = game.settings.get("sta-utils", "migrationVersion");
    mv >= 2
      ? pass(`Migration version = ${mv} (≥ 2 ✓)`)
      : fail(`Migration version = ${mv} — expected ≥ 2`);
  } catch (e) {
    fail(`Could not read migrationVersion setting: ${e.message}`);
  }

  // ── 3. Live Actor / Item Field Accessibility ─────────────────────────────

  const char = game.actors.find((a) => a.type === "character");
  if (char) {
    for (const f of [
      "fatiguedAttribute",
      "fatiguedTraitUuid",
      "currentMissionLogId",
    ]) {
      const v = char.system?.[f];
      v !== undefined
        ? pass(`character.system.${f} accessible (value: ${JSON.stringify(v)})`)
        : fail(`character.system.${f} is undefined`);
    }
    const ucm = char.system?.usedCallbackThisMission;
    ucm !== undefined
      ? pass(`character.system.usedCallbackThisMission accessible (${ucm})`)
      : fail("character.system.usedCallbackThisMission is undefined");
    Array.isArray(char.system?.pendingShipBenefits)
      ? pass("character.system.pendingShipBenefits is an Array")
      : fail("character.system.pendingShipBenefits is not an Array");
  } else {
    skip(
      "No character actor in world — skipping character system.* field tests",
    );
  }

  const ship = game.actors.find((a) => a.type === "starship");
  if (ship) {
    const v = ship.system?.reservePowerSystem;
    v !== undefined
      ? pass(
          `starship.system.reservePowerSystem accessible (${JSON.stringify(v)})`,
        )
      : fail("starship.system.reservePowerSystem is undefined");
  } else {
    skip("No starship actor in world — skipping starship system.* field test");
  }

  const craft = game.actors.find((a) => a.type === "smallcraft");
  if (craft) {
    const v = craft.system?.reservePowerSystem;
    v !== undefined
      ? pass(
          `smallcraft.system.reservePowerSystem accessible (${JSON.stringify(v)})`,
        )
      : fail("smallcraft.system.reservePowerSystem is undefined");
  } else {
    skip(
      "No smallcraft actor in world — skipping smallcraft system.* field test",
    );
  }

  const trait = game.items.find((i) => i.type === "trait");
  if (trait) {
    const v = trait.system?.isFatigue;
    v !== undefined
      ? pass(`trait.system.isFatigue accessible (${v})`)
      : fail("trait.system.isFatigue is undefined");
  } else {
    skip("No trait item in world — skipping trait system.* field test");
  }

  // ── 4. Write Round-Trip (non-destructive, GM only) ───────────────────────

  if (char && game.user?.isGM) {
    const original = char.system?.fatiguedAttribute ?? null;
    try {
      await char.update({ "system.fatiguedAttribute": "__test__" });
      const after = char.system?.fatiguedAttribute;
      after === "__test__"
        ? pass(
            "Write round-trip: system.fatiguedAttribute updated and readable",
          )
        : fail(`Write round-trip: expected '__test__', got '${after}'`);
    } finally {
      await char.update({ "system.fatiguedAttribute": original });
    }
  } else {
    skip("Write round-trip skipped (no character actor or not GM)");
  }

  // ── 5. Stale Flag Regression ─────────────────────────────────────────────
  // system.* should not be overridden by a stale flag value

  if (char && game.user?.isGM) {
    const saved = char.system?.fatiguedAttribute ?? null;
    try {
      await char.update({ "system.fatiguedAttribute": null });
      await char.setFlag("sta-utils", "fatiguedAttribute", "STALE_FLAG");
      const val = char.system?.fatiguedAttribute;
      val !== "STALE_FLAG"
        ? pass(
            `Flag regression: system.fatiguedAttribute (${JSON.stringify(val)}) is not polluted by stale flag`,
          )
        : fail(
            "Flag regression FAILED: system.fatiguedAttribute was overridden by stale flag value",
          );
    } finally {
      await char.unsetFlag("sta-utils", "fatiguedAttribute");
      await char.update({ "system.fatiguedAttribute": saved });
    }
  } else {
    skip("Flag regression skipped (no character actor or not GM)");
  }

  // ── 6. Module Load Order ─────────────────────────────────────────────────
  // sta-officers-log must be a dependency of sta-utils (or load first) so that
  // UtilsCharacterData extends OfficersCharacterData extends STA CharacterData.

  const officersLogMod = game.modules.get("sta-officers-log");
  const staUtilsMod = game.modules.get("sta-utils");
  if (officersLogMod?.active && staUtilsMod?.active) {
    // Verify the character model name chain includes both modules' class names
    let cls = CONFIG.Actor.dataModels?.character;
    const chain = [];
    while (cls && cls !== Object) {
      chain.push(cls.name);
      cls = Object.getPrototypeOf(cls);
    }
    const hasOfficers = chain.some(
      (n) => n.includes("Officers") || n.includes("officers"),
    );
    const hasUtils = chain.some(
      (n) => n.includes("Utils") || n.includes("utils"),
    );
    hasOfficers
      ? pass(
          `Model chain includes officers-log class (chain: ${chain.join(" → ")})`,
        )
      : fail(
          `Model chain missing officers-log class (chain: ${chain.join(" → ")})`,
        );
    hasUtils
      ? pass("Model chain includes sta-utils class")
      : fail("Model chain missing sta-utils class");
  } else {
    skip(
      "Module load-order check skipped (sta-officers-log or sta-utils not active)",
    );
  }

  // ── Report ───────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.ok === true).length;
  const failed = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  const lines = results.map(
    (r) => `${r.ok === true ? "✅" : r.ok === false ? "❌" : "⏭️"} ${r.msg}`,
  );
  lines.push(`\n${passed} passed  •  ${failed} failed  •  ${skipped} skipped`);

  const summary = lines.join("\n");
  console.log(
    "%c[sta TypeDataModel Verification]\n",
    "font-weight:bold",
    summary,
  );

  await Dialog.prompt({
    title: "sta TypeDataModel Verification",
    content: `<pre style="font-size:11px;line-height:1.6;max-height:60vh;overflow:auto">${summary}</pre>`,
    label: "Close",
    rejectClose: false,
  });
})();
