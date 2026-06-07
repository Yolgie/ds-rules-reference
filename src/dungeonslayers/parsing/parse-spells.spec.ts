import { describe, it, expect } from 'vitest'
import { parseSpells } from './parse-spells'
import type { SpellIcon, TextLine } from './pdf-text'
import type { SpellClassRequirement } from '../model/spell'

/** A spell-page TextLine on page 60, left column, at an explicit y. */
function line(text: string, y: number, column: 0 | 1 = 0, page = 60): TextLine {
  return { page, column, y, text }
}

const noClasses = new Map<string, SpellClassRequirement[]>()

describe('parseSpells', () => {
  it('parses name, labelled fields, effect, requirements and type', () => {
    const lines = [
      line('ALLHEILUNG', 700),
      line('Preis: 650GM', 690),
      line('ZB: +0', 680),
      line('Dauer: Augenblicklich', 670),
      line('Distanz: Berühren', 660),
      line('Abklingzeit: 24 Stunden', 650),
      line('Effekt: Dieser Zauber heilt', 640),
      line('sämtliche Wunden.', 630),
    ]
    const classMap = new Map([['ALLHEILUNG', [{ dsClass: 'Hei', level: 10 }]]]) as Map<
      string,
      SpellClassRequirement[]
    >
    const icons: SpellIcon[] = [{ page: 60, x: 120, y: 700, hash: 'z' }]

    const [spell] = parseSpells(lines, icons, classMap)
    expect(spell).toEqual({
      name: 'ALLHEILUNG',
      price: '650GM',
      spellBonus: '+0',
      duration: 'Augenblicklich',
      distance: 'Berühren',
      cooldown: '24 Stunden',
      effect: 'Dieser Zauber heilt sämtliche Wunden.',
      classRequirements: [{ dsClass: 'Hei', level: 10 }],
      spellType: 'ZAUBER',
    })
  })

  it('skips level-circle number lines between entries', () => {
    const result = parseSpells(
      [
        line('10', 705), // circle above the first heading
        line('ALLHEILUNG', 700),
        line('Preis: 650GM', 690),
        line('Effekt: Heilt alles.', 680),
        line('8 10', 605), // circles above the next heading
        line('BLITZ', 600),
        line('Preis: 310GM', 590),
        line('Effekt: Ein Blitz.', 580),
      ],
      [],
      noClasses,
    )

    expect(result.map((s) => s.name)).toEqual(['ALLHEILUNG', 'BLITZ'])
    expect(result[0]!.effect).toBe('Heilt alles.')
    expect(result[0]!.effect).not.toMatch(/8 10/)
  })

  it('repairs hyphenated line wraps in the effect', () => {
    const [spell] = parseSpells(
      [
        line('FLACKERN', 700),
        line('Preis: 5GM', 690),
        line('Effekt: Charakterindividuali-', 680),
        line('sierung erfolgt.', 670),
      ],
      [],
      noClasses,
    )

    expect(spell!.effect).toBe('Charakterindividualisierung erfolgt.')
  })

  it('infers the type from icon-hash frequency (majority = ZAUBER)', () => {
    const lines = [
      line('ALLHEILUNG', 700),
      line('Effekt: x', 690),
      line('BLENDEN', 600),
      line('Effekt: y', 590),
    ]
    const icons: SpellIcon[] = [
      { page: 60, x: 120, y: 700, hash: 'common' },
      { page: 60, x: 120, y: 600, hash: 'rare' },
      // extra "common" icons elsewhere make it the majority hash
      { page: 61, x: 120, y: 500, hash: 'common' },
      { page: 61, x: 120, y: 400, hash: 'common' },
    ]

    const result = parseSpells(lines, icons, noClasses)
    expect(result.find((s) => s.name === 'ALLHEILUNG')!.spellType).toBe('ZAUBER')
    expect(result.find((s) => s.name === 'BLENDEN')!.spellType).toBe('ZIELZAUBER')
  })

  it('matches icons by page, column and y proximity', () => {
    const icons: SpellIcon[] = [
      { page: 60, x: 120, y: 700, hash: 'a' }, // left column, matches
      { page: 60, x: 450, y: 700, hash: 'b' }, // right column, ignored for a left heading
    ]
    const [spell] = parseSpells(
      [line('ALLHEILUNG', 700, 0), line('Effekt: x', 690)],
      icons,
      noClasses,
    )
    // Only the left-column icon ('a') applies; with one mapped hash it is ZAUBER.
    expect(spell!.spellType).toBe('ZAUBER')
  })

  it('leaves requirements empty for spells absent from the tables', () => {
    const [spell] = parseSpells(
      [line('BESCHWÖRUNGSKREIS ZEICHNEN', 700), line('Effekt: Ein Ritual.', 690)],
      [],
      noClasses,
    )
    expect(spell!.classRequirements).toEqual([])
  })

  it('drops false headings without price or effect, and ignores non-spell pages', () => {
    const result = parseSpells(
      [
        line('LISTE DER ZAUBERSPRÜCHE', 760), // NOISE, never a heading
        line('GEISTERWORT', 720), // heading with no content → dropped
        line('ALLHEILUNG', 700),
        line('Preis: 5GM', 690),
        line('Effekt: Heilt.', 680),
        line('FEUERBALL', 500, 0, 88), // outside spell pages → ignored
        line('Effekt: Boom.', 490, 0, 88),
      ],
      [],
      noClasses,
    )

    expect(result.map((s) => s.name)).toEqual(['ALLHEILUNG'])
  })
})
