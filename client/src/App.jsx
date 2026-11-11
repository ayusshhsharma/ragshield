import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PlaceholderPage
              title="Sign in"
              description="Authenticate to manage RAGShield projects and experiments."
              showAuthLinks
            />
          }
        />
        <Route
          path="/register"
          element={
            <PlaceholderPage
              title="Create account"
              description="Register a developer account."
              showAuthLinks
            />
          }
        />
      </Route>

      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <PlaceholderPage
              title="Dashboard"
              description="Overview of projects, latest baseline vs protected ASR, and recent runs."
            />
          }
        />
        <Route
          path="/projects"
          element={
            <PlaceholderPage
              title="Projects"
              description="Isolated RAG security testing workspaces."
            />
          }
        />
        <Route
          path="/projects/:id"
          element={<Navigate to="overview" replace />}
        />
        <Route
          path="/projects/:id/:tab"
          element={
            <PlaceholderPage
              title="Project Workspace"
              description="Documents, RAG config, defenses, attack library, runs, and playground."
            />
          }
        />
        <Route
          path="/runs/:id"
          element={
            <PlaceholderPage
              title="Run Detail"
              description="Metrics, outcome distribution, and per-case results."
            />
          }
        />
        <Route
          path="/experiments/:id"
          element={
            <PlaceholderPage
              title="Experiment Comparison"
              description="Side-by-side baseline vs protected metrics and defense overhead."
            />
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
