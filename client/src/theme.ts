import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb',      // Tailwind blue-600
      light: '#3b82f6',
      dark: '#1d4ed8',
    },
    secondary: {
      main: '#64748b',      // Tailwind slate-500
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
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Hiragino Sans"',
      '"Hiragino Kaku Gothic ProN"',
      '"Noto Sans JP"',
      'sans-serif',
    ].join(','),
    fontSize: 14,
    h1: { fontSize: '1.25rem', fontWeight: 700 },
    h2: { fontSize: '1.125rem', fontWeight: 600 },
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
    MuiButton: {
      defaultProps: {
        disableElevation: true,  // ボタンの影をなくす
      },
      styleOverrides: {
        root: {
          textTransform: 'none', // 大文字変換をなくす
          fontWeight: 500,
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
    },
  },
})

export default theme
