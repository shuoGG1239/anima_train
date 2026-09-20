<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import TitleBar from '@/components/layout/TitleBar.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import { useToast } from '@/composables/useToast'
import { useSettingsStore } from '@/stores/settings'
import { useJobsStore } from '@/stores/jobs'

const settings = useSettingsStore()
const jobs = useJobsStore()
const toast = useToast()
const platform = window.api?.platform ?? 'win32'

let offLog: (() => void) | undefined
let offStatus: (() => void) | undefined
let offCleared: (() => void) | undefined
let offResult: (() => void) | undefined

onMounted(async () => {
  await settings.load()
  await jobs.init()
  offLog = window.api.jobs.onLog(({ jobId, line }) => jobs.appendLog(jobId, line))
  offStatus = window.api.jobs.onStatus((job) => jobs.upsert(job))
  offCleared = window.api.jobs.onCleared(({ jobId }) => jobs.clearLog(jobId))
  offResult = window.api.jobs.onResult((job) => jobs.upsert(job))
})

onUnmounted(() => {
  offLog?.()
  offStatus?.()
  offCleared?.()
  offResult?.()
})
</script>

<template>
  <div class="app-frame" :class="[`platform-${platform}`]">
    <TitleBar />
    <div class="app-shell">
      <Sidebar />
      <main class="main">
        <div class="page-view">
          <RouterView v-slot="{ Component }">
            <KeepAlive :include="['ProjectsView', 'DatasetsView', 'ToolsView']">
              <component :is="Component" />
            </KeepAlive>
          </RouterView>
        </div>
      </main>
    </div>
    <ToastHost />
  </div>
</template>
