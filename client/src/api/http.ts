// 全APIファイル共通のaxiosインスタンス。ベースURLはViteのプロキシ設定
// （vite.config.ts の server.proxy '/api' → localhost:3001）に委ねるため空。
import axios from 'axios'

export const http = axios.create()

// axiosエラーからHTTPステータスを取り出す（無ければundefined）
export function axiosStatusOf(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined
}
