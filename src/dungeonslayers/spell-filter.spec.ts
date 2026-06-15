import { describe, expect, it } from 'vitest'
import { DSClass } from './model/ds_class'
import type { DSSpell, SpellClassRequirement } from './model/spell'
import { SpellType } from './model/spell'
import { filterSpells, type SpellFilter } from './spell-filter'

type Req = [DSClass, number]

function spell(name: string, reqs: Req[], effect = ''): DSSpell {
  return {
    name,
    price: '10GM',
    classRequirements: reqs.map(([dsClass, level]): SpellClassRequirement => ({ dsClass, level })),
    spellType: SpellType.ZAUBER,
    spellBonus: '+0',
    duration: '',
    distance: '',
    cooldown: '',
    effect,
  }
}

const light = spell('Licht', [[DSClass.Hei, 1], [DSClass.Zau, 2]], 'Macht hell.')
const fireball = spell('Feuerball', [[DSClass.Zau, 6], [DSClass.Sch, 8]], 'Feuerschaden.')
const heal = spell('Heilung', [[DSClass.Hei, 4]], 'Heilt Wunden.')
const all = [light, fireball, heal]

const noFilter: SpellFilter = { classes: [], spellTypes: [], maxLevel: null, search: '' }
const names = (spells: DSSpell[]) => spells.map((s) => s.name)

describe('filterSpells', () => {
  it('returns all spells when no filter is set', () => {
    expect(filterSpells(all, noFilter)).toEqual(all)
  })

  it('filters by class', () => {
    expect(names(filterSpells(all, { ...noFilter, classes: [DSClass.Hei] }))).toEqual(['Licht', 'Heilung'])
  })

  it('filters by any class level when no class is selected', () => {
    expect(names(filterSpells(all, { ...noFilter, maxLevel: 2 }))).toEqual(['Licht'])
  })

  it('requires the same class requirement to match both selected class and level', () => {
    expect(names(filterSpells(all, { ...noFilter, classes: [DSClass.Sch], maxLevel: 6 }))).toEqual([])
  })

  it('matches when a selected class is learnable at or below the selected level', () => {
    expect(names(filterSpells(all, { ...noFilter, classes: [DSClass.Zau], maxLevel: 6 }))).toEqual([
      'Licht',
      'Feuerball',
    ])
  })
})
