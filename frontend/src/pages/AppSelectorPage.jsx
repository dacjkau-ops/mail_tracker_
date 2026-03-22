import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  CalendarMonth as CalendarMonthIcon,
  Logout as LogoutIcon,
  MailOutline as MailOutlineIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const appCards = [
  {
    key: 'mails',
    title: 'Mail Tracker',
    description: 'Track inward mail, assignments, remarks, closures, and audit history.',
    icon: MailOutlineIcon,
    path: '/mails',
    accent: 'linear-gradient(135deg, #0f4c81 0%, #4678a5 100%)',
  },
  {
    key: 'returns',
    title: 'Calendar of Returns',
    description: 'View month-wise pending returns, submission history, and delay summaries by section.',
    icon: CalendarMonthIcon,
    path: '/returns',
    accent: 'linear-gradient(135deg, #6b2c3f 0%, #b45b57 100%)',
  },
];

const AppSelectorPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sectionLabels = user?.sections_list?.map((section) => section.name) || [];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: 6,
        background:
          'radial-gradient(circle at top left, rgba(107,44,63,0.14), transparent 35%), linear-gradient(180deg, #f7f2ec 0%, #eef2f5 100%)',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            mb: 5,
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Shared Sign In
            </Typography>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
              Office Workflow Portal
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
              Choose the module you want to work in. Mail tracking and returns share the same
              login, user roles, and office sections, but run independently.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Chip
              label={user?.actual_role || user?.role || 'User'}
              color="secondary"
              sx={{ fontWeight: 600 }}
            />
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout}>
              Logout
            </Button>
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 4 }}>
          <Chip label={user?.full_name || user?.username || 'User'} variant="outlined" />
          {sectionLabels.length > 0 ? (
            sectionLabels.map((label) => (
              <Chip key={label} label={label} variant="outlined" color="primary" />
            ))
          ) : (
            <Chip label="No section restriction" variant="outlined" color="default" />
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 3,
          }}
        >
          {appCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.key}
                sx={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  minHeight: 260,
                  boxShadow: '0 24px 60px rgba(35, 40, 47, 0.08)',
                }}
              >
                <CardActionArea
                  onClick={() => navigate(card.path)}
                  sx={{
                    height: '100%',
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    background: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.98) 100%), ${card.accent}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      background: card.accent,
                      boxShadow: '0 16px 30px rgba(0,0,0,0.12)',
                    }}
                  >
                    <Icon sx={{ fontSize: 36 }} />
                  </Box>

                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      {card.description}
                    </Typography>
                    <Typography variant="button" color="primary">
                      Open module
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default AppSelectorPage;

