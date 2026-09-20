/** 数据集模块：扫描统计、图片列表、配对清理、缩略图。 */

import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { nativeImage } from 'electron'
import { datasetsDir } from './settings'
import type { DatasetDetail, DatasetImageItem, DatasetInfo } from '@shared/ipc-types'

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'])

export function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return IMG_EXTS.has(name.slice(dot).toLowerCase())
}

function readDirSorted(dir: string): string[] {
  try {
    return readdirSync(dir).sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/** 数据集目录结构：优先 <name>/images，否则把 <name> 本身当图片目录。 */
export function resolveImagesDir(datasetDir: string): string {
  const nested = join(datasetDir, 'images')
  if (existsSync(nested)) {
    const hasImage = readDirSorted(nested).some(isImageFile)
    if (hasImage) return nested
  }
  return datasetDir
}

function computeInfo(name: string, dir: string): DatasetInfo {
  const imagesDir = resolveImagesDir(dir)
  const files = readDirSorted(imagesDir)
  let imageCount = 0
  let captionCount = 0
  let paired = 0
  let totalSizeBytes = 0
  const imageStems = new Set<string>()
  const captionStems = new Set<string>()

  for (const f of files) {
    const full = join(imagesDir, f)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    if (isImageFile(f)) {
      imageCount++
      imageStems.add(stemOf(f))
      totalSizeBytes += st.size
    } else if (f.toLowerCase().endsWith('.txt')) {
      captionCount++
      captionStems.add(stemOf(f))
    }
  }
  for (const s of imageStems) {
    if (captionStems.has(s)) paired++
  }
  return {
    name,
    dir,
    imagesDir,
    imageCount,
    captionCount,
    paired,
    orphanImages: imageCount - paired,
    orphanCaptions: captionCount - paired,
    totalSizeBytes,
  }
}

function stemOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function listDatasets(): DatasetInfo[] {
  const root = datasetsDir()
  if (!existsSync(root)) return []
  const out: DatasetInfo[] = []
  for (const entry of readDirSorted(root)) {
    const dir = join(root, entry)
    let st
    try {
      st = statSync(dir)
    } catch {
      continue
    }
    if (!st.isDirectory() || entry.startsWith('.')) continue
    out.push(computeInfo(entry, dir))
  }
  return out.sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)
}

export function getDatasetInfo(name: string): DatasetInfo {
  return computeInfo(name, join(datasetsDir(), name))
}

export function datasetDetail(name: string): DatasetDetail {
  const info = computeInfo(name, join(datasetsDir(), name))
  const files = readDirSorted(info.imagesDir)
  const imageStems = new Set<string>()
  const captionStems = new Set<string>()
  const images: DatasetImageItem[] = []

  for (const f of files) {
    if (isImageFile(f)) imageStems.add(stemOf(f))
    else if (f.toLowerCase().endsWith('.txt')) captionStems.add(stemOf(f))
  }

  for (const f of files) {
    if (!isImageFile(f)) continue
    const full = join(info.imagesDir, f)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    images.push({
      name: f,
      path: full,
      sizeBytes: st.size,
      mtimeMs: st.mtimeMs,
      hasCaption: captionStems.has(stemOf(f)),
    })
  }
  images.sort((a, b) => a.name.localeCompare(b.name))

  const orphanImageNames = [...imageStems]
    .filter((s) => !captionStems.has(s))
    .sort((a, b) => a.localeCompare(b))
  const orphanCaptionNames = [...captionStems]
    .filter((s) => !imageStems.has(s))
    .sort((a, b) => a.localeCompare(b))

  return { info, images, orphanImageNames, orphanCaptionNames }
}

/** 删除孤儿图片/字幕，返回实际删除的文件名。 */
export function deleteOrphans(name: string): { deletedImages: string[]; deletedCaptions: string[] } {
  const detail = datasetDetail(name)
  const deletedImages: string[] = []
  const deletedCaptions: string[] = []
  for (const stem of detail.orphanImageNames) {
    for (const f of readDirSorted(detail.info.imagesDir)) {
      if (isImageFile(f) && stemOf(f) === stem) {
        try {
          unlinkSync(join(detail.info.imagesDir, f))
          deletedImages.push(f)
        } catch {
          // ignore
        }
      }
    }
  }
  for (const stem of detail.orphanCaptionNames) {
    const f = `${stem}.txt`
    const full = join(detail.info.imagesDir, f)
    try {
      unlinkSync(full)
      deletedCaptions.push(f)
    } catch {
      // ignore
    }
  }
  return { deletedImages, deletedCaptions }
}

/** 读取图片缩略图（等比缩小）为 data URL，避免把整张大图塞进渲染进程。 */
export function imageThumbDataUrl(path: string, size = 256): string | null {
  try {
    const img = nativeImage.createFromPath(path)
    if (img.isEmpty()) return null
    const { width, height } = img.getSize()
    if (width <= 0 || height <= 0) return null
    if (Math.max(width, height) <= size) {
      return img.toDataURL()
    }
    const scale = size / Math.max(width, height)
    return img.resize({ width: Math.max(1, Math.round(width * scale)) }).toDataURL()
  } catch {
    return null
  }
}

export function readCaption(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}
