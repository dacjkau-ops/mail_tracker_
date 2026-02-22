import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  CircularProgress,
  Link,
} from '@mui/material';
import authService from '../services/authService';

const ChangePasswordPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.changePassword(
        formData.username,
        formData.current_password,
        formData.new_password,
        formData.confirm_password
      );
      navigate('/login', {
        state: {
          successMessage: 'Password changed successfully. Please log in with your new password.',
        },
      });
    } catch (err) {
      const message =
        err.response?.data?.error ||
        'Failed to change password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
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
        <Card sx={{ width: '100%', maxWidth: 500 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
              Change Password
            </Typography>

            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
              Enter your username and current password to set a new password.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

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
              />

              <TextField
                fullWidth
                label="Current Password"
                name="current_password"
                type="password"
                value={formData.current_password}
                onChange={handleChange}
                margin="normal"
                required
                disabled={loading}
              />

              <TextField
                fullWidth
                label="New Password"
                name="new_password"
                type="password"
                value={formData.new_password}
                onChange={handleChange}
                margin="normal"
                required
                disabled={loading}
                helperText="Minimum 8 characters"
              />

              <TextField
                fullWidth
                label="Confirm New Password"
                name="confirm_password"
                type="password"
                value={formData.confirm_password}
                onChange={handleChange}
                margin="normal"
                required
                disabled={loading}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Change Password'}
              </Button>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Back to Login
              </Link>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default ChangePasswordPage;
