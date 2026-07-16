import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import RoleHome from './pages/RoleHome';
import MyAttendance from './pages/MyAttendance';
import TeamDashboard from './pages/TeamDashboard';
import LeadershipDashboard from './pages/LeadershipDashboard';
import AdminPanel from './pages/AdminPanel';
import ChangePassword from './pages/ChangePassword';
import ProtectedRoute from './auth/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Everything below requires auth and renders inside the shell */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoleHome />} />
        <Route path="/me" element={<MyAttendance />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route
          path="/team"
          element={
            <ProtectedRoute roles={['manager', 'leadership', 'admin']}>
              <TeamDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leadership"
          element={
            <ProtectedRoute roles={['leadership', 'admin']}>
              <LeadershipDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}