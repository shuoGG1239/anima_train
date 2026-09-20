/** 相似图去重：调用 python/scan_cli.py（输出 JSON），结果由进程运行器解析。 */

import { app } from 'electron'
import { existsSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { getSettings } from './settings'
import { startJob } from './process-runner'
import type {
  JobStartResult,
  SimilarDeleteParams,
  SimilarDeleteResult,
  SimilarScanParams,
} from '@shared/ipc-types'

/** 启动相似图扫描任务；完成后 job.result 为 SimilarScanResult。 */
export function runSimilarScan(params: SimilarScanParams): JobStartResult {
  const settings = getSettings()
  const script = join(settings.trainRoot, 'python', 'scan_cli.py')
  if (!existsSync(script)) {
    throw new Error(`缺少 python/scan_cli.py: ${script}`)
  }
  const root = resolve(params.path.trim())
  if (!existsSync(root)) {
    throw new Error(`目录不存在: ${root}`)
  }
  const resultFile = join(app.getPath('temp'), `anima-similar-${Date.now()}.json`)

  const args: string[] = [
    settings.pythonPath,
    script,
    '--path',
    root,
    '--threshold',
    String(params.threshold),
    '--method',
    params.method,
    '--json-out',
    resultFile,
  ]
  if (params.recursive) args.push('--recursive')

  const job = startJob({
    kind: 'similar',
    name: `相似图扫描: ${root.split(/[\\/]/).pop()}`,
    args,
    cwd: settings.trainRoot,
    resultFile,
  })
  return { job }
}

/** 删除扫描结果里的重复图片（同时删除同名 .txt 字幕）。路径必须位于扫描根目录下。 */
export function deleteSimilar(params: SimilarDeleteParams): SimilarDeleteResult {
  const root = resolve(params.root)
  const deleted: string[] = []
  const errors: string[] = []

  for (const raw of params.paths) {
    let candidate = resolve(raw)
    if (candidate !== root && !candidate.startsWith(root + '\\') && !candidate.startsWith(root + '/')) {
      errors.push(`${raw}: 位于扫描根目录之外`)
      continue
    }
    if (!existsSync(candidate)) {
      errors.push(`${raw}: 不存在`)
      continue
    }
    try {
      unlinkSync(candidate)
      deleted.push(candidate)
      const dot = candidate.lastIndexOf('.')
      const caption = dot > 0 ? `${candidate.slice(0, dot)}.txt` : `${candidate}.txt`
      if (existsSync(caption)) {
        unlinkSync(caption)
      }
    } catch (err) {
      errors.push(`${raw}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { deleted, errors }
}
