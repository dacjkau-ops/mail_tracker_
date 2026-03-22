import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { useAuth } from '../context/AuthContext';

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
  { key: 'total_count', label: 'Total Due', color: '#294f75' },
  { key: 'pending_count', label: 'Pending', color: '#8c3b45' },
  { key: 'submitted_count', label: 'Submitted', color: '#3d7a53' },
  { key: 'overdue_count', label: 'Overdue', color: '#9b3d2e' },
];

const frequencyColor = {
  monthly: 'primary',
  quarterly: 'secondary',
  annual: 'default',
};

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
      } catch (err) {
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark the return as submitted.');
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
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          color: 'white',
          background: 'linear-gradient(135deg, #5b2538 0%, #ab594f 100%)',
        }}
      >
        <Typography variant="overline" sx={{ opacity: 0.8 }}>
          Current Filing Window
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          Calendar of Returns
        </Typography>
        <Typography variant="body1" sx={{ maxWidth: 760, opacity: 0.92 }}>
          Track section-wise pending reports for the current month. Submitted items automatically
          move to the historical archive with their processed date and user log.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
                px: 1.75,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                font: 'inherit',
                color: 'text.primary',
                backgroundColor: 'background.paper',
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

          <Button variant="outlined" startIcon={<HistoryIcon />} onClick={handleOpenHistory}>
            Open History
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="280px">
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
              gap: 2,
              mb: 3,
            }}
          >
            {summaryCards.map((card) => (
              <Paper key={card.key} sx={{ p: 2.5, borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {card.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: card.color }}>
                  {dashboard?.summary?.[card.key] ?? 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dashboard?.month_label || ''}
                </Typography>
              </Paper>
            ))}
          </Box>

          {isSectionSelectable && (dashboard?.section_overview?.length || 0) > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
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
                  <Paper key={section.section} sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      {section.section_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending: {section.pending_count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Submitted: {section.submitted_count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overdue: {section.overdue_count}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          <Paper sx={{ p: 2.5, borderRadius: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Pending Returns
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {dashboard?.month_label}
                </Typography>
              </Box>
              {dashboard?.selected_section && (
                <Chip label={dashboard.selected_section.name} color="secondary" variant="outlined" />
              )}
            </Box>

            {(dashboard?.entries?.length || 0) === 0 ? (
              dashboard?.summary?.total_count ? (
                <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="inherit" />}>
                  All returns for {dashboard.month_label} have been submitted. Use history to review
                  the processed dates and delays.
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
                          <Typography variant="caption" color="text.secondary">
                            {entry.report_code_snapshot}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={entry.frequency_snapshot}
                            color={frequencyColor[entry.frequency_snapshot] || 'default'}
                          />
                        </TableCell>
                        {isSectionSelectable && !selectedSection && <TableCell>{entry.section_name}</TableCell>}
                        <TableCell>
                          <Typography variant="body2">{formatDate(entry.due_date)}</Typography>
                          {entry.is_overdue && (
                            <Typography variant="caption" color="error">
                              Overdue
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={entry.status}
                            color={entry.is_overdue ? 'error' : 'warning'}
                            variant={entry.is_overdue ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {entry.can_submit ? (
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleSubmit(entry.id)}
                              disabled={submittingId === entry.id}
                            >
                              {submittingId === entry.id ? 'Submitting...' : 'Mark Submitted'}
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
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

