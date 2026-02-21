import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  AccountCircle,
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <MailIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Mail Tracking System
          </Typography>

          <Button
            color="inherit"
            onClick={() => navigate('/mails')}
            sx={{ mr: 2 }}
          >
            All Mails
          </Button>

          {canCreateMail() && (
            <Button
              color="inherit"
              startIcon={<AddIcon />}
              onClick={() => navigate('/mails/create')}
              sx={{ mr: 2 }}
            >
              Create Mail
            </Button>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={ROLE_LABELS[user?.role] || user?.role || 'User'}
              size="small"
              color="secondary"
            />
            <IconButton
              size="large"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem disabled>
                <Typography variant="body2">
                  {user?.full_name || user?.username}
                </Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
