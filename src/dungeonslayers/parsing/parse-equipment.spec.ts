import { describe, it, expect } from 'vitest'
import { parseEquipment } from './parse-equipment'
import { Location } from '../model/location'

/** Builds one region (a vertical table stack) from rows of cells. */
function region(...rows: string[][]) {
  return rows.map((cells) => ({ cells }))
}

describe('parseEquipment', () => {
  it('parses a generic table with location and verbatim prices', () => {
    const { tables } = parseEquipment([
      region(
        ['AUF REISEN', 'PREIS'],
        ['Angelhaken und Schnur', 'D', '2SM'],
        ['Wagen (4 Räder)', 'D', '35GM'],
      ),
    ])

    expect(tables['Auf Reisen']).toEqual([
      { name: 'Angelhaken und Schnur', location: Location.D, price: '2SM', addendums: [] },
      { name: 'Wagen (4 Räder)', location: Location.D, price: '35GM', addendums: [] },
    ])
  })

  it('handles service tables without a location column and keeps complex prices raw', () => {
    const { tables } = parseEquipment([
      region(
        ['IM TEMPEL', 'PREIS'],
        ['Heiltrank (heilt W20 LK)', '10GM'],
        ['MAGISCHE DIENSTE', 'PREIS'],
        ['Zauberdienst (z.B. Teleport)', 'Spruchkosten/2'],
      ),
    ])

    expect(tables['Im Tempel']![0]).toEqual({
      name: 'Heiltrank (heilt W20 LK)',
      location: null,
      price: '10GM',
      addendums: [],
    })
    expect(tables['Magische Dienste']![0]!.price).toBe('Spruchkosten/2')
    expect(tables['Magische Dienste']![0]!.location).toBeNull()
  })

  it('parses weapons with WB, optional Besonderes, and the Lanze/Waffenlos edge cases', () => {
    const { weapons } = parseEquipment([
      region(
        ['WAFFEN', 'WB', 'BESONDERES', 'PREIS'],
        ['Axt', '+1', 'D', '6GM'],
        ['Armbrust, schwer (2h)', '+3', 'Initiative -4, Gegnerabwehr -2', 'K', '15GM'],
        ['Lanze', '+1/+4', 'Nur im Trab', 'K', '2GM'],
        ['Waffenlos', '+0', 'Gegnerabwehr +5', '-', '-'],
      ),
    ])

    expect(weapons[0]).toEqual({ name: 'Axt', location: Location.D, price: '6GM', addendums: [], weaponBonus: '+1', special: '' })
    expect(weapons[1]!.special).toBe('Initiative -4, Gegnerabwehr -2')
    expect(weapons[2]!.weaponBonus).toBe('+1/+4')
    expect(weapons[3]).toEqual({ name: 'Waffenlos', location: null, price: '-', addendums: [], weaponBonus: '+0', special: 'Gegnerabwehr +5' })
  })

  it('parses armor with PA into the armor list', () => {
    const { armor, tables, weapons } = parseEquipment([
      region(
        ['RÜSTUNGEN', 'PA', 'BESONDERES', 'PREIS'],
        ['Plattenpanzer', '+3', 'Laufen -1m', 'K', '50GM'],
        ['Robe', '+0', 'D', '1GM'],
      ),
    ])

    expect(weapons).toEqual([])
    expect(Object.keys(tables)).toEqual([])
    expect(armor[0]).toEqual({ name: 'Plattenpanzer', location: Location.K, price: '50GM', addendums: [], armorBonus: '+3', special: 'Laufen -1m' })
    expect(armor[1]!.special).toBe('')
  })

  it('resolves an addendum marked on the name, joining a wrapped note', () => {
    const { tables } = parseEquipment([
      region(
        ['BEIM HÄNDLER', 'PREIS'],
        ['Heilkraut*', 'D', '25SM'],
        ['*: Probenwert 10: 1-10 heilt LK, 11+'],
        ['kein Heileffekt'],
      ),
    ])

    expect(tables['Beim Händler']![0]).toEqual({
      name: 'Heilkraut',
      location: Location.D,
      price: '25SM',
      addendums: ['Probenwert 10: 1-10 heilt LK, 11+ kein Heileffekt'],
    })
  })

  it('resolves an addendum marked on the price', () => {
    const { tables } = parseEquipment([
      region(['IM TEMPEL', 'PREIS'], ['Allheilung (Zauberspruch)', '100GM*'], ['*: Als Spende nötig']),
    ])

    expect(tables['Im Tempel']![0]!.price).toBe('100GM')
    expect(tables['Im Tempel']![0]!.addendums).toEqual(['Als Spende nötig'])
  })

  it('splits multiple footnotes packed into one line (e.g. "***: c  ****: d")', () => {
    const { weapons } = parseEquipment([
      region(
        ['WAFFEN', 'WB', 'BESONDERES', 'PREIS'],
        ['Speer****', '+1', 'sowohl Nah', 'D', '1GM'],
        ['*: a', '**: b'],
        ['***: c ****: d'],
      ),
    ])

    expect(weapons[0]!.name).toBe('Speer')
    expect(weapons[0]!.addendums).toEqual(['d'])
  })

  it('falls back to a region-shared footnote when the item\'s own table lacks it', () => {
    // "Mahlzeit*" is in Im Gasthaus, but its footnote is printed under neighbouring tables.
    const { tables } = parseEquipment([
      region(
        ['AUF REISEN', 'PREIS'],
        ['Tagesration (3 Mahlzeiten*)', 'D', '5SM'],
        ['*: Erwachsener benötigt 3 pro Tag'],
        ['IM GASTHAUS', 'PREIS'],
        ['Mahlzeit* im Gasthaus', 'D', '5KM - 5SM'],
        ['UNTERBRINGUNG', 'PREIS'],
        ['*: Erwachsener benötigt 3 pro Tag'],
      ),
    ])

    const mahlzeit = tables['Im Gasthaus']![0]!
    expect(mahlzeit.name).toBe('Mahlzeit im Gasthaus')
    expect(mahlzeit.addendums).toEqual(['Erwachsener benötigt 3 pro Tag'])
  })

  it('does not bleed tables across regions and ignores pre-heading lines', () => {
    const { tables } = parseEquipment([
      region(['AUF REISEN', 'PREIS'], ['Seil (10m)', 'D', '1GM']),
      region(['1 GOLD = 10 SILBER = 100 KUPFER'], ['BEIM HÄNDLER', 'PREIS'], ['Decke', 'D', '1SM']),
    ])

    expect(tables['Auf Reisen']).toHaveLength(1)
    expect(tables['Beim Händler']).toEqual([
      { name: 'Decke', location: Location.D, price: '1SM', addendums: [] },
    ])
  })
})
