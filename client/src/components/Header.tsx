import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'

type NavItem = { label: string; to: string }
type NavCategory = { label: string; items: NavItem[] }

const NAV: NavCategory[] = [
  {
    label: 'アップロード',
    items: [
      { label: 'サービスニュースファイルアップロード', to: '/upload/service-news' },
      { label: '車種コンテンツアップロード', to: '/upload/vehicle-content' },
      { label: '共通コンテンツアップロード', to: '/upload/common-content' },
    ],
  },
  {
    label: 'マスタ管理',
    items: [
      { label: '車種テーブル', to: '/master/vehicle' },
      { label: '型式名車名CD変換テーブル', to: '/master/katashiki-name' },
      { label: 'アプリケーション更新テーブル', to: '/master/app-update' },
      { label: '生産情報テーブル', to: '/master/production-info' },
      { label: '車両情報ファイルテーブル', to: '/master/vehicle-file' },
      { label: '型式ID車両ID変換テーブル', to: '/master/katashiki-vehicle-id' },
      { label: '車両No.型式ID変換テーブル', to: '/master/vehicle-no-katashiki' },
      { label: 'E ID／システム名変換テーブル', to: '/master/eid-system' },
    ],
  },
  {
    label: '情報・設定管理',
    items: [
      { label: 'お知らせ情報更新', to: '/settings/notice' },
      { label: 'D3 セキュリティ認証情報管理', to: '/settings/d3-security' },
      { label: 'D3 リブロファイルメンテナンス', to: '/settings/d3-libro' },
    ],
  },
  {
    label: '権限管理',
    items: [
      { label: '権限管理', to: '/auth/roles' },
      { label: 'ユーザー権限管理', to: '/auth/user-roles' },
      { label: '管理者テーブルメンテナンス', to: '/auth/admin' },
    ],
  },
  {
    label: 'データ出力',
    items: [
      { label: 'オフライン更新ファイル作成', to: '/output/offline-update' },
      { label: 'HTML納品データ作成', to: '/output/html-delivery' },
      { label: 'SMS閲覧車種登録用ファイル出力', to: '/output/sms-vehicle' },
    ],
  },
  {
    label: 'ログ閲覧',
    items: [
      { label: '電子マニュアル版ログ', to: '/log/electronic' },
      { label: 'HTML版ログ', to: '/log/html' },
    ],
  },
]

function NavDropdown({ category }: { category: NavCategory }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()

  return (
    <>
      <Button
        color="inherit"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        sx={{ fontSize: '0.8125rem' }}
      >
        {category.label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { elevation: 1, sx: { minWidth: 220, mt: 0 } }, list: { onMouseLeave: () => setAnchor(null) } }}
      >
        {category.items.map((item) => (
          <MenuItem
            key={item.to}
            dense
            onClick={() => { navigate(item.to); setAnchor(null) }}
            sx={{ fontSize: '0.8125rem' }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default function Header() {
  return (
    <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Typography variant="body2" sx={{ mr: 2, whiteSpace: 'nowrap', fontWeight: 700, color: 'primary.main' }}>
          マニュアルメンテナンスツール
        </Typography>
        {NAV.map((cat) => (
          <NavDropdown key={cat.label} category={cat} />
        ))}
      </Toolbar>
    </AppBar>
  )
}
