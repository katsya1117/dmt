// 表の直上に常時表示する絞り込み欄（No.・ユーザー名をAND条件でonChange即時フィルタ）
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import InputBase from '@mui/material/InputBase'
import CloseIcon from '@mui/icons-material/Close'
import { focusRing, type RecordFilterProps } from './shared'

// ボタン（MUI medium）と高さを揃える
const CONTROL_HEIGHT = 36

type InlineFieldProps = {
  label: string
  value: string
  width: number
  numeric?: boolean
  onChange: (value: string) => void
}

function InlineField({ label, value, width, numeric, onChange }: InlineFieldProps) {
  return (
    <InputBase
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ 'aria-label': `${label}で絞り込み`, ...(numeric ? { inputMode: 'numeric' } : {}) }}
      startAdornment={
        <Box component="span" sx={{ pr: 1, mr: 1, borderRight: '1px solid #e2e8f0', color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {label}
        </Box>
      }
      endAdornment={
        value ? (
          <ButtonBase
            aria-label={`${label}の絞り込みを解除`}
            onClick={() => onChange('')}
            sx={{ width: 20, height: 20, borderRadius: '4px', color: 'text.secondary', '&:hover': { bgcolor: '#f1f5f9', color: 'text.primary' } }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </ButtonBase>
        ) : null
      }
      sx={{
        width,
        height: CONTROL_HEIGHT,
        px: 1.25,
        fontSize: '0.875rem',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: value ? '#94a3b8' : '#e2e8f0',
        borderRadius: '8px',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        '&:hover': { borderColor: '#cbd5e1' },
        '&.Mui-focused': { borderColor: 'primary.main', boxShadow: focusRing },
      }}
    />
  )
}

export function FilterInline({ numberValue, accountNameValue, onNumberChange, onAccountNameChange }: RecordFilterProps) {
  const hasAny = Boolean(numberValue || accountNameValue)

  return (
    <Box role="search" aria-label="レコードの絞り込み" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      <InlineField label="No." value={numberValue} width={150} numeric onChange={onNumberChange} />
      <InlineField label="ユーザー名" value={accountNameValue} width={240} onChange={onAccountNameChange} />
      {hasAny && (
        <ButtonBase
          onClick={() => {
            onNumberChange('')
            onAccountNameChange('')
          }}
          sx={{ fontFamily: 'inherit', fontSize: '0.75rem', px: 1, height: 28, borderRadius: '6px', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
        >
          すべてクリア
        </ButtonBase>
      )}
    </Box>
  )
}
