import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Meetings from './pages/Meetings';
import MeetingRoom from './pages/MeetingRoom';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Settings from './pages/Settings';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="meetings/:uuid" element={<MeetingRoom />} />
        <Route path="patients" element={<Patients />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
