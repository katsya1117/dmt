import { Router } from 'express'
import { listVehicles, listKatashiki } from '../repositories/master'

const router = Router()

// 車種一覧
router.get('/vehicles', (_req, res) => {
  res.json(listVehicles())
})

// 型式一覧（?vehicleId= で車種に絞り込み）
router.get('/katashiki', (req, res) => {
  const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined
  res.json(listKatashiki(vehicleId))
})

export default router
