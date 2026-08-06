import { createTheme } from '@mui/material/styles'
// MuiDataGridをテーマのcomponents overridesで型認識させるための型拡張のみのimport
import type {} from '@mui/x-data-grid/themeAugmentation'

const theme = createTheme({
  palette: {
    // MUI感の強い鮮やかな青はやめ、near-blackを主役にした中立的な配色にする。
    // 青は「情報/リンク」のアクセントとしてinfoに退避。
    primary: {
      main: '#1e293b',      // Tailwind slate-800（near-black）
      light: '#334155',     // slate-700
      dark: '#0f172a',      // slate-900
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b',      // Tailwind slate-500
    },
    info: {
      main: '#2563eb',      // Tailwind blue-600（リンク等のアクセント専用）
    },
    background: {
      default: '#f8fafc',   // Tailwind slate-50
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',   // Tailwind slate-800
      secondary: '#64748b', // Tailwind slate-500
    },
    divider: '#e2e8f0',     // Tailwind slate-200
    // 【DataGridのヘッダー背景はcomponents.MuiDataGrid.styleOverridesが効かない】
    // v9のDataGridはヘッダー背景をCSS変数(--DataGrid-t-header-background-base)
    // 経由で描画しており、その値はpalette.DataGrid.headerBgから注入される。
    // styleOverrides側で.MuiDataGrid-columnHeadersに直接backgroundColorを
    // 当てても、このCSS変数を参照する内部スタイルの方が優先され上書きできない
    // slate-100(#f1f5f9)はbody(白)との差がわずか数階調しかなく、実画面では
    // ほぼ見分けがつかなかったため、はっきり差が出るslate-200を使う
    DataGrid: {
      headerBg: '#e2e8f0', // Tailwind slate-200
    },
  },

  typography: {
    // 欧文/数字=Inter、和文=Noto Sans JP。読めない環境用にsystem fontをfallback。
    fontFamily: [
      '"Inter"',
      '"Noto Sans JP"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Hiragino Sans"',
      '"Hiragino Kaku Gothic ProN"',
      'sans-serif',
    ].join(','),
    fontSize: 14,
    // 数字を等幅に揃え、字面を少し締める（内部ツールの可読性向上）
    body1: { fontFeatureSettings: '"tnum"' },
    body2: { fontFeatureSettings: '"tnum"' },
    h1: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontSize: '1rem', fontWeight: 600 },
  },

  shape: {
    borderRadius: 4, // デフォルト(4)のまま。MUI感が出やすい8には上げない
  },

  shadows: [
    'none',
    '0 1px 2px 0 rgb(0 0 0 / 0.05)',          // 1: カード等
    '0 1px 3px 0 rgb(0 0 0 / 0.08)',           // 2
    '0 2px 4px 0 rgb(0 0 0 / 0.08)',           // 3
    '0 4px 6px -1px rgb(0 0 0 / 0.08)',        // 4
    '0 4px 6px -1px rgb(0 0 0 / 0.10)',        // 5
    '0 4px 6px -1px rgb(0 0 0 / 0.12)',        // 6
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',      // 7
    '0 10px 15px -3px rgb(0 0 0 / 0.10)',      // 8
    '0 10px 15px -3px rgb(0 0 0 / 0.12)',      // 9
    '0 20px 25px -5px rgb(0 0 0 / 0.08)',      // 10
    '0 20px 25px -5px rgb(0 0 0 / 0.10)',      // 11
    '0 20px 25px -5px rgb(0 0 0 / 0.12)',      // 12
    '0 25px 50px -12px rgb(0 0 0 / 0.12)',     // 13
    '0 25px 50px -12px rgb(0 0 0 / 0.15)',     // 14
    '0 25px 50px -12px rgb(0 0 0 / 0.18)',     // 15
    '0 25px 50px -12px rgb(0 0 0 / 0.20)',     // 16
    '0 25px 50px -12px rgb(0 0 0 / 0.22)',     // 17
    '0 25px 50px -12px rgb(0 0 0 / 0.24)',     // 18
    '0 25px 50px -12px rgb(0 0 0 / 0.26)',     // 19
    '0 25px 50px -12px rgb(0 0 0 / 0.28)',     // 20
    '0 25px 50px -12px rgb(0 0 0 / 0.30)',     // 21
    '0 25px 50px -12px rgb(0 0 0 / 0.32)',     // 22
    '0 25px 50px -12px rgb(0 0 0 / 0.34)',     // 23
    '0 25px 50px -12px rgb(0 0 0 / 0.36)',     // 24
  ],

  components: {
    // リップル（波紋アニメ）はMUIらしさの最大要因の一つ。全体で無効化する。
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,  // ボタンの影をなくす
      },
      styleOverrides: {
        root: {
          textTransform: 'none', // 大文字変換をなくす
          fontWeight: 500,
          borderRadius: 6,
        },
        // アウトラインボタンは枠線を細く・落ち着いた色に
        outlined: {
          borderColor: '#cbd5e1', // slate-300
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#f1f5f9', // Tailwind slate-100
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          color: '#475569', // Tailwind slate-600
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        // 丸すぎる（pill）とMUIバッジ感が強いので角丸を控えめに
        root: {
          borderRadius: 4,
          fontWeight: 500,
        },
      },
    },
    // 入力欄の角丸を揃える
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    // AppBarのグラデ/影を排除（フラットに）
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'default',
      },
    },
    // ツールチップは黒箱すぎるMUI標準を少し落ち着かせる
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b',
          fontSize: '0.75rem',
        },
      },
    },
    // 【Switchが白背景に同化する問題への対処】原因は上のshadows配列を全体的に
    // 薄く上書きしたことで、Switchのthumbの既定シャドウ(theme.shadows[1]依存)まで
    // 薄くなってしまったため。thumbに固定のシャドウを与え、OFF時のtrackも
    // 既定の低opacityのままだと白背景でほぼ見えないので不透明な色を明示する
    MuiSwitch: {
      styleOverrides: {
        track: {
          opacity: 1,
          backgroundColor: '#cbd5e1', // slate-300
        },
        thumb: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px 0 rgb(0 0 0 / 0.2)',
        },
      },
    },
    // DataGridの列表示パネルにある検索欄を消す。列数がどの画面も15個程度で
    // 検索するまでもなく、かつパネルはPopper経由でDataGridの外（documentの
    // 別階層）にポータル描画されるため、DataGrid個別のsxでは届かず全体で
    // 上書きする必要がある（2026-08-05）
    MuiDataGrid: {
      styleOverrides: {
        columnsManagementHeader: { display: 'none' },
        // 【ヘッダーがbodyと同化する問題への対処】背景色は上のpalette.DataGrid.headerBg
        // で設定済み（CSS変数経由のためstyleOverridesでは効かない）。文字色はここで
        // MuiTableHeadと同じ配色に揃える
        columnHeader: {
          fontWeight: 600,
          color: '#475569', // Tailwind slate-600
        },
        columnHeaders: {
          borderBottom: '1px solid #cbd5e1', // Tailwind slate-300。背景色だけでなく境界線でも区切る
        },
      },
    },
    // ダイアログ各部の既定余白が窮屈なので広げる（MUI標準のstyleOverridesの範囲）
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '20px 28px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '20px 28px',
          // MUI既定は直前にDialogTitleがあるとpaddingTopを0にするが、
          // タイトルとの間の余白が窮屈になるためこの画面では明示的に確保する
          '.MuiDialogTitle-root + &': {
            paddingTop: 20,
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 28px',
          gap: 8,
        },
      },
    },
  },
})

export default theme
