import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import returnsService from '../services/returnsService';
import { formatDate } from '../utils/dateHelpers';
import { OverdueBadge } from '../components/StatusIndicator';
import { useAuth } from '../context/AuthContext';
import { PALETTE } from '../utils/constants';

const getCurrentPeriodValue = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const parsePeriod = (value) => {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
};

const summaryCards = [
  { key: 'total_count', label: 'Total Due', color: PALETTE.textPrimary },
  { key: 'pending_count', label: 'Pending', color: PALETTE.amber },
  { key: 'submitted_count', label: 'Submitted', color: PALETTE.green },
  { key: 'overdue_count', label: 'Overdue', color: PALETTE.dotRed },
];

const frequencyText = {
  monthly: PALETTE.textPrimary,
  quarterly: PALETTE.amber,
  annual: PALETTE.textSecondary,
};

const DotLabel = ({ label, dotColor, textColor, fontWeight = 400 }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
    <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dotColor }} />
    <Typography sx={{ fontSize: 12, color: textColor, fontWeight }}>
      {label}
    </Typography>
  </Box>
);

const ReturnsDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState(getCurrentPeriodValue);
  const [selectedSection, setSelectedSection] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState(null);

  const isSectionSelectable = user?.role === 'AG' || user?.role === 'DAG';
  const { year, month } = useMemo(() => parsePeriod(period), [period]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await returnsService.getDashboard({
          year,
          month,
          section: selectedSection || undefined,
        });
        if (!active) return;
        setDashboard(data);
      } catch (loadError) {
        if (!active) return;
        setError('Failed to load the current returns dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [year, month, selectedSection]);

  const handleSubmit = async (entryId) => {
    setSubmittingId(entryId);
    try {
      await returnsService.submitReturnEntry(entryId);
      const refreshed = await returnsService.getDashboard({
        year,
        month,
        section: selectedSection || undefined,
      });
      setDashboard(refreshed);
    } catch (submitError) {
      setError(submitError.response?.data?.error || 'Failed to mark the return as submitted.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleOpenHistory = () => {
    const query = new URLSearchParams({ period });
    if (selectedSection) query.append('section', selectedSection);
    navigate(`/returns/history?${query.toString()}`);
  };

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2,
          border: `1px solid ${PALETTE.border}`,
          boxShadow: PALETTE.shadow,
        }}
      >
        <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>
          Current Filing Window
        </Typography>
        <Typography component="h1" sx={{ fontSize: '16px', fontWeight: 500, mb: 0.75 }}>
          Calendar of Returns
        </Typography>
        <Typography variant="body2" sx={{ maxWidth: 760, color: PALETTE.textSecondary }}>
          Track section-wise pending reports for the current month. Submitted items move into the
          archive with their processed date and user log.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          border: `1px solid ${PALETTE.border}`,
          boxShadow: PALETTE.shadow,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel shrink htmlFor="returns-period">
              Month
            </InputLabel>
            <Box
              component="input"
              id="returns-period"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              sx={{
                height: 40,
                px: 1.5,
                borderRadius: `${PALETTE.radiusButton}px`,
                border: `1px solid ${PALETTE.border}`,
                font: 'inherit',
                color: PALETTE.textPrimary,
                backgroundColor: PALETTE.paper,
              }}
            />
          </FormControl>

          {isSectionSelectable && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Section</InputLabel>
              <Select
                value={selectedSection}
                label="Section"
                onChange={(event) => setSelectedSection(event.target.value)}
              >
                <MenuItem value="">All Sections</MenuItem>
                {(dashboard?.available_sections || []).map((section) => (
                  <MenuItem key={section.id} value={String(section.id)}>
                    {section.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button variant="outlined" startIcon={<HistoryIcon />} onClick={handleOpenHistory} sx={{ ml: 'auto' }}>
            Open History
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="240px">
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
              gap: 2,
              mb: 2,
            }}
          >
            {summaryCards.map((card) => (
              <Paper
                key={card.key}
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${PALETTE.border}`,
                  boxShadow: PALETTE.shadow,
                }}
              >
                <Typography variant="body2" sx={{ color: PALETTE.textSecondary, mb: 0.5 }}>
                  {card.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 500, color: card.color }}>
                  {dashboard?.summary?.[card.key] ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>
                  {dashboard?.month_label || ''}
                </Typography>
              </Paper>
            ))}
          </Box>

          {isSectionSelectable && (dashboard?.section_overview?.length || 0) > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ mb: 1.25, fontSize: '14px', fontWeight: 500, color: PALETTE.textPrimary }}>
                Section Overview
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {dashboard.section_overview.map((section) => (
                  <Paper
                    key={section.section}
                    elevation={0}
                    sx={{
                      p: 2,
                      border: `1px solid ${PALETTE.border}`,
                      boxShadow: PALETTE.shadow,
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                      {section.section_name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                      Pending: {section.pending_count}
                    </Typography>
                    <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                      Submitted: {section.submitted_count}
                    </Typography>
                    <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                      Overdue: {section.overdue_count}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: `1px solid ${PALETTE.border}`,
              boxShadow: PALETTE.shadow,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
                mb: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: PALETTE.textPrimary }}>
                  Pending Returns
                </Typography>
                <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                  {dashboard?.month_label}
                </Typography>
              </Box>
              {dashboard?.selected_section && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 28,
                    px: 1,
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: `${PALETTE.radiusButton}px`,
                    color: PALETTE.textSecondary,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  {dashboard.selected_section.name}
                </Box>
              )}
            </Box>

            {(dashboard?.entries?.length || 0) === 0 ? (
              dashboard?.summary?.total_count ? (
                <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="inherit" />}>
                  All returns for {dashboard.month_label} have been submitted. Use history to review
                  processed dates and delays.
                </Alert>
              ) : (
                <Alert severity="info">
                  No return definitions are scheduled for this month in the selected section scope.
                </Alert>
              )
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Report</TableCell>
                      <TableCell>Frequency</TableCell>
                      {isSectionSelectable && !selectedSection && <TableCell>Section</TableCell>}
                      <TableCell>Due Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboard.entries.map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{entry.report_name_snapshot}</Typography>
                          <Typography variant="caption" sx={{ color: PALETTE.textSecondary }}>
                            {entry.report_code_snapshot}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: frequencyText[entry.frequency_snapshot] || PALETTE.textSecondary }}>
                            {entry.frequency_snapshot}
                          </Typography>
                        </TableCell>
                        {isSectionSelectable && !selectedSection && <TableCell>{entry.section_name}</TableCell>}
                        <TableCell>
                          <Typography variant="body2">{formatDate(entry.due_date)}</Typography>
                          {entry.is_overdue && <OverdueBadge>Overdue</OverdueBadge>}
                        </TableCell>
                        <TableCell>
                          {entry.is_overdue ? (
                            <DotLabel
                              label="Overdue"
                              dotColor={PALETTE.dotRed}
                              textColor={PALETTE.overdueText}
                              fontWeight={500}
                            />
                          ) : (
                            <DotLabel
                              label={entry.status}
                              dotColor={PALETTE.amber}
                              textColor={PALETTE.amber}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {entry.can_submit ? (
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleSubmit(entry.id)}
                              disabled={submittingId === entry.id}
                              sx={{
                                backgroundColor: PALETTE.burgundy,
                                '&:hover': {
                                  backgroundColor: PALETTE.burgundyDark,
                                },
                              }}
                            >
                              {submittingId === entry.id ? 'Submitting...' : 'Mark Submitted'}
                            </Button>
                          ) : (
                            <Typography variant="caption" sx={{ color: PALETTE.textSecondary }}>
                              View only
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
};

export default ReturnsDashboardPage;
