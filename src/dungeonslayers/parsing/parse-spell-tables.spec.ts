import { describe, it, expect } from 'vitest'
import { parseSpellTables, spellKey } from './parse-spell-tables'
import type { TextLine } from './pdf-text'

/** Builds page-58/59 TextLine fixtures (the table parser only reads those pages). */
function lines(...texts: string[]): TextLine[] {
  return texts.map((text, i) => ({ page: 58, column: 0, y: 1000 - i, text }))
}

describe('parseSpellTables', () => {
  it('maps spell names to class and level under each STUFE heading', () => {
    const map = parseSpellTables(
      lines('SPRÜCHE DER HEILER', 'STUFE 1', 'Licht, Segen', 'STUFE 2', 'Balancieren'),
    )

    expect(map.get('LICHT')).toEqual([{ dsClass: 'Hei', level: 1 }])
    expect(map.get('SEGEN')).toEqual([{ dsClass: 'Hei', level: 1 }])
    expect(map.get('BALANCIEREN')).toEqual([{ dsClass: 'Hei', level: 2 }])
  })

  it('joins names that wrap across lines before splitting on commas', () => {
    const map = parseSpellTables(
      lines('SPRÜCHE DER HEILER', 'STUFE 1', 'Blenden, Heilende', 'Aura, Licht'),
    )

    expect(map.has('HEILENDE AURA')).toBe(true)
    expect(map.has('HEILENDE')).toBe(false)
    expect(map.get('HEILENDE AURA')).toEqual([{ dsClass: 'Hei', level: 1 }])
  })

  it('accumulates requirements across all three class tables', () => {
    const map = parseSpellTables(
      lines(
        'SPRÜCHE DER HEILER',
        'STUFE 8',
        'Botschaft',
        'SPRÜCHE DER ZAUBERER',
        'STUFE 6',
        'Botschaft',
        'SPRÜCHE DER SCHWARZMAGIER',
        'STUFE 8',
        'Botschaft',
      ),
    )

    expect(map.get('BOTSCHAFT')).toEqual([
      { dsClass: 'Hei', level: 8 },
      { dsClass: 'Zau', level: 6 },
      { dsClass: 'Sch', level: 8 },
    ])
  })

  it('ignores lines outside a class/level block and outside pages 58/59', () => {
    const fixture: TextLine[] = [
      { page: 57, column: 0, y: 5, text: 'Balancieren' }, // wrong page
      { page: 58, column: 0, y: 4, text: 'Irgendein Fließtext' }, // before any heading
      { page: 58, column: 0, y: 3, text: 'SPRÜCHE DER HEILER' },
      { page: 58, column: 0, y: 2, text: 'STUFE 1' },
      { page: 58, column: 0, y: 1, text: 'Licht' },
    ]

    const map = parseSpellTables(fixture)
    expect([...map.keys()]).toEqual(['LICHT'])
  })

  it('normalises lookup keys to upper-case and collapsed whitespace', () => {
    expect(spellKey('  Arkanes   Schwert ')).toBe('ARKANES SCHWERT')
  })
})
