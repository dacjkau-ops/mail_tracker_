import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActionArea,
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
import { PALETTE } from '../utils/constants';

const appCards = [
  {
    key: 'mails',
    title: 'Mail Tracker',
    description: 'Track inward mail, assignments, remarks, closures, and audit history.',
    icon: MailOutlineIcon,
    path: '/mails',
    accentColor: PALETTE.burgundy,
    accentBackground: 'rgba(107, 26, 26, 0.08)',
  },
  {
    key: 'returns',
    title: 'Calendar of Returns',
    description: 'Review pending returns, historical submissions, and delay summaries by section.',
    icon: CalendarMonthIcon,
    path: '/returns',
    accentColor: PALETTE.amber,
    accentBackground: 'rgba(146, 101, 10, 0.09)',
  },
];

const tagSx = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  px: 1,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: `${PALETTE.radiusButton}px`,
  color: PALETTE.textSecondary,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: PALETTE.paper,
};

const AppSelectorPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sectionLabels = user?.sections_list?.map((section) => section.name) || [];

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 4, sm: 6 }, backgroundColor: PALETTE.cream }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            flexWrap: 'wrap',
            mb: 4,
          }}
        >
          <Box sx={{ maxWidth: 760 }}>
            <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>
              Workflow Suite
            </Typography>
            <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 500, mb: 1 }}>
              Office Workflow Portal
            </Typography>
            <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
              Choose the module you want to work in. Mail tracking and returns share the same login,
              user roles, and office sections, with a single restrained design system across both.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ ...tagSx, color: PALETTE.burgundy, borderColor: PALETTE.border }}>
              {user?.actual_role || user?.role || 'User'}
            </Box>
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout}>
              Logout
            </Button>
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 4 }}>
          <Box sx={tagSx}>{user?.full_name || user?.username || 'User'}</Box>
          {sectionLabels.length > 0 ? (
            sectionLabels.map((label) => (
              <Box key={label} sx={tagSx}>
                {label}
              </Box>
            ))
          ) : (
            <Box sx={tagSx}>No section restriction</Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}
        >
          {appCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.key}
                sx={{
                  borderRadius: `${PALETTE.radiusCard}px`,
                  border: `1px solid ${PALETTE.border}`,
                  boxShadow: PALETTE.shadow,
                  backgroundColor: PALETTE.paper,
                }}
              >
                <CardActionArea
                  onClick={() => navigate(card.path)}
                  sx={{
                    height: '100%',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 5,
                  }}
                >
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: `${PALETTE.radiusCard}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: card.accentColor,
                      backgroundColor: card.accentBackground,
                      border: `1px solid ${PALETTE.border}`,
                    }}
                  >
                    <Icon sx={{ fontSize: 26 }} />
                  </Box>

                  <Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 500 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: PALETTE.textSecondary }}>
                      {card.description}
                    </Typography>
                    <Typography variant="body2" sx={{ color: PALETTE.burgundy, fontWeight: 500 }}>
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
