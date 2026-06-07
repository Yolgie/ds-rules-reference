<script setup lang="ts">
import Card from 'primevue/card';
import type { DSEquipment } from '@/dungeonslayers/model/equipment';

defineProps<{
  title: string;
  items: DSEquipment[];
  extraColumns?: { field: string; header: string }[];
}>();

/** Reads an extra-column field (e.g. weaponBonus/special) off a row by name. */
function cell(item: DSEquipment, field: string): string {
  return (item as unknown as Record<string, string>)[field] ?? '';
}
</script>

<template>
  <Card class="equipment-table">
    <template #title>{{ title }}</template>
    <template #content>
      <table class="eq-table">
        <thead>
          <tr>
            <th>Name</th>
            <th v-for="col in extraColumns" :key="col.field">{{ col.header }}</th>
            <th class="col-narrow">Ort</th>
            <th class="col-narrow">Preis</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="index">
            <td>
              {{ item.name
              }}<span v-if="item.addendums.length" class="addendums">
                ({{ item.addendums.join('; ') }})</span
              >
            </td>
            <td v-for="col in extraColumns" :key="col.field">{{ cell(item, col.field) }}</td>
            <td class="col-narrow">{{ item.location ?? '—' }}</td>
            <td class="col-narrow">{{ item.price || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </Card>
</template>

<style scoped>
.equipment-table {
  margin-bottom: 1.5rem;
}
.eq-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.eq-table th,
.eq-table td {
  text-align: left;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--ds-content-border-color);
}
.eq-table th {
  font-weight: 600;
  color: var(--ds-text-color);
}
.eq-table tbody tr:nth-child(even) {
  background: var(--ds-content-hover-background);
}
.col-narrow {
  width: 1%;
  white-space: nowrap;
}
.addendums {
  color: var(--ds-text-muted-color);
  font-size: 0.85rem;
}
</style>
