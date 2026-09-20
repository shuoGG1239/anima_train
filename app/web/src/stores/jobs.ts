import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { JobInfo, JobLogLine } from '@shared/ipc-types'

const MAX_RENDERED_LOGS = 2000

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<JobInfo[]>([])
  const logs = reactive<Record<string, JobLogLine[]>>({})

  async function init(): Promise<void> {
    jobs.value = await window.api.jobs.list()
  }

  function upsert(job: JobInfo): void {
    const idx = jobs.value.findIndex((j) => j.id === job.id)
    if (idx >= 0) {
      jobs.value[idx] = job
    } else {
      jobs.value.unshift(job)
    }
  }

  function byId(jobId: string): JobInfo | undefined {
    return jobs.value.find((j) => j.id === jobId)
  }

  function appendLog(jobId: string, line: JobLogLine): void {
    let arr = logs[jobId]
    if (!arr) {
      arr = []
      logs[jobId] = arr
    }
    arr.push(line)
    if (arr.length > MAX_RENDERED_LOGS) {
      arr.splice(0, arr.length - MAX_RENDERED_LOGS)
    }
  }

  async function hydrateLogs(jobId: string): Promise<void> {
    const lines = await window.api.jobs.getLogs(jobId)
    logs[jobId] = lines.slice(-MAX_RENDERED_LOGS)
  }

  function clearLog(jobId: string): void {
    logs[jobId] = []
  }

  async function clearLogs(jobId: string): Promise<void> {
    await window.api.jobs.clearLogs(jobId)
    clearLog(jobId)
  }

  async function stop(jobId: string): Promise<JobInfo | null> {
    const job = await window.api.jobs.stop(jobId)
    if (job) upsert(job)
    return job
  }

  const runningJobs = computed(() => jobs.value.filter((j) => j.status === 'running'))

  return {
    jobs,
    logs,
    init,
    upsert,
    byId,
    appendLog,
    hydrateLogs,
    clearLog,
    clearLogs,
    stop,
    runningJobs,
  }
})
