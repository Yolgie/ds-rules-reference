import { DSClass } from './model/ds_class'
import type { DSSpell, SpellType } from './model/spell'

export interface SpellFilter {
  /** Selected classes; empty means no class filter. Only Hei/Zau/Sch apply to spells. */
  classes: DSClass[]
  /** Selected spell types; empty means no type filter. */
  spellTypes: SpellType[]
  /** Maximum learning level; null means no level filter. */
  maxLevel: number | null
  /** Substring searched in name and effect; empty means no search filter. */
  search: string
}

function matchesClasses(spell: DSSpell, classes: DSClass[]): boolean {
  if (classes.length === 0) return true
  return spell.classRequirements.some((req) => classes.includes(req.dsClass))
}

function matchesSpellTypes(spell: DSSpell, spellTypes: SpellType[]): boolean {
  if (spellTypes.length === 0) return true
  return spell.spellType !== null && spellTypes.includes(spell.spellType)
}

function matchesLevel(spell: DSSpell, maxLevel: number | null): boolean {
  if (maxLevel === null) return true
  return spell.classRequirements.some((req) => req.level <= maxLevel)
}

function matchesSearch(spell: DSSpell, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true
  return spell.name.toLowerCase().includes(term) || spell.effect.toLowerCase().includes(term)
}

/** Filters spells by class, type, level, and search, combining them with AND. */
export function filterSpells(spells: DSSpell[], filter: SpellFilter): DSSpell[] {
  return spells.filter(
    (spell) =>
      matchesClasses(spell, filter.classes) &&
      matchesSpellTypes(spell, filter.spellTypes) &&
      matchesLevel(spell, filter.maxLevel) &&
      matchesSearch(spell, filter.search),
  )
}
