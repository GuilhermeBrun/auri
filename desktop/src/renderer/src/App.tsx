import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AgendaPage } from './pages/AgendaPage'
import { ClinicPage } from './pages/ClinicPage'
import { FinanceCatalogPage } from './pages/FinanceCatalogPage'
import { FinancePage } from './pages/FinancePage'
import { PatientAnamneseRoute } from './pages/PatientAnamnesePage'
import { PatientFinanceRoute } from './pages/PatientFinancePage'
import { PatientFormRoute } from './pages/PatientFormPage'
import { PatientSessionsRoute } from './pages/PatientSessionsPage'
import { PatientTermsRoute } from './pages/PatientTermsPage'
import { StoragePage } from './pages/StoragePage'
import { TermModelRoute } from './pages/TermModelPage'
import { PatientsPage } from './pages/PatientsPage'
import { GeneralPage } from './pages/GeneralPage'
import { AppearancePage } from './pages/SettingsPage'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/agenda" replace />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="pacientes" element={<PatientsPage />} />
        <Route path="pacientes/novo" element={<PatientFormRoute />} />
        <Route path="pacientes/:id" element={<PatientFormRoute />} />
        <Route path="pacientes/:id/anamnese" element={<PatientAnamneseRoute />} />
        <Route path="pacientes/:id/sessoes" element={<PatientSessionsRoute />} />
        <Route path="pacientes/:id/termos" element={<PatientTermsRoute />} />
        <Route path="pacientes/:id/financeiro" element={<PatientFinanceRoute />} />
        <Route path="financeiro" element={<FinancePage />} />
        <Route path="financeiro/valores" element={<FinanceCatalogPage />} />
        <Route path="clinica" element={<ClinicPage />} />
        <Route path="clinica/termos/novo" element={<TermModelRoute />} />
        <Route path="clinica/termos/:id" element={<TermModelRoute />} />
        <Route path="configuracoes" element={<Navigate to="geral" replace />} />
        <Route path="configuracoes/geral" element={<GeneralPage />} />
        <Route path="configuracoes/aparencia" element={<AppearancePage />} />
        <Route path="configuracoes/armazenamento" element={<StoragePage />} />
        <Route path="*" element={<Navigate to="/agenda" replace />} />
      </Route>
    </Routes>
  )
}

export default App
