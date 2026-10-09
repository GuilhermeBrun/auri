import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AgendaPage } from './pages/AgendaPage'
import { PatientFormRoute } from './pages/PatientFormPage'
import { PatientsPage } from './pages/PatientsPage'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/agenda" replace />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="pacientes" element={<PatientsPage />} />
        <Route path="pacientes/novo" element={<PatientFormRoute />} />
        <Route path="pacientes/:id" element={<PatientFormRoute />} />
        <Route path="*" element={<Navigate to="/agenda" replace />} />
      </Route>
    </Routes>
  )
}

export default App
