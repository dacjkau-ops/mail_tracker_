import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AppSelectorPage from './pages/AppSelectorPage';
import MailListPage from './pages/MailListPage';
import MailDetailPage from './pages/MailDetailPage';
import CreateMailPage from './pages/CreateMailPage';
import MainLayout from './layouts/MainLayout';
import ReturnsLayout from './layouts/ReturnsLayout';
import ReturnsDashboardPage from './pages/ReturnsDashboardPage';
import ReturnsHistoryPage from './pages/ReturnsHistoryPage';

// Create MUI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route component (redirect to apps if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/apps" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />

      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/apps"
        element={
          <ProtectedRoute>
            <AppSelectorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mails"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MailListPage />} />
        <Route path="create" element={<CreateMailPage />} />
        <Route path=":id" element={<MailDetailPage />} />
      </Route>

      <Route
        path="/returns"
        element={
          <ProtectedRoute>
            <ReturnsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ReturnsDashboardPage />} />
        <Route path="history" element={<ReturnsHistoryPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/apps" replace />} />
      <Route path="*" element={<Navigate to="/apps" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
