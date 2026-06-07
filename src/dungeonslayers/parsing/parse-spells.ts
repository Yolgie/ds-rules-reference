import { SpellType, type DSSpell, type SpellClassRequirement } from '../model/spell'
import { spellKey } from './parse-spell-tables'
import type { SpellIcon, TextLine } from './pdf-text'

/** Spell detail entries live on these PDF pages. */
const MIN_PAGE = 60
const MAX_PAGE = 87
/** Page mid-line (all spell pages are 595 wide); separates the two body columns. */
const MID_X = 297.5
/** An icon counts as a heading's marker if its y is within this of the heading line. */
const ICON_Y_TOLERANCE = 12

/** An all-caps spell-name heading: letters/spaces/hyphens/apostrophes, no digits. */
const HEADING = /^[A-ZÄÖÜ][A-ZÄÖÜ '-]{2,39}$/
/** Section words and the list intro that look like headings but are not spells. */
const NOISE =
  /^(LISTE DER|ZAUBERSPRÜCHE|TALENTE|REGELN|CHARAKTERE|AUSR|SPIELLEITUNG|ABENTEUER|DIE WELT|ANH|INDEX)/
/** A level-circle line (only the small coloured stufe numbers). */
const NUMERIC = /^[\d\s]+$/

const FIELDS: { key: 'price' | 'spellBonus' | 'duration' | 'distance' | 'cooldown'; re: RegExp }[] =
  [
    { key: 'price', re: /^Preis:\s*(.*)$/ },
    { key: 'spellBonus', re: /^ZB:\s*(.*)$/ },
    { key: 'duration', re: /^Dauer:\s*(.*)$/ },
    { key: 'distance', re: /^Distanz:\s*(.*)$/ },
    { key: 'cooldown', re: /^Abklingzeit:\s*(.*)$/ },
  ]
const EFFECT = /^Effekt:\s*(.*)$/

/** Joins wrapped lines into one string, repairing hyphenation at line breaks. */
function joinLines(parts: string[]): string {
  let text = ''
  for (const part of parts) {
    if (/[a-zäöü]-$/.test(text) && /^[a-zäöü]/.test(part)) {
      text = text.slice(0, -1) + part
    } else {
      text = text ? `${text} ${part}` : part
    }
  }
  return text.trim()
}

/**
 * Maps icon pixel-hashes to spell types. The same visual icon is reused across the
 * spell pages, so types are inferred from hash frequency: the most common icon is the
 * normal ZAUBER, the next most common is the ZIELZAUBER (the rare third icon — the
 * "geistesbeeinflussend" marker — is left unmapped and ignored for the type).
 */
function buildHashTypes(icons: SpellIcon[]): Map<string, SpellType> {
  const counts = new Map<string, number>()
  for (const icon of icons) counts.set(icon.hash, (counts.get(icon.hash) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hash]) => hash)
  const types = new Map<string, SpellType>()
  if (ranked[0]) types.set(ranked[0], SpellType.ZAUBER)
  if (ranked[1]) types.set(ranked[1], SpellType.ZIELZAUBER)
  return types
}

/** Determines a heading's spell type from the icons drawn beside it. */
function typeForHeading(
  line: TextLine,
  icons: SpellIcon[],
  hashTypes: Map<string, SpellType>,
): SpellType | null {
  let result: SpellType | null = null
  for (const icon of icons) {
    if (icon.page !== line.page) continue
    if ((icon.x < MID_X ? 0 : 1) !== line.column) continue
    if (Math.abs(icon.y - line.y) > ICON_Y_TOLERANCE) continue
    const type = hashTypes.get(icon.hash)
    if (type === SpellType.ZIELZAUBER) return SpellType.ZIELZAUBER // most specific wins
    if (type === SpellType.ZAUBER) result = SpellType.ZAUBER
  }
  return result
}

interface Draft {
  name: string
  line: TextLine
  price: string
  spellBonus: string
  duration: string
  distance: string
  cooldown: string
  effectLines: string[]
}

function isHeading(text: string): boolean {
  return HEADING.test(text) && !NOISE.test(text)
}

/**
 * Parses the spell detail entries (pages 60–87) into {@link DSSpell}s. Each spell is
 * an all-caps heading followed by labelled lines (Preis/ZB/Dauer/Distanz/Abklingzeit)
 * and an Effekt block of wrapped prose, up to the next heading. Class requirements are
 * resolved from `classMap` (the pages 58/59 tables) and the spell type from `icons`.
 */
export function parseSpells(
  lines: TextLine[],
  icons: SpellIcon[],
  classMap: Map<string, SpellClassRequirement[]>,
): DSSpell[] {
  const hashTypes = buildHashTypes(icons)
  const spells: DSSpell[] = []
  let draft: Draft | null = null
  let inEffect = false

  const commit = () => {
    if (!draft) return
    const effect = joinLines(draft.effectLines)
    // Drop false headings (table/sidebar words) that carry no spell content.
    if (draft.price || effect) {
      spells.push({
        name: draft.name,
        price: draft.price,
        classRequirements: classMap.get(spellKey(draft.name)) ?? [],
        spellType: typeForHeading(draft.line, icons, hashTypes),
        spellBonus: draft.spellBonus,
        duration: draft.duration,
        distance: draft.distance,
        cooldown: draft.cooldown,
        effect,
      })
    }
    draft = null
    inEffect = false
  }

  for (const line of lines) {
    if (line.page < MIN_PAGE || line.page > MAX_PAGE) continue
    const text = line.text.trim()
    if (!text || NUMERIC.test(text)) continue // skip blanks and level circles

    if (isHeading(text)) {
      commit()
      draft = {
        name: text,
        line,
        price: '',
        spellBonus: '',
        duration: '',
        distance: '',
        cooldown: '',
        effectLines: [],
      }
      continue
    }
    if (!draft || NOISE.test(text)) continue

    const effectMatch = EFFECT.exec(text)
    if (effectMatch) {
      inEffect = true
      if (effectMatch[1]) draft.effectLines.push(effectMatch[1])
      continue
    }

    const field = FIELDS.find((f) => f.re.test(text))
    if (field && !inEffect) {
      draft[field.key] = field.re.exec(text)![1]!.trim()
      continue
    }

    if (inEffect) draft.effectLines.push(text)
  }
  commit()

  return spells
}
