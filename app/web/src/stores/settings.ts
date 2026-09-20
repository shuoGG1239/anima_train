import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '@shared/ipc-types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings | null>(null)

  async function load(): Promise<AppSettings> {
    settings.value = await window.api.settings.get()
    return settings.value
  }

  async function save(patch: Partial<AppSettings>): Promise<AppSettings> {
    settings.value = await window.api.settings.set(patch)
    return settings.value
  }

  return { settings, load, save }
})
