import { createTheme } from '@mui/material/styles'

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
  },
})

export default theme
