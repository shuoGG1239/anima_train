/// <reference types="vite/client" />

import type {
  AppSettings,
  CreateProjectParams,
  DanbooruFetchParams,
  DatasetDetail,
  DatasetInfo,
  JobInfo,
  JobLogLine,
  JobStartResult,
  ProjectFileSet,
  ProjectInfo,
  SimilarDeleteParams,
  SimilarDeleteResult,
  SimilarScanParams,
  Wd14BatchParams,
} from '../shared/ipc-types'
import type { ThemeMode } from '../shared/theme'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare global {
  interface Window {
    api: {
      platform: string
      theme: {
        set: (mode: ThemeMode) => Promise<ThemeMode>
      }
      settings: {
        get: () => Promise<AppSettings>
        set: (patch: Partial<AppSettings>) => Promise<AppSettings>
        pickTrainRoot: () => Promise<string | null>
        openTrainRoot: () => Promise<void>
        pickPython: () => Promise<string | null>
      }
      shell: {
        pickDir: (opts?: { title?: string; defaultPath?: string }) => Promise<string | null>
        openPath: (filePath: string) => Promise<void>
        showItemInFolder: (filePath: string) => Promise<void>
      }
      jobs: {
        list: () => Promise<JobInfo[]>
        getLogs: (jobId: string) => Promise<JobLogLine[]>
        clearLogs: (jobId: string) => Promise<void>
        stop: (jobId: string) => Promise<JobInfo | null>
        onLog: (cb: (payload: { jobId: string; line: JobLogLine }) => void) => () => void
        onStatus: (cb: (job: JobInfo) => void) => () => void
        onCleared: (cb: (payload: { jobId: string }) => void) => () => void
        onResult: (cb: (job: JobInfo) => void) => () => void
      }
      projects: {
        list: () => Promise<ProjectInfo[]>
        create: (params: CreateProjectParams) => Promise<ProjectInfo>
        readFiles: (name: string) => Promise<ProjectFileSet>
        writeFiles: (name: string, files: ProjectFileSet) => Promise<ProjectInfo>
        runTrain: (name: string) => Promise<JobStartResult>
        runPreprocess: (name: string) => Promise<JobStartResult>
        openFolder: (name: string) => Promise<void>
        delete: (name: string) => Promise<void>
      }
      datasets: {
        list: () => Promise<DatasetInfo[]>
        detail: (name: string) => Promise<DatasetDetail>
        readThumb: (path: string, size?: number) => Promise<string | null>
        readCaption: (path: string) => Promise<string | null>
        deleteOrphans: (
          name: string,
        ) => Promise<{ deletedImages: string[]; deletedCaptions: string[] }>
        openFolder: (name: string) => Promise<void>
      }
      tools: {
        danbooru: (params: DanbooruFetchParams) => Promise<JobStartResult>
        wd14: (params: Wd14BatchParams) => Promise<JobStartResult>
      }
      similar: {
        scan: (params: SimilarScanParams) => Promise<JobStartResult>
        delete: (params: SimilarDeleteParams) => Promise<SimilarDeleteResult>
      }
    }
  }
}

export {}
