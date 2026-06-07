import { DSClass } from '../model/ds_class'
import type { SpellClassRequirement } from '../model/spell'
import type { TextLine } from './pdf-text'

/** Spell class overview tables live on these PDF pages. */
const TABLE_PAGES = new Set([58, 59])

/** "SPRÜCHE DER …" section heading → the class whose spell list follows. */
const CLASS_HEADINGS: Record<string, DSClass> = {
  'SPRÜCHE DER HEILER': DSClass.Hei,
  'SPRÜCHE DER ZAUBERER': DSClass.Zau,
  'SPRÜCHE DER SCHWARZMAGIER': DSClass.Sch,
}

/** A "STUFE N" sub-heading marking the level at which the listed spells are learnable. */
const LEVEL_HEADING = /^STUFE\s+(\d+)$/

/**
 * Normalises a spell name to its lookup key: upper-cased and whitespace-collapsed.
 * Detail entries are printed all-caps while the tables use title case, so matching
 * is done on the upper-cased form.
 */
export function spellKey(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toUpperCase()
}

/**
 * Parses the class spell tables (pages 58/59) into a map of spell name → the classes
 * and levels that can learn it. Each table is a "SPRÜCHE DER …" section split into
 * "STUFE N" blocks of comma-separated names; names wrap across lines, so a block's
 * lines are joined before splitting on commas. The returned map is keyed by
 * {@link spellKey} so the detail parser can resolve a spell's class requirements.
 */
export function parseSpellTables(lines: TextLine[]): Map<string, SpellClassRequirement[]> {
  const map = new Map<string, SpellClassRequirement[]>()

  let currentClass: DSClass | null = null
  let currentLevel: number | null = null
  let buffer: string[] = []

  const flush = () => {
    if (currentClass === null || currentLevel === null || buffer.length === 0) {
      buffer = []
      return
    }
    const joined = buffer.join(' ').replace(/\s+/g, ' ').trim()
    for (const raw of joined.split(',')) {
      const name = raw.trim()
      if (!name) continue
      const key = spellKey(name)
      const reqs = map.get(key) ?? []
      if (!reqs.some((r) => r.dsClass === currentClass)) {
        reqs.push({ dsClass: currentClass, level: currentLevel })
      }
      map.set(key, reqs)
    }
    buffer = []
  }

  for (const line of lines) {
    if (!TABLE_PAGES.has(line.page)) continue
    const text = line.text.trim()

    const classHeading = CLASS_HEADINGS[text]
    if (classHeading) {
      flush()
      currentClass = classHeading
      currentLevel = null
      continue
    }

    const levelMatch = LEVEL_HEADING.exec(text)
    if (levelMatch) {
      flush()
      currentLevel = Number(levelMatch[1])
      continue
    }

    // Only collect list lines once we are inside a class/level block.
    if (currentClass !== null && currentLevel !== null) buffer.push(text)
  }
  flush()

  return map
}
