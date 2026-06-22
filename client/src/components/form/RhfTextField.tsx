import { Controller, FieldValues, Control, Path } from 'react-hook-form'
import TextField, { TextFieldProps } from '@mui/material/TextField'

type Props<T extends FieldValues> = {
  name: Path<T>
  control: Control<T>
} & Omit<TextFieldProps, 'name' | 'error' | 'value' | 'onChange'>

/**
 * React Hook Form と MUI TextField をつなぐ汎用フィールド。
 * バリデーションエラーは自動で helperText に表示される。
 * 全CRUDフォームはこのコンポーネントを使う。
 */
export function RhfTextField<T extends FieldValues>({ name, control, ...textFieldProps }: Props<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...textFieldProps}
          {...field}
          value={field.value ?? ''}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? textFieldProps.helperText}
        />
      )}
    />
  )
}
