/** Shared IPC payload types (renderer ⇄ main). */

import type { ThemeMode } from './theme'

/* ---------- settings ---------- */

export interface AppSettings {
  /** anima_train 仓库根目录，其下应有 datasets/ 与 projects/ */
  trainRoot: string
  /** Python 可执行文件，用于启动预处理工具脚本 */
  pythonPath: string
  /** Danbooru 下载默认代理 */
  danbooruProxy: string
  danbooruMinSide: number
  danbooruMaxSide: number
  danbooruQuality: number
  danbooruTrigger: string
  /** WD14 模型目录（含 .onnx 与 .csv） */
  wd14ModelDir: string
  wd14ModelName: string
}

/* ---------- jobs (进程控制台) ---------- */

export type JobKind = 'train' | 'preprocess' | 'danbooru' | 'wd14' | 'similar' | 'custom'

export type JobStatus = 'running' | 'success' | 'error' | 'stopped'

export type JobLogLevel = 'stdout' | 'stderr' | 'system'

export interface JobLogLine {
  id: number
  ts: number
  level: JobLogLevel
  text: string
}

export interface JobInfo {
  id: string
  kind: JobKind
  name: string
  command: string
  cwd: string
  status: JobStatus
  pid: number | null
  startedAt: number
  finishedAt: number | null
  exitCode: number | null
  logFile: string | null
  /** 工具型任务（相似图扫描）完成后解析出的结果 */
  result: unknown
  error: string | null
}

export interface JobStartResult {
  job: JobInfo
}

/* ---------- projects ---------- */

export interface ProjectInfo {
  name: string
  dir: string
  hasTrainScript: boolean
  hasPreprocessScript: boolean
  hasDatasetToml: boolean
  hasOutput: boolean
  hasLogs: boolean
  trainScript: string
  preprocessScript: string
  datasetToml: string
  outputDir: string
  logDir: string
}

export interface ProjectFileSet {
  trainScript: string
  preprocessScript: string
  datasetToml: string
}

export interface CreateProjectParams {
  name: string
  trigger: string
  description?: string
}

/* ---------- datasets ---------- */

export interface DatasetInfo {
  name: string
  dir: string
  /** 图片所在目录（name/images 或 name 本身） */
  imagesDir: string
  imageCount: number
  captionCount: number
  paired: number
  orphanImages: number
  orphanCaptions: number
  totalSizeBytes: number
}

export interface DatasetImageItem {
  name: string
  path: string
  sizeBytes: number
  mtimeMs: number
  hasCaption: boolean
}

export interface DatasetDetail {
  info: DatasetInfo
  images: DatasetImageItem[]
  orphanImageNames: string[]
  orphanCaptionNames: string[]
}

/* ---------- similar scan ---------- */

export interface SimilarScanParams {
  path: string
  threshold: number
  method: string
  recursive: boolean
}

export interface SimilarScanItem {
  path: string
  name: string
  distance: number
  sizeBytes: number
}

export interface SimilarScanGroup {
  index: number
  items: SimilarScanItem[]
}

export interface SimilarScanResult {
  root: string
  scanned: number
  skipped: number
  threshold: number
  method: string
  recursive: boolean
  groups: SimilarScanGroup[]
}

export interface SimilarDeleteParams {
  root: string
  paths: string[]
}

export interface SimilarDeleteResult {
  deleted: string[]
  errors: string[]
}

/* ---------- tools ---------- */

export interface DanbooruFetchParams {
  tags: string
  proxy: string
  minSide: number
  maxSide: number
  quality: number
  trigger: string
  preprocess: boolean
}

export interface Wd14BatchParams {
  inputDir: string
  modelDir: string
  modelName: string
  trigger: string
  minSide: number
  maxSide: number
  threshold: number
  characterThreshold: number
  excludeTags: string
}

/* ---------- misc ---------- */

export interface ImageThumb {
  path: string
  name: string
  dataUrl: string
}

export type { ThemeMode }
