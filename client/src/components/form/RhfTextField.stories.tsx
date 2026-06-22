import type { Meta, StoryObj } from '@storybook/react-vite'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { RhfTextField } from './RhfTextField'

const schema = z.object({
  code: z.string().min(1, 'コードは必須です'),
  name: z.string().min(1, '名称は必須です'),
})

type FormValues = z.infer<typeof schema>

// RHF + Zod + MUI の最小フォーム例（CRUD画面の雛形）
function DemoForm() {
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '' },
  })

  return (
    <Box component="form" onSubmit={handleSubmit((v) => alert(JSON.stringify(v)))} sx={{ width: 360 }}>
      <Stack spacing={2}>
        <RhfTextField name="code" control={control} label="コード" size="small" fullWidth />
        <RhfTextField name="name" control={control} label="名称" size="small" fullWidth />
        <Button type="submit" variant="contained">保存</Button>
      </Stack>
    </Box>
  )
}

const meta: Meta<typeof DemoForm> = {
  title: 'form/RhfTextField',
  component: DemoForm,
}
export default meta

type Story = StoryObj<typeof DemoForm>

export const Default: Story = {}
