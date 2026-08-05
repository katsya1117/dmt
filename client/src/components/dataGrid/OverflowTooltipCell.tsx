import Tooltip from '@mui/material/Tooltip'

type Props = {
  value: string
}

// DataGridの既定セルレンダラーは、内容が省略された時にブラウザ標準の
// title属性でツールチップを出す（飾り気のない見た目で浮く）。renderCellで
// このコンポーネントを使うことで、どの列でもMUIのTooltipに統一できる
export function OverflowTooltipCell({ value }: Props) {
  return (
    <Tooltip title={value} placement="bottom-start">
      <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </Tooltip>
  )
}
