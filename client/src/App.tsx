import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box'
import { Provider as ReduxProvider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { store } from './store'
import { queryClient } from './lib/queryClient'
import theme from './theme'
import Header from './components/Header'

import ServiceNewsUpload from './pages/ServiceNewsUpload'
import VehicleContentUpload from './pages/VehicleContentUpload'
import CommonContentUpload from './pages/CommonContentUpload'

import VehicleTable from './pages/VehicleTable'
import KatashikiNameTable from './pages/KatashikiNameTable'
import AppUpdateTable from './pages/AppUpdateTable'
import ProductionInfoTable from './pages/ProductionInfoTable'
import VehicleFileTable from './pages/VehicleFileTable'
import KatashikiVehicleIdTable from './pages/KatashikiVehicleIdTable'
import VehicleNoKatashikiTable from './pages/VehicleNoKatashikiTable'
import EIdSystemTable from './pages/EIdSystemTable'

import NoticeUpdate from './pages/NoticeUpdate'
import D3SecurityAuth from './pages/D3SecurityAuth'
import D3LibroFile from './pages/D3LibroFile'

import RoleManagement from './pages/RoleManagement'
import UserRoleManagement from './pages/UserRoleManagement'
import AdminTable from './pages/AdminTable'

import OfflineUpdateCreate from './pages/OfflineUpdateCreate'
import HtmlDeliveryCreate from './pages/HtmlDeliveryCreate'
import SmsVehicleExport from './pages/SmsVehicleExport'

import ElectronicManualLog from './pages/ElectronicManualLog'
import HtmlManualLog from './pages/HtmlManualLog'

export default function App() {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
    <BrowserRouter>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Header />
        <Box component="main">
          <Routes>
            <Route path="/" element={<Navigate to="/upload/service-news" replace />} />

            <Route path="/upload/service-news" element={<ServiceNewsUpload />} />
            <Route path="/upload/vehicle-content" element={<VehicleContentUpload />} />
            <Route path="/upload/common-content" element={<CommonContentUpload />} />

            <Route path="/master/vehicle" element={<VehicleTable />} />
            <Route path="/master/katashiki-name" element={<KatashikiNameTable />} />
            <Route path="/master/app-update" element={<AppUpdateTable />} />
            <Route path="/master/production-info" element={<ProductionInfoTable />} />
            <Route path="/master/vehicle-file" element={<VehicleFileTable />} />
            <Route path="/master/katashiki-vehicle-id" element={<KatashikiVehicleIdTable />} />
            <Route path="/master/vehicle-no-katashiki" element={<VehicleNoKatashikiTable />} />
            <Route path="/master/eid-system" element={<EIdSystemTable />} />

            <Route path="/settings/notice" element={<NoticeUpdate />} />
            <Route path="/settings/d3-security" element={<D3SecurityAuth />} />
            <Route path="/settings/d3-libro" element={<D3LibroFile />} />

            <Route path="/auth/roles" element={<RoleManagement />} />
            <Route path="/auth/user-roles" element={<UserRoleManagement />} />
            <Route path="/auth/admin" element={<AdminTable />} />

            <Route path="/output/offline-update" element={<OfflineUpdateCreate />} />
            <Route path="/output/html-delivery" element={<HtmlDeliveryCreate />} />
            <Route path="/output/sms-vehicle" element={<SmsVehicleExport />} />

            <Route path="/log/electronic" element={<ElectronicManualLog />} />
            <Route path="/log/html" element={<HtmlManualLog />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
      </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  )
}
