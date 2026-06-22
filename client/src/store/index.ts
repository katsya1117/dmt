import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import authReducer from './slices/authSlice'
import jobsReducer from './slices/jobsSlice'
import localFilesReducer from './slices/localFilesSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    jobs: jobsReducer,
    localFiles: localFilesReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
