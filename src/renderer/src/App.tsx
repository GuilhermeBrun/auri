import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AgendaPage } from './pages/AgendaPage'
import { BackupPage } from './pages/BackupPage'
import { ConnectionPage } from './pages/ConnectionPage'
import { PatientFormRoute } from './pages/PatientFormPage'
import { PatientsPage } from './pages/PatientsPage'
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
        {/* cada seção das Configurações tem o seu endereço; a raiz abre a primeira */}
        <Route path="configuracoes" element={<Navigate to="aparencia" replace />} />
        <Route path="configuracoes/aparencia" element={<AppearancePage />} />
        <Route path="configuracoes/conexao" element={<ConnectionPage />} />
        <Route path="configuracoes/copia" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/agenda" replace />} />
      </Route>
    </Routes>
  )
}

export default App
