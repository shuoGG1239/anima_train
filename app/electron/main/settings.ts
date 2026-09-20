import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join, resolve } from 'path'
import { DEFAULT_PYTHON, DEFAULT_PROXY, DEFAULT_WD14_MODEL_NAME } from '@shared/app-defaults'
import type { AppSettings } from '@shared/ipc-types'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** 仓库根目录的标志：包含 python/（与 datasets/projects 同级）。 */
function isTrainRoot(dir: string): boolean {
  return existsSync(join(dir, 'python'))
}

/** 从 main bundle 所在目录向上查找 anima_train 仓库根。 */
function defaultTrainRoot(): string {
  const env = process.env.ANIMA_TRAIN_ROOT
  if (env && env.trim()) {
    const p = resolve(env.trim())
    if (isTrainRoot(p)) return p
  }
  // dev: app/out/main → … → anima_train；preview/打包后 app 仍位于仓库内也可命中
  let cur = __dirname
  for (;;) {
    if (isTrainRoot(cur)) return cur
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  // 打包安装到仓库外的兜底：app.getAppPath() 的父目录
  try {
    const parent = resolve(dirname(app.getAppPath()), '..')
    if (isTrainRoot(parent)) return parent
  } catch {
    // ignore
  }
  return join(homedir(), 'anima_train')
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function clampFloat(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function getSettings(): AppSettings {
  const defaults: AppSettings = {
    trainRoot: defaultTrainRoot(),
    pythonPath: DEFAULT_PYTHON,
    danbooruProxy: DEFAULT_PROXY,
    danbooruMinSide: 768,
    danbooruMaxSide: 2048,
    danbooruQuality: 95,
    danbooruTrigger: '',
    wd14ModelDir: '',
    wd14ModelName: DEFAULT_WD14_MODEL_NAME,
  }

  try {
    const path = settingsPath()
    if (!existsSync(path)) {
      return defaults
    }
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    return {
      trainRoot:
        typeof raw.trainRoot === 'string' && raw.trainRoot.trim()
          ? resolve(raw.trainRoot.trim())
          : defaults.trainRoot,
      pythonPath:
        typeof raw.pythonPath === 'string' && raw.pythonPath.trim()
          ? raw.pythonPath.trim()
          : defaults.pythonPath,
      danbooruProxy:
        typeof raw.danbooruProxy === 'string' ? raw.danbooruProxy.trim() : defaults.danbooruProxy,
      danbooruMinSide: clampInt(raw.danbooruMinSide, defaults.danbooruMinSide, 256, 4096),
      danbooruMaxSide: clampInt(raw.danbooruMaxSide, defaults.danbooruMaxSide, 256, 4096),
      danbooruQuality: clampInt(raw.danbooruQuality, defaults.danbooruQuality, 50, 100),
      danbooruTrigger: typeof raw.danbooruTrigger === 'string' ? raw.danbooruTrigger.trim() : defaults.danbooruTrigger,
      wd14ModelDir: typeof raw.wd14ModelDir === 'string' ? raw.wd14ModelDir.trim() : defaults.wd14ModelDir,
      wd14ModelName:
        typeof raw.wd14ModelName === 'string' && raw.wd14ModelName.trim()
          ? raw.wd14ModelName.trim()
          : defaults.wd14ModelName,
    }
  } catch {
    return defaults
  }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  if (next.trainRoot && next.trainRoot.trim()) {
    next.trainRoot = resolve(next.trainRoot.trim())
  }
  if (next.pythonPath) {
    next.pythonPath = next.pythonPath.trim()
  }
  if (next.wd14ModelDir) {
    next.wd14ModelDir = next.wd14ModelDir.trim()
  }
  next.danbooruMinSide = clampInt(next.danbooruMinSide, 768, 256, 4096)
  next.danbooruMaxSide = clampInt(next.danbooruMaxSide, 2048, 256, 4096)
  next.danbooruQuality = clampInt(next.danbooruQuality, 95, 50, 100)
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

/** 仓库根目录下的 datasets / projects 派生路径。 */
export function datasetsDir(): string {
  return join(getSettings().trainRoot, 'datasets')
}

export function projectsDir(): string {
  return join(getSettings().trainRoot, 'projects')
}

export function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}
