<script setup lang="ts">
import UploadMenu from '@/components/UploadMenu.vue'
import { useRulesStore } from '@/store/rules-store'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'

const store = useRulesStore()
const { isDataLoaded } = storeToRefs(store)
const router = useRouter()

const sections = [
  { label: 'Talente', route: '/talents', icon: 'pi pi-user' },
  { label: 'Ausrüstung', route: '/equipment', icon: 'pi pi-shopping-bag' },
  { label: 'Zaubersprüche', route: '/spells', icon: 'pi pi-sparkles' },
]
</script>

<template>
  <main>
    <h1>Dungeonslayers Regel-Referenz</h1>
    <Card class="intro">
      <template #content>
        <p>
          Diese Anwendung ist ein durchsuch- und filterbares Nachschlagewerk für das
          Rollenspielsystem <strong>Dungeonslayers</strong>. Lade das Dungeonslayers-Regel-PDF
          hoch – die Daten werden direkt in deinem Browser ausgelesen und anschließend in den
          Bereichen <strong>Talente</strong>, <strong>Ausrüstung</strong> und
          <strong>Zaubersprüche</strong> aufbereitet dargestellt.
        </p>
      </template>
    </Card>

    <section v-if="isDataLoaded" class="nav">
      <p class="hint">Die Daten sind geladen. Wähle einen Bereich:</p>
      <div class="nav-buttons">
        <Button
          v-for="section in sections"
          :key="section.route"
          :label="section.label"
          :icon="section.icon"
          size="large"
          class="nav-button"
          @click="router.push(section.route)"
        />
      </div>
    </section>
    <section v-else class="upload">
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
.intro {
  max-width: 50rem;
  margin-bottom: 2rem;
}
.intro p {
  margin: 0;
  line-height: 1.5;
}
.nav {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hint {
  margin-bottom: 1rem;
}
.nav-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}
.nav-button {
  min-width: 12rem;
}
</style>
