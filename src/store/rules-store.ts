import  {defineStore} from 'pinia'
import type {DSTalent} from '../dungeonslayers/model/talent'
import type {DSArmor, DSEquipment, DSWeapon, ParsedEquipment} from '../dungeonslayers/model/equipment'
import type {DSSpell} from '../dungeonslayers/model/spell'
import {computed, ref} from 'vue'
import type {Ref} from 'vue'

export const useRulesStore = defineStore('rules', () => {
    const talents: Ref<DSTalent[]> = ref([])
    const spells: Ref<DSSpell[]> = ref([])
    const equipment: Ref<Record<string, DSEquipment[]>> = ref({})
    const weapons: Ref<DSWeapon[]> = ref([])
    const armor: Ref<DSArmor[]> = ref([])

    const isDataLoaded = computed(() => talents.value.length !== 0)

    function resetStore() {
        talents.value = []
        spells.value = []
        equipment.value = {}
        weapons.value = []
        armor.value = []
    }

    function addTalents (newTalents: DSTalent[]) {
        talents.value.push(...newTalents)
    }

    function addSpells (newSpells: DSSpell[]) {
        spells.value.push(...newSpells)
    }

    function setEquipment (parsed: ParsedEquipment) {
        equipment.value = parsed.tables
        weapons.value = parsed.weapons
        armor.value = parsed.armor
    }

    return {talents, spells, equipment, weapons, armor, isDataLoaded, resetStore, addTalents, addSpells, setEquipment}
})
