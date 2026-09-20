<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { IconFolderPick, IconSun, IconMoon } from '@/components/icons'

defineOptions({ name: 'SettingsView' })

const settings = useSettingsStore()
const { isDark, setTheme } = useTheme()
const toast = useToast()

const dirty = ref(false)
let saveTimer: number | null = null

function markDirty(): void {
  dirty.value = true
  if (saveTimer != null) return
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    void flush()
  }, 400)
}

async function flush(): Promise<void> {
  if (!settings.settings) return
  try {
    await settings.save({ ...settings.settings })
    dirty.value = false
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function pickTrainRoot(): Promise<void> {
  const picked = await window.api.settings.pickTrainRoot()
  if (picked) {
    toast.ok('训练根目录已更新')
    dirty.value = false
  }
}

async function pickPython(): Promise<void> {
  const picked = await window.api.settings.pickPython()
  if (picked) {
    toast.ok('Python 已更新')
    dirty.value = false
  }
}

async function pickWd14ModelDir(): Promise<void> {
  const picked = await window.api.shell.pickDir({
    title: '选择 WD14 模型目录（含 .onnx 与 .csv）',
    defaultPath: settings.settings?.wd14ModelDir || undefined,
  })
  if (picked) {
    settings.settings!.wd14ModelDir = picked
    markDirty()
  }
}

async function openTrainRoot(): Promise<void> {
  try {
    await window.api.settings.openTrainRoot()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function fmtTrainRoot(root: string): { datasets: string; projects: string } {
  const r = root.replace(/[\\/]+$/, '')
  return { datasets: `${r}\\datasets`, projects: `${r}\\projects` }
}

onMounted(async () => {
  await settings.load()
})

onBeforeUnmount(() => {
  if (saveTimer != null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
})
</script>

<template>
  <div class="page-shell page-shell--scroll">
    <section class="list-panel settings-panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <span class="panel-title">设置</span>
          <span v-if="dirty" class="status-pill running">未保存</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!dirty" @click="flush">保存设置</button>
      </div>
      <div class="panel-body settings-body">
        <template v-if="settings.settings">
          <div class="section-title">工作区</div>
          <div class="path-row">
            <label class="field" style="flex: 1">
              <span class="field-label">训练仓库根目录</span>
              <div class="input-btn">
                <input v-model="settings.settings.trainRoot" class="input" type="text" spellcheck="false" @input="markDirty" />
                <button type="button" class="btn btn-ghost" @click="pickTrainRoot"><IconFolderPick :size="14" /> 选择…</button>
                <button type="button" class="btn btn-ghost" @click="openTrainRoot">打开</button>
              </div>
            </label>
          </div>
          <div class="section-hint" style="margin-bottom: 16px">
            派生目录：<span class="mono">{{ fmtTrainRoot(settings.settings.trainRoot).datasets }}</span> ·
            <span class="mono">{{ fmtTrainRoot(settings.settings.trainRoot).projects }}</span>
          </div>

          <div class="path-row">
            <label class="field" style="flex: 1">
              <span class="field-label">Python 可执行文件</span>
              <div class="input-btn">
                <input v-model="settings.settings.pythonPath" class="input" type="text" spellcheck="false" @input="markDirty" />
                <button type="button" class="btn btn-ghost" @click="pickPython">选择…</button>
              </div>
            </label>
          </div>
          <div class="section-hint" style="margin-bottom: 16px">
            用于运行 Danbooru 下载 / WD14 打标 / 相似图扫描脚本。
          </div>

          <div class="section-title">Danbooru 下载默认值</div>
          <div class="field-row field-row--3">
            <label class="field">
              <span class="field-label">代理</span>
              <input v-model="settings.settings.danbooruProxy" class="input" type="text" spellcheck="false" @input="markDirty" />
            </label>
            <label class="field">
              <span class="field-label">最短边</span>
              <input v-model.number="settings.settings.danbooruMinSide" class="input" type="number" min="256" max="4096" @input="markDirty" />
            </label>
            <label class="field">
              <span class="field-label">最长边</span>
              <input v-model.number="settings.settings.danbooruMaxSide" class="input" type="number" min="256" max="4096" @input="markDirty" />
            </label>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field-label">JPEG 质量</span>
              <input v-model.number="settings.settings.danbooruQuality" class="input" type="number" min="50" max="100" @input="markDirty" />
            </label>
            <label class="field">
              <span class="field-label">默认触发词</span>
              <input v-model="settings.settings.danbooruTrigger" class="input" type="text" spellcheck="false" @input="markDirty" />
            </label>
          </div>

          <div class="section-title">WD14 打标默认值</div>
          <div class="path-row">
            <label class="field" style="flex: 1">
              <span class="field-label">WD14 模型目录</span>
              <div class="input-btn">
                <input v-model="settings.settings.wd14ModelDir" class="input" type="text" spellcheck="false" @input="markDirty" />
                <button type="button" class="btn btn-ghost" @click="pickWd14ModelDir">选择…</button>
              </div>
            </label>
          </div>
          <div class="field" style="max-width: 280px">
            <span class="field-label">模型名</span>
            <input v-model="settings.settings.wd14ModelName" class="input" type="text" spellcheck="false" @input="markDirty" />
          </div>

          <div class="section-title">外观</div>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" @click="setTheme(isDark ? 'light' : 'dark')">
              <IconSun v-if="isDark" :size="16" />
              <IconMoon v-else :size="16" />
              {{ isDark ? '切换到白天模式' : '切换到暗黑模式' }}
            </button>
          </div>

          <div class="section-hint" style="margin-top: 16px">
            设置保存在 Electron userData 目录下的 settings.json。
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-panel {
  flex: 0 0 auto;
  width: 100%;
  max-width: 860px;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
