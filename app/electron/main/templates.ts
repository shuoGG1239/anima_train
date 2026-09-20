/** 新建训练项目的文件模板 —— 在应用内可直接编辑保存。 */

export interface ProjectTemplates {
  trainScript: string
  preprocessScript: string
  datasetToml: string
}

export function buildTemplates(name: string, trigger: string, description: string): ProjectTemplates {
  const safeName = /^[\w\-.]+$/.test(name) ? name : 'anima_lora'
  const trig = trigger.trim() || 'YOUR_TRIGGER'

  const trainScript = `# ${name} LoRA 训练脚本
# 由 Anima 训练工作台生成 —— 在「项目详情」页编辑后保存，再点「开始训练」。
# 请根据你的训练环境修改：sd-scripts 路径、accelerate 环境、训练参数等。
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputDir   = Join-Path $ProjectRoot "output"
$LogDir      = Join-Path $ProjectRoot "logs"
$DatasetToml = Join-Path $ProjectRoot "dataset.toml"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir   | Out-Null

# TODO: 改成你本机的 sd-scripts 仓库路径
$ScriptsRoot = "C:\\c_git_project\\sd-scripts"
if (-not (Test-Path $ScriptsRoot)) {
  Write-Error "sd-scripts 不存在: $ScriptsRoot，请先修改本脚本顶部的路径"
}

Set-Location $ScriptsRoot

# 训练日志会同时输出到应用控制台与 logs\\train.log（由应用记录）
accelerate launch --num_cpu_threads_per_process 8 \`
  "$ScriptsRoot\\train_network.py" \`
  --config_file $DatasetToml \`
  --output_dir $OutputDir \`
  --output_name "${safeName}" \`
  --log_with tensorboard \`
  --logging_dir $LogDir

Write-Host "训练完成: $OutputDir"
`

  const preprocessScript = `# ${name} 预处理脚本
# 由 Anima 训练工作台生成 —— 可选。
# 也可以在「工具」页使用内置的 WD14 批量打标 / 相似图去重 / 配对清理。
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ImagesDir   = Join-Path $ProjectRoot "images"

Write-Host "预处理目标目录: $ImagesDir"
# TODO: 在这里写你的预处理流程（重命名 / 缩放 / 打标 / 挑选）
`

  const datasetToml = `# ${name} 数据集配置（sd-scripts / kohya 风格）
# 触发词: ${trig}
# 使用示例: ${trig}, <lora:${safeName}:0.8>, ...

[general]
shuffle_caption = true
caption_extension = ".txt"
keep_tokens = 1
enable_bucket = true
resolution = 1024
bucket_reso_steps = 64
max_token_length = 225

# TODO: 修改为你的图片目录（也可以直接在项目文件夹下建 images/）
[[datasets]]
resolution = 1024
batch_size = 4

  [[datasets.subsets]]
  image_dir = "C:\\path\\to\\your\\images"
  num_repeats = 10
`

  return { trainScript, preprocessScript, datasetToml }
}
