<script setup lang="ts">
import { IconMoon, IconSun } from '@/components/icons'
import { useTheme } from '@/composables/useTheme'
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useJobsStore } from '@/stores/jobs'

const route = useRoute()
const router = useRouter()
const { isDark, toggleTheme } = useTheme()
const jobs = useJobsStore()

const runningCount = computed(() => jobs.runningJobs.length)

const primaryItems = [
  { path: '/', label: '总览', icon: 'spark' as const },
  { path: '/projects', label: '项目', icon: 'project' as const },
  { path: '/datasets', label: '数据集', icon: 'image' as const },
  { path: '/tools', label: '工具', icon: 'wrench' as const },
  { path: '/console', label: '控制台', icon: 'console' as const },
]

function go(path: string): void {
  router.push(path)
}
</script>

<template>
  <aside class="sidebar">
    <nav class="nav-list">
      <button
        v-for="item in primaryItems"
        :key="item.path"
        type="button"
        class="nav-item"
        :class="{ active: route.path === item.path }"
        :title="item.label"
        @click="go(item.path)"
      >
        <svg v-if="item.icon === 'spark'" class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3l1.8 5.6L19.5 10.5l-5.7 1.9L12 18l-1.8-5.6L4.5 10.5l5.7-1.9L12 3z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <path d="M18 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" fill="currentColor" />
        </svg>
        <svg v-else-if="item.icon === 'project'" class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4L11 6h7.5A1.5 1.5 0 0 1 20 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-12z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <path d="M8 12h8M12 8.5v7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <svg v-else-if="item.icon === 'image'" class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.6" />
          <circle cx="9" cy="10" r="1.6" fill="currentColor" />
          <path
            d="M4.5 16.5l4.2-4.2a1.2 1.2 0 0 1 1.7 0L14 16l2.1-2.1a1.2 1.2 0 0 1 1.7 0l1.7 1.7"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else-if="item.icon === 'wrench'" class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.8 2.8-2.2-.5-.5-2.2 2.5-2.1z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.6" />
          <path d="M7 9.5l2.2 2.2L7 13.9M12.5 14.5H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.path === '/console' && runningCount > 0" class="nav-badge">{{ runningCount }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <button
        type="button"
        class="nav-item"
        :title="isDark ? '切换到白天模式' : '切换到暗黑模式'"
        :aria-label="isDark ? '切换到白天模式' : '切换到暗黑模式'"
        @click="toggleTheme"
      >
        <IconSun v-if="!isDark" class="nav-icon" :size="22" />
        <IconMoon v-else class="nav-icon" :size="22" />
        <span class="nav-label">{{ isDark ? '暗黑' : '白天' }}</span>
      </button>
      <button
        type="button"
        class="nav-item"
        :class="{ active: route.path === '/settings' }"
        title="设置"
        @click="go('/settings')"
      >
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z"
            stroke="currentColor"
            stroke-width="1.6"
          />
          <path
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.05.24.25.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.58-.22 1.12-.54 1.63-.94l2.39.96c.25.1.54 0 .68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
        <span class="nav-label">设置</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nav-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  pointer-events: none;
}

.nav-item {
  position: relative;
}
</style>
