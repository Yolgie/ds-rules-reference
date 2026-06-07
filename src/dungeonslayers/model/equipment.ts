import type { Location } from './location'

export interface DSEquipment {
    name: string
    location: Location | null
    /** Raw price as printed, e.g. "2SM", "5KM - 5SM", "250GM/m²" ("-" for none). */
    price: string
    /** Footnote texts that apply to this entry (marked with * in the PDF). */
    addendums: string[]
}

/** A weapon from the WAFFEN table (extends equipment with WB and Besonderes). */
export interface DSWeapon extends DSEquipment {
    weaponBonus: string
    special: string
}

/** A piece of armor from the RÜSTUNGEN table (extends equipment with PA and Besonderes). */
export interface DSArmor extends DSEquipment {
    armorBonus: string
    special: string
}

/** Parsed equipment grouped by table. `tables` is keyed by the German table heading. */
export interface ParsedEquipment {
    tables: Record<string, DSEquipment[]>
    weapons: DSWeapon[]
    armor: DSArmor[]
}
