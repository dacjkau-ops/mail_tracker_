import React, { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  CircularProgress,
  Link,
  Divider,
} from '@mui/material';
import { Mail as MailIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { PALETTE } from '../utils/constants';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.successMessage || '';
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.username, formData.password);

    if (result.success) {
      navigate('/apps');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: 4,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 1,
            backgroundColor: PALETTE.paper,
          }}
        >
          {/* Header with icon */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                backgroundColor: PALETTE.subtle,
                border: `1px solid ${PALETTE.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <MailIcon sx={{ color: PALETTE.burgundy, fontSize: 24 }} />
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: '1.5rem',
                fontWeight: 500,
                color: PALETTE.textPrimary,
                letterSpacing: '-0.02em',
                mb: 1,
              }}
            >
              Mail Tracker
            </Typography>
            <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
              Government Office Workflow System
            </Typography>
          </Box>

          {/* Alerts */}
          {successMessage && (
            <Alert
              severity="success"
              sx={{
                mb: 3,
                border: `1px solid ${PALETTE.green}`,
                backgroundColor: 'rgba(93, 122, 93, 0.08)',
                color: PALETTE.textPrimary,
                '& .MuiAlert-icon': { color: PALETTE.green },
              }}
            >
              {successMessage}
            </Alert>
          )}

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                border: `1px solid ${PALETTE.dotRed}`,
                backgroundColor: 'rgba(139, 42, 42, 0.05)',
                color: PALETTE.textPrimary,
                '& .MuiAlert-icon': { color: PALETTE.dotRed },
              }}
            >
              {error}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              autoFocus
              disabled={loading}
              size="small"
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: PALETTE.cream,
                },
              }}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading}
              size="small"
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: PALETTE.cream,
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="medium"
              disabled={loading}
              sx={{
                py: 1,
                textTransform: 'none',
                fontWeight: 500,
                backgroundColor: PALETTE.burgundy,
                '&:hover': {
                  backgroundColor: PALETTE.burgundyDark,
                },
                '&:disabled': {
                  backgroundColor: PALETTE.borderDark,
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} thickness={3} sx={{ color: '#fff' }} />
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer links */}
          <Divider sx={{ my: 3, borderColor: PALETTE.border }} />

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
            <Link
              component={RouterLink}
              to="/signup"
              sx={{
                fontSize: '0.875rem',
                color: PALETTE.textSecondary,
                textDecoration: 'none',
                '&:hover': {
                  color: PALETTE.burgundy,
                },
              }}
            >
              Request Account
            </Link>
            <Link
              component={RouterLink}
              to="/change-password"
              sx={{
                fontSize: '0.875rem',
                color: PALETTE.textSecondary,
                textDecoration: 'none',
                '&:hover': {
                  color: PALETTE.burgundy,
                },
              }}
            >
              Change Password
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
