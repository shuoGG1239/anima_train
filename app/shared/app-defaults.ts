/** Process-agnostic product defaults (web + electron main). */

export const APP_DISPLAY_NAME = 'Anima 训练工作台'

/** Default Python executable / module runner used to launch tool scripts. */
export const DEFAULT_PYTHON = 'python'

/** Default proxy used by Danbooru 下载（v2rayN 默认端口）. */
export const DEFAULT_PROXY = 'socks5://127.0.0.1:1080'

export const DEFAULT_WD14_MODEL_NAME = 'wd-swinv2-tagger-v3'

/** Keep last N jobs in memory (finished jobs included). */
export const JOB_HISTORY_LIMIT = 100

/** Per-job ring buffer size for logs. */
export const JOB_LOG_LIMIT = 2000
