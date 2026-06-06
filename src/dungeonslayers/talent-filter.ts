import { DSClass } from './model/ds_class'
import type { DSTalent } from './model/talent'

export interface TalentFilter {
  /** Selected classes; empty means no class filter. */
  classes: DSClass[]
  /** Maximum character level; null means no level filter. */
  maxLevel: number | null
  /** Substring searched in name and description; empty means no search filter. */
  search: string
}

/** Classes that can additionally learn every talent ZAW can learn. */
const ZAW_DERIVED: readonly DSClass[] = [DSClass.Hei, DSClass.Sch, DSClass.Zau]

/**
 * The set of classes able to learn a talent. A talent's listed requirement
 * classes can all learn it; additionally, because Hei/Sch/Zau can learn
 * everything ZAW can, any ZAW talent is also learnable by those three.
 */
export function learnableClasses(talent: DSTalent): Set<DSClass> {
  const classes = new Set<DSClass>()
  for (const req of talent.classRequirements) {
    classes.add(req.dsClass)
    if (req.dsClass === DSClass.ZAW) {
      for (const derived of ZAW_DERIVED) classes.add(derived)
    }
  }
  return classes
}

function matchesClasses(talent: DSTalent, classes: DSClass[]): boolean {
  if (classes.length === 0) return true
  const learnable = learnableClasses(talent)
  return classes.some((c) => learnable.has(c))
}

function matchesLevel(talent: DSTalent, maxLevel: number | null): boolean {
  if (maxLevel === null) return true
  return talent.classRequirements.some((req) => req.classLevel <= maxLevel)
}

function matchesSearch(talent: DSTalent, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true
  return (
    talent.name.toLowerCase().includes(term) ||
    talent.description.toLowerCase().includes(term)
  )
}

/** Filters talents by class, level, and search, combining the three with AND. */
export function filterTalents(talents: DSTalent[], filter: TalentFilter): DSTalent[] {
  return talents.filter(
    (talent) =>
      matchesClasses(talent, filter.classes) &&
      matchesLevel(talent, filter.maxLevel) &&
      matchesSearch(talent, filter.search),
  )
}
