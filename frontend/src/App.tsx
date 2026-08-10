import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, HOME_BY_ROLE, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { AppShell } from './layouts/AppShell';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/StudentDashboard';
import { StudentJobs } from './pages/StudentJobs';
import { StudentApplications } from './pages/StudentApplications';
import { StudentProfile } from './pages/StudentProfile';
import { HrDashboard } from './pages/HrDashboard';
import { HrJobs } from './pages/HrJobs';
import { HrPipeline } from './pages/HrPipeline';
import { OfficerDashboard } from './pages/OfficerDashboard';
import { OfficerProfiles } from './pages/OfficerProfiles';
import { OfficerRecruiters } from './pages/OfficerRecruiters';
import { RecruiterSignup } from './pages/RecruiterSignup';
import { OfficerApprovals } from './pages/OfficerApprovals';
import { OfficerApplications } from './pages/OfficerApplications';
import { OfficerResults } from './pages/OfficerResults';
import { CellRoster } from './pages/CellRoster';
import { AlumniEndorse } from './pages/AlumniEndorse';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function LandingRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recruiter-signup" element={<RecruiterSignup />} />
            <Route path="/" element={<LandingRedirect />} />

            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route path="/student/home" element={<StudentDashboard />} />
              <Route path="/student/jobs" element={<StudentJobs />} />
              <Route path="/student/applications" element={<StudentApplications />} />
              <Route path="/student/profile" element={<StudentProfile />} />

              <Route path="/hr/home" element={<HrDashboard />} />
              <Route path="/hr/jobs" element={<HrJobs />} />
              <Route path="/hr/jobs/:jobId/pipeline" element={<HrPipeline />} />

              <Route path="/officer/home" element={<OfficerDashboard />} />
              <Route path="/officer/approvals" element={<OfficerApprovals />} />
              <Route path="/officer/applications" element={<OfficerApplications />} />
              <Route path="/officer/results" element={<OfficerResults />} />
              <Route path="/officer/profiles" element={<OfficerProfiles />} />
              <Route path="/officer/recruiters" element={<OfficerRecruiters />} />
              <Route path="/officer/roster" element={<CellRoster />} />

              <Route path="/cell/roster" element={<CellRoster />} />

              <Route path="/alumni/endorse" element={<AlumniEndorse />} />
            </Route>

            <Route path="*" element={<LandingRedirect />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
