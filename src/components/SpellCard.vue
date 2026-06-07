<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import { computed } from 'vue'
import type { DSSpell } from '@/dungeonslayers/model/spell'
import {SpellType} from '@/dungeonslayers/model/spell' 

const props = defineProps<{ spell: DSSpell }>()

const requirements = computed(() =>
  props.spell.classRequirements.map((req) => `${req.dsClass} ${req.level}`).join(', '),
)

const stats = computed(() =>
  [
    { label: 'Preis', value: props.spell.price },
    { label: 'ZB', value: props.spell.spellBonus },
    { label: 'Dauer', value: props.spell.duration },
    { label: 'Distanz', value: props.spell.distance },
    { label: 'Abklingzeit', value: props.spell.cooldown },
  ].filter((s) => s.value),
)
</script>

<template>
  <Card class="spell-card">
    <template #title>
      <div class="title-row">
        <span>{{ spell.name }} 
          <i v-if="spell.spellType === SpellType.ZAUBER" class="spell-type-iconpi pi-book"></i>
          <i v-if="spell.spellType === SpellType.ZIELZAUBER" class="spell-type-icon pi pi-bullseye"></i>
        </span>
        <Tag v-if="spell.spellType" :value="spell.spellType" severity="info" />
      </div>
    </template>
    <template #subtitle>{{ requirements || 'Keine Klassenangabe' }}</template>
    <template #content>
      <dl class="stats">
        <template v-for="stat in stats" :key="stat.label">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}</dd>
        </template>
      </dl>
      <p v-if="spell.effect" class="effect">{{ spell.effect }}</p>
    </template>
  </Card>
</template>

<style scoped>
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.stats {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.75rem;
  margin: 0 0 0.75rem;
  line-height: 1.4;
}
.stats dt {
  font-weight: 600;
}
.stats dd {
  margin: 0;
}
.effect {
  white-space: pre-line;
  margin: 0;
}
.spell-type-icon {
  color: var(--ds-text-muted-color);
}
</style>
