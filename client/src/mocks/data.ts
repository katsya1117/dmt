import type { Katashiki, KatashikiFile } from '../api/types'

export const mockKatashikiList: Katashiki[] = [
  { id: 'ABC-2021', label: 'ABC-2021' },
  { id: 'ABC-2022', label: 'ABC-2022' },
  { id: 'XYZ-2020', label: 'XYZ-2020' },
]

export const mockKatashikiFiles: Record<string, KatashikiFile[]> = {
  'ABC-2021': [
    { name: 'manual_001.xml', ext: 'xml', label: 'XML（分割済み）', size: 12400 },
    { name: 'manual_001.pdf', ext: 'pdf', label: 'PDF', size: 204800 },
    { name: 'figure_001.svg', ext: 'svg', label: 'SVG（図版）', size: 3200 },
    { name: 'katashiki.db',   ext: 'db',  label: '型式別DB',      size: 8192 },
  ],
  'ABC-2022': [
    { name: 'manual_001.xml', ext: 'xml', label: 'XML（分割済み）', size: 13500 },
    { name: 'manual_001.swf', ext: 'swf', label: 'SWF',            size: 512000 },
    { name: 'caption.xml',    ext: 'xml', label: 'XML（分割済み）', size: 2048 },
  ],
  'XYZ-2020': [
    { name: 'manual_002.xml', ext: 'xml', label: 'XML（分割済み）', size: 9800 },
    { name: 'figure_002.svg', ext: 'svg', label: 'SVG（図版）',     size: 4100 },
  ],
}
