export type Katashiki = {
  id: string
  label: string
}

export type KatashikiFile = {
  name: string
  ext: string
  label: string
  size: number
}

export type UploadResult = {
  success: boolean
  message?: string
}
