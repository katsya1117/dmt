import { useLayoutEffect, useRef, useState } from 'react'
import Tooltip from '@mui/material/Tooltip'

type Props = {
  value: string
}

// DataGridの既定セルレンダラーは、内容が省略された時にブラウザ標準の
// title属性でツールチップを出す（飾り気のない見た目で浮く）。renderCellで
// このコンポーネントを使うことで、どの列でもMUIのTooltipに統一できる。
// テキストが実際に省略されている（scrollWidth > clientWidth）場合のみ表示する
export function OverflowTooltipCell({ value }: Props) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useLayoutEffect(() => {
    const el = spanRef.current
    if (!el) return

    const checkOverflow = () => setIsOverflowing(el.scrollWidth > el.clientWidth)
    checkOverflow()

    const observer = new ResizeObserver(checkOverflow)
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  return (
    <Tooltip title={value} placement="bottom-start" disableHoverListener={!isOverflowing}>
      <span
        ref={spanRef}
        style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value}
      </span>
    </Tooltip>
  )
}
