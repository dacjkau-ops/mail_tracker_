import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material';
import {
  AccountCircle,
  Apps as AppsIcon,
  Mail as MailIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  AG: 'AG',
  DAG: 'DAG',
  SrAO: 'Sr AO',
  AAO: 'AAO',
  auditor: 'Auditor',
  clerk: 'Clerk',
};

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, canCreateMail } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/mails') {
      return location.pathname === '/mails' || location.pathname === '/mails/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: '#FFFFFF',
          color: '#2D3436',
          borderBottom: '1px solid #E8E6E3',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ minHeight: 56 }}>
          <MailIcon sx={{ mr: 1.5, color: '#6B1A1A', fontSize: 22 }} />
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 0,
              fontWeight: 600,
              fontSize: '1.125rem',
              color: '#2D3436',
              letterSpacing: '-0.01em',
              mr: 4,
            }}
          >
            Mail Tracking
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
            <Button
              color="inherit"
              startIcon={<AppsIcon sx={{ fontSize: 18 }} />}
              onClick={() => navigate('/apps')}
              sx={{
                textTransform: 'none',
                fontWeight: isActive('/apps') ? 600 : 400,
                color: isActive('/apps') ? '#6B1A1A' : '#636E72',
                '&:hover': { color: '#2D3436' },
              }}
            >
              Apps
            </Button>

            <Button
              color="inherit"
              onClick={() => navigate('/mails')}
              sx={{
                textTransform: 'none',
                fontWeight: isActive('/mails') ? 600 : 400,
                color: isActive('/mails') ? '#6B1A1A' : '#636E72',
                '&:hover': { color: '#2D3436' },
              }}
            >
              All Mails
            </Button>

            {canCreateMail() && (
              <Button
                color="inherit"
                startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                onClick={() => navigate('/mails/create')}
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive('/mails/create') ? 600 : 400,
                  color: isActive('/mails/create') ? '#6B1A1A' : '#636E72',
                  '&:hover': { color: '#2D3436' },
                }}
              >
                Create
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={user?.actual_role || ROLE_LABELS[user?.role] || user?.role || 'User'}
              size="small"
              sx={{
                backgroundColor: '#F5F4F2',
                color: '#636E72',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
                border: '1px solid #E8E6E3',
              }}
            />
            <IconButton
              size="small"
              onClick={handleMenu}
              sx={{
                color: '#636E72',
                '&:hover': { color: '#2D3436' },
              }}
            >
              <AccountCircle sx={{ fontSize: 24 }} />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 180,
                  border: '1px solid #E8E6E3',
                  boxShadow: '0 4px 12px rgba(45, 52, 54, 0.08)',
                },
              }}
            >
              <MenuItem disabled sx={{ opacity: 1 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#2D3436' }}>
                    {user?.full_name || user?.username}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#636E72' }}>
                    {user?.email}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider sx={{ my: 1, borderColor: '#E8E6E3' }} />
              <MenuItem onClick={() => { handleClose(); navigate('/change-password'); }}>
                <Typography variant="body2">Change Password</Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Typography variant="body2" sx={{ color: '#8B2A2A' }}>Logout</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          bgcolor: '#FAFAF8',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
