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
  Divider,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  PictureAsPdf as PdfIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import StatusIndicator, { OverdueBadge } from '../components/StatusIndicator';
import { ACTION_STATUS_COLORS, PALETTE } from '../utils/constants';
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
  const [searchInput, setSearchInput] = useState('');
  const [orderBy, setOrderBy] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setCurrentPage(1);
        setFilters(prev => ({ ...prev, search: searchInput }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  useEffect(() => {
    loadMails();
  }, [filters, currentPage, pageSize]);

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
      setFilters({ ...filters, section: value, subsection: '' });
      return;
    }
    setFilters({ ...filters, [field]: value });
  };

  const handleRowClick = useCallback((mailId) => {
    navigate(`/mails/${mailId}`);
  }, [navigate]);

  const handleViewPdf = useCallback(async (mailId, stage = 'created') => {
    try {
      const blob = await mailService.viewPdf(mailId, stage);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
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

  const sortedMails = useMemo(() => {
    return [...visibleMails].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      if (orderBy === 'assigned_to') {
        aValue = a.assigned_to_name || a.assigned_to?.full_name || '';
        bValue = b.assigned_to_name || b.assigned_to?.full_name || '';
      }
      if (orderBy === 'current_handler') {
        aValue = a.current_handler_name || a.current_handler?.full_name || '';
        bValue = b.current_handler_name || b.current_handler?.full_name || '';
      }
      if (order === 'asc') return aValue > bValue ? 1 : -1;
      return aValue < bValue ? 1 : -1;
    });
  }, [visibleMails, orderBy, order]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, totalCount);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h1"
            sx={{
              fontSize: '1.75rem',
              fontWeight: 600,
              color: PALETTE.textPrimary,
              letterSpacing: '-0.02em',
              mb: 0.5,
            }}
          >
            Mail Records
          </Typography>
          <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
            {totalCount > 0 && `Showing ${showingFrom}-${showingTo} of ${totalCount} records`}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PdfIcon sx={{ fontSize: 18 }} />}
          onClick={() => exportMailListToPDF(sortedMails, filters)}
          sx={{
            borderColor: PALETTE.borderDark,
            color: PALETTE.textSecondary,
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': {
              borderColor: PALETTE.textSecondary,
              backgroundColor: PALETTE.subtle,
            },
          }}
        >
          Export PDF
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            border: `1px solid ${PALETTE.dotRed}`,
            backgroundColor: 'rgba(139, 42, 42, 0.05)',
            color: PALETTE.dotRed,
            '& .MuiAlert-icon': { color: PALETTE.dotRed },
          }}
        >
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          border: `1px solid ${PALETTE.border}`,
          backgroundColor: PALETTE.paper,
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TextField
            placeholder="Search SL No, Letter No, Subject..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            size="small"
            sx={{
              flexGrow: 1,
              minWidth: 280,
              maxWidth: 400,
              '& .MuiOutlinedInput-root': {
                backgroundColor: PALETTE.cream,
              },
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: PALETTE.textMuted, mr: 1 }} />,
            }}
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ color: PALETTE.textSecondary }}>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
              sx={{ backgroundColor: PALETTE.paper }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="assigned">Assigned to me</MenuItem>
              <MenuItem value="created_by_me">Created by me</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>

          {user?.role === 'AG' && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Section</InputLabel>
              <Select
                value={filters.section}
                label="Section"
                onChange={(e) => handleFilterChange('section', e.target.value)}
                sx={{ backgroundColor: PALETTE.paper }}
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
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Subsection</InputLabel>
              <Select
                value={filters.subsection}
                label="Subsection"
                onChange={(e) => handleFilterChange('subsection', e.target.value)}
                sx={{ backgroundColor: PALETTE.paper }}
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

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Per Page</InputLabel>
            <Select
              value={pageSize}
              label="Per Page"
              onChange={(e) => {
                setPageSize(e.target.value);
                setCurrentPage(1);
              }}
              sx={{ backgroundColor: PALETTE.paper }}
            >
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Table Container */}
      <Box sx={{ position: 'relative' }} data-testid="mail-table-container">
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(250, 250, 248, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            <CircularProgress size={32} thickness={3} sx={{ color: PALETTE.burgundy }} />
          </Box>
        )}

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 1,
            overflow: 'hidden',
            backgroundColor: PALETTE.paper,
          }}
        >
          <Table sx={{ tableLayout: 'fixed', minWidth: 1100 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: PALETTE.subtle }}>
                <TableCell sx={{ width: '6%', fontWeight: 600, py: 1.5 }}>
                  <TableSortLabel
                    active={orderBy === 'sl_no'}
                    direction={orderBy === 'sl_no' ? order : 'asc'}
                    onClick={() => handleSort('sl_no')}
                    sx={{ '& .MuiTableSortLabel-icon': { color: PALETTE.textSecondary } }}
                  >
                    SL No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '11%', fontWeight: 600 }}>Letter No</TableCell>
                <TableCell sx={{ width: '15%', fontWeight: 600 }}>Subject</TableCell>
                <TableCell sx={{ width: '10%', fontWeight: 600 }}>From</TableCell>
                <TableCell sx={{ width: '10%', fontWeight: 600 }}>
                  <TableSortLabel
                    active={orderBy === 'assigned_to'}
                    direction={orderBy === 'assigned_to' ? order : 'asc'}
                    onClick={() => handleSort('assigned_to')}
                  >
                    Assigned
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '10%', fontWeight: 600 }}>Handler</TableCell>
                <TableCell sx={{ width: '10%', fontWeight: 600 }}>Action</TableCell>
                <TableCell sx={{ width: '9%', fontWeight: 600 }}>
                  <TableSortLabel
                    active={orderBy === 'due_date'}
                    direction={orderBy === 'due_date' ? order : 'asc'}
                    onClick={() => handleSort('due_date')}
                  >
                    Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: '9%', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ width: '10%', fontWeight: 600 }}>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedMails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                      No records found matching your criteria
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedMails.map((mail) => {
                  const overdue = isOverdue(mail.due_date, mail.status);

                  return (
                    <TableRow
                      key={mail.id}
                      onClick={() => handleRowClick(mail.id)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: overdue ? 'rgba(139, 42, 42, 0.04)' : 'inherit',
                        '&:hover': {
                          backgroundColor: overdue ? 'rgba(139, 42, 42, 0.08)' : PALETTE.cream,
                        },
                        '&:last-child .MuiTableCell-root': {
                          borderBottom: 'none',
                        },
                      }}
                    >
                      <TableCell
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                          color: overdue ? PALETTE.burgundy : PALETTE.textPrimary,
                        }}
                      >
                        {mail.sl_no}
                      </TableCell>
                      <TableCell
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: PALETTE.textPrimary,
                        }}
                      >
                        {mail.letter_no}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              flex: 1,
                              color: PALETTE.textPrimary,
                              fontWeight: 400,
                            }}
                          >
                            {mail.mail_reference_subject?.length > 45
                              ? `${mail.mail_reference_subject.substring(0, 45)}...`
                              : mail.mail_reference_subject}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {mail.attachment_metadata?.by_stage?.created && (
                              <Tooltip title="View created PDF">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewPdf(mail.id, 'created');
                                  }}
                                  sx={{
                                    p: 0.5,
                                    color: PALETTE.textSecondary,
                                    '&:hover': { color: PALETTE.burgundy },
                                  }}
                                >
                                  <VisibilityIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {mail.attachment_metadata?.by_stage?.closed && (
                              <Tooltip title="View closing PDF">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewPdf(mail.id, 'closed');
                                  }}
                                  sx={{
                                    p: 0.5,
                                    color: PALETTE.green,
                                    '&:hover': { color: PALETTE.textPrimary },
                                  }}
                                >
                                  <VisibilityIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: PALETTE.textSecondary,
                        }}
                      >
                        {mail.from_office}
                      </TableCell>
                      <TableCell>
                        {mail.is_multi_assigned && mail.assignees_display?.length > 0 ? (
                          <Box>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ color: PALETTE.textPrimary }}
                            >
                              {mail.assignees_display[0]}
                              {mail.assignees_display.length > 1 && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ color: PALETTE.textSecondary, ml: 0.5 }}
                                >
                                  +{mail.assignees_display.length - 1}
                                </Typography>
                              )}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: PALETTE.textPrimary }}
                          >
                            {mail.assigned_to_name || mail.assigned_to?.full_name || 'N/A'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {mail.is_multi_assigned && mail.current_handlers_display?.length > 0 ? (
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: PALETTE.textPrimary }}
                          >
                            {mail.current_handlers_display[0]}
                            {mail.current_handlers_display.length > 1 && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ color: PALETTE.textSecondary, ml: 0.5 }}
                              >
                                +{mail.current_handlers_display.length - 1}
                              </Typography>
                            )}
                          </Typography>
                        ) : (
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: PALETTE.textPrimary }}
                          >
                            {mail.current_handler_name || mail.current_handler?.full_name || 'N/A'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {mail.current_action_status ? (
                          <Typography
                            variant="body2"
                            sx={{
                              color: mail.current_action_status === 'Completed'
                                ? PALETTE.green
                                : PALETTE.textSecondary,
                              fontWeight: mail.current_action_status === 'Completed' ? 500 : 400,
                            }}
                          >
                            {mail.current_action_status}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: PALETTE.textMuted }}>
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: overdue ? PALETTE.burgundy : PALETTE.textPrimary,
                              fontWeight: overdue ? 500 : 400,
                            }}
                          >
                            {formatDate(mail.due_date)}
                          </Typography>
                          {overdue && (
                            <OverdueBadge>Overdue</OverdueBadge>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator
                          status={mail.status}
                          overdue={overdue}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            color: PALETTE.textSecondary,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {mail.time_in_stage || calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              py: 1.5,
              px: 2,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <MuiPagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size="small"
              showFirstButton
              showLastButton
              siblingCount={1}
              boundaryCount={1}
              sx={{
                '& .MuiPaginationItem-root': {
                  color: PALETTE.textSecondary,
                },
                '& .Mui-selected': {
                  backgroundColor: `${PALETTE.burgundy} !important`,
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: PALETTE.burgundyDark,
                  },
                },
              }}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default MailListPage;
