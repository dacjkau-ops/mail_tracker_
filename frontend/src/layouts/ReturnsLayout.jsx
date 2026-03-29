import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Apps as AppsIcon,
  CalendarMonth as CalendarMonthIcon,
  History as HistoryIcon,
  ViewTimeline as ViewTimelineIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { PALETTE } from '../utils/constants';

const ROLE_LABELS = {
  AG: 'AG',
  DAG: 'DAG',
  SrAO: 'Sr AO',
  AAO: 'AAO',
  auditor: 'Auditor',
  clerk: 'Clerk',
};

const getInitials = (value) => {
  const source = value?.trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
};

const navButtonSx = (active) => ({
  minHeight: 32,
  px: 1.25,
  color: active ? PALETTE.textPrimary : PALETTE.textSecondary,
  backgroundColor: active ? PALETTE.hover : 'transparent',
  fontWeight: 500,
  '&:hover': {
    backgroundColor: PALETTE.hover,
    color: PALETTE.textPrimary,
  },
});

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
  const roleLabel = user?.actual_role || ROLE_LABELS[user?.role] || user?.role || 'User';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar
          sx={{
            minHeight: 56,
            px: { xs: 2, sm: 3 },
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <CalendarMonthIcon sx={{ color: PALETTE.burgundy, fontSize: 20 }} />
            <Typography
              component="div"
              sx={{
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: PALETTE.textPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              Calendar of Returns
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexGrow: 1, ml: 1 }}>
            <Button
              color="inherit"
              startIcon={<AppsIcon sx={{ fontSize: 17 }} />}
              onClick={() => navigate('/apps')}
              sx={navButtonSx(location.pathname.startsWith('/apps'))}
            >
              Apps
            </Button>
            <Button
              color="inherit"
              startIcon={<ViewTimelineIcon sx={{ fontSize: 17 }} />}
              onClick={() => navigate('/returns')}
              sx={navButtonSx(!isHistory)}
            >
              Pending
            </Button>
            <Button
              color="inherit"
              startIcon={<HistoryIcon sx={{ fontSize: 17 }} />}
              onClick={() => navigate('/returns/history')}
              sx={navButtonSx(isHistory)}
            >
              History
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                alignItems: 'center',
                minHeight: 28,
                px: 1,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: `${PALETTE.radiusButton}px`,
                color: PALETTE.textSecondary,
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: PALETTE.paper,
              }}
            >
              {roleLabel}
            </Box>

            <IconButton
              size="small"
              onClick={handleMenu}
              sx={{
                p: 0.25,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: `${PALETTE.radiusButton}px`,
              }}
            >
              <Avatar>{getInitials(user?.full_name || user?.username)}</Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 180,
                  border: `1px solid ${PALETTE.border}`,
                  boxShadow: PALETTE.shadow,
                },
              }}
            >
              <MenuItem disabled sx={{ opacity: 1, py: 1.25 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: PALETTE.textPrimary }}>
                    {user?.full_name || user?.username}
                  </Typography>
                  <Typography variant="caption" sx={{ color: PALETTE.textSecondary }}>
                    {user?.email}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider sx={{ borderColor: PALETTE.border }} />
              <MenuItem onClick={() => { handleClose(); navigate('/apps'); }}>
                <Typography variant="body2" sx={{ color: PALETTE.textPrimary }}>
                  Switch Module
                </Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Typography variant="body2" sx={{ color: PALETTE.burgundy }}>
                  Logout
                </Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, bgcolor: PALETTE.cream }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default ReturnsLayout;
