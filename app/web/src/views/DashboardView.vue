<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDatasetsStore } from '@/stores/datasets'
import { useProjectsStore } from '@/stores/projects'
import { useJobsStore } from '@/stores/jobs'
import { formatBytes, formatTime, statusText } from '@/utils/format'

defineOptions({ name: 'DashboardView' })

const router = useRouter()
const datasets = useDatasetsStore()
const projects = useProjectsStore()
const jobs = useJobsStore()

const totalImages = computed(() =>
  datasets.datasets.reduce((sum, d) => sum + d.imageCount, 0),
)
const totalPaired = computed(() =>
  datasets.datasets.reduce((sum, d) => sum + d.paired, 0),
)
const totalOrphans = computed(() =>
  datasets.datasets.reduce((sum, d) => sum + d.orphanImages + d.orphanCaptions, 0),
)

onMounted(async () => {
  await Promise.all([datasets.refresh(), projects.refresh(), jobs.init()])
})

function go(path: string): void {
  router.push(path)
}
</script>

<template>
  <div class="page-shell page-shell--scroll">
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-card-label">训练项目</span>
        <span class="stat-card-value">{{ projects.projects.length }}</span>
        <span class="stat-card-sub">点击进入项目管理</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">数据集</span>
        <span class="stat-card-value">{{ datasets.datasets.length }}</span>
        <span class="stat-card-sub">{{ totalImages }} 张图片 / {{ totalPaired }} 对已配对</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">待清理孤儿文件</span>
        <span class="stat-card-value" :class="{ 'is-warn': totalOrphans > 0 }">
          {{ totalOrphans }}
        </span>
        <span class="stat-card-sub">图片 + 字幕</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">运行中的任务</span>
        <span class="stat-card-value" :class="{ 'is-run': jobs.runningJobs.length > 0 }">
          {{ jobs.runningJobs.length }}
        </span>
        <span class="stat-card-sub">训练 / 预处理</span>
      </div>
    </div>

    <div class="section-title">快速入口</div>
    <div class="card-grid">
      <div class="card" @click="go('/projects')">
        <div class="card-title">
          <span class="card-title-text">项目与训练</span>
        </div>
        <div class="card-desc">创建训练项目、编辑 train.ps1 / dataset.toml、一键启动训练并实时查看日志。</div>
      </div>
      <div class="card" @click="go('/datasets')">
        <div class="card-title">
          <span class="card-title-text">数据集浏览</span>
        </div>
        <div class="card-desc">图片网格浏览、image + txt 配对统计、一键清理孤儿文件。</div>
      </div>
      <div class="card" @click="go('/tools')">
        <div class="card-title">
          <span class="card-title-text">预处理工具</span>
        </div>
        <div class="card-desc">Danbooru 下载、WD14 批量打标、相似图去重。</div>
      </div>
      <div class="card" @click="go('/console')">
        <div class="card-title">
          <span class="card-title-text">任务控制台</span>
        </div>
        <div class="card-desc">查看所有训练 / 预处理任务的实时日志，随时停止。</div>
      </div>
    </div>

    <template v-if="jobs.jobs.length">
      <div class="section-title">最近任务</div>
      <div class="job-list">
        <div
          v-for="job in jobs.jobs.slice(0, 6)"
          :key="job.id"
          class="job-row"
          @click="go('/console')"
        >
          <span class="job-dot" :class="job.status" />
          <div class="job-main">
            <span class="job-name">{{ job.name }}</span>
            <span class="job-meta">{{ statusText(job.status) }} · {{ formatTime(job.startedAt) }}</span>
          </div>
          <span class="job-time">{{ formatTime(job.startedAt) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat-card-value.is-warn {
  color: var(--warning);
}

.stat-card-value.is-run {
  color: var(--info);
}
</style>
