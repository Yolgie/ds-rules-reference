<script setup lang="ts">
import TalentCard from '@/components/TalentCard.vue';
import UploadMenu from '@/components/UploadMenu.vue';
import { useRulesStore } from '@/store/rules-store'
import { filterTalents } from '@/dungeonslayers/talent-filter'
import { DSClass } from '@/dungeonslayers/model/ds_class'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import Toolbar from 'primevue/toolbar'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const store = useRulesStore()

const { talents, isDataLoaded } = storeToRefs(store)

const classOptions = Object.values(DSClass)
const levelOptions = Array.from({ length: 20 }, (_, i) => i + 1)

const selectedClasses = ref<DSClass[]>([])
const selectedLevel = ref<number | null>(null)
const search = ref('')

const filteredTalents = computed(() =>
  filterTalents(talents.value, {
    classes: selectedClasses.value ?? [],
    maxLevel: selectedLevel.value,
    search: search.value,
  }),
)
</script>

<template>
  <main>
    <h1>Talente</h1>
    <section v-if="isDataLoaded" class="talent-list">
        <Toolbar class="filter-bar">
          <template #center>
            <div class="filters">
              <MultiSelect
                v-model="selectedClasses"
                :options="classOptions"
                display="chip"
                :maxSelectedLabels="4"
                placeholder="Klassen"
                showClear
                class="filter-classes"
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
        <p class="count">{{ filteredTalents.length }} / {{ talents.length }} Talente</p>
        <TalentCard v-for="talent in filteredTalents" :key="talent.name" :talent="talent" class="talent" />
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
.talent-list {
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
.filter-level {
    min-width: 8rem;
}
.talent {
    margin-bottom: 1.5rem;
}
</style>
