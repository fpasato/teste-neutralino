import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { AppLayout } from "./components/AppLayout";

import { AuditTab } from "./Pages/admin/audit";
import { UsersTable } from "./Pages/admin/profiles";
import { AttendantsTab } from "./Pages/admin/attendants";
import { OccurrencesTab } from "./Pages/admin/occurrences";

import { Login } from "./Pages/auth/Login";
import { Home } from "./Pages/sos/SosList";
import { SosDetail } from "./Pages/sos/SosDetail";
import { Dashboard } from "./Pages/dashboard";
import { MapView } from "./Pages/mapview";
import { startDispatchScheduler } from "./services/supabase/dispatchScheduler";

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          {/* Rotas que qualquer atendente logado e ativo pode acessar */}
          <Route
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/sos/:id" element={<SosDetail />} />
            <Route path="/mapview" element={<MapView />} />
          </Route>

          {/* Rotas restritas a admin/supervisor */}
          <Route
            element={
              <PrivateRoute allowedRoles={["admin", "supervisor"]}>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/audit" element={<AuditTab />} />
            <Route path="/profiles" element={<UsersTable />} />
            <Route path="/attendants" element={<AttendantsTab />} />
            <Route path="/sos" element={<OccurrencesTab />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;