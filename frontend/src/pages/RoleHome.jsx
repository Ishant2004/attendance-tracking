import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const HOME = {
  employee: '/me',
  manager: '/team',
  leadership: '/leadership',
  admin: '/admin',
};

export default function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={HOME[user.role] || '/me'} replace />;
}