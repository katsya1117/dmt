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

// アップロード
import ServiceNewsUpload from './pages/ServiceNewsUpload'
import BookletUpload from './pages/BookletUpload'
import VehicleDbUpload from './pages/VehicleDbUpload'
import VehicleContentUpload from './pages/VehicleContentUpload'
import CommonContentUpload from './pages/CommonContentUpload'
import ApplicationUpload from './pages/ApplicationUpload'

// ログ閲覧
import LogViewer from './pages/LogViewer'

// メンテナンス
import VehicleTable from './pages/VehicleTable'
import NoticeTable from './pages/NoticeTable'
import AccountAuthTable from './pages/AccountAuthTable'
import RoleTable from './pages/RoleTable'
import UserRoleTable from './pages/UserRoleTable'
import AdminTable from './pages/AdminTable'
import AppUpdateTable from './pages/AppUpdateTable'
import ProductionInfoTable from './pages/ProductionInfoTable'
import VehicleFileTable from './pages/VehicleFileTable'
import SystemNameTable from './pages/SystemNameTable'
import KatashikiNameTable from './pages/KatashikiNameTable'
import KatashikiVehicleIdTable from './pages/KatashikiVehicleIdTable'

// データ出力
import OfflineUpdateCreate from './pages/OfflineUpdateCreate'
import HtmlFileCreate from './pages/HtmlFileCreate'
import DeliveryDataCreate from './pages/DeliveryDataCreate'
import VehicleListHtmlCreate from './pages/VehicleListHtmlCreate'

// 故障診断
import DiagnosisInstallFile from './pages/DiagnosisInstallFile'
import SecurityAuthManage from './pages/SecurityAuthManage'
import ReproFileMaintenance from './pages/ReproFileMaintenance'

// 環境設定
import ConnectionSettings from './pages/ConnectionSettings'

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

            {/* アップロード */}
            <Route path="/upload/service-news" element={<ServiceNewsUpload />} />
            <Route path="/upload/booklet" element={<BookletUpload />} />
            <Route path="/upload/vehicle-db" element={<VehicleDbUpload />} />
            <Route path="/upload/vehicle-content" element={<VehicleContentUpload />} />
            <Route path="/upload/common-content" element={<CommonContentUpload />} />
            <Route path="/upload/application" element={<ApplicationUpload />} />

            {/* ログ閲覧（単一画面） */}
            <Route path="/log" element={<LogViewer />} />

            {/* メンテナンス */}
            <Route path="/master/vehicle" element={<VehicleTable />} />
            <Route path="/master/notice" element={<NoticeTable />} />
            <Route path="/master/account-auth" element={<AccountAuthTable />} />
            <Route path="/master/role" element={<RoleTable />} />
            <Route path="/master/user-role" element={<UserRoleTable />} />
            <Route path="/master/admin" element={<AdminTable />} />
            <Route path="/master/app-update" element={<AppUpdateTable />} />
            <Route path="/master/production-info" element={<ProductionInfoTable />} />
            <Route path="/master/vehicle-file" element={<VehicleFileTable />} />
            <Route path="/master/system-name" element={<SystemNameTable />} />
            <Route path="/master/katashiki-name" element={<KatashikiNameTable />} />
            <Route path="/master/katashiki-vehicle-id" element={<KatashikiVehicleIdTable />} />

            {/* データ出力 */}
            <Route path="/output/offline-update" element={<OfflineUpdateCreate />} />
            <Route path="/output/html" element={<HtmlFileCreate />} />
            <Route path="/output/delivery" element={<DeliveryDataCreate />} />
            <Route path="/output/vehicle-list-html" element={<VehicleListHtmlCreate />} />

            {/* 故障診断 */}
            <Route path="/diagnosis/install-file" element={<DiagnosisInstallFile />} />
            <Route path="/diagnosis/security-auth" element={<SecurityAuthManage />} />
            <Route path="/diagnosis/repro-file" element={<ReproFileMaintenance />} />

            {/* 環境設定 */}
            <Route path="/settings/connection" element={<ConnectionSettings />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
      </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  )
}
