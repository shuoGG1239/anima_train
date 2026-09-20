# Anima LoRA training workspace

```
anima_train/
  app/                  # Electron 桌面应用（Anima 训练工作台）
  python/               # 所有 Python 工具脚本（桌面应用调用）
    danbooru_fetch.py
    preprocess_luluka_extra.py
    prune_dataset_pairs.py
    scan_cli.py         # 相似图扫描 JSON CLI（应用内部使用）
    similar_scan.py     # 感知哈希聚类引擎
  datasets/
    ibuki_swimsuit/images
    moria_luluka/images
  projects/
    luokun/
    moria_luluka/
    ibuki_swimsuit/
    seia_swimsuit/
      dataset.toml
      preprocess.ps1
      train.ps1
      output/
      logs/
```

## 桌面应用（`app/`）

Electron + Vue 3 + Pinia + TypeScript 的训练工作台，UI 架构与风格参考 `G:\git_project\aigc-ui`。

```powershell
cd app
npm install
npm run dev
```

功能：

- **总览**：数据集 / 项目 / 孤儿文件 / 运行中任务统计
- **项目与训练**：创建训练项目（生成 train.ps1、preprocess.ps1、dataset.toml 模板），
  在应用内直接编辑脚本并保存，一键启动训练 / 预处理，实时查看日志、随时停止
- **数据集浏览**：图片网格、image + txt 配对统计、一键清理孤儿文件
- **工具**：
  - Danbooru 下载（表单化 `python/danbooru_fetch.py`）
  - WD14 批量打标（表单化 `python/preprocess_luluka_extra.py`）
  - 相似图去重（`python/scan_cli.py` JSON 扫描 + 可视化挑选删除）
- **控制台**：所有任务的实时日志（含进程停止）
- **设置**：训练仓库根目录、Python 路径、工具默认参数、深浅色主题

Python 脚本集中在 `python/` 下，均可单独 CLI 调用（`python python/danbooru_fetch.py --help` 等），默认参数保持不变。

## Similar image dedupe (`python/`)

原独立的 FastAPI Web UI（start.py / app.py / cli.py）已移除，相似图去重的界面由桌面应用「工具 → 相似图去重」提供。`python/scan_cli.py` + `python/similar_scan.py` 仅保留桌面应用调用的扫描引擎：

```powershell
pip install pillow imagehash
```

- **JSON CLI**（桌面应用内部使用）: `python python/scan_cli.py --path <dir> [--threshold 8] [--method phash] [--recursive] [--json-out out.json]`

## Usage after train

```
ibuki swimsuit, <lora:ibuki_swimsuit:0.8>, ...
seia swimsuit, <lora:seia_swimsuit:0.8>, ...
moria luluka, <lora:moria_luluka:0.8>, ...
```
