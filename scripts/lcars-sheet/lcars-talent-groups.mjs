const AWARD_TYPES = ["award", "medal"];
const SPECIES_AND_ROLE_TYPES = ["speciesability", "role"];

export function prepareLcarsTalentGroups(context) {
  const isAward = (item) => AWARD_TYPES.includes(item.system?.talenttype?.typeenum);
  const isSpeciesAbility = (item) =>
    item.system?.talenttype?.typeenum === "speciesability";
  context.speciesAbilityItems = context.items.filter(
    (item) => item.type === "talent" && isSpeciesAbility(item),
  );
  context.hasSpeciesAbility = context.speciesAbilityItems.length > 0;
  context.talentItems = context.items.filter(
    (item) => item.type === "talent" && !isAward(item) && !isSpeciesAbility(item),
  );
  context.awardItems = context.items.filter(
    (item) => item.type === "talent" && isAward(item),
  );
  context.hasAwards = context.awardItems.length > 0;

  const localize = (key) => game.i18n.localize(key);
  const speciesLabel = localize("sta-utils.talentUses.speciesAbilityType");
  const roleLabel = localize("sta-utils.talentUses.roleType");
  const definitions = [
    {
      cls: "species-ability",
      icon: "fa-dna",
      label: speciesLabel,
      types: SPECIES_AND_ROLE_TYPES,
    },
    {
      cls: "talents",
      icon: "fa-star",
      label: localize("sta.item.talent.title"),
      types: null,
    },
    {
      cls: "awards",
      icon: "fa-medal",
      label: localize("sta-utils.lcars.belongings.awards"),
      types: AWARD_TYPES,
    },
  ];
  const talents = context.items.filter((item) => item.type === "talent");
  const specificTypes = definitions.flatMap((definition) => definition.types ?? []);
  const groups = definitions
    .map((definition) => ({
      ...definition,
      items: talents.filter((item) => {
        const type = item.system?.talenttype?.typeenum;
        return definition.types
          ? definition.types.includes(type)
          : !specificTypes.includes(type);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const speciesAndRole = groups.find((group) => group.cls === "species-ability");
  if (speciesAndRole) {
    const hasSpecies = speciesAndRole.items.some(
      (item) => item.system?.talenttype?.typeenum === "speciesability",
    );
    const hasRole = speciesAndRole.items.some(
      (item) => item.system?.talenttype?.typeenum === "role",
    );
    speciesAndRole.label =
      hasSpecies && hasRole
        ? localize("sta-utils.talentUses.speciesAbilityAndRole")
        : hasRole
          ? roleLabel
          : speciesLabel;
    if (!hasSpecies) speciesAndRole.icon = "fa-user-tie";
  }

  context.talentGroups = groups;
  context.showTalentsSubheader = groups.length >= 2;
}

export function talentGroup(item) {
  const type = item.system?.talenttype?.typeenum;
  if (SPECIES_AND_ROLE_TYPES.includes(type)) return "species-ability";
  if (AWARD_TYPES.includes(type)) return "awards";
  return "talents";
}

export function sortTalentWithinGroup(sheet, event, item) {
  const group = talentGroup(item);
  const siblings = sheet.actor.items
    .filter((candidate) => candidate.type === "talent" && talentGroup(candidate) === group)
    .sort((a, b) => a.sort - b.sort);

  const row = event.target?.closest?.("li[data-item-id]");
  const target = row ? sheet.actor.items.get(row.dataset.itemId) : null;
  if (!target || target.id === item.id || !siblings.includes(target)) return false;

  const before = row.dataset.dropPosition === "before";
  const updates = foundry.utils
    .performIntegerSort(item, { target, siblings, sortKey: "sort", sortBefore: before })
    .map((update) => ({ _id: update.target.id ?? update.target._id, sort: update.update.sort }))
    .filter((update) => update._id != null);
  if (!updates.length) return false;
  return sheet.actor.updateEmbeddedDocuments("Item", updates);
}
