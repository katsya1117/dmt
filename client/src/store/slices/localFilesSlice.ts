import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type LocalFilesState = {
  fileNames: string[]
}

const initialState: LocalFilesState = {
  fileNames: [],
}

export const localFilesSlice = createSlice({
  name: 'localFiles',
  initialState,
  reducers: {
    setFileNames(state, action: PayloadAction<string[]>) {
      state.fileNames = action.payload
    },
    clearFileNames(state) {
      state.fileNames = []
    },
  },
})

export const { setFileNames, clearFileNames } = localFilesSlice.actions
export default localFilesSlice.reducer
