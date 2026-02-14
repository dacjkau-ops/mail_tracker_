import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';
import mailService from '../services/mailService';
import { MAIL_STATUS, STATUS_COLORS, ACTION_STATUS_COLORS } from '../utils/constants';
import { formatDate, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { exportMailListToPDF } from '../utils/pdfExport';

const MailListPage = () => {
  const navigate = useNavigate();
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  });
  // Separate state for search input to enable debouncing
  const [searchInput, setSearchInput] = useState('');
  const [orderBy, setOrderBy] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const assignmentStatusColors = {
    Active: 'primary',
    Completed: 'success',
    Revoked: 'error',
  };

  // Debounce search input - only update filters.search after 400ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchInput }));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // Load mails when filters change (but not on every keystroke due to debounce)
  useEffect(() => {
    loadMails();
  }, [filters]);

  const loadMails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await mailService.getAllMails(filters);
      setMails(data);
    } catch (err) {
      setError('Failed to load mails. Please try again.');
      console.error('Error loading mails:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleFilterChange = (field, value) => {
    setFilters({
      ...filters,
      [field]: value,
    });
  };

  // PERFORMANCE FIX: Memoize row click handler to prevent recreating on each render
  const handleRowClick = useCallback((mailId) => {
    navigate(`/mails/${mailId}`);
  }, [navigate]);

  // PERFORMANCE FIX: Memoize sorted mails to prevent re-sorting on every render
  // Only re-sort when mails, orderBy, or order changes
  const sortedMails = useMemo(() => {
    return [...mails].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      // Handle name fields (API returns assigned_to_name, current_handler_name)
      if (orderBy === 'assigned_to') {
        aValue = a.assigned_to_name || a.assigned_to?.full_name || '';
        bValue = b.assigned_to_name || b.assigned_to?.full_name || '';
      }
      if (orderBy === 'current_handler') {
        aValue = a.current_handler_name || a.current_handler?.full_name || '';
        bValue = b.current_handler_name || b.current_handler?.full_name || '';
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
  }, [mails, orderBy, order]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Mail Records
        </Typography>
        <Button
          variant="outlined"
          startIcon={<PdfIcon />}
          onClick={() => exportMailListToPDF(sortedMails, filters)}
        >
          Export to PDF
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2}>
          <TextField
            label="Search"
            placeholder="Search by sl_no, letter_no, or subject"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flexGrow: 1 }}
            size="small"
          />

          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {Object.values(MAIL_STATUS).map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'sl_no'}
                  direction={orderBy === 'sl_no' ? order : 'asc'}
                  onClick={() => handleSort('sl_no')}
                >
                  SL No
                </TableSortLabel>
              </TableCell>
              <TableCell>Letter No</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>From Office</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'assigned_to'}
                  direction={orderBy === 'assigned_to' ? order : 'asc'}
                  onClick={() => handleSort('assigned_to')}
                >
                  Assigned To
                </TableSortLabel>
              </TableCell>
              <TableCell>Current Handler</TableCell>
              <TableCell>Current Action</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'due_date'}
                  direction={orderBy === 'due_date' ? order : 'asc'}
                  onClick={() => handleSort('due_date')}
                >
                  Due Date
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Time in Stage</TableCell>
              <TableCell>Completion Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedMails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No mails found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedMails.map((mail) => {
                const overdue = isOverdue(mail.due_date, mail.status);

                return (
                  <TableRow
                    key={mail.id}
                    hover
                    onClick={() => handleRowClick(mail.id)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: overdue ? 'error.light' : 'inherit',
                      '&:hover': {
                        bgcolor: overdue ? 'error.main' : 'action.hover',
                      },
                    }}
                  >
                    <TableCell>{mail.sl_no}</TableCell>
                    <TableCell>{mail.letter_no}</TableCell>
                    <TableCell>
                      {mail.mail_reference_subject?.length > 50
                        ? `${mail.mail_reference_subject.substring(0, 50)}...`
                        : mail.mail_reference_subject}
                    </TableCell>
                    <TableCell>{mail.from_office}</TableCell>
                    <TableCell>
                      {mail.is_multi_assigned && mail.assignees_display?.length > 0 ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {mail.assignee_count} assignees
                          </Typography>
                          <Tooltip title={mail.assignees_display.join(', ')}>
                            <Typography variant="body2" sx={{ maxWidth: 220 }} noWrap>
                              {mail.assignees_display.join(', ')}
                            </Typography>
                          </Tooltip>
                        </Box>
                      ) : (
                        mail.assigned_to_name || mail.assigned_to?.full_name || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {mail.is_multi_assigned && mail.current_handlers_display?.length > 0 ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {mail.current_handler_count || mail.current_handlers_display.length} handlers
                          </Typography>
                          <Tooltip title={mail.current_handlers_display.join(', ')}>
                            <Typography variant="body2" sx={{ maxWidth: 220 }} noWrap>
                              {mail.current_handlers_display.join(', ')}
                            </Typography>
                          </Tooltip>
                        </Box>
                      ) : (
                        mail.current_handler_name || mail.current_handler?.full_name || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {mail.is_multi_assigned && mail.assignment_snapshots?.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 280 }}>
                          {mail.assignment_snapshots.map((snap) => (
                            <Tooltip
                              key={`${mail.id}-${snap.ref}`}
                              title={`${snap.assignee_name} (${snap.ref})`}
                            >
                              <Chip
                                label={`${snap.ref}: ${snap.status}`}
                                size="small"
                                color={assignmentStatusColors[snap.status] || 'default'}
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      ) : mail.current_action_status ? (
                        <Box>
                          <Chip
                            label={mail.current_action_status}
                            color={ACTION_STATUS_COLORS[mail.current_action_status] || 'default'}
                            size={mail.current_action_status === 'Completed' ? 'medium' : 'small'}
                            sx={{
                              fontSize: mail.current_action_status === 'Completed' ? '0.85rem' : '0.75rem',
                              fontWeight: mail.current_action_status === 'Completed' ? 700 : 500,
                            }}
                          />
                          {mail.current_action_status === 'Completed' && mail.current_action_remarks && (
                            <Tooltip title={mail.current_action_remarks}>
                              <Typography
                                variant="caption"
                                color="success.dark"
                                display="block"
                                sx={{ mt: 0.5, maxWidth: 220 }}
                                noWrap
                              >
                                {mail.current_action_remarks}
                              </Typography>
                            </Tooltip>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(mail.due_date)}
                      {overdue && (
                        <Typography variant="caption" display="block" color="error">
                          OVERDUE
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={mail.status}
                        color={STATUS_COLORS[mail.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {mail.time_in_stage || calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
                    </TableCell>
                    <TableCell>
                      {mail.date_of_completion ? formatDate(mail.date_of_completion) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MailListPage;
