# Anima LoRA training workspace

```
anima_train/
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

## Similar image dedupe (`similar_images_web/`)

```powershell
pip install fastapi uvicorn pillow imagehash
```

- **Web UI**: double-click `similar_images_web\start.py` → http://127.0.0.1:8765
- **CLI**: `similar_images_web\cli.py` (edit `TARGET` / thresholds at top of file)

## Usage after train

```
ibuki swimsuit, <lora:ibuki_swimsuit:0.8>, ...
seia swimsuit, <lora:seia_swimsuit:0.8>, ...
moria luluka, <lora:moria_luluka:0.8>, ...
```
