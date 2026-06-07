<script setup lang="ts">
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import type { DSEquipment } from '@/dungeonslayers/model/equipment';

defineProps<{
  title: string;
  items: DSEquipment[];
  extraColumns?: { field: string; header: string }[];
}>();
</script>

<template>
  <Card class="equipment-table">
    <template #title>{{ title }}</template>
    <template #content>
      <DataTable :value="items" size="small" stripedRows>
        <Column header="Name">
          <template #body="{ data }">
            {{ data.name }}<span v-if="data.addendums.length" class="addendums"> ({{ data.addendums.join('; ') }})</span>
          </template>
        </Column>
        <Column v-for="col in extraColumns" :key="col.field" :field="col.field" :header="col.header" />
        <Column header="Ort">
          <template #body="{ data }">{{ data.location ?? '—' }}</template>
        </Column>
        <Column header="Preis">
          <template #body="{ data }">{{ data.price || '—' }}</template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>

<style scoped>
.equipment-table {
  margin-bottom: 1.5rem;
}
.addendums {
  color: var(--ds-text-muted-color);
  font-size: 0.85rem;
}
</style>
