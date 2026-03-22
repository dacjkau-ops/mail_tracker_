import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import returnsService from '../services/returnsService';
import { formatDate, formatDateTime } from '../utils/dateHelpers';
import { useAuth } from '../context/AuthContext';

const currentPeriodValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const parsePeriod = (value) => {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
};

const ReturnsHistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [period, setPeriod] = useState(searchParams.get('period') || currentPeriodValue());
  const [selectedSection, setSelectedSection] = useState(searchParams.get('section') || '');
  const [delayMonths, setDelayMonths] = useState(6);
  const [historyData, setHistoryData] = useState(null);
  const [delaySummary, setDelaySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSectionSelectable = user?.role === 'AG' || user?.role === 'DAG';
  const { year, month } = useMemo(() => parsePeriod(period), [period]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [historyResponse, delayResponse] = await Promise.all([
          returnsService.getHistory({
            year,
            month,
            section: selectedSection || undefined,
          }),
          returnsService.getDelaySummary({
            year,
            month,
            section: selectedSection || undefined,
            months: delayMonths,
          }),
        ]);

        if (!active) return;
        setHistoryData(historyResponse);
        setDelaySummary(delayResponse);
      } catch (err) {
        if (!active) return;
        setError('Failed to load returns history.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [year, month, selectedSection, delayMonths]);

  const delayedThisMonth = historyData?.entries?.filter((entry) => entry.delay_days > 0).length || 0;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/returns')} sx={{ mb: 2 }}>
        Back to Pending View
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel shrink htmlFor="returns-history-period">
              Month
            </InputLabel>
            <Box
              component="input"
              id="returns-history-period"
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
                {(historyData?.available_sections || []).map((section) => (
                  <MenuItem key={section.id} value={String(section.id)}>
                    {section.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Delay Window</InputLabel>
            <Select
              value={delayMonths}
              label="Delay Window"
              onChange={(event) => setDelayMonths(event.target.value)}
            >
              <MenuItem value={3}>Last 3 months</MenuItem>
              <MenuItem value={6}>Last 6 months</MenuItem>
              <MenuItem value={12}>Last 12 months</MenuItem>
            </Select>
          </FormControl>
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
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Archived Entries
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {historyData?.summary?.total_count ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {historyData?.month_label}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Submitted
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2f6f47' }}>
                {historyData?.summary?.submitted_count ?? 0}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Still Pending
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#8c3b45' }}>
                {historyData?.summary?.pending_count ?? 0}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Delayed This Month
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#9b3d2e' }}>
                {delayedThisMonth}
              </Typography>
            </Paper>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
              gap: 3,
            }}
          >
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Historical Archive
              </Typography>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Report</TableCell>
                      {isSectionSelectable && !selectedSection && <TableCell>Section</TableCell>}
                      <TableCell>Due Date</TableCell>
                      <TableCell>Processed Date</TableCell>
                      <TableCell>Processed By</TableCell>
                      <TableCell>Delay</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(historyData?.entries || []).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Typography variant="subtitle2">{entry.report_name_snapshot}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {entry.report_code_snapshot} · {entry.frequency_snapshot}
                          </Typography>
                        </TableCell>
                        {isSectionSelectable && !selectedSection && <TableCell>{entry.section_name}</TableCell>}
                        <TableCell>{formatDate(entry.due_date)}</TableCell>
                        <TableCell>{entry.submitted_at ? formatDateTime(entry.submitted_at) : '-'}</TableCell>
                        <TableCell>{entry.submitted_by_name || '-'}</TableCell>
                        <TableCell>{entry.delay_days ? `${entry.delay_days} day(s)` : '-'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={entry.status}
                            color={entry.status === 'submitted' ? 'success' : 'warning'}
                            variant={entry.status === 'submitted' ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Delay Summary
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Last {delaySummary?.months_requested || delayMonths} months ending in{' '}
                {delaySummary?.end_period?.label || historyData?.month_label}.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {(delaySummary?.points || []).map((point) => (
                  <Paper key={point.label} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="subtitle2">{point.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Delayed: {point.delayed_count} · Pending: {point.pending_count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Avg delay: {point.average_delay_days} day(s)
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Paper>
          </Box>
        </>
      )}
    </Box>
  );
};

export default ReturnsHistoryPage;

