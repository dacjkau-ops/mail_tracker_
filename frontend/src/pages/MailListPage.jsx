import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputAdornment,
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
  TableSortLabel,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  VisibilityOutlined as VisibilityIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import StatusIndicator, { OverdueBadge } from '../components/StatusIndicator';
import { PALETTE } from '../utils/constants';
import { formatDate, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { exportMailListToPDF } from '../utils/pdfExport';
import { useAuth } from '../context/AuthContext';

const tableHeaderCellSx = {
  backgroundColor: PALETTE.headerBackground,
  color: PALETTE.textMuted,
  fontSize: '10.5px',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  py: 1.25,
  borderBottom: `1px solid ${PALETTE.borderLight}`,
};

const wrappingCellSx = {
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  color: PALETTE.textPrimary,
  verticalAlign: 'top',
};

const subjectCellSx = {
  ...wrappingCellSx,
  minWidth: 180,
  lineHeight: 1.45,
  fontWeight: 500,
  overflow: 'visible',
  textOverflow: 'unset',
};

const actionChipBaseSx = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 22,
  px: '7px',
  py: '2px',
  borderRadius: '3px',
  border: `1px solid ${PALETTE.border}`,
  fontSize: '11px',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const getCurrentActionChip = (value) => {
  if (!value) {
    return {
      label: 'Not set',
      sx: {
        ...actionChipBaseSx,
        backgroundColor: '#F5F5F5',
        color: '#9A9A9A',
        border: '1px solid #E0E0E0',
      },
    };
  }

  if (value === 'Completed') {
    return {
      label: value,
      sx: {
        ...actionChipBaseSx,
        backgroundColor: '#EDF7EE',
        color: '#1B5E20',
        border: '1px solid #A5D6A7',
      },
    };
  }

  return {
    label: value,
    sx: {
      ...actionChipBaseSx,
      backgroundColor: '#FAFAF8',
      color: PALETTE.textSecondary,
      border: `1px solid ${PALETTE.border}`,
    },
  };
};

const compareValues = (aValue, bValue, order) => {
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return order === 'asc' ? -1 : 1;
  if (bValue == null) return order === 'asc' ? 1 : -1;

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return order === 'asc' ? aValue - bValue : bValue - aValue;
  }

  if (aValue instanceof Date && bValue instanceof Date) {
    return order === 'asc' ? aValue - bValue : bValue - aValue;
  }

  const left = String(aValue).toLowerCase();
  const right = String(bValue).toLowerCase();
  const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? result : result * -1;
};

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setCurrentPage(1);
        setFilters((prev) => ({ ...prev, search: searchInput }));
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
      } catch (loadError) {
        console.error('Error loading sections:', loadError);
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
    } catch (loadError) {
      setError('Failed to load mails. Please try again.');
      console.error('Error loading mails:', loadError);
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
      setFilters((prev) => ({ ...prev, section: value, subsection: '' }));
      return;
    }
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handlePageChange = useCallback((nextPage) => {
    if (nextPage < 1) return;
    setCurrentPage(nextPage);
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
      })),
    );
  }, [filters.section, sectionOptions, user]);

  const sortedMails = useMemo(() => {
    return [...mails].sort((a, b) => {
      const getValue = (mail) => {
        switch (orderBy) {
          case 'sl_no':
            return Number(mail.sl_no);
          case 'assigned_to':
            return mail.is_multi_assigned
              ? (mail.assignees_display || []).join(', ')
              : mail.assigned_to_name || mail.assigned_to?.full_name || '';
          case 'current_handler':
            return mail.is_multi_assigned
              ? (mail.current_handlers_display || []).join(', ')
              : mail.current_handler_name || mail.current_handler?.full_name || '';
          case 'due_date':
            return mail.due_date ? new Date(mail.due_date) : null;
          case 'date_of_completion':
            return mail.date_of_completion ? new Date(mail.date_of_completion) : null;
          default:
            return mail[orderBy];
        }
      };

      return compareValues(getValue(a), getValue(b), order);
    });
  }, [mails, orderBy, order]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, totalCount);

  return (
    <Box>
      <Typography
        component="h1"
        sx={{
          mb: 1.5,
          fontSize: '16px',
          fontWeight: 500,
          color: '#1A1A1A',
        }}
      >
        Mail Records
      </Typography>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            border: `1px solid ${PALETTE.dotRed}`,
            backgroundColor: 'rgba(198, 40, 40, 0.05)',
            color: PALETTE.textPrimary,
            '& .MuiAlert-icon': { color: PALETTE.dotRed },
          }}
        >
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.25,
          mb: 2,
          p: 1.5,
          border: `1px solid ${PALETTE.border}`,
          borderRadius: `${PALETTE.radiusCard}px`,
          backgroundColor: PALETTE.paper,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status}
            label="Status"
            onChange={(event) => handleFilterChange('status', event.target.value)}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="assigned">Assigned to me</MenuItem>
            <MenuItem value="created_by_me">Created by me</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </Select>
        </FormControl>

        {user?.role === 'AG' && (
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filters.section}
              label="Section"
              onChange={(event) => handleFilterChange('section', event.target.value)}
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
              onChange={(event) => handleFilterChange('subsection', event.target.value)}
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

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Per Page</InputLabel>
          <Select
            value={pageSize}
            label="Per Page"
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(1);
            }}
          >
            <MenuItem value={25}>25</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Search SL No, Letter No, Subject..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{
            flex: '1 1 260px',
            minWidth: 240,
            '& .MuiOutlinedInput-root': {
              backgroundColor: PALETTE.paper,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 17, color: PALETTE.textMuted }} />
              </InputAdornment>
            ),
          }}
        />

        <Button
          variant="outlined"
          onClick={() => exportMailListToPDF(sortedMails, filters)}
          sx={{
            ml: 'auto',
            border: '1px solid #E0E0E0',
            color: PALETTE.textSecondary,
            backgroundColor: '#FFFFFF',
            '&:hover': {
              borderColor: PALETTE.burgundy,
              color: PALETTE.burgundy,
              backgroundColor: '#FFFFFF',
            },
          }}
        >
          Export PDF
        </Button>
      </Box>

      <Paper
        elevation={0}
        data-testid="mail-table-container"
        sx={{
          position: 'relative',
          backgroundColor: PALETTE.paper,
          border: `1px solid ${PALETTE.border}`,
          borderRadius: `${PALETTE.radiusCard}px`,
          boxShadow: PALETTE.shadow,
          overflow: 'hidden',
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(250, 250, 248, 0.82)',
            }}
          >
            <CircularProgress size={30} thickness={3.2} sx={{ color: PALETTE.burgundy }} />
          </Box>
        )}

        <TableContainer sx={{ backgroundColor: PALETTE.paper }}>
          <Table sx={{ tableLayout: 'auto', minWidth: 1460 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="none" sx={{ ...tableHeaderCellSx, width: 4, minWidth: 4, px: 0, py: 0 }} />
                <TableCell sx={{ ...tableHeaderCellSx, width: 90, minWidth: 90 }}>
                  <TableSortLabel
                    active={orderBy === 'sl_no'}
                    direction={orderBy === 'sl_no' ? order : 'asc'}
                    onClick={() => handleSort('sl_no')}
                    sx={{
                      color: `${PALETTE.textMuted} !important`,
                      '& .MuiTableSortLabel-icon': {
                        color: `${PALETTE.textMuted} !important`,
                      },
                    }}
                  >
                    SL No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 100, minWidth: 100 }}>
                  Letter No
                </TableCell>
                <TableCell sx={tableHeaderCellSx}>Subject</TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 150, minWidth: 130 }}>
                  From Office
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 150, minWidth: 130 }}>
                  <TableSortLabel
                    active={orderBy === 'assigned_to'}
                    direction={orderBy === 'assigned_to' ? order : 'asc'}
                    onClick={() => handleSort('assigned_to')}
                    sx={{
                      color: `${PALETTE.textMuted} !important`,
                      '& .MuiTableSortLabel-icon': {
                        color: `${PALETTE.textMuted} !important`,
                      },
                    }}
                  >
                    Assigned To
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 150, minWidth: 130 }}>
                  <TableSortLabel
                    active={orderBy === 'current_handler'}
                    direction={orderBy === 'current_handler' ? order : 'asc'}
                    onClick={() => handleSort('current_handler')}
                    sx={{
                      color: `${PALETTE.textMuted} !important`,
                      '& .MuiTableSortLabel-icon': {
                        color: `${PALETTE.textMuted} !important`,
                      },
                    }}
                  >
                    Current Handler
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 110, minWidth: 110 }}>
                  Current Action
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 100, minWidth: 100 }}>
                  <TableSortLabel
                    active={orderBy === 'due_date'}
                    direction={orderBy === 'due_date' ? order : 'asc'}
                    onClick={() => handleSort('due_date')}
                    sx={{
                      color: `${PALETTE.textMuted} !important`,
                      '& .MuiTableSortLabel-icon': {
                        color: `${PALETTE.textMuted} !important`,
                      },
                    }}
                  >
                    Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 110, minWidth: 110 }}>
                  Status
                </TableCell>
                
                <TableCell sx={{ ...tableHeaderCellSx, width: 100, minWidth: 90 }}>
                  <TableSortLabel
                    active={orderBy === 'date_of_completion'}
                    direction={orderBy === 'date_of_completion' ? order : 'asc'}
                    onClick={() => handleSort('date_of_completion')}
                    sx={{
                      color: `${PALETTE.textMuted} !important`,
                      '& .MuiTableSortLabel-icon': {
                        color: `${PALETTE.textMuted} !important`,
                      },
                    }}
                  >
                    Completion Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ ...tableHeaderCellSx, width: 40, minWidth: 40, textAlign: 'center' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedMails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                      No records found matching your criteria
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedMails.map((mail) => {
                  const overdue = isOverdue(mail.due_date, mail.status);
                  const currentAction = getCurrentActionChip(mail.current_action_status);
                  const assignedTo = mail.is_multi_assigned
                    ? (mail.assignees_display || []).join(', ') || 'N/A'
                    : mail.assigned_to_name || mail.assigned_to?.full_name || 'N/A';
                  const currentHandler = mail.is_multi_assigned
                    ? (mail.current_handlers_display || []).join(', ') || 'N/A'
                    : mail.current_handler_name || mail.current_handler?.full_name || 'N/A';

                  return (
                    <TableRow
                      key={mail.id}
                      hover
                      onClick={() => navigate(`/mails/${mail.id}`)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: PALETTE.paper,
                        '&:hover': {
                          backgroundColor: PALETTE.hover,
                        },
                        '& .MuiTableCell-root': {
                          borderBottom: `1px solid ${PALETTE.borderLight}`,
                        },
                      }}
                    >
                      <TableCell
                        padding="none"
                        sx={{ width: 4, minWidth: 4, px: 0, py: 0, position: 'relative' }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: overdue ? PALETTE.dotRed : 'transparent',
                          }}
                        />
                      </TableCell>

                      <TableCell
                        sx={{
                          verticalAlign: 'top',
                          fontVariantNumeric: 'tabular-nums',
                          color: PALETTE.textPrimary,
                        }}
                      >
                        {mail.sl_no}
                      </TableCell>

                      <TableCell sx={{ verticalAlign: 'top', color: PALETTE.textPrimary }}>
                        {mail.letter_no || '-'}
                      </TableCell>

                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="body2" sx={subjectCellSx}>
                          {mail.mail_reference_subject || '-'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={wrappingCellSx}>{mail.from_office || '-'}</TableCell>
                      <TableCell sx={wrappingCellSx}>{assignedTo}</TableCell>
                      <TableCell sx={wrappingCellSx}>{currentHandler}</TableCell>

                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Box component="span" sx={currentAction.sx}>
                          {currentAction.label}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: PALETTE.textPrimary,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatDate(mail.due_date)}
                        </Typography>
                        {overdue && <OverdueBadge>Overdue</OverdueBadge>}
                      </TableCell>

                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <StatusIndicator status={mail.status} size="small" />
                      </TableCell>

                      <TableCell
                        sx={{
                          verticalAlign: 'top',
                          color: PALETTE.textSecondary,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {mail.time_in_stage || calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
                      </TableCell>

                      <TableCell
                        sx={{
                          verticalAlign: 'top',
                          color: PALETTE.textSecondary,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {mail.date_of_completion ? formatDate(mail.date_of_completion) : '-'}
                      </TableCell>

                      <TableCell sx={{ verticalAlign: 'top', textAlign: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/mails/${mail.id}`);
                          }}
                          sx={{
                            width: 26,
                            height: 26,
                            border: `1px solid ${PALETTE.border}`,
                            borderRadius: '4px',
                            color: PALETTE.textSecondary,
                            '&:hover': {
                              borderColor: PALETTE.burgundy,
                              color: PALETTE.burgundy,
                              backgroundColor: '#FFFFFF',
                            },
                          }}
                        >
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${PALETTE.borderLight}`,
            backgroundColor: PALETTE.paper,
          }}
        >
          <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
            {`Showing ${showingFrom}-${showingTo} of ${totalCount} records`}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>
              {`Page ${Math.min(currentPage, totalPages)} of ${totalPages}`}
            </Typography>
            <Button
              variant="outlined"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              sx={{
                minWidth: 70,
                border: '1px solid #E0E0E0',
                borderRadius: '4px',
                backgroundColor: '#FFFFFF',
                color: PALETTE.textSecondary,
                '&:hover': {
                  borderColor: PALETTE.burgundy,
                  color: PALETTE.burgundy,
                  backgroundColor: '#FFFFFF',
                },
              }}
            >
              Prev
            </Button>
            <Button
              variant="outlined"
              disabled={currentPage >= totalPages || totalCount === 0}
              onClick={() => handlePageChange(currentPage + 1)}
              sx={{
                minWidth: 70,
                border: '1px solid #E0E0E0',
                borderRadius: '4px',
                backgroundColor: '#FFFFFF',
                color: PALETTE.textSecondary,
                '&:hover': {
                  borderColor: PALETTE.burgundy,
                  color: PALETTE.burgundy,
                  backgroundColor: '#FFFFFF',
                },
              }}
            >
              Next
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default MailListPage;
