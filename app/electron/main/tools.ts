/** 预处理工具集成：Danbooru 下载、WD14 批量打标（以 job 方式运行 Python 脚本）。 */

import { join } from 'path'
import { existsSync } from 'fs'
import { getSettings } from './settings'
import { startJob } from './process-runner'
import type { DanbooruFetchParams, JobStartResult, Wd14BatchParams } from '@shared/ipc-types'

function requireFile(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`${label} 不存在: ${path}`)
  }
}

/** 运行 python/danbooru_fetch.py，下载 + 整理 + 预处理为 datasets/<slug>/images。 */
export function runDanbooruFetch(params: DanbooruFetchParams): JobStartResult {
  const settings = getSettings()
  const script = join(settings.trainRoot, 'python', 'danbooru_fetch.py')
  requireFile(script, 'danbooru_fetch.py')

  const tags = params.tags
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (!tags.length) {
    throw new Error('请至少填写一个 Danbooru 标签')
  }

  const args: string[] = [
    settings.pythonPath,
    script,
    '--tags',
    tags.join(' '),
    '--min-side',
    String(params.minSide),
    '--max-side',
    String(params.maxSide),
    '--quality',
    String(params.quality),
  ]
  if (params.proxy && params.proxy.trim()) args.push('--proxy', params.proxy.trim())
  if (params.trigger && params.trigger.trim()) args.push('--trigger', params.trigger.trim())
  if (!params.preprocess) args.push('--no-preprocess')

  const slug = tags.join('_').replace(/[^\w\-.]+/g, '_').replace(/^_+|_+$/g, '') || 'danbooru'
  const job = startJob({
    kind: 'danbooru',
    name: `Danbooru: ${tags.join(' + ')}`,
    args,
    cwd: settings.trainRoot,
  })
  return { job }
}

/** 运行 python/preprocess_luluka_extra.py，批量重命名 / 缩放 + WD14 反推 caption。 */
export function runWd14Batch(params: Wd14BatchParams): JobStartResult {
  const settings = getSettings()
  const script = join(settings.trainRoot, 'python', 'preprocess_luluka_extra.py')
  requireFile(script, 'preprocess_luluka_extra.py')

  const inputDir = params.inputDir.trim()
  if (!inputDir) throw new Error('请选择图片目录')
  const modelDir = params.modelDir.trim()
  if (!modelDir) throw new Error('请配置 WD14 模型目录（含 .onnx 与 .csv）')

  const args: string[] = [
    settings.pythonPath,
    script,
    '--input-dir',
    inputDir,
    '--model-dir',
    modelDir,
    '--model-name',
    params.modelName.trim() || 'wd-swinv2-tagger-v3',
    '--min-side',
    String(params.minSide),
    '--max-side',
    String(params.maxSide),
    '--threshold',
    String(params.threshold),
    '--character-threshold',
    String(params.characterThreshold),
  ]
  if (params.trigger && params.trigger.trim()) args.push('--trigger', params.trigger.trim())
  if (params.excludeTags && params.excludeTags.trim()) {
    args.push('--exclude', params.excludeTags)
  }

  const job = startJob({
    kind: 'wd14',
    name: `WD14: ${inputDir.split(/[\\/]/).pop()}`,
    args,
    cwd: settings.trainRoot,
  })
  return { job }
}
