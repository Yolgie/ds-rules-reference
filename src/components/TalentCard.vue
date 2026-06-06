<script setup lang="ts">
import Card from 'primevue/card';
import { computed } from 'vue';
import type { DSTalent } from '@/dungeonslayers/model/talent';

const props = defineProps<{ talent: DSTalent }>();

const requirements = computed(() =>
  props.talent.classRequirements
    .map((req) => `${req.dsClass} ${req.classLevel} (${req.maxTalentRank})`)
    .join(', '),
);
</script>

<template>
  <Card class="talent-card">
    <template #title>{{ talent.name }}</template>
    <template #subtitle>{{ requirements }}</template>
    <template #content>
      <p class="description">{{ talent.description }}</p>
    </template>
  </Card>
</template>

<style scoped>
.description {
  white-space: pre-line;
  margin: 0;
}
</style>
