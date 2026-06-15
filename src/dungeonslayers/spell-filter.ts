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

function matchesClassAndLevel(spell: DSSpell, classes: DSClass[], maxLevel: number | null): boolean {
  if (classes.length === 0 && maxLevel === null) return true

  return spell.classRequirements.some((req) => {
    const classMatches = classes.length === 0 || classes.includes(req.dsClass)
    const levelMatches = maxLevel === null || req.level <= maxLevel
    return classMatches && levelMatches
  })
}

function matchesSpellTypes(spell: DSSpell, spellTypes: SpellType[]): boolean {
  if (spellTypes.length === 0) return true
  return spell.spellType !== null && spellTypes.includes(spell.spellType)
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
      matchesClassAndLevel(spell, filter.classes, filter.maxLevel) &&
      matchesSpellTypes(spell, filter.spellTypes) &&
      matchesSearch(spell, filter.search),
  )
}
