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
  IconButton,
  Pagination as MuiPagination,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { STATUS_COLORS, ACTION_STATUS_COLORS } from '../utils/constants';
import { formatDate, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { exportMailListToPDF } from '../utils/pdfExport';
import { useAuth } from '../context/AuthContext';

const MailListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mails, setMails] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    section: '',
    subsection: '',
    search: '',
  });
  // Separate state for search input to enable debouncing
  const [searchInput, setSearchInput] = useState('');
  const [orderBy, setOrderBy] = useState('created_at');
  const [order, setOrder] = useState('desc');

  // Pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const assignmentStatusColors = {
    Active: 'primary',
    Completed: 'success',
    Revoked: 'error',
  };

  // Debounce search input - only update filters.search after 400ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setCurrentPage(1);
        setFilters(prev => ({ ...prev, search: searchInput }));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // Load mails when filters, page, or page size change
  useEffect(() => {
    loadMails();
  }, [filters, currentPage, pageSize]);

  // Load section hierarchy for AG/DAG filter dropdowns
  useEffect(() => {
    const loadSections = async () => {
      if (!user || (user.role !== 'AG' && user.role !== 'DAG')) return;
      try {
        const sectionsData = await mailService.getSections();
        setSections(sectionsData);
      } catch (err) {
        console.error('Error loading sections:', err);
      }
    };

    loadSections();
  }, [user]);

  const loadMails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await mailService.getAllMails(filters, currentPage, pageSize);
      setMails(data.results || []);
      setTotalCount(data.count || 0);
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
    setCurrentPage(1);
    if (field === 'section') {
      setFilters({
        ...filters,
        section: value,
        subsection: '',
      });
      return;
    }

    setFilters({
      ...filters,
      [field]: value,
    });
  };

  // PERFORMANCE FIX: Memoize row click handler to prevent recreating on each render
  const handleRowClick = useCallback((mailId) => {
    navigate(`/mails/${mailId}`);
  }, [navigate]);

  const handleViewPdf = useCallback(async (mailId) => {
    try {
      const blob = await mailService.viewPdf(mailId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up the object URL after a delay to allow the browser to load it
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Error viewing PDF:', err);
    }
  }, []);

  const handlePageChange = useCallback((event, page) => {
    setCurrentPage(page);
    const tableEl = document.querySelector('[data-testid="mail-table-container"]');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const sectionOptions = useMemo(() => {
    if (!user) return [];

    if (user.role === 'AG') return sections;

    if (user.role === 'DAG') {
      const dagSectionIds = new Set((user.sections || []).map((id) => Number(id)));
      return sections.filter((section) => dagSectionIds.has(section.id));
    }

    return [];
  }, [sections, user]);

  const subsectionOptions = useMemo(() => {
    if (!user || (user.role !== 'AG' && user.role !== 'DAG')) return [];

    let baseSections = sectionOptions;

    if (user.role === 'AG' && filters.section) {
      baseSections = sectionOptions.filter((section) => section.id === Number(filters.section));
    }

    return baseSections.flatMap((section) =>
      (section.subsections || []).map((subsection) => ({
        ...subsection,
        section_name: section.name,
      }))
    );
  }, [sectionOptions, filters.section, user]);

  // UI-only role-based filtering for subsection and role-driven section controls
  const visibleMails = useMemo(() => {
    let filtered = [...mails];

    if (filters.section) {
      const sectionId = Number(filters.section);
      filtered = filtered.filter((mail) => Number(mail.section) === sectionId);
    }

    if (filters.subsection) {
      const subsectionId = Number(filters.subsection);
      filtered = filtered.filter((mail) => Number(mail.subsection) === subsectionId);
    }

    return filtered;
  }, [mails, filters.section, filters.subsection]);

  // PERFORMANCE FIX: Memoize sorted mails to prevent re-sorting on every render
  // Only re-sort when visible mails, orderBy, or order changes
  const sortedMails = useMemo(() => {
    return [...visibleMails].sort((a, b) => {
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
  }, [visibleMails, orderBy, order]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, totalCount);

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
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            label="Search"
            placeholder="Search by sl_no, letter_no, or subject"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 260 }}
            size="small"
          />

          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="assigned">Assigned to me</MenuItem>
              <MenuItem value="created_by_me">Created by me</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>

          {user?.role === 'AG' && (
            <FormControl sx={{ minWidth: 220 }} size="small">
              <InputLabel>Section</InputLabel>
              <Select
                value={filters.section}
                label="Section"
                onChange={(e) => handleFilterChange('section', e.target.value)}
              >
                <MenuItem value="">All Sections</MenuItem>
                {sectionOptions.map((section) => (
                  <MenuItem key={section.id} value={section.id}>
                    {section.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {(user?.role === 'AG' || user?.role === 'DAG') && (
            <FormControl sx={{ minWidth: 260 }} size="small">
              <InputLabel>Subsection</InputLabel>
              <Select
                value={filters.subsection}
                label="Subsection"
                onChange={(e) => handleFilterChange('subsection', e.target.value)}
              >
                <MenuItem value="">All Subsections</MenuItem>
                {subsectionOptions.map((subsection) => (
                  <MenuItem key={subsection.id} value={subsection.id}>
                    {`${subsection.section_name} - ${subsection.name}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Per page</InputLabel>
            <Select
              value={pageSize}
              label="Per page"
              onChange={(e) => {
                setPageSize(e.target.value);
                setCurrentPage(1);
              }}
            >
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      <Box sx={{ position: 'relative' }} data-testid="mail-table-container">
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ tableLayout: 'fixed', minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '6%' }}>
                  <TableSortLabel
                    active={orderBy === 'sl_no'}
                    direction={orderBy === 'sl_no' ? order : 'asc'}
                    onClick={() => handleSort('sl_no')}
                  >
                    SL No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '11%' }}>Letter No</TableCell>
                <TableCell sx={{ width: '13%' }}>Subject</TableCell>
                <TableCell sx={{ width: '8%' }}>From Office</TableCell>
                <TableCell sx={{ width: '10%' }}>
                  <TableSortLabel
                    active={orderBy === 'assigned_to'}
                    direction={orderBy === 'assigned_to' ? order : 'asc'}
                    onClick={() => handleSort('assigned_to')}
                  >
                    Assigned To
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '10%' }}>Current Handler</TableCell>
                <TableCell sx={{ width: '12%' }}>Current Action</TableCell>
                <TableCell sx={{ width: '7%' }}>
                  <TableSortLabel
                    active={orderBy === 'due_date'}
                    direction={orderBy === 'due_date' ? order : 'asc'}
                    onClick={() => handleSort('due_date')}
                  >
                    Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '7%' }}>Status</TableCell>
                <TableCell sx={{ width: '9%' }}>Time in Stage</TableCell>
                <TableCell sx={{ width: '7%' }}>Completion Date</TableCell>
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
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mail.sl_no}</TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mail.letter_no}</TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {mail.mail_reference_subject?.length > 50
                              ? `${mail.mail_reference_subject.substring(0, 50)}...`
                              : mail.mail_reference_subject}
                          </Typography>
                          <Box sx={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                            {mail.attachment_metadata?.has_attachment && (
                              <Tooltip title="View PDF">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewPdf(mail.id);
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  <AttachFileIcon fontSize="small" color="action" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mail.from_office}</TableCell>
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
                          <Typography variant="body2" noWrap>
                            {mail.assigned_to_name || mail.assigned_to?.full_name || 'N/A'}
                          </Typography>
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
                          <Typography variant="body2" noWrap>
                            {mail.current_handler_name || mail.current_handler?.full_name || 'N/A'}
                          </Typography>
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

        {/* Pagination bar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
          component={Paper}
          elevation={0}
        >
          <Typography variant="body2" color="text.secondary">
            {totalCount === 0
              ? '0 records'
              : `Showing ${showingFrom}-${showingTo} of ${totalCount} records`}
          </Typography>
          {totalPages > 1 && (
            <MuiPagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
              siblingCount={1}
              boundaryCount={1}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default MailListPage;
