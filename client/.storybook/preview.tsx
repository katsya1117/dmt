import type { Preview } from '@storybook/react-vite'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { initialize, mswLoader } from 'msw-storybook-addon'
import theme from '../src/theme'
import { handlers } from '../src/mocks/handlers'
import '../src/index.css'

initialize({ onUnhandledRequest: 'bypass' })

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    msw: { handlers },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
}

export default preview
