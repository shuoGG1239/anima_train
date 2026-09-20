<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SplitPane from '@/components/common/SplitPane.vue'
import LogConsole from '@/components/common/LogConsole.vue'
import { useJobsStore } from '@/stores/jobs'
import { formatDuration, formatTime, statusText } from '@/utils/format'
import type { JobInfo } from '@shared/ipc-types'

defineOptions({ name: 'ConsoleView' })

const jobs = useJobsStore()
const selectedId = ref<string | null>(null)

const selectedJob = computed<JobInfo | undefined>(() =>
  selectedId.value ? jobs.byId(selectedId.value) : undefined,
)

const sortedJobs = computed(() =>
  [...jobs.jobs].sort((a, b) => b.startedAt - a.startedAt),
)

function select(job: JobInfo): void {
  selectedId.value = job.id
}

onMounted(async () => {
  await jobs.init()
  if (!selectedId.value && jobs.jobs.length) {
    selectedId.value = jobs.jobs[0].id
  }
})
</script>

<template>
  <div class="page-shell">
    <SplitPane storage-key="anima-train:console-split" :default-width="320" :min-width="260" :max-width="400">
      <template #left>
        <section class="list-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-title">任务</span>
              <span v-if="jobs.runningJobs.length" class="status-pill running">{{ jobs.runningJobs.length }} 运行中</span>
            </div>
          </div>
          <div class="list-scroll">
            <div
              v-for="job in sortedJobs"
              :key="job.id"
              class="job-row"
              :class="{ active: job.id === selectedId }"
              @click="select(job)"
            >
              <span class="job-dot" :class="job.status" />
              <div class="job-main">
                <span class="job-name">{{ job.name }}</span>
                <span class="job-meta">
                  {{ statusText(job.status) }}
                  <template v-if="job.exitCode !== null"> · code {{ job.exitCode }}</template>
                  · {{ formatDuration(job.startedAt, job.finishedAt) }}
                </span>
              </div>
              <span class="job-time">{{ formatTime(job.startedAt) }}</span>
            </div>
            <div v-if="!sortedJobs.length" class="empty-state">
              <div class="title">还没有任务</div>
              <div class="hint">训练 / 预处理 / 下载 / 打标的日志都会出现在这里</div>
            </div>
          </div>
        </section>
      </template>

      <template #right>
        <section class="detail-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-title">{{ selectedJob?.name ?? '日志' }}</span>
              <span v-if="selectedJob" class="status-pill" :class="selectedJob.status">
                {{ statusText(selectedJob.status) }}
              </span>
            </div>
          </div>
          <div class="panel-body console-body">
            <LogConsole v-if="selectedJob" :key="selectedJob.id" :job-id="selectedJob.id" :min-height="200" />
            <div v-else class="empty-state">
              <div class="title">选择左侧任务查看日志</div>
            </div>
          </div>
        </section>
      </template>
    </SplitPane>
  </div>
</template>
