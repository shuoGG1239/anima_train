import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { DatasetDetail, DatasetInfo } from '@shared/ipc-types'

const THUMB_CACHE_LIMIT = 800

export const useDatasetsStore = defineStore('datasets', () => {
  const datasets = ref<DatasetInfo[]>([])
  const detail = ref<DatasetDetail | null>(null)
  const thumbs = reactive<Record<string, string | null>>({})

  async function refresh(): Promise<void> {
    datasets.value = await window.api.datasets.list()
  }

  async function open(name: string): Promise<DatasetDetail> {
    detail.value = await window.api.datasets.detail(name)
    return detail.value
  }

  async function thumb(path: string, size = 256): Promise<string | null> {
    const key = `${size}:${path}`
    if (key in thumbs) return thumbs[key]
    const dataUrl = await window.api.datasets.readThumb(path, size)
    thumbs[key] = dataUrl
    const keys = Object.keys(thumbs)
    if (keys.length > THUMB_CACHE_LIMIT) {
      for (const k of keys.slice(0, keys.length - THUMB_CACHE_LIMIT)) {
        delete thumbs[k]
      }
    }
    return dataUrl
  }

  function invalidate(): void {
    detail.value = null
  }

  async function refreshDetail(name: string): Promise<DatasetDetail | null> {
    if (detail.value?.info.name === name) {
      detail.value = await window.api.datasets.detail(name)
    }
    return detail.value
  }

  return {
    datasets,
    detail,
    thumbs,
    refresh,
    open,
    thumb,
    invalidate,
    refreshDetail,
  }
})
