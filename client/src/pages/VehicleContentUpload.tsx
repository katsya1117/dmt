import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import { VehicleSelectTable } from '../components/select/VehicleSelectTable'
import { KatashikiSelectTable } from '../components/select/KatashikiSelectTable'
import type { Vehicle, Katashiki } from '../api/master'

export default function VehicleContentUpload() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [katashiki, setKatashiki] = useState<Katashiki | null>(null)

  const handleVehicle = (_id: string, v: Vehicle) => {
    setVehicle(v)
    setKatashiki(null) // 車種を変えたら型式選択をリセット
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" gutterBottom>車種コンテンツ アップロード</Typography>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="h3" gutterBottom>① 車種を選択</Typography>
          <VehicleSelectTable selectedId={vehicle?.id ?? null} onSelect={handleVehicle} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="h3" gutterBottom>② 型式を選択</Typography>
          {vehicle ? (
            <KatashikiSelectTable
              vehicleId={vehicle.id}
              selectedId={katashiki?.id ?? null}
              onSelect={(_id, k) => setKatashiki(k)}
            />
          ) : (
            <Typography color="text.secondary">先に車種を選択してください</Typography>
          )}
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="body2">選択中:</Typography>
        {vehicle ? <Chip label={`車種 ${vehicle.name}`} color="primary" /> : <Chip label="車種 未選択" />}
        {katashiki ? <Chip label={`型式 ${katashiki.name}`} color="primary" /> : <Chip label="型式 未選択" />}
      </Box>
    </Box>
  )
}
