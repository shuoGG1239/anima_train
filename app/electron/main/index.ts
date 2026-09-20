import { app, BrowserWindow, clipboard, Menu, shell } from 'electron'
import { join } from 'path'
import { APP_DISPLAY_NAME } from '@shared/app-defaults'
import { THEME_CHROME } from '@shared/theme'
import { registerIpc } from './ipc'
import { initJobRunner, stopAllJobsSync } from './process-runner'

app.commandLine.appendSwitch('unsafely-disable-devtools-self-xss-warnings')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const lightChrome = THEME_CHROME.light

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: APP_DISPLAY_NAME,
    backgroundColor: lightChrome.bg,
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 14, y: 10 } }
      : {
          titleBarOverlay: {
            color: lightChrome.bg,
            symbolColor: lightChrome.fg,
            height: 36,
          },
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  // 右键菜单（参考 aigc-ui）：输入框剪切/复制/粘贴、图片路径操作、检查元素。
  // 检查元素 → inspectElement(x, y) 会自动打开 DevTools 并定位到该元素。
  mainWindow.webContents.on('context-menu', async (_event, params) => {
    const win = mainWindow
    if (!win) return

    let imagePath: string | null = null
    try {
      const hit = (await win.webContents.executeJavaScript(
        `(() => {
          const at = document.elementFromPoint(${params.x}, ${params.y});
          const pathEl = at && typeof at.closest === 'function'
            ? at.closest('[data-image-path]')
            : null;
          return pathEl && typeof pathEl.getAttribute === 'function'
            ? pathEl.getAttribute('data-image-path')
            : null;
        })()`,
      )) as string | null
      if (typeof hit === 'string' && hit.trim()) imagePath = hit.trim()
    } catch {
      // ignore
    }

    const template: Electron.MenuItemConstructorOptions[] = []

    // 输入框：标准编辑操作（用 editFlags 判断哪些可用）
    if (params.isEditable) {
      if (params.editFlags.canCut) template.push({ label: '剪切', role: 'cut' })
      if (params.editFlags.canCopy) template.push({ label: '复制', role: 'copy' })
      if (params.editFlags.canPaste) template.push({ label: '粘贴', role: 'paste' })
      if (params.editFlags.canSelectAll) template.push({ label: '全选', role: 'selectAll' })
      if (template.length) template.push({ type: 'separator' })
    } else if (params.selectionText?.trim()) {
      template.push({ label: '复制', role: 'copy' })
      template.push({ type: 'separator' })
    }

    // 图片元素：在文件夹中显示 / 复制路径
    if (imagePath) {
      template.push({
        label: '在文件夹中显示',
        click: () => {
          shell.showItemInFolder(imagePath as string)
        },
      })
      template.push({
        label: '复制路径',
        click: () => {
          clipboard.writeText(imagePath as string)
        },
      })
      template.push({ type: 'separator' })
    }

    template.push({
      label: '检查元素',
      click: () => {
        win.webContents.inspectElement(params.x, params.y)
      },
    })

    Menu.buildFromTemplate(template).popup({ window: win })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void import('electron').then(({ shell }) => shell.openExternal(details.url))
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.anima.train')
  }

  initJobRunner(() => mainWindow)
  registerIpc(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopAllJobsSync()
})

app.on('window-all-closed', () => {
  stopAllJobsSync()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
