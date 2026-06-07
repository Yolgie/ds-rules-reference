import type { DSClass } from './ds_class'

/** Whether a spell is a normal spell or a targeted spell, taken from its icon. */
export enum SpellType {
  ZAUBER = 'ZAUBER',
  ZIELZAUBER = 'ZIELZAUBER',
}

/** One class that can learn the spell and the level at which it becomes available. */
export type SpellClassRequirement = {
  /** Always one of DSClass.Hei / DSClass.Zau / DSClass.Sch for spells. */
  dsClass: DSClass
  level: number
}

export type DSSpell = {
  name: string
  /** Raw price as printed, e.g. "650GM" ("Preis"). */
  price: string
  /** Classes and levels that can learn the spell (from the tables on pages 58/59). */
  classRequirements: SpellClassRequirement[]
  /** Normal vs targeted spell, from the icon next to the name; null if undetermined. */
  spellType: SpellType | null
  /** Raw "ZB" (Zauberbonus), e.g. "+0", "-2", "-(KÖR+AU)/2 des Ziels". */
  spellBonus: string
  /** Raw "Dauer". */
  duration: string
  /** Raw "Distanz". */
  distance: string
  /** Raw "Abklingzeit". */
  cooldown: string
  /** Raw "Effekt" prose (wrapped lines joined). */
  effect: string
}
