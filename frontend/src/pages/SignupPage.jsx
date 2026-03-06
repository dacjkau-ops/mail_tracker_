import React, { useEffect, useMemo, useState } from 'react';
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
  MenuItem,
} from '@mui/material';
import authService from '../services/authService';

const SignupPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    confirm_password: '',
    requested_role: '',
    section_id: '',
    subsection_id: '',
  });
  const [roles, setRoles] = useState([]);
  const [sections, setSections] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await authService.getSignupMetadata();
        setRoles(data.roles || []);
        setSections(data.sections || []);
      } catch (err) {
        const message = err.response?.data?.detail || 'Failed to load signup metadata.';
        setError(message);
      } finally {
        setMetaLoading(false);
      }
    };
    loadMetadata();
  }, []);

  const availableSubsections = useMemo(() => {
    if (!formData.section_id) return [];
    const selected = sections.find((s) => String(s.id) === String(formData.section_id));
    return selected?.subsections || [];
  }, [sections, formData.section_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'section_id') {
        next.subsection_id = '';
      }
      return next;
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitLoading(true);
    try {
      await authService.signup({
        username: formData.username.trim(),
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        password: formData.password,
        requested_role: formData.requested_role,
        section_id: Number(formData.section_id),
        subsection_id: Number(formData.subsection_id),
      });

      navigate('/login', {
        replace: true,
        state: {
          successMessage: 'Signup request submitted. Please wait for superuser approval before login.',
        },
      });
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === 'string') {
        setError(data);
      } else if (data?.detail) {
        setError(data.detail);
      } else if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        const firstValue = data[firstKey];
        if (Array.isArray(firstValue)) {
          setError(firstValue[0]);
        } else {
          setError(String(firstValue));
        }
      } else {
        setError('Signup request failed. Please check your inputs and try again.');
      }
    } finally {
      setSubmitLoading(false);
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
          py: 3,
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 560 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 1 }}>
              Request Account
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
              Submit your details for superuser approval
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {metaLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Full Name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  margin="normal"
                  required
                  disabled={submitLoading}
                />
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  margin="normal"
                  required
                  disabled={submitLoading}
                />
                <TextField
                  fullWidth
                  label="Official Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  margin="normal"
                  required
                  disabled={submitLoading}
                />
                <TextField
                  select
                  fullWidth
                  label="Requested Role"
                  name="requested_role"
                  value={formData.requested_role}
                  onChange={handleChange}
                  margin="normal"
                  required
                  disabled={submitLoading}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Section"
                  name="section_id"
                  value={formData.section_id}
                  onChange={handleChange}
                  margin="normal"
                  required
                  disabled={submitLoading}
                >
                  {sections.map((section) => (
                    <MenuItem key={section.id} value={section.id}>
                      {section.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Subsection"
                  name="subsection_id"
                  value={formData.subsection_id}
                  onChange={handleChange}
                  margin="normal"
                  required
                  disabled={submitLoading || !formData.section_id}
                >
                  {availableSubsections.map((subsection) => (
                    <MenuItem key={subsection.id} value={subsection.id}>
                      {subsection.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  margin="normal"
                  required
                  inputProps={{ minLength: 8 }}
                  disabled={submitLoading}
                />
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirm_password"
                  type="password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  margin="normal"
                  required
                  inputProps={{ minLength: 8 }}
                  disabled={submitLoading}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  sx={{ mt: 3 }}
                  disabled={submitLoading || metaLoading}
                >
                  {submitLoading ? <CircularProgress size={24} /> : 'Submit Signup Request'}
                </Button>
              </form>
            )}

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

export default SignupPage;
