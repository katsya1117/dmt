// 絞り込みUIのデザイン比較用（仮）。採用案が決まったら他案と一緒に整理する
export type RecordFilterProps = {
  numberValue: string
  accountNameValue: string
  onNumberChange: (value: string) => void
  onAccountNameChange: (value: string) => void
}

export const isComposing = (e: React.KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229

export const focusRing = '0 0 0 3px rgb(30 41 59 / 0.12)'
export const popoverPaperSx = {
  mt: 0.75,
  borderRadius: '10px',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 12px 32px rgb(15 23 42 / 0.12), 0 2px 6px rgb(15 23 42 / 0.06)',
} as const
