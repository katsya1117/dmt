import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type JobStatus = 'idle' | 'running' | 'success' | 'error'

type Job = {
  status: JobStatus
  message: string | null
  startedAt: string | null
}

type JobsState = {
  processA: Job
  processB: Job
  upload: Record<string, Job> // 型式IDごと
}

const defaultJob = (): Job => ({ status: 'idle', message: null, startedAt: null })

const initialState: JobsState = {
  processA: defaultJob(),
  processB: defaultJob(),
  upload: {},
}

type JobKey = 'processA' | 'processB'

export const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    startJob(state, action: PayloadAction<JobKey>) {
      state[action.payload] = { status: 'running', message: null, startedAt: new Date().toISOString() }
    },
    succeedJob(state, action: PayloadAction<{ key: JobKey; message?: string }>) {
      state[action.payload.key] = { status: 'success', message: action.payload.message ?? null, startedAt: state[action.payload.key].startedAt }
    },
    failJob(state, action: PayloadAction<{ key: JobKey; message: string }>) {
      state[action.payload.key] = { status: 'error', message: action.payload.message, startedAt: state[action.payload.key].startedAt }
    },
    startUpload(state, action: PayloadAction<string>) {
      state.upload[action.payload] = { status: 'running', message: null, startedAt: new Date().toISOString() }
    },
    succeedUpload(state, action: PayloadAction<{ id: string; message?: string }>) {
      const job = state.upload[action.payload.id]
      state.upload[action.payload.id] = { status: 'success', message: action.payload.message ?? null, startedAt: job?.startedAt ?? null }
    },
    failUpload(state, action: PayloadAction<{ id: string; message: string }>) {
      const job = state.upload[action.payload.id]
      state.upload[action.payload.id] = { status: 'error', message: action.payload.message, startedAt: job?.startedAt ?? null }
    },
  },
})

export const { startJob, succeedJob, failJob, startUpload, succeedUpload, failUpload } = jobsSlice.actions
export default jobsSlice.reducer
