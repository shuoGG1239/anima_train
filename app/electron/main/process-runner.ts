/**
 * 通用进程运行器：管理多个并发的训练 / 预处理任务。
 *
 * 每个任务（job）拥有独立的日志环形缓冲、状态与（可选的）落盘日志 / 结果文件，
 * 并通过 IPC 事件把日志行与状态变化推送给渲染进程。
 */

import { spawn, execFile, execFileSync, type ChildProcessWithoutNullStreams } from 'child_process'
import { promisify } from 'util'
import { appendFileSync, existsSync, readFileSync } from 'fs'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { JOB_HISTORY_LIMIT, JOB_LOG_LIMIT } from '@shared/app-defaults'
import type { JobInfo, JobKind, JobLogLevel, JobLogLine, JobStatus } from '@shared/ipc-types'

const execFileAsync = promisify(execFile)

export interface StartJobOptions {
  kind: JobKind
  name: string
  /** spawn 命令数组（不含 shell，避免注入；train.ps1 用 powershell.exe 显式拉起） */
  args: string[]
  cwd: string
  env?: Record<string, string>
  /** 日志同时追加写盘（如训练日志） */
  logFile?: string
  /** 任务成功后解析该 JSON 文件并作为 job.result */
  resultFile?: string
}

interface RunningJob {
  info: JobInfo
  child: ChildProcessWithoutNullStreams | null
  logs: JobLogLine[]
  resultFile: string | null
}

const jobs = new Map<string, RunningJob>()
let seq = 1
let getWindow: () => BrowserWindow | null = () => null

export function initJobRunner(getter: () => BrowserWindow | null): void {
  getWindow = getter
}

function broadcast(channel: string, payload: unknown): void {
  try {
    getWindow()?.webContents.send(channel, payload)
  } catch {
    // window may already be destroyed during quit
  }
}

function pushLog(jobId: string, level: JobLogLevel, text: string): void {
  const run = jobs.get(jobId)
  if (!run) return
  const line: JobLogLine = {
    id: seq++,
    ts: Date.now(),
    level,
    text: text.replace(/\r/g, ''),
  }
  run.logs.push(line)
  if (run.logs.length > JOB_LOG_LIMIT) {
    run.logs.splice(0, run.logs.length - JOB_LOG_LIMIT)
  }
  if (run.info.logFile && text) {
    try {
      appendFileSync(run.info.logFile, `${line.text}\n`, 'utf-8')
    } catch {
      // log file may be unwritable
    }
  }
  broadcast(IPC.jobs.log, { jobId, line })
}

function setStatus(jobId: string, patch: Partial<JobInfo>): void {
  const run = jobs.get(jobId)
  if (!run) return
  Object.assign(run.info, patch)
  broadcast(IPC.jobs.status, run.info)
}

export function listJobs(): JobInfo[] {
  return [...jobs.values()]
    .map((r) => r.info)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, JOB_HISTORY_LIMIT)
}

export function getJobLogs(jobId: string): JobLogLine[] {
  const run = jobs.get(jobId)
  return run ? [...run.logs] : []
}

export function clearJobLogs(jobId: string): void {
  const run = jobs.get(jobId)
  if (!run) return
  run.logs.length = 0
  broadcast(IPC.jobs.cleared, { jobId })
}

function killProcessTreeSync(targetPid: number): void {
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(targetPid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      // process may already be gone
    }
    return
  }
  try {
    process.kill(-targetPid, 'SIGKILL')
  } catch {
    try {
      process.kill(targetPid, 'SIGKILL')
    } catch {
      // ignore
    }
  }
}

async function killProcessTree(targetPid: number): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/pid', String(targetPid), '/T', '/F'], {
        windowsHide: true,
      })
    } catch {
      // process may already be gone
    }
    return
  }
  try {
    process.kill(-targetPid, 'SIGTERM')
  } catch {
    try {
      process.kill(targetPid, 'SIGTERM')
    } catch {
      // ignore
    }
  }
}

export function startJob(opts: StartJobOptions): JobInfo {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const info: JobInfo = {
    id,
    kind: opts.kind,
    name: opts.name,
    command: opts.args.join(' '),
    cwd: opts.cwd,
    status: 'running',
    pid: null,
    startedAt: Date.now(),
    finishedAt: null,
    exitCode: null,
    logFile: opts.logFile ?? null,
    result: null,
    error: null,
  }
  const run: RunningJob = { info, child: null, logs: [], resultFile: opts.resultFile ?? null }
  jobs.set(id, run)

  pushLog(id, 'system', `启动任务: ${opts.name}`)
  pushLog(id, 'system', opts.args.join(' '))
  pushLog(id, 'system', `工作目录: ${opts.cwd}`)

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(opts.args[0], opts.args.slice(1), {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      windowsHide: true,
      shell: false,
    })
  } catch (err) {
    pushLog(id, 'system', `启动失败: ${err instanceof Error ? err.message : String(err)}`)
    setStatus(id, { status: 'error', finishedAt: Date.now(), error: String(err) })
    return info
  }

  run.child = child
  info.pid = child.pid ?? null
  broadcast(IPC.jobs.status, info)

  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    for (const line of chunk.split(/\n/)) {
      if (line.length) pushLog(id, 'stdout', line)
    }
  })
  child.stderr?.on('data', (chunk: string) => {
    for (const line of chunk.split(/\n/)) {
      if (line.length) pushLog(id, 'stderr', line)
    }
  })
  child.on('error', (err) => {
    pushLog(id, 'system', `进程错误: ${err.message}`)
    setStatus(id, { status: 'error', finishedAt: Date.now(), error: err.message })
  })
  child.on('close', (code, signal) => {
    pushLog(
      id,
      'system',
      `进程已退出 code=${code ?? 'null'} signal=${signal ?? 'null'}`,
    )
    const status: JobStatus = code === 0 ? 'success' : 'error'
    setStatus(id, { status, exitCode: code, finishedAt: Date.now() })
    run.child = null
    void settleResult(id, status)
  })

  return info
}

async function settleResult(jobId: string, status: JobStatus): Promise<void> {
  const run = jobs.get(jobId)
  if (!run) return
  const resultFile = run.resultFile
  if (status === 'success' && resultFile && existsSync(resultFile)) {
    try {
      run.info.result = JSON.parse(readFileSync(resultFile, 'utf-8'))
    } catch (err) {
      pushLog(jobId, 'system', `解析结果文件失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  broadcast(IPC.jobs.result, run.info)
}

export async function stopJob(jobId: string): Promise<JobInfo | null> {
  const run = jobs.get(jobId)
  if (!run) return null
  const targetPid = run.info.pid
  if (targetPid) {
    pushLog(jobId, 'system', `正在停止进程 pid=${targetPid} …`)
    await killProcessTree(targetPid)
  }
  if (run.child) {
    try {
      run.child.kill()
    } catch {
      // ignore
    }
  }
  if (run.info.status === 'running') {
    setStatus(jobId, { status: 'stopped', finishedAt: Date.now() })
  }
  return run.info
}

/** 退出客户端时同步杀掉所有子进程树，避免 async 未完成就退出。 */
export function stopAllJobsSync(): void {
  for (const run of jobs.values()) {
    const pid = run.info.pid
    if (pid) killProcessTreeSync(pid)
    if (run.child) {
      try {
        run.child.kill()
      } catch {
        // ignore
      }
    }
    if (run.info.status === 'running') {
      run.info.status = 'stopped'
      run.info.finishedAt = Date.now()
    }
  }
}
