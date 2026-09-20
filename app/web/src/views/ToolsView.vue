<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppSelect from '@/components/common/AppSelect.vue'
import { useToolsStore } from '@/stores/tools'
import { useSettingsStore } from '@/stores/settings'
import { useJobsStore } from '@/stores/jobs'
import { useDatasetsStore } from '@/stores/datasets'
import { useToast } from '@/composables/useToast'
import { IMAGE_HASH_METHOD_OPTIONS } from '@/utils/select-options'
import { formatBytes } from '@/utils/format'
import type { SimilarScanGroup } from '@shared/ipc-types'

defineOptions({ name: 'ToolsView' })

const tools = useToolsStore()
const settings = useSettingsStore()
const jobs = useJobsStore()
const datasets = useDatasetsStore()
const toast = useToast()
const router = useRouter()

const activeTool = ref<'danbooru' | 'wd14' | 'similar'>('danbooru')
const running = ref(false)

const similarJob = computed(() =>
  tools.similarJobId ? jobs.byId(tools.similarJobId) : undefined,
)
const similarRunning = computed(() => similarJob.value?.status === 'running')
const selectedPaths = reactive<Set<string>>(new Set())
const deleting = ref(false)

const totalFiles = computed(() =>
  (tools.similarResult?.groups ?? []).reduce((sum, g) => sum + g.items.length, 0),
)

onMounted(() => {
  if (settings.settings) {
    tools.applySettings(settings.settings)
  }
})

watch(
  () => similarJob.value?.status,
  (status) => {
    if (similarJob.value && status !== 'running') {
      tools.collectResult(similarJob.value)
      if (status === 'error') {
        toast.error('相似图扫描失败，请到控制台查看日志')
      } else if (status === 'success' && !similarJob.value.result) {
        toast.error('扫描完成但没有返回结果')
      }
    }
  },
)

watch(
  () => tools.similarResult,
  (r) => {
    selectedPaths.clear()
    if (r && !r.groups.length) toast.info('没有发现相似分组')
  },
)

async function pickDir(field: 'wd14Input' | 'wd14Model' | 'similarPath'): Promise<void> {
  let title = '选择目录'
  let defaultPath: string | undefined
  if (field === 'wd14Input') {
    title = '选择要打标的图片目录'
    defaultPath = tools.wd14.inputDir || undefined
  } else if (field === 'wd14Model') {
    title = '选择 WD14 模型目录（含 .onnx 与 .csv）'
    defaultPath = tools.wd14.modelDir || undefined
  } else {
    title = '选择要扫描的图片目录'
    defaultPath = tools.similar.path || undefined
  }
  const picked = await window.api.shell.pickDir({ title, defaultPath })
  if (!picked) return
  if (field === 'wd14Input') tools.wd14.inputDir = picked
  else if (field === 'wd14Model') tools.wd14.modelDir = picked
  else tools.similar.path = picked
}

async function runDanbooru(): Promise<void> {
  running.value = true
  try {
    const job = await tools.runDanbooru()
    toast.ok('Danbooru 下载已启动')
    router.push('/console')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    running.value = false
  }
}

async function runWd14(): Promise<void> {
  running.value = true
  try {
    const job = await tools.runWd14()
    toast.ok('WD14 批量打标已启动')
    router.push('/console')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    running.value = false
  }
}

async function scan(): Promise<void> {
  if (!tools.similar.path.trim()) {
    toast.error('请先选择要扫描的图片目录')
    return
  }
  try {
    await tools.runSimilarScan()
    toast.info('扫描进行中…完成后会自动展示结果')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function toggleSelect(path: string): void {
  if (selectedPaths.has(path)) selectedPaths.delete(path)
  else selectedPaths.add(path)
}

async function deleteSelected(): Promise<void> {
  if (!tools.similarResult || selectedPaths.size === 0) return
  deleting.value = true
  try {
    const result = await window.api.similar.delete({
      root: tools.similarResult.root,
      paths: [...selectedPaths],
    })
    if (result.deleted.length) toast.ok(`已删除 ${result.deleted.length} 个文件`)
    if (result.errors.length) toast.error(result.errors.join('；'))
    // 从结果中移除已删除项
    const removed = new Set(result.deleted)
    for (const group of tools.similarResult.groups) {
      group.items = group.items.filter((it) => !removed.has(it.path))
    }
    tools.similarResult.groups = tools.similarResult.groups.filter((g) => g.items.length > 1)
    selectedPaths.clear()
    if (!tools.similarResult.groups.length) {
      tools.similarResult = null
      toast.info('所有相似分组已清理')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    deleting.value = false
  }
}

function groupThumb(path: string): string | undefined {
  return datasets.thumbs[`112:${path}`] ?? undefined
}

function loadGroupThumbs(group: SimilarScanGroup): void {
  for (const item of group.items) {
    void datasets.thumb(item.path, 112)
  }
}

watch(
  () => tools.similarResult,
  (r) => {
    if (r) {
      for (const g of r.groups) loadGroupThumbs(g)
    }
  },
)
</script>

<template>
  <div class="page-shell">
    <div class="tool-switch">
      <button
        v-for="t in [
          { key: 'danbooru', label: 'Danbooru 下载' },
          { key: 'wd14', label: 'WD14 批量打标' },
          { key: 'similar', label: '相似图去重' },
        ] as const"
        :key="t.key"
        type="button"
        class="tool-switch-btn"
        :class="{ active: activeTool === t.key }"
        @click="activeTool = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <section class="list-panel tool-panel">
      <!-- Danbooru 下载 -->
      <template v-if="activeTool === 'danbooru'">
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-title">从 Danbooru 下载图片到数据集</span>
          </div>
        </div>
        <div class="panel-body tool-body">
          <label class="field">
            <span class="field-label">标签（空格或逗号分隔）</span>
            <textarea
              v-model="tools.danbooru.tags"
              class="textarea textarea--sm"
              placeholder="例如 seia_(swimsuit)_(blue_archive)"
              spellcheck="false"
            />
          </label>
          <div class="field-row field-row--3">
            <label class="field">
              <span class="field-label">代理</span>
              <input v-model="tools.danbooru.proxy" class="input" type="text" spellcheck="false" />
            </label>
            <label class="field">
              <span class="field-label">最短边</span>
              <input v-model.number="tools.danbooru.minSide" class="input" type="number" min="256" max="4096" />
            </label>
            <label class="field">
              <span class="field-label">最长边</span>
              <input v-model.number="tools.danbooru.maxSide" class="input" type="number" min="256" max="4096" />
            </label>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field-label">JPEG 质量</span>
              <input v-model.number="tools.danbooru.quality" class="input" type="number" min="50" max="100" />
            </label>
            <label class="field">
              <span class="field-label">触发词（可留空）</span>
              <input v-model="tools.danbooru.trigger" class="input" type="text" placeholder="例如 ibuki swimsuit" spellcheck="false" />
            </label>
          </div>
          <label class="field field--check">
            <span class="field-label">下载后处理：缩放 / 去透明底 / 标签格式化（trigger, tag…）</span>
            <input v-model="tools.danbooru.preprocess" type="checkbox" />
          </label>
          <div class="section-hint">
            需要 <span class="mono">gallery-dl pillow PySocks</span>；结果保存到
            <span class="mono">datasets/&lt;标签&gt;/images/</span>，下载进度在控制台查看。
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" :disabled="running || !tools.danbooru.tags.trim()" @click="runDanbooru">
              开始下载
            </button>
          </div>
        </div>
      </template>

      <!-- WD14 批量打标 -->
      <template v-else-if="activeTool === 'wd14'">
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-title">批量重命名 / 缩放 + WD14 反推字幕</span>
          </div>
        </div>
        <div class="panel-body tool-body">
          <div class="path-row">
            <label class="field" style="flex: 1">
              <span class="field-label">图片目录</span>
              <div class="input-btn">
                <input v-model="tools.wd14.inputDir" class="input" type="text" spellcheck="false" />
                <button type="button" class="btn btn-ghost" @click="pickDir('wd14Input')">选择…</button>
              </div>
            </label>
          </div>
          <div class="path-row">
            <label class="field" style="flex: 1">
              <span class="field-label">WD14 模型目录（含 .onnx 与 .csv）</span>
              <div class="input-btn">
                <input v-model="tools.wd14.modelDir" class="input" type="text" spellcheck="false" />
                <button type="button" class="btn btn-ghost" @click="pickDir('wd14Model')">选择…</button>
              </div>
            </label>
          </div>
          <div class="field-row field-row--3">
            <label class="field">
              <span class="field-label">模型名</span>
              <input v-model="tools.wd14.modelName" class="input" type="text" spellcheck="false" />
            </label>
            <label class="field">
              <span class="field-label">最短边</span>
              <input v-model.number="tools.wd14.minSide" class="input" type="number" min="256" max="4096" />
            </label>
            <label class="field">
              <span class="field-label">最长边</span>
              <input v-model.number="tools.wd14.maxSide" class="input" type="number" min="256" max="4096" />
            </label>
          </div>
          <div class="field-row field-row--3">
            <label class="field">
              <span class="field-label">触发词</span>
              <input v-model="tools.wd14.trigger" class="input" type="text" placeholder="例如 moria luluka" spellcheck="false" />
            </label>
            <label class="field">
              <span class="field-label">General 阈值</span>
              <input v-model.number="tools.wd14.threshold" class="input" type="number" min="0" max="1" step="0.05" />
            </label>
            <label class="field">
              <span class="field-label">Character 阈值</span>
              <input v-model.number="tools.wd14.characterThreshold" class="input" type="number" min="0" max="1" step="0.05" />
            </label>
          </div>
          <label class="field">
            <span class="field-label">额外排除标签（逗号分隔）</span>
            <input v-model="tools.wd14.excludeTags" class="input" type="text" placeholder="watermark, text, signature" spellcheck="false" />
          </label>
          <div class="section-hint">
            需要 <span class="mono">onnxruntime pillow numpy</span>；会在图片目录内原地重命名、缩放并写出
            <span class="mono">.txt</span> 字幕。
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" :disabled="running || !tools.wd14.inputDir.trim() || !tools.wd14.modelDir.trim()" @click="runWd14">
              开始打标
            </button>
          </div>
        </div>
      </template>

      <!-- 相似图去重 -->
      <template v-else>
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-title">相似图去重</span>
            <span v-if="similarRunning" class="status-pill running">扫描中</span>
            <span v-if="tools.similarResult" class="status-pill success">
              {{ tools.similarResult.scanned }} 张 · {{ tools.similarResult.groups.length }} 组 · {{ totalFiles }} 文件
            </span>
          </div>
          <div class="form-actions" style="padding-top: 0">
            <button
              v-if="selectedPaths.size > 0"
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="deleting"
              @click="deleteSelected"
            >
              删除选中的 {{ selectedPaths.size }} 个文件
            </button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="similarRunning" @click="scan">
              {{ tools.similarResult ? '重新扫描' : '开始扫描' }}
            </button>
          </div>
        </div>
        <div class="panel-body similar-body">
          <div class="path-row" style="margin-bottom: 12px">
            <label class="field" style="flex: 1; margin-bottom: 0">
              <span class="field-label">图片目录</span>
              <div class="input-btn">
                <input v-model="tools.similar.path" class="input" type="text" spellcheck="false" />
                <button type="button" class="btn btn-ghost" @click="pickDir('similarPath')">选择…</button>
              </div>
            </label>
          </div>
          <div class="field-row field-row--3" style="margin-bottom: 12px">
            <label class="field" style="margin-bottom: 0">
              <span class="field-label">阈值（汉明距离 0-32）</span>
              <input v-model.number="tools.similar.threshold" class="input" type="number" min="0" max="32" />
            </label>
            <label class="field" style="margin-bottom: 0">
              <span class="field-label">哈希方法</span>
              <AppSelect v-model="tools.similar.method" :options="IMAGE_HASH_METHOD_OPTIONS" />
            </label>
            <label class="field field--check">
              <span class="field-label">递归子目录</span>
              <input v-model="tools.similar.recursive" type="checkbox" />
            </label>
          </div>

          <div v-if="tools.similarResult" class="similar-groups">
            <div v-for="group in tools.similarResult.groups" :key="group.index" class="similar-group">
              <div class="similar-group-head">
                <span class="similar-group-title">第 {{ group.index }} 组 · {{ group.items.length }} 个文件</span>
              </div>
              <div
                v-for="item in group.items"
                :key="item.path"
                class="similar-row"
                :class="{ 'is-selected': selectedPaths.has(item.path) }"
                :data-image-path="item.path"
                @click="toggleSelect(item.path)"
              >
                <div class="similar-thumb">
                  <img v-if="groupThumb(item.path)" :src="groupThumb(item.path)" :alt="item.name" />
                </div>
                <span class="similar-name">{{ item.name }}</span>
                <span class="similar-distance">d={{ item.distance }}</span>
                <span class="similar-size">{{ formatBytes(item.sizeBytes) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <div class="title">还没有扫描结果</div>
            <div class="hint">选择图片目录后点击「开始扫描」；扫描完成后点击图片行即可选中删除（会同步删除同名 .txt）</div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.tool-switch {
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-soft);
  align-self: flex-start;
}

.tool-switch-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-soft);
  cursor: pointer;
}

.tool-switch-btn:first-child {
  border-radius: calc(var(--radius-sm) - 1px) 0 0 calc(var(--radius-sm) - 1px);
}

.tool-switch-btn:last-child {
  border-radius: 0 calc(var(--radius-sm) - 1px) calc(var(--radius-sm) - 1px) 0;
}

.tool-switch-btn + .tool-switch-btn {
  border-left: 1px solid var(--border);
}

.tool-switch-btn.active {
  background: var(--bg);
  color: var(--text);
}

.tool-switch-btn:hover:not(.active) {
  color: var(--text);
  background: var(--bg-sidebar-item-hover);
}

.tool-panel {
  flex: 1;
  min-height: 0;
}

.tool-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  max-width: 760px;
}

.similar-body {
  overflow: auto;
}

.similar-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  max-width: 900px;
}
</style>
