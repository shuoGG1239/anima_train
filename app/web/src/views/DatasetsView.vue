<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import SplitPane from '@/components/common/SplitPane.vue'
import DatasetImageCell from '@/components/datasets/DatasetImageCell.vue'
import { useDatasetsStore } from '@/stores/datasets'
import { useToast } from '@/composables/useToast'
import { formatBytes } from '@/utils/format'
import type { DatasetImageItem, DatasetInfo } from '@shared/ipc-types'

defineOptions({ name: 'DatasetsView' })

const store = useDatasetsStore()
const toast = useToast()

const selectedName = ref<string>('')
const visibleCount = ref(60)
const gridRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

const lightbox = ref<{ item: DatasetImageItem; image: string | null; caption: string | null } | null>(null)
const loadingLightbox = ref(false)

let observer: IntersectionObserver | null = null

const selected = computed<DatasetInfo | undefined>(() =>
  store.datasets.find((d) => d.name === selectedName.value),
)

const visibleImages = computed(() => {
  const all = store.detail?.images ?? []
  return all.slice(0, visibleCount.value)
})

async function select(name: string): Promise<void> {
  selectedName.value = name
  visibleCount.value = 60
  await store.open(name)
  await nextTick()
  observeSentinel()
}

function observeSentinel(): void {
  observer?.disconnect()
  observer = null
  if (!sentinelRef.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        visibleCount.value += 60
      }
    },
    { root: gridRef.value, rootMargin: '200px' },
  )
  observer.observe(sentinelRef.value)
}

async function openLightbox(item: DatasetImageItem): Promise<void> {
  loadingLightbox.value = true
  lightbox.value = { item, image: null, caption: null }
  try {
    const [img, caption] = await Promise.all([
      store.thumb(item.path, 1024),
      window.api.datasets.readCaption(item.path.replace(/\.[^.]+$/, '.txt')),
    ])
    if (lightbox.value?.item.path === item.path) {
      lightbox.value.image = img
      lightbox.value.caption = caption
    }
  } catch {
    // ignore
  } finally {
    loadingLightbox.value = false
  }
}

function openLightboxByPath(path: string): void {
  const item = store.detail?.images.find((i) => i.path === path)
  if (item) void openLightbox(item)
}

async function prune(): Promise<void> {
  if (!selectedName.value) return
  const info = store.detail?.info
  if (!info || info.orphanImages + info.orphanCaptions === 0) return
  try {
    const result = await window.api.datasets.deleteOrphans(selectedName.value)
    toast.ok(`已清理 ${result.deletedImages.length} 张图片、${result.deletedCaptions.length} 个字幕`)
    await store.refreshDetail(selectedName.value)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function openFolder(): Promise<void> {
  if (!selectedName.value) return
  try {
    await window.api.datasets.openFolder(selectedName.value)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function reveal(path: string): void {
  void window.api.shell.showItemInFolder(path).catch(() => {})
}

onMounted(async () => {
  await store.refresh()
  if (store.datasets.length && !selectedName.value) {
    await select(store.datasets[0].name)
  } else {
    await nextTick()
    observeSentinel()
  }
})

// KeepAlive 重新激活时刷新列表与当前数据集详情
onActivated(async () => {
  await store.refresh()
  if (selectedName.value) {
    await store.refreshDetail(selectedName.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="page-shell">
    <SplitPane storage-key="anima-train:datasets-split" :default-width="280" :min-width="220" :max-width="340">
      <template #left>
        <section class="list-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-title">数据集</span>
            </div>
          </div>
          <div class="list-scroll">
            <button
              v-for="d in store.datasets"
              :key="d.name"
              type="button"
              class="list-item"
              :class="{ active: d.name === selectedName }"
              @click="select(d.name)"
            >
              <span class="list-item-name">{{ d.name }}</span>
              <span class="list-item-meta">{{ d.imageCount }} 图</span>
            </button>
            <div v-if="!store.datasets.length" class="empty-state">
              <div class="title">没有数据集</div>
              <div class="hint">
                在「工具」页用 Danbooru 下载创建，或手动放到 <span class="mono">datasets/</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template #right>
        <section v-if="store.detail" class="detail-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-title">{{ store.detail.info.name }}</span>
              <span v-if="store.detail.info.orphanImages + store.detail.info.orphanCaptions > 0" class="status-pill error">
                {{ store.detail.info.orphanImages + store.detail.info.orphanCaptions }} 个孤儿文件
              </span>
            </div>
            <div class="form-actions" style="padding-top: 0">
              <button type="button" class="btn btn-ghost btn-sm" @click="openFolder">打开目录</button>
              <button
                type="button"
                class="btn btn-danger btn-ghost btn-sm"
                :disabled="store.detail.info.orphanImages + store.detail.info.orphanCaptions === 0"
                @click="prune"
              >
                清理孤儿文件
              </button>
            </div>
          </div>

          <div class="dataset-stats">
            <div class="stat-mini">
              <span class="stat-mini-value">{{ store.detail.info.imageCount }}</span>
              <span class="stat-mini-label">图片</span>
            </div>
            <div class="stat-mini">
              <span class="stat-mini-value">{{ store.detail.info.captionCount }}</span>
              <span class="stat-mini-label">字幕</span>
            </div>
            <div class="stat-mini">
              <span class="stat-mini-value">{{ store.detail.info.paired }}</span>
              <span class="stat-mini-label">已配对</span>
            </div>
            <div class="stat-mini">
              <span class="stat-mini-value">{{ formatBytes(store.detail.info.totalSizeBytes) }}</span>
              <span class="stat-mini-label">总大小</span>
            </div>
            <div class="stat-mini" style="flex: 1; min-width: 0">
              <span class="stat-mini-value mono" style="font-size: 11px">{{ store.detail.info.imagesDir }}</span>
              <span class="stat-mini-label">图片目录</span>
            </div>
          </div>

          <div class="panel-body panel-body--flush">
            <div v-if="!store.detail.images.length" class="empty-state">
              <div class="title">目录里没有图片</div>
              <div class="hint">图片目录: {{ store.detail.info.imagesDir }}</div>
            </div>
            <div v-else ref="gridRef" class="image-grid-scroll">
              <div class="image-grid">
                <DatasetImageCell
                  v-for="item in visibleImages"
                  :key="item.path"
                  :path="item.path"
                  :name="item.name"
                  :has-caption="item.hasCaption"
                  @open="openLightboxByPath"
                />
              </div>
              <div ref="sentinelRef" class="grid-sentinel">
                <span v-if="visibleImages.length < store.detail.images.length" class="spinner" />
                <span v-else class="grid-end">{{ store.detail.images.length }} 张图片</span>
              </div>
            </div>
          </div>
        </section>

        <section v-else class="detail-panel">
          <div class="panel-body">
            <div class="empty-state">
              <div class="title">选择一个数据集</div>
              <div class="hint">查看图片、配对统计，清理孤儿文件</div>
            </div>
          </div>
        </section>
      </template>
    </SplitPane>

    <!-- 图片大图预览 -->
    <Teleport to="body">
      <div v-if="lightbox" class="overlay" @click.self="lightbox = null">
        <div class="overlay-card">
          <div class="overlay-header">
            <span class="overlay-title">{{ lightbox.item.name }}</span>
            <button type="button" class="btn btn-ghost btn-sm" @click="reveal(lightbox.item.path)">
              在文件夹中显示
            </button>
            <button type="button" class="btn btn-icon" title="关闭" @click="lightbox = null">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="overlay-body">
            <img
              v-if="lightbox.image"
              :src="lightbox.image"
              class="overlay-img"
              :alt="lightbox.item.name"
              :data-image-path="lightbox.item.path"
            />
            <div v-else-if="loadingLightbox" class="empty-state"><span class="spinner" /></div>
            <div v-else class="empty-state"><div class="hint">无法读取图片</div></div>
            <div v-if="lightbox.caption" class="overlay-caption">{{ lightbox.caption }}</div>
            <div v-else-if="lightbox.item.hasCaption" class="empty-state"><div class="hint">无字幕内容</div></div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dataset-stats {
  display: flex;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.stat-mini {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-mini-value {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.stat-mini-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.image-grid-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
}

.grid-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 0;
}

.grid-end {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
}
</style>
