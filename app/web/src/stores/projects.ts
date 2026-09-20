import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreateProjectParams, ProjectFileSet, ProjectInfo } from '@shared/ipc-types'
import { useJobsStore } from './jobs'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<ProjectInfo[]>([])
  const editing = ref<ProjectInfo | null>(null)
  const files = ref<ProjectFileSet | null>(null)

  async function refresh(): Promise<void> {
    projects.value = await window.api.projects.list()
  }

  async function create(params: CreateProjectParams): Promise<ProjectInfo> {
    const info = await window.api.projects.create(params)
    await refresh()
    return info
  }

  async function loadFiles(name: string): Promise<void> {
    files.value = await window.api.projects.readFiles(name)
  }

  async function saveFiles(name: string): Promise<ProjectInfo> {
    if (!files.value) throw new Error('尚未加载项目文件')
    const info = await window.api.projects.writeFiles(name, files.value)
    await refresh()
    return info
  }

  async function runTrain(name: string): Promise<void> {
    const jobs = useJobsStore()
    const { job } = await window.api.projects.runTrain(name)
    jobs.upsert(job)
  }

  async function runPreprocess(name: string): Promise<void> {
    const jobs = useJobsStore()
    const { job } = await window.api.projects.runPreprocess(name)
    jobs.upsert(job)
  }

  async function remove(name: string): Promise<void> {
    await window.api.projects.delete(name)
    if (editing.value?.name === name) {
      editing.value = null
      files.value = null
    }
    await refresh()
  }

  return {
    projects,
    editing,
    files,
    refresh,
    create,
    loadFiles,
    saveFiles,
    runTrain,
    runPreprocess,
    remove,
  }
})
