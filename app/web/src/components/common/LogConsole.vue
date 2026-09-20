<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useJobsStore } from '@/stores/jobs'

const props = withDefaults(
  defineProps<{
    jobId: string
    /** 是否显示顶部操作条（停止/清空/过滤） */
    controls?: boolean
    minHeight?: number
  }>(),
  {
    controls: true,
    minHeight: 220,
  },
)

const jobs = useJobsStore()
const logBodyRef = ref<HTMLElement | null>(null)
const filter = ref('')
const autoScroll = ref(true)

const job = computed(() => jobs.byId(props.jobId))
const lines = computed(() => jobs.logs[props.jobId] ?? [])
const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return lines.value
  return lines.value.filter((l) => l.text.toLowerCase().includes(q))
})

const statusLabel = computed(() => {
  switch (job.value?.status) {
    case 'running':
      return '运行中'
    case 'success':
      return '已完成'
    case 'error':
      return '失败'
    case 'stopped':
      return '已停止'
    default:
      return ''
  }
})

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function scrollToBottom(): void {
  if (autoScroll.value && logBodyRef.value) {
    logBodyRef.value.scrollTop = logBodyRef.value.scrollHeight
  }
}

function onScroll(): void {
  const el = logBodyRef.value
  if (!el) return
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}

async function onClear(): Promise<void> {
  await jobs.clearLogs(props.jobId)
}

async function onStop(): Promise<void> {
  await jobs.stop(props.jobId)
}

onMounted(async () => {
  await jobs.hydrateLogs(props.jobId)
  await nextTick()
  scrollToBottom()
})

watch(
  () => lines.value.length,
  () => {
    void nextTick(scrollToBottom)
  },
)

watch(
  () => props.jobId,
  async () => {
    await jobs.hydrateLogs(props.jobId)
    await nextTick()
    scrollToBottom()
  },
)
</script>

<template>
  <div class="console-log-wrap" :style="{ minHeight: `${minHeight}px` }">
    <div v-if="controls" class="console-controls">
      <input
        v-model="filter"
        class="input console-filter"
        type="search"
        placeholder="过滤日志…"
        spellcheck="false"
      />
      <span v-if="job" class="console-status">{{ statusLabel }}</span>
      <button
        v-if="job?.status === 'running'"
        type="button"
        class="btn btn-danger btn-ghost btn-sm"
        title="停止进程"
        @click="onStop"
      >
        停止
      </button>
      <button type="button" class="btn btn-ghost btn-sm" title="清空日志" @click="onClear">
        清空
      </button>
    </div>
    <div ref="logBodyRef" class="console-log" @scroll="onScroll">
      <div v-if="!lines.length" class="empty-state">
        <div class="title">暂无日志</div>
        <div class="hint">任务启动后输出会显示在这里</div>
      </div>
      <div v-else-if="!filtered.length" class="empty-state">
        <div class="title">没有匹配的行</div>
      </div>
      <template v-else>
        <div
          v-for="line in filtered"
          :key="line.id"
          class="console-line"
          :class="line.level"
        >
          <span class="console-time">{{ fmtTime(line.ts) }}</span>
          <span class="console-text">{{ line.text }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.console-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 8px;
}

.console-filter {
  width: 220px;
  height: 28px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 999px;
}

.console-status {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
}
</style>
