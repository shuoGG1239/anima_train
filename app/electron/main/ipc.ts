import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { IPC } from '@shared/ipc-channels'
import type { ThemeMode } from '@shared/theme'
import { chromeForTheme, isThemeMode } from '@shared/theme'
import { getSettings, setSettings } from './settings'
import {
  clearJobLogs,
  getJobLogs,
  listJobs,
  stopJob,
} from './process-runner'
import {
  createProject,
  deleteProject,
  listProjects,
  openProjectFolder,
  readProjectFiles,
  runPreprocess,
  runTrain,
  writeProjectFiles,
} from './project'
import {
  datasetDetail,
  deleteOrphans,
  getDatasetInfo,
  imageThumbDataUrl,
  listDatasets,
  readCaption,
} from './dataset'
import { runDanbooruFetch, runWd14Batch } from './tools'
import { deleteSimilar, runSimilarScan } from './similar'
import type { CreateProjectParams, DanbooruFetchParams, ProjectFileSet, SimilarDeleteParams, SimilarScanParams, Wd14BatchParams } from '@shared/ipc-types'

function applyWindowChrome(win: BrowserWindow, theme: ThemeMode): void {
  const { bg, fg } = chromeForTheme(theme)
  win.setBackgroundColor(bg)
  if (process.platform === 'win32') {
    try {
      win.setTitleBarOverlay({ color: bg, symbolColor: fg, height: 36 })
    } catch {
      // overlay unsupported / not enabled
    }
  }
}

export function registerIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.theme.set, (_event, theme: unknown) => {
    const mode: ThemeMode = isThemeMode(theme) ? theme : 'light'
    const win = getMainWindow()
    if (win) applyWindowChrome(win, mode)
    return mode
  })

  ipcMain.handle(IPC.settings.get, () => getSettings())
  ipcMain.handle(IPC.settings.set, (_event, patch: Record<string, unknown>) => {
    return setSettings(patch as never)
  })

  ipcMain.handle(IPC.settings.pickTrainRoot, async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择 anima_train 仓库根目录',
      defaultPath: getSettings().trainRoot,
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return setSettings({ trainRoot: result.filePaths[0] }).trainRoot
  })

  ipcMain.handle(IPC.settings.openTrainRoot, async () => {
    const dir = getSettings().trainRoot
    if (!existsSync(dir)) throw new Error('仓库根目录不存在')
    const err = await shell.openPath(dir)
    if (err) throw new Error(err)
  })

  ipcMain.handle(IPC.settings.pickPython, async () => {
    const win = getMainWindow()
    if (!win) return null
    const current = getSettings().pythonPath
    const result = await dialog.showOpenDialog(win, {
      title: '选择 Python 可执行文件',
      defaultPath: current && current !== 'python' ? current : undefined,
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: '可执行文件', extensions: ['exe'] }]
          : [{ name: '可执行文件', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return setSettings({ pythonPath: result.filePaths[0] }).pythonPath
  })

  ipcMain.handle(IPC.shell.pickDir, async (_event, opts?: { title?: string; defaultPath?: string }) => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: opts?.title?.trim() || '选择目录',
      defaultPath: opts?.defaultPath?.trim() || undefined,
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.shell.openPath, async (_event, filePath: string) => {
    const target = String(filePath || '').trim()
    if (!target || !existsSync(target)) throw new Error('文件或目录不存在')
    const err = await shell.openPath(target)
    if (err) throw new Error(err)
  })

  ipcMain.handle(IPC.shell.showItemInFolder, async (_event, filePath: string) => {
    const target = String(filePath || '').trim()
    if (!target) throw new Error('路径为空')
    if (existsSync(target)) {
      shell.showItemInFolder(target)
      return
    }
    throw new Error('文件或目录不存在')
  })

  /* ---------- jobs ---------- */
  ipcMain.handle(IPC.jobs.list, () => listJobs())
  ipcMain.handle(IPC.jobs.getLogs, (_event, jobId: string) => getJobLogs(jobId))
  ipcMain.handle(IPC.jobs.clearLogs, (_event, jobId: string) => clearJobLogs(jobId))
  ipcMain.handle(IPC.jobs.stop, async (_event, jobId: string) => {
    const job = await stopJob(jobId)
    return job
  })

  /* ---------- projects ---------- */
  ipcMain.handle(IPC.projects.list, () => listProjects())
  ipcMain.handle(IPC.projects.create, (_event, params: CreateProjectParams) => createProject(params))
  ipcMain.handle(IPC.projects.readFiles, (_event, name: string) => readProjectFiles(name))
  ipcMain.handle(IPC.projects.writeFiles, (_event, name: string, files: ProjectFileSet) =>
    writeProjectFiles(name, files),
  )
  ipcMain.handle(IPC.projects.runTrain, (_event, name: string) => runTrain(name))
  ipcMain.handle(IPC.projects.runPreprocess, (_event, name: string) => runPreprocess(name))
  ipcMain.handle(IPC.projects.openFolder, (_event, name: string) => openProjectFolder(name))
  ipcMain.handle(IPC.projects.delete, (_event, name: string) => deleteProject(name))

  /* ---------- datasets ---------- */
  ipcMain.handle(IPC.datasets.list, () => listDatasets())
  ipcMain.handle(IPC.datasets.detail, (_event, name: string) => datasetDetail(name))
  ipcMain.handle(IPC.datasets.readThumb, (_event, path: string, size = 256) =>
    imageThumbDataUrl(path, size),
  )
  ipcMain.handle(IPC.datasets.readCaption, (_event, path: string) => readCaption(path))
  ipcMain.handle(IPC.datasets.deleteOrphans, (_event, name: string) => deleteOrphans(name))
  ipcMain.handle(IPC.datasets.openFolder, async (_event, name: string) => {
    const info = getDatasetInfo(name)
    const err = await shell.openPath(info.imagesDir)
    if (err) throw new Error(err)
  })

  /* ---------- tools ---------- */
  ipcMain.handle(IPC.tools.danbooru, (_event, params: DanbooruFetchParams) => runDanbooruFetch(params))
  ipcMain.handle(IPC.tools.wd14, (_event, params: Wd14BatchParams) => runWd14Batch(params))

  /* ---------- similar ---------- */
  ipcMain.handle(IPC.similar.scan, (_event, params: SimilarScanParams) => runSimilarScan(params))
  ipcMain.handle(IPC.similar.delete, (_event, params: SimilarDeleteParams) => deleteSimilar(params))
}
