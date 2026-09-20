/** 训练项目管理：扫描 / 创建 / 读写脚本 / 启动训练 / 删除。 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { shell } from 'electron'
import { projectsDir, ensureDir } from './settings'
import { startJob, stopJob, type StartJobOptions } from './process-runner'
import { buildTemplates } from './templates'
import type {
  CreateProjectParams,
  JobStartResult,
  ProjectFileSet,
  ProjectInfo,
} from '@shared/ipc-types'

function projectDir(name: string): string {
  return join(projectsDir(), name)
}

function isProjectDir(dir: string): boolean {
  const entries = ['train.ps1', 'preprocess.ps1', 'dataset.toml', 'output', 'logs']
  return entries.some((e) => existsSync(join(dir, e)))
}

export function listProjects(): ProjectInfo[] {
  const root = projectsDir()
  if (!existsSync(root)) return []
  const out: ProjectInfo[] = []
  for (const entry of readDirSorted(root)) {
    const dir = join(root, entry)
    let st
    try {
      st = statSync(dir)
    } catch {
      continue
    }
    if (!st.isDirectory() || entry.startsWith('.')) continue
    // 任意子目录都算一个项目（便于用户手工建目录），没有模板文件也能列出
    out.push(describeProject(entry, dir))
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function readDirSorted(dir: string): string[] {
  try {
    return readdirSync(dir).sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function describeProject(name: string, dir: string): ProjectInfo {
  const trainScript = join(dir, 'train.ps1')
  const preprocessScript = join(dir, 'preprocess.ps1')
  const datasetToml = join(dir, 'dataset.toml')
  const outputDir = join(dir, 'output')
  const logDir = join(dir, 'logs')
  return {
    name,
    dir,
    hasTrainScript: existsSync(trainScript),
    hasPreprocessScript: existsSync(preprocessScript),
    hasDatasetToml: existsSync(datasetToml),
    hasOutput: existsSync(outputDir) && readDirSorted(outputDir).length > 0,
    hasLogs: existsSync(logDir),
    trainScript,
    preprocessScript,
    datasetToml,
    outputDir,
    logDir,
  }
}

function validateName(name: string): string {
  const n = name.trim()
  if (!n) throw new Error('项目名不能为空')
  if (!/^[\w\-. ]+$/.test(n)) {
    throw new Error('项目名只能包含字母、数字、下划线、连字符、点与空格')
  }
  if (/[\\/:*?"<>|]/.test(n)) {
    throw new Error('项目名包含非法字符')
  }
  return n
}

export function createProject(params: CreateProjectParams): ProjectInfo {
  const name = validateName(params.name)
  const dir = join(projectsDir(), name)
  if (existsSync(dir)) {
    throw new Error(`项目已存在: ${name}`)
  }
  ensureDir(dir)
  mkdirSync(join(dir, 'output'), { recursive: true })
  mkdirSync(join(dir, 'logs'), { recursive: true })
  const tpl = buildTemplates(name, params.trigger, params.description ?? '')
  writeFileSync(join(dir, 'train.ps1'), tpl.trainScript, 'utf-8')
  writeFileSync(join(dir, 'preprocess.ps1'), tpl.preprocessScript, 'utf-8')
  writeFileSync(join(dir, 'dataset.toml'), tpl.datasetToml, 'utf-8')
  return describeProject(name, dir)
}

export function readProjectFiles(name: string): ProjectFileSet {
  const info = describeProject(name, projectDir(name))
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf-8') : '')
  return {
    trainScript: read(info.trainScript),
    preprocessScript: read(info.preprocessScript),
    datasetToml: read(info.datasetToml),
  }
}

export function writeProjectFiles(name: string, files: ProjectFileSet): ProjectInfo {
  const dir = projectDir(name)
  if (!existsSync(dir)) throw new Error(`项目不存在: ${name}`)
  writeFileSync(join(dir, 'train.ps1'), files.trainScript, 'utf-8')
  writeFileSync(join(dir, 'preprocess.ps1'), files.preprocessScript, 'utf-8')
  writeFileSync(join(dir, 'dataset.toml'), files.datasetToml, 'utf-8')
  return describeProject(name, dir)
}

export function deleteProject(name: string): void {
  const dir = projectDir(name)
  if (!existsSync(dir)) throw new Error(`项目不存在: ${name}`)
  rmSync(dir, { recursive: true, force: true })
}

function runProjectScript(name: string, scriptName: 'train.ps1' | 'preprocess.ps1', kind: 'train' | 'preprocess'): JobStartResult {
  const info = describeProject(name, projectDir(name))
  const scriptPath = scriptName === 'train.ps1' ? info.trainScript : info.preprocessScript
  if (!existsSync(scriptPath)) {
    throw new Error(`缺少 ${scriptName}，请在项目详情里先创建并保存`)
  }
  const logDir = ensureDir(info.logDir)
  const logFile = join(logDir, `${scriptName.replace('.ps1', '')}.log`)
  const args = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
  const job = startJob({
    kind,
    name: `${name} · ${scriptName.replace('.ps1', '')}`,
    args,
    cwd: info.dir,
    logFile,
  })
  return { job }
}

export function runTrain(name: string): JobStartResult {
  return runProjectScript(name, 'train.ps1', 'train')
}

export function runPreprocess(name: string): JobStartResult {
  return runProjectScript(name, 'preprocess.ps1', 'preprocess')
}

export async function openProjectFolder(name: string): Promise<void> {
  const dir = projectDir(name)
  if (!existsSync(dir)) throw new Error(`项目不存在: ${name}`)
  await shell.openPath(dir)
}

export async function stopProjectJob(jobId: string): Promise<void> {
  await stopJob(jobId)
}
