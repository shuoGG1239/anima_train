/**
 * Shared IPC channel names (main ↔ preload).
 * Keep string values stable; rename keys freely.
 */
export const IPC = {
  theme: {
    set: 'theme:set',
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    pickTrainRoot: 'settings:pickTrainRoot',
    openTrainRoot: 'settings:openTrainRoot',
    pickPython: 'settings:pickPython',
  },
  shell: {
    pickDir: 'shell:pickDir',
    openPath: 'shell:openPath',
    showItemInFolder: 'shell:showItemInFolder',
  },
  jobs: {
    list: 'jobs:list',
    getLogs: 'jobs:getLogs',
    clearLogs: 'jobs:clearLogs',
    stop: 'jobs:stop',
    log: 'jobs:log',
    status: 'jobs:status',
    cleared: 'jobs:cleared',
    result: 'jobs:result',
  },
  projects: {
    list: 'projects:list',
    create: 'projects:create',
    readFiles: 'projects:readFiles',
    writeFiles: 'projects:writeFiles',
    runTrain: 'projects:runTrain',
    runPreprocess: 'projects:runPreprocess',
    openFolder: 'projects:openFolder',
    delete: 'projects:delete',
  },
  datasets: {
    list: 'datasets:list',
    detail: 'datasets:detail',
    readThumb: 'datasets:readThumb',
    readCaption: 'datasets:readCaption',
    deleteOrphans: 'datasets:deleteOrphans',
    openFolder: 'datasets:openFolder',
  },
  tools: {
    danbooru: 'tools:danbooru',
    wd14: 'tools:wd14',
  },
  similar: {
    scan: 'similar:scan',
    delete: 'similar:delete',
  },
} as const
