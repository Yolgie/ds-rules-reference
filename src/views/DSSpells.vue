<script setup lang="ts">
import SpellCard from '@/components/SpellCard.vue'
import UploadMenu from '@/components/UploadMenu.vue'
import { useRulesStore } from '@/store/rules-store'
import { filterSpells } from '@/dungeonslayers/spell-filter'
import { DSClass } from '@/dungeonslayers/model/ds_class'
import { SpellType } from '@/dungeonslayers/model/spell'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import Toolbar from 'primevue/toolbar'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const store = useRulesStore()

const { spells, isDataLoaded } = storeToRefs(store)

const classOptions = [DSClass.Hei, DSClass.Zau, DSClass.Sch]
const spellTypeOptions = Object.values(SpellType)
const levelOptions = Array.from({ length: 20 }, (_, i) => i + 1)

const selectedClasses = ref<DSClass[]>([])
const selectedSpellTypes = ref<SpellType[]>([])
const selectedLevel = ref<number | null>(null)
const search = ref('')

const filteredSpells = computed(() =>
  filterSpells(spells.value, {
    classes: selectedClasses.value ?? [],
    spellTypes: selectedSpellTypes.value ?? [],
    maxLevel: selectedLevel.value,
    search: search.value,
  }),
)
</script>

<template>
  <main>
    <h1>Zaubersprüche</h1>
    <section v-if="isDataLoaded" class="spell-list">
      <Toolbar class="filter-bar">
        <template #center>
          <div class="filters">
            <MultiSelect
              v-model="selectedClasses"
              :options="classOptions"
              display="chip"
              :maxSelectedLabels="3"
              placeholder="Klassen"
              showClear
              class="filter-classes"
            />
            <MultiSelect
              v-model="selectedSpellTypes"
              :options="spellTypeOptions"
              display="chip"
              :maxSelectedLabels="2"
              placeholder="Zaubertyp"
              showClear
              class="filter-types"
            />
            <Select
              v-model="selectedLevel"
              :options="levelOptions"
              placeholder="Stufe"
              showClear
              class="filter-level"
            />
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText v-model="search" placeholder="Suche" />
            </IconField>
          </div>
        </template>
      </Toolbar>
      <p class="count">{{ filteredSpells.length }} / {{ spells.length }} Zaubersprüche</p>
      <SpellCard v-for="spell in filteredSpells" :key="spell.name" :spell="spell" class="spell" />
    </section>
    <section v-else>
      <UploadMenu></UploadMenu>
    </section>
  </main>
</template>

<style scoped>
main {
  display: flex;
  align-items: center;
  flex-direction: column;
}
.spell-list {
  max-width: 60rem;
  width: 100%;
}
.filter-bar {
  margin-bottom: 1rem;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.filter-classes {
  min-width: 14rem;
}
.filter-types {
  min-width: 12rem;
}
.filter-level {
  min-width: 8rem;
}
.spell {
  margin-bottom: 1.5rem;
}
</style>
