export interface SelectOption {
  label: string
  value: string
}

export const IMAGE_HASH_METHOD_OPTIONS: SelectOption[] = [
  { label: 'phash（感知哈希）', value: 'phash' },
  { label: 'dhash（差异哈希）', value: 'dhash' },
  { label: 'ahash（均值哈希）', value: 'ahash' },
  { label: 'whash（小波哈希）', value: 'whash' },
]
