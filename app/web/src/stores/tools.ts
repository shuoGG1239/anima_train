import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type {
  DanbooruFetchParams,
  JobInfo,
  SimilarScanParams,
  SimilarScanResult,
  Wd14BatchParams,
} from '@shared/ipc-types'
import { useJobsStore } from './jobs'

export const useToolsStore = defineStore('tools', () => {
  const danbooru = reactive<DanbooruFetchParams>({
    tags: '',
    proxy: 'socks5://127.0.0.1:1080',
    minSide: 768,
    maxSide: 2048,
    quality: 95,
    trigger: '',
    preprocess: true,
  })

  const wd14 = reactive<Wd14BatchParams>({
    inputDir: '',
    modelDir: '',
    modelName: 'wd-swinv2-tagger-v3',
    trigger: '',
    minSide: 768,
    maxSide: 2048,
    threshold: 0.35,
    characterThreshold: 0.85,
    excludeTags: '',
  })

  const similar = reactive<SimilarScanParams>({
    path: '',
    threshold: 8,
    method: 'phash',
    recursive: false,
  })

  const similarJobId = ref<string | null>(null)
  const similarResult = ref<SimilarScanResult | null>(null)

  /** 从设置合并默认值（代理、尺寸等）。 */
  function applySettings(s: { danbooruProxy: string; danbooruMinSide: number; danbooruMaxSide: number; danbooruQuality: number; danbooruTrigger: string; wd14ModelDir: string; wd14ModelName: string }): void {
    if (!danbooru.proxy) danbooru.proxy = s.danbooruProxy
    if (danbooru.minSide <= 0) danbooru.minSide = s.danbooruMinSide
    if (danbooru.maxSide <= 0) danbooru.maxSide = s.danbooruMaxSide
    if (danbooru.quality <= 0) danbooru.quality = s.danbooruQuality
    if (!danbooru.trigger) danbooru.trigger = s.danbooruTrigger
    if (!wd14.modelDir) wd14.modelDir = s.wd14ModelDir
    if (!wd14.modelName) wd14.modelName = s.wd14ModelName
  }

  async function runDanbooru(): Promise<JobInfo> {
    const jobs = useJobsStore()
    const { job } = await window.api.tools.danbooru({ ...danbooru })
    jobs.upsert(job)
    return job
  }

  async function runWd14(): Promise<JobInfo> {
    const jobs = useJobsStore()
    const { job } = await window.api.tools.wd14({ ...wd14 })
    jobs.upsert(job)
    return job
  }

  async function runSimilarScan(): Promise<JobInfo> {
    const jobs = useJobsStore()
    similarResult.value = null
    const { job } = await window.api.similar.scan({ ...similar })
    similarJobId.value = job.id
    jobs.upsert(job)
    return job
  }

  function collectResult(job: JobInfo): void {
    if (job.id === similarJobId.value && job.status !== 'running' && job.result) {
      similarResult.value = job.result as SimilarScanResult
    }
  }

  return {
    danbooru,
    wd14,
    similar,
    similarJobId,
    similarResult,
    applySettings,
    runDanbooru,
    runWd14,
    runSimilarScan,
    collectResult,
  }
})
