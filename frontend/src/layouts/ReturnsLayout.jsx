import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  AccountCircle,
  Apps as AppsIcon,
  CalendarMonth as CalendarMonthIcon,
  History as HistoryIcon,
  ViewTimeline as ViewTimelineIcon,
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

const ReturnsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
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

  const isHistory = location.pathname.startsWith('/returns/history');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <CalendarMonthIcon sx={{ mr: 2, color: '#8c3b45' }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary', fontWeight: 700 }}>
            Calendar of Returns
          </Typography>

          <Button color="inherit" startIcon={<AppsIcon />} onClick={() => navigate('/apps')} sx={{ mr: 1 }}>
            Apps
          </Button>
          <Button
            color="inherit"
            startIcon={<ViewTimelineIcon />}
            onClick={() => navigate('/returns')}
            sx={{ mr: 1, fontWeight: !isHistory ? 700 : 500 }}
          >
            Pending
          </Button>
          <Button
            color="inherit"
            startIcon={<HistoryIcon />}
            onClick={() => navigate('/returns/history')}
            sx={{ mr: 2, fontWeight: isHistory ? 700 : 500 }}
          >
            History
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={user?.actual_role || ROLE_LABELS[user?.role] || user?.role || 'User'}
              size="small"
              color="secondary"
            />
            <IconButton size="large" onClick={handleMenu} color="inherit">
              <AccountCircle />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
              <MenuItem disabled>
                <Typography variant="body2">{user?.full_name || user?.username}</Typography>
              </MenuItem>
              <MenuItem onClick={() => { handleClose(); navigate('/apps'); }}>
                Switch Module
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f6f7fb' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default ReturnsLayout;

