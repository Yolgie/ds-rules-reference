import { Location } from '../model/location'
import type { DSArmor, DSEquipment, DSWeapon, ParsedEquipment } from '../model/equipment'
import type { CellRow } from './pdf-text'

type Kind = 'generic' | 'weapon' | 'armor'

const WEAPONS_KEY = '__weapons__'
const ARMOR_KEY = '__armor__'

/** PDF table heading (upper-case) → display key + how its rows are shaped. */
const HEADINGS: Record<string, { key: string; kind: Kind }> = {
  'AUF REISEN': { key: 'Auf Reisen', kind: 'generic' },
  'BEIM HÄNDLER': { key: 'Beim Händler', kind: 'generic' },
  BELEUCHTUNG: { key: 'Beleuchtung', kind: 'generic' },
  DIVERSES: { key: 'Diverses', kind: 'generic' },
  SCHLÖSSER: { key: 'Schlösser', kind: 'generic' },
  'IM GASTHAUS': { key: 'Im Gasthaus', kind: 'generic' },
  UNTERBRINGUNG: { key: 'Unterbringung', kind: 'generic' },
  'IM TEMPEL': { key: 'Im Tempel', kind: 'generic' },
  'UNTERKUNFT ERRICHTEN': { key: 'Unterkunft errichten', kind: 'generic' },
  'MAGISCHE DIENSTE': { key: 'Magische Dienste', kind: 'generic' },
  REITTIERE: { key: 'Reittiere', kind: 'generic' },
  TIERE: { key: 'Tiere', kind: 'generic' },
  WAFFEN: { key: WEAPONS_KEY, kind: 'weapon' },
  RÜSTUNGEN: { key: ARMOR_KEY, kind: 'armor' },
}

const NOTE_MARKER = /(\*+)\s*:\s*/g
const LOCATION_CELL = /^[DKGEZ]$/
const BONUS_CELL = /^[+-]\d/

/** Strips footnote asterisks from a cell, returning the clean text and the marker count. */
function stripMarkers(text: string): { clean: string; count: number } {
  const runs = text.match(/\*+/g)
  const count = runs ? Math.max(...runs.map((r) => r.length)) : 0
  const clean = text.replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
  return { clean, count }
}

function toLocation(cell: string): Location | null {
  return LOCATION_CELL.test(cell) ? (cell as Location) : null
}

/** Extracts one or more footnotes from a line like "*: a  **: b" → [{1,'a'},{2,'b'}]. */
function extractNotes(text: string): { count: number; text: string }[] {
  const matches = [...text.matchAll(NOTE_MARKER)]
  return matches.map((m, i) => {
    const start = m.index + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1]!.index : text.length
    return { count: m[1]!.length, text: text.slice(start, end).trim() }
  })
}

interface PendingItem {
  item: DSEquipment
  key: string
  markerCount: number
}

interface TableState {
  notes: Map<number, string>
  lastNoteCount: number | null
}

function parseGeneric(cells: string[]): { item: DSEquipment; markerCount: number } {
  const priceRaw = cells[cells.length - 1]!
  const hasLocation = cells.length >= 3 && LOCATION_CELL.test(cells[cells.length - 2]!)
  const nameEnd = hasLocation ? cells.length - 2 : cells.length - 1
  const name = stripMarkers(cells.slice(0, nameEnd).join(' '))
  const price = stripMarkers(priceRaw)
  return {
    item: {
      name: name.clean,
      location: hasLocation ? toLocation(cells[cells.length - 2]!) : null,
      price: price.clean,
      addendums: [],
    },
    markerCount: Math.max(name.count, price.count),
  }
}

function parseWeaponLike(cells: string[]): {
  name: string
  location: Location | null
  price: string
  bonus: string
  special: string
  markerCount: number
} {
  const priceRaw = cells[cells.length - 1]!
  const locationCell = cells[cells.length - 2] ?? ''
  let bonusIdx = cells.findIndex((c) => BONUS_CELL.test(c))
  if (bonusIdx < 1) bonusIdx = 1
  const name = stripMarkers(cells.slice(0, bonusIdx).join(' '))
  const price = stripMarkers(priceRaw)
  return {
    name: name.clean,
    location: toLocation(locationCell),
    price: price.clean,
    bonus: cells[bonusIdx] ?? '',
    special: cells.slice(bonusIdx + 1, cells.length - 2).join(' '),
    markerCount: Math.max(name.count, price.count),
  }
}

/**
 * Parses the equipment tables from the extracted cell-row regions. Each region
 * is a vertical stack of tables (heading → rows → footnotes); the parser detects
 * headings, parses rows per table kind, and resolves each entry's addendums from
 * its table's footnotes (with a region-scoped fallback for footnotes printed
 * under a neighbouring table).
 */
export function parseEquipment(regions: CellRow[][]): ParsedEquipment {
  const tables: Record<string, DSEquipment[]> = {}
  const weapons: DSWeapon[] = []
  const armor: DSArmor[] = []

  const bucketFor = (key: string): DSEquipment[] => {
    if (key === WEAPONS_KEY) return weapons
    if (key === ARMOR_KEY) return armor
    return (tables[key] ??= [])
  }

  for (const region of regions) {
    let current: { key: string; kind: Kind } | null = null
    const states = new Map<string, TableState>()
    const pending: PendingItem[] = []

    const stateFor = (key: string): TableState => {
      let state = states.get(key)
      if (!state) {
        state = { notes: new Map(), lastNoteCount: null }
        states.set(key, state)
      }
      return state
    }

    for (const { cells } of region) {
      if (cells.length === 0) continue
      const heading = HEADINGS[cells[0]!.toUpperCase()]
      if (heading) {
        current = heading
        bucketFor(heading.key)
        stateFor(heading.key)
        continue
      }
      if (!current) continue

      const text = cells.join(' ')
      const state = stateFor(current.key)

      if (/^\*+\s*:/.test(text)) {
        for (const note of extractNotes(text)) {
          state.notes.set(note.count, note.text)
          state.lastNoteCount = note.count
        }
        continue
      }

      // Continuation of a wrapped footnote (a stray line right after a note).
      if (state.lastNoteCount !== null && cells.length < 2) {
        const existing = state.notes.get(state.lastNoteCount) ?? ''
        state.notes.set(state.lastNoteCount, `${existing} ${text}`.trim())
        continue
      }
      if (cells.length < 2) continue // stray non-item line (e.g. a legend)
      state.lastNoteCount = null // an item ends any open footnote block

      if (current.kind === 'generic') {
        const { item, markerCount } = parseGeneric(cells)
        bucketFor(current.key).push(item)
        pending.push({ item, key: current.key, markerCount })
      } else {
        const parsed = parseWeaponLike(cells)
        const base: DSEquipment = {
          name: parsed.name,
          location: parsed.location,
          price: parsed.price,
          addendums: [],
        }
        if (current.kind === 'weapon') {
          const weapon: DSWeapon = { ...base, weaponBonus: parsed.bonus, special: parsed.special }
          weapons.push(weapon)
          pending.push({ item: weapon, key: current.key, markerCount: parsed.markerCount })
        } else {
          const piece: DSArmor = { ...base, armorBonus: parsed.bonus, special: parsed.special }
          armor.push(piece)
          pending.push({ item: piece, key: current.key, markerCount: parsed.markerCount })
        }
      }
    }

    resolveAddendums(pending, states)
  }

  return { tables, weapons, armor }
}

/** Assigns each pending item its footnote text by marker count, region-scoped. */
function resolveAddendums(pending: PendingItem[], states: Map<string, TableState>): void {
  // For fallback: footnote texts seen anywhere in the region, grouped by count.
  const byCount = new Map<number, Set<string>>()
  for (const state of states.values()) {
    for (const [count, text] of state.notes) {
      ;(byCount.get(count) ?? byCount.set(count, new Set()).get(count)!).add(text)
    }
  }

  for (const { item, key, markerCount } of pending) {
    if (markerCount === 0) continue
    const own = states.get(key)?.notes.get(markerCount)
    if (own) {
      item.addendums = [own]
      continue
    }
    const candidates = byCount.get(markerCount)
    if (candidates && candidates.size === 1) item.addendums = [...candidates]
  }
}
