import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'

type NavItem = { label: string; to: string }
// 子メニューを持つ親（items）か、直接遷移する親（to）か
type NavCategory = { label: string; items?: NavItem[]; to?: string }

const NAV: NavCategory[] = [
  {
    label: 'アップロード',
    items: [
      { label: 'サービスニュース', to: '/upload/service-news' },
      { label: '冊子版', to: '/upload/booklet' },
      { label: '車種DB', to: '/upload/vehicle-db' },
      { label: '車種コンテンツ', to: '/upload/vehicle-content' },
      { label: '共通コンテンツ', to: '/upload/common-content' },
      { label: 'アプリケーション', to: '/upload/application' },
    ],
  },
  {
    // 子メニューなし。アップロード内容別に絞り込む単一画面
    label: 'ログ閲覧',
    to: '/log',
  },
  {
    label: 'メンテナンス',
    items: [
      { label: '車種テーブル', to: '/master/vehicle' },
      { label: 'お知らせ情報テーブル', to: '/master/notice' },
      { label: 'アカウント認証テーブル', to: '/master/account-auth' },
      { label: '権限テーブル', to: '/master/role' },
      { label: 'ユーザー権限テーブル', to: '/master/user-role' },
      { label: '運用管理者テーブル', to: '/master/admin' },
      { label: 'アプリケーション更新テーブル', to: '/master/app-update' },
      { label: '生産情報テーブル', to: '/master/production-info' },
      { label: '車両情報ファイルテーブル', to: '/master/vehicle-file' },
      { label: 'システム名変換テーブル', to: '/master/system-name' },
      { label: '型式名車名CD変換テーブル', to: '/master/katashiki-name' },
      { label: '型式ID車両ID変換テーブル', to: '/master/katashiki-vehicle-id' },
    ],
  },
  {
    label: 'データ出力',
    items: [
      { label: 'オフライン更新ファイル', to: '/output/offline-update' },
      { label: 'HTML版ファイル', to: '/output/html' },
      { label: '納品データ', to: '/output/delivery' },
      { label: '車名一覧用HTML', to: '/output/vehicle-list-html' },
    ],
  },
  {
    label: '故障診断',
    items: [
      { label: '診断AP関連インストールファイル', to: '/diagnosis/install-file' },
      { label: 'セキュリティ認証情報管理', to: '/diagnosis/security-auth' },
      { label: 'リプロファイルメンテナンス', to: '/diagnosis/repro-file' },
    ],
  },
  {
    label: '環境設定',
    items: [
      { label: '接続先設定', to: '/settings/connection' },
    ],
  },
]

function NavDropdown({ category }: { category: NavCategory }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()

  // 子メニューを持たない親は直接遷移するボタン
  if (!category.items) {
    return (
      <Button
        color="inherit"
        onClick={() => category.to && navigate(category.to)}
        sx={{ fontSize: '0.8125rem' }}
      >
        {category.label}
      </Button>
    )
  }

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
