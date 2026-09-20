export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export function formatDuration(startedAt: number, finishedAt: number | null): string {
  const end = finishedAt ?? Date.now()
  const ms = Math.max(0, end - startedAt)
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function statusText(status: string): string {
  switch (status) {
    case 'running':
      return '运行中'
    case 'success':
      return '完成'
    case 'error':
      return '失败'
    case 'stopped':
      return '已停止'
    default:
      return status
  }
}
