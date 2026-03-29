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

// Institutional Color Palette
// Primary: Burgundy/Wine for authority and premium feel
// Background: Warm off-white for deliberate, non-template look
// Accent: Amber/Gold used sparingly for emphasis only

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6B1A1A',      // Burgundy/Wine - institutional, premium
      light: '#8B2A2A',
      dark: '#4A1212',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#B8860B',      // Dark Goldenrod/Amber - used sparingly
      light: '#D4A020',
      dark: '#8B6508',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FAFAF8',   // Off-white/Cream - warm, deliberate
      paper: '#FFFFFF',      // Pure white for cards
    },
    text: {
      primary: '#2D3436',    // Charcoal for strong contrast
      secondary: '#636E72',  // Muted gray for secondary text
      disabled: '#B2BEC3',
    },
    success: {
      main: '#5D7A5D',       // Muted green - not bright
      light: '#7A9A7A',
      dark: '#4A5F4A',
    },
    warning: {
      main: '#B8860B',         // Amber for warnings (same as secondary)
      light: '#D4A020',
      dark: '#8B6508',
    },
    error: {
      main: '#8B2A2A',         // Dark red, not bright
      light: '#A84A4A',
      dark: '#6B1A1A',
    },
    divider: '#E8E6E3',        // Warm gray divider
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.025em',
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '0.9375rem',   // 15px - slightly larger for readability
      lineHeight: 1.6,
      letterSpacing: '0',
    },
    body2: {
      fontSize: '0.875rem',    // 14px
      lineHeight: 1.6,
      letterSpacing: '0',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      letterSpacing: '0.01em',
      textTransform: 'none',   // No uppercase - more refined
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      letterSpacing: '0.02em',
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 4,           // Soft, not sharp, not rounded
  },
  spacing: 8,
  shadows: [
    'none',
    '0 1px 2px rgba(45, 52, 54, 0.04)',   // Subtle
    '0 1px 3px rgba(45, 52, 54, 0.06)',   // Cards
    '0 2px 4px rgba(45, 52, 54, 0.06)',   // Elevated
    '0 2px 8px rgba(45, 52, 54, 0.08)',   // Modals
    '0 4px 12px rgba(45, 52, 54, 0.08)',  // Dialogs
    ...Array(19).fill('0 8px 24px rgba(45, 52, 54, 0.12)'), // Rest are heavier but rarely used
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#FAFAF8',
          fontFeatureSettings: '"cv11", "ss01"', // Inter font features
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#2D3436',
          borderBottom: '1px solid #E8E6E3',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          boxShadow: '0 1px 3px rgba(45, 52, 54, 0.06)',
        },
        elevation0: {
          border: '1px solid #E8E6E3',
          boxShadow: 'none',
        },
        elevation1: {
          border: '1px solid #E8E6E3',
          boxShadow: '0 1px 3px rgba(45, 52, 54, 0.06)',
        },
        elevation2: {
          border: '1px solid #E8E6E3',
          boxShadow: '0 2px 4px rgba(45, 52, 54, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: '#D3D0CB',
          '&:hover': {
            borderColor: '#B8B5AF',
            backgroundColor: '#F5F4F2',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          fontSize: '0.8125rem',
        },
        filled: {
          backgroundColor: '#F5F4F2',
          color: '#636E72',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            backgroundColor: '#FFFFFF',
            '& fieldset': {
              borderColor: '#D3D0CB',
            },
            '&:hover fieldset': {
              borderColor: '#B8B5AF',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6B1A1A',
              borderWidth: '1px',
            },
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: '1px solid #E8E6E3',
          borderRadius: 4,
          boxShadow: '0 1px 3px rgba(45, 52, 54, 0.06)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#F5F4F2',
          '& .MuiTableCell-root': {
            fontWeight: 600,
            color: '#2D3436',
            borderBottom: '1px solid #E8E6E3',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E8E6E3',
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#FAFAF8',
          },
          '&:last-child .MuiTableCell-root': {
            borderBottom: 'none',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#E8E6E3',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: '1px solid #E8E6E3',
          boxShadow: '0 4px 12px rgba(45, 52, 54, 0.08)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: '1px solid #E8E6E3',
          boxShadow: '0 4px 12px rgba(45, 52, 54, 0.08)',
        },
      },
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
