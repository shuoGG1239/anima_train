<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import SplitPane from '@/components/common/SplitPane.vue'
import LogConsole from '@/components/common/LogConsole.vue'
import { useProjectsStore } from '@/stores/projects'
import { useJobsStore } from '@/stores/jobs'
import { useToast } from '@/composables/useToast'
import type { ProjectInfo } from '@shared/ipc-types'

defineOptions({ name: 'ProjectsView' })

const projects = useProjectsStore()
const jobs = useJobsStore()
const toast = useToast()

const selectedName = ref<string>('')
const activeTab = ref<'train' | 'preprocess' | 'dataset' | 'console'>('train')
const showCreate = ref(false)
const createName = ref('')
const createTrigger = ref('')
const createDesc = ref('')
const creating = ref(false)
const confirmingDelete = ref(false)
const jobForProject = reactive<Record<string, string>>({})

const selected = computed<ProjectInfo | undefined>(() =>
  projects.projects.find((p) => p.name === selectedName.value),
)

const selectedJobId = computed(() =>
  selectedName.value ? jobForProject[selectedName.value] ?? null : null,
)

const selectedJob = computed(() =>
  selectedJobId.value ? jobs.byId(selectedJobId.value) : undefined,
)

const runningForSelected = computed(() =>
  selectedName.value ? jobs.runningJobs.some((j) => j.name.startsWith(`${selectedName.value} ·`)) : false,
)

const fileKeyForTab = { train: 'trainScript', preprocess: 'preprocessScript', dataset: 'datasetToml' } as const

const hasDirty = ref(false)

async function select(name: string): Promise<void> {
  selectedName.value = name
  activeTab.value = 'train'
  await projects.loadFiles(name)
  hasDirty.value = false
}

async function save(): Promise<void> {
  if (!selectedName.value || !projects.files) return
  try {
    await projects.saveFiles(selectedName.value)
    hasDirty.value = false
    toast.ok('已保存项目文件')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function markDirty(): void {
  hasDirty.value = true
}

async function runTrain(): Promise<void> {
  if (!selectedName.value) return
  try {
    await projects.runTrain(selectedName.value)
    const job = [...jobs.jobs].find((j) => j.name.startsWith(`${selectedName.value} · train`))
    if (job) jobForProject[selectedName.value] = job.id
    activeTab.value = 'console'
    toast.ok('训练已启动')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function runPreprocess(): Promise<void> {
  if (!selectedName.value) return
  try {
    await projects.runPreprocess(selectedName.value)
    const job = [...jobs.jobs].find((j) => j.name.startsWith(`${selectedName.value} · preprocess`))
    if (job) jobForProject[selectedName.value] = job.id
    activeTab.value = 'console'
    toast.ok('预处理已启动')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function openFolder(): Promise<void> {
  if (!selectedName.value) return
  try {
    await window.api.projects.openFolder(selectedName.value)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function removeProject(): Promise<void> {
  if (!selectedName.value) return
  try {
    await projects.remove(selectedName.value)
    selectedName.value = ''
    toast.ok('项目已删除')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    confirmingDelete.value = false
  }
}

async function createProject(): Promise<void> {
  const name = createName.value.trim()
  if (!name) {
    toast.error('请输入项目名')
    return
  }
  creating.value = true
  try {
    const info = await projects.create({
      name,
      trigger: createTrigger.value.trim(),
      description: createDesc.value.trim(),
    })
    toast.ok(`已创建项目 ${info.name}`)
    showCreate.value = false
    createName.value = ''
    createTrigger.value = ''
    createDesc.value = ''
    await select(info.name)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  await projects.refresh()
  // 恢复上次选中的项目（通过 KeepAlive 保留状态，无需额外处理）
})
</script>

<template>
  <div class="page-shell">
    <SplitPane storage-key="anima-train:projects-split" :default-width="300" :min-width="240" :max-width="360">
      <template #left>
        <section class="list-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-title">训练项目</span>
            </div>
            <button type="button" class="btn btn-primary btn-sm" @click="showCreate = true">新建</button>
          </div>
          <div class="list-scroll">
            <button
              v-for="p in projects.projects"
              :key="p.name"
              type="button"
              class="list-item"
              :class="{ active: p.name === selectedName }"
              @click="select(p.name)"
            >
              <span class="list-item-name">{{ p.name }}</span>
              <span class="chip" :class="p.hasTrainScript ? 'ok' : 'warn'">{{ p.hasTrainScript ? 'train' : '无脚本' }}</span>
            </button>
            <div v-if="!projects.projects.length" class="empty-state">
              <div class="title">还没有训练项目</div>
              <div class="hint">点击右上角「新建」创建第一个项目</div>
            </div>
          </div>
        </section>
      </template>

      <template #right>
        <section v-if="selected && projects.files" class="detail-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-title">{{ selected.name }}</span>
              <span v-if="runningForSelected" class="status-pill running">训练中</span>
            </div>
            <div class="form-actions" style="padding-top: 0">
              <button type="button" class="btn btn-ghost btn-sm" @click="openFolder">打开目录</button>
              <button
                type="button"
                class="btn btn-danger btn-ghost btn-sm"
                @click="confirmingDelete = !confirmingDelete"
              >
                {{ confirmingDelete ? '确认删除?' : '删除' }}
              </button>
              <button v-if="confirmingDelete" type="button" class="btn btn-danger btn-sm" @click="removeProject">
                是，删除
              </button>
              <button type="button" class="btn btn-ghost btn-sm" :disabled="!selected.hasPreprocessScript" @click="runPreprocess">
                预处理
              </button>
              <button type="button" class="btn btn-primary btn-sm" :disabled="!selected.hasTrainScript" @click="runTrain">
                开始训练
              </button>
            </div>
          </div>

          <div class="panel-tabs">
            <button
              v-for="t in [
                { key: 'train', label: 'train.ps1' },
                { key: 'preprocess', label: 'preprocess.ps1' },
                { key: 'dataset', label: 'dataset.toml' },
                { key: 'console', label: '控制台' },
              ] as const"
              :key="t.key"
              type="button"
              class="panel-tab"
              :class="{ active: activeTab === t.key }"
              @click="activeTab = t.key"
            >
              {{ t.label }}
            </button>
            <div class="panel-tabs-right">
              <button
                v-if="activeTab !== 'console' && hasDirty"
                type="button"
                class="btn btn-primary btn-sm"
                @click="save"
              >
                保存
              </button>
            </div>
          </div>

          <div class="panel-body panel-body--flush editor-body">
            <template v-if="activeTab === 'train' || activeTab === 'preprocess' || activeTab === 'dataset'">
              <textarea
                :key="activeTab"
                v-model="projects.files[fileKeyForTab[activeTab]]"
                class="textarea editor-textarea"
                spellcheck="false"
                @input="markDirty"
              />
            </template>
            <template v-else>
              <div v-if="selectedJob" class="console-panel">
                <LogConsole :job-id="selectedJobId ?? ''" />
              </div>
              <div v-else class="empty-state">
                <div class="title">还没有运行记录</div>
                <div class="hint">点击「开始训练」或「预处理」后，日志会显示在这里</div>
              </div>
            </template>
          </div>
        </section>

        <section v-else class="detail-panel">
          <div class="panel-body">
            <div class="empty-state">
              <div class="title">选择一个训练项目</div>
              <div class="hint">
                项目目录位于 <span class="mono">{{ 'projects/' }}</span>
                ，包含 train.ps1、preprocess.ps1、dataset.toml
              </div>
            </div>
          </div>
        </section>
      </template>
    </SplitPane>

    <!-- 新建项目 -->
    <Teleport to="body">
      <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
        <div class="overlay-card create-card">
          <div class="overlay-header">
            <span class="overlay-title">新建训练项目</span>
            <button type="button" class="btn btn-icon" title="关闭" @click="showCreate = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="overlay-body">
            <label class="field">
              <span class="field-label">项目名 *</span>
              <input v-model="createName" class="input" type="text" placeholder="例如 ibuki_swimsuit" spellcheck="false" @keyup.enter="createProject" />
            </label>
            <label class="field">
              <span class="field-label">触发词</span>
              <input v-model="createTrigger" class="input" type="text" placeholder="例如 ibuki swimsuit" spellcheck="false" />
            </label>
            <label class="field">
              <span class="field-label">备注</span>
              <textarea v-model="createDesc" class="textarea textarea--sm" placeholder="可选" spellcheck="false" />
            </label>
            <div class="section-hint">
              将创建 <span class="mono">projects/&lt;项目名&gt;/</span> 目录，并生成 train.ps1、
              preprocess.ps1、dataset.toml 模板（可在详情页直接编辑保存）。
            </div>
            <div class="form-actions" style="justify-content: flex-end">
              <button type="button" class="btn btn-ghost" @click="showCreate = false">取消</button>
              <button type="button" class="btn btn-primary" :disabled="creating" @click="createProject">
                {{ creating ? '创建中…' : '创建项目' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.panel-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 12px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-tab {
  border: none;
  background: transparent;
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-soft);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-family: var(--mono);
}

.panel-tab:hover {
  color: var(--text);
}

.panel-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.panel-tabs-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
}

.editor-body {
  display: flex;
  min-height: 0;
}

.editor-textarea {
  flex: 1;
  min-height: 0;
  height: 100%;
  resize: none;
  border: none;
  border-radius: 0;
  background: var(--bg-input);
  font-size: 12.5px;
  line-height: 1.5;
}

.editor-textarea:focus {
  box-shadow: none;
}

.create-card {
  width: min(480px, 100%);
}
</style>
