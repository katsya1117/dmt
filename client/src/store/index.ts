import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import authReducer from './slices/authSlice'
import jobsReducer from './slices/jobsSlice'
import localFilesReducer from './slices/localFilesSlice'
import { masterApi } from './services/masterApi'
import { accountAuthApi } from './services/accountAuthApi'

// ストーリー/テストごとに独立したキャッシュを持たせるためファクトリ関数にする
// （singletonの store を使い回すと、前のストーリーのRTK Queryキャッシュが漏れる）
export function createStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      jobs: jobsReducer,
      localFiles: localFilesReducer,
      [masterApi.reducerPath]: masterApi.reducer,
      [accountAuthApi.reducerPath]: accountAuthApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // queryFnでapi/*.tsの ApiError（クラスインスタンス）をそのままキャッシュに
        // 乗せているため、この2スライスだけシリアライズ可能チェックの対象外にする
        serializableCheck: {
          ignoredPaths: [masterApi.reducerPath, accountAuthApi.reducerPath],
        },
      }).concat(masterApi.middleware, accountAuthApi.middleware),
  })
}

export const store = createStore()

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
