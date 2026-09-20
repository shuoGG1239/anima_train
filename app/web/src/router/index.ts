import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import ProjectsView from '@/views/ProjectsView.vue'
import DatasetsView from '@/views/DatasetsView.vue'
import ToolsView from '@/views/ToolsView.vue'
import ConsoleView from '@/views/ConsoleView.vue'
import SettingsView from '@/views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/projects', name: 'projects', component: ProjectsView },
    { path: '/datasets', name: 'datasets', component: DatasetsView },
    { path: '/tools', name: 'tools', component: ToolsView },
    { path: '/console', name: 'console', component: ConsoleView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})
