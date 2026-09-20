import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ThemeMode } from '@shared/theme'
import type {
  CreateProjectParams,
  DanbooruFetchParams,
  JobInfo,
  JobLogLine,
  ProjectFileSet,
  SimilarDeleteParams,
  SimilarScanParams,
  Wd14BatchParams,
} from '@shared/ipc-types'

function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform as NodeJS.Platform,
  theme: {
    set: (mode: ThemeMode) => ipcRenderer.invoke(IPC.theme.set, mode),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke(IPC.settings.set, patch),
    pickTrainRoot: () => ipcRenderer.invoke(IPC.settings.pickTrainRoot),
    openTrainRoot: () => ipcRenderer.invoke(IPC.settings.openTrainRoot),
    pickPython: () => ipcRenderer.invoke(IPC.settings.pickPython),
  },
  shell: {
    pickDir: (opts?: { title?: string; defaultPath?: string }) =>
      ipcRenderer.invoke(IPC.shell.pickDir, opts),
    openPath: (filePath: string) => ipcRenderer.invoke(IPC.shell.openPath, filePath),
    showItemInFolder: (filePath: string) =>
      ipcRenderer.invoke(IPC.shell.showItemInFolder, filePath),
  },
  jobs: {
    list: () => ipcRenderer.invoke(IPC.jobs.list),
    getLogs: (jobId: string) => ipcRenderer.invoke(IPC.jobs.getLogs, jobId),
    clearLogs: (jobId: string) => ipcRenderer.invoke(IPC.jobs.clearLogs, jobId),
    stop: (jobId: string) => ipcRenderer.invoke(IPC.jobs.stop, jobId),
    onLog: (cb: (payload: { jobId: string; line: JobLogLine }) => void) =>
      on(IPC.jobs.log, cb),
    onStatus: (cb: (job: JobInfo) => void) => on(IPC.jobs.status, cb),
    onCleared: (cb: (payload: { jobId: string }) => void) => on(IPC.jobs.cleared, cb),
    onResult: (cb: (job: JobInfo) => void) => on(IPC.jobs.result, cb),
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC.projects.list),
    create: (params: CreateProjectParams) => ipcRenderer.invoke(IPC.projects.create, params),
    readFiles: (name: string) => ipcRenderer.invoke(IPC.projects.readFiles, name),
    writeFiles: (name: string, files: ProjectFileSet) =>
      ipcRenderer.invoke(IPC.projects.writeFiles, name, files),
    runTrain: (name: string) => ipcRenderer.invoke(IPC.projects.runTrain, name),
    runPreprocess: (name: string) => ipcRenderer.invoke(IPC.projects.runPreprocess, name),
    openFolder: (name: string) => ipcRenderer.invoke(IPC.projects.openFolder, name),
    delete: (name: string) => ipcRenderer.invoke(IPC.projects.delete, name),
  },
  datasets: {
    list: () => ipcRenderer.invoke(IPC.datasets.list),
    detail: (name: string) => ipcRenderer.invoke(IPC.datasets.detail, name),
    readThumb: (path: string, size?: number) => ipcRenderer.invoke(IPC.datasets.readThumb, path, size),
    readCaption: (path: string) => ipcRenderer.invoke(IPC.datasets.readCaption, path),
    deleteOrphans: (name: string) => ipcRenderer.invoke(IPC.datasets.deleteOrphans, name),
    openFolder: (name: string) => ipcRenderer.invoke(IPC.datasets.openFolder, name),
  },
  tools: {
    danbooru: (params: DanbooruFetchParams) => ipcRenderer.invoke(IPC.tools.danbooru, params),
    wd14: (params: Wd14BatchParams) => ipcRenderer.invoke(IPC.tools.wd14, params),
  },
  similar: {
    scan: (params: SimilarScanParams) => ipcRenderer.invoke(IPC.similar.scan, params),
    delete: (params: SimilarDeleteParams) => ipcRenderer.invoke(IPC.similar.delete, params),
  },
})
