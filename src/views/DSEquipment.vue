<script setup lang="ts">
import UploadMenu from '@/components/UploadMenu.vue';
import EquipmentTable from '@/components/EquipmentTable.vue';
import { useRulesStore } from '@/store/rules-store';
import { storeToRefs } from 'pinia';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

const store = useRulesStore();
const { equipment, weapons, armor, isDataLoaded } = storeToRefs(store);

const weaponColumns = [
  { field: 'weaponBonus', header: 'WB' },
  { field: 'special', header: 'Besonderes' },
];
const armorColumns = [
  { field: 'armorBonus', header: 'PA' },
  { field: 'special', header: 'Besonderes' },
];

const gegenstaende = ['Auf Reisen', 'Beim Händler', 'Beleuchtung', 'Diverses', 'Schlösser'];
const dienstleistungen = ['Magische Dienste', 'Im Tempel', 'Im Gasthaus', 'Unterbringung', 'Unterkunft errichten'];
const tiere = ['Reittiere', 'Tiere'];
</script>

<template>
  <main>
    <h1>Ausrüstung</h1>
    <section v-if="isDataLoaded" class="equipment">
      <Tabs value="0">
        <TabList>
          <Tab value="0">Gegenstände</Tab>
          <Tab value="1">Dienstleistungen</Tab>
          <Tab value="2">Waffen &amp; Rüstungen</Tab>
          <Tab value="3">Tiere</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <EquipmentTable v-for="t in gegenstaende" :key="t" :title="t" :items="equipment[t] ?? []" />
          </TabPanel>
          <TabPanel value="1">
            <EquipmentTable v-for="t in dienstleistungen" :key="t" :title="t" :items="equipment[t] ?? []" />
          </TabPanel>
          <TabPanel value="2">
            <EquipmentTable title="Waffen" :items="weapons" :extra-columns="weaponColumns" />
            <EquipmentTable title="Rüstungen" :items="armor" :extra-columns="armorColumns" />
          </TabPanel>
          <TabPanel value="3">
            <EquipmentTable v-for="t in tiere" :key="t" :title="t" :items="equipment[t] ?? []" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </section>
    <section v-else>
      <UploadMenu />
    </section>
  </main>
</template>

<style scoped>
main {
  display: flex;
  align-items: center;
  flex-direction: column;
}
.equipment {
  max-width: 60rem;
  width: 100%;
}
</style>
