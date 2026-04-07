import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {
  ArrowBack,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  SwapHoriz as ReassignIcon,
  CheckCircle as CloseIcon,
  Replay as ReopenIcon,
  GroupAdd as MultiAssignIcon,
  PictureAsPdf as PdfIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';
import StatusIndicator from '../components/StatusIndicator';
import { formatDate, formatDateTime, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { PALETTE } from '../utils/constants';
import ReassignDialog from '../components/ReassignDialog';
import CloseMailDialog from '../components/CloseMailDialog';
import ReopenDialog from '../components/ReopenDialog';
import MultiAssignDialog from '../components/MultiAssignDialog';
import UpdateCurrentActionDialog from '../components/UpdateCurrentActionDialog';

const MailDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canReopen } = useAuth();

  const [mail, setMail] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [multiAssignDialogOpen, setMultiAssignDialogOpen] = useState(false);
  const [updateActionDialogOpen, setUpdateActionDialogOpen] = useState(false);
  const [pdfUploadWarning, setPdfUploadWarning] = useState(false);
  const [closePdfUploadWarning, setClosePdfUploadWarning] = useState(false);

  const [remarksEditing, setRemarksEditing] = useState(false);
  const [remarksValue, setRemarksValue] = useState('');
  const [remarksSaving, setRemarksSaving] = useState(false);

  useEffect(() => {
    loadMail();
    loadAuditTrail();
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pdfError') === '1') setPdfUploadWarning(true);
  }, []);

  const loadMail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await mailService.getMailById(id);
      setMail(data);
    } catch {
      setError('Failed to load mail details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditTrail = async () => {
    try {
      const data = await mailService.getAuditTrail(id);
      setAuditTrail(data);
    } catch (err) {
      console.error('Error loading audit trail:', err);
    }
  };

  const handleViewPdf = async (stage = 'created') => {
    try {
      const blob = await mailService.viewPdf(id, stage);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
  };

  const handleDownloadPdf = async (stage = 'created') => {
    try {
      const blob = await mailService.viewPdf(id, stage);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mail?.attachment_metadata?.by_stage?.[stage]?.original_filename || `${stage}-attachment.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  const handleReassign = async (data) => {
    try {
      await mailService.reassignMail(id, data);
      setReassignDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to reassign mail');
    }
  };

  const handleClose = async ({ remarks, pdfFile }) => {
    try {
      await mailService.closeMail(id, remarks);
      if (pdfFile) {
        try {
          await mailService.uploadPdf(id, pdfFile, 'closed');
          setClosePdfUploadWarning(false);
        } catch (uploadErr) {
          console.error('Failed to upload closing PDF:', uploadErr);
          setClosePdfUploadWarning(true);
        }
      } else {
        setClosePdfUploadWarning(false);
      }
      setCloseDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to close mail');
    }
  };

  const handleReopen = async (remarks) => {
    try {
      await mailService.reopenMail(id, remarks);
      setReopenDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to reopen mail');
    }
  };

  const handleUpdateCurrentAction = async (data) => {
    try {
      await mailService.updateCurrentAction(id, data);
      setUpdateActionDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to update current action');
    }
  };

  const handleSaveRemarks = async () => {
    setRemarksSaving(true);
    try {
      await mailService.updateCurrentAction(id, {
        current_action_status: mail.current_action_status || 'Under Review',
        current_action_remarks: remarksValue.trim(),
      });
      setRemarksEditing(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      console.error('Failed to save remarks:', err);
    } finally {
      setRemarksSaving(false);
    }
  };

  const canEditRemarks = () => {
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    return user?.id === handlerId;
  };

  const canReassignMail = () => {
    if (!mail) return false;
    if (user?.role === 'AG') return true;
    const sectionId = mail?.section_details?.id || mail?.section;
    if (user?.role === 'DAG' && sectionId && user?.sections?.includes(sectionId)) return true;
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    if (user?.id === handlerId) return true;
    if (Array.isArray(mail?.assignments)) {
      const hasActiveAssignment = mail.assignments.some((a) => {
        const currentId = a.reassigned_to || a.assigned_to;
        return a.status === 'Active' && currentId === user.id;
      });
      if (hasActiveAssignment) return true;
    }
    return false;
  };

  const canCloseMail = () => {
    if (!mail || mail.status === 'Closed') return false;
    if (mail.is_multi_assigned) return user?.role === 'AG';
    if (user?.role === 'AG') return true;
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    if (user?.id === handlerId) return true;
    return false;
  };

  const canReopenMail = () => canReopen() && mail?.status === 'Closed';

  const canMultiAssign = () => {
    if (!mail || mail.status === 'Closed') return false;
    if (user?.role === 'AG') return true;
    const sectionId = mail?.section_details?.id || mail?.section;
    if (user?.role === 'DAG' && sectionId && user?.sections?.includes(sectionId)) return true;
    if (user?.role === 'DAG' && Array.isArray(mail?.assignments)) {
      const hasActiveAssignment = mail.assignments.some((a) => {
        const currentId = a.reassigned_to || a.assigned_to;
        return a.status === 'Active' && currentId === user.id;
      });
      if (hasActiveAssignment) return true;
    }
    return false;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={32} sx={{ color: PALETTE.burgundy }} />
      </Box>
    );
  }

  if (error || !mail) {
    return (
      <Box>
        <Alert
          severity="error"
          sx={{
            border: `1px solid ${PALETTE.dotRed}`,
            backgroundColor: 'rgba(139, 42, 42, 0.05)',
            color: PALETTE.textPrimary,
            '& .MuiAlert-icon': { color: PALETTE.dotRed },
          }}
        >
          {error || 'Mail not found'}
        </Alert>
        <Button
          onClick={() => navigate('/mails')}
          sx={{
            mt: 2,
            color: PALETTE.textSecondary,
            textTransform: 'none',
          }}
          startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
        >
          Back to Mail List
        </Button>
      </Box>
    );
  }

  const overdue = isOverdue(mail.due_date, mail.status);

  const sortedAuditTrail = [...auditTrail].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const createEntry = auditTrail.find(e => e.action === 'CREATE');
  const createdByName = createEntry?.performed_by_details?.full_name || '—';
  const createdAt = createEntry?.timestamp;

  const isHandler = canEditRemarks();
  const hasActions = canReassignMail() || canCloseMail() || canMultiAssign() || canReopenMail();

  // Action buttons component
  const ActionButtons = ({ fullWidth = false }) => (
    <Stack spacing={1} direction={fullWidth ? 'column' : 'row'} flexWrap="wrap">
      {canCloseMail() && (
        <Button
          variant="contained"
          startIcon={<CloseIcon sx={{ fontSize: 18 }} />}
          onClick={() => setCloseDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            backgroundColor: PALETTE.burgundy,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 500,
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: PALETTE.burgundyDark,
              boxShadow: 'none',
            },
          }}
        >
          Complete Task
        </Button>
      )}
      {canReassignMail() && (
        <Button
          variant="outlined"
          startIcon={<ReassignIcon sx={{ fontSize: 18 }} />}
          onClick={() => setReassignDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            borderColor: PALETTE.borderDark,
            color: PALETTE.textPrimary,
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': {
              borderColor: PALETTE.textSecondary,
              backgroundColor: PALETTE.subtle,
            },
          }}
        >
          Reassign
        </Button>
      )}
      {canMultiAssign() && (
        <Button
          variant="outlined"
          startIcon={<MultiAssignIcon sx={{ fontSize: 18 }} />}
          onClick={() => setMultiAssignDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            borderColor: PALETTE.borderDark,
            color: PALETTE.textPrimary,
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': {
              borderColor: PALETTE.textSecondary,
              backgroundColor: PALETTE.subtle,
            },
          }}
        >
          Multi Assign
        </Button>
      )}
      {canReopenMail() && (
        <Button
          variant="outlined"
          startIcon={<ReopenIcon sx={{ fontSize: 18 }} />}
          onClick={() => setReopenDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            borderColor: PALETTE.dotRed,
            color: PALETTE.dotRed,
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': {
              borderColor: PALETTE.burgundy,
              backgroundColor: 'rgba(107, 26, 26, 0.04)',
            },
          }}
        >
          Reopen
        </Button>
      )}
    </Stack>
  );

  // Build assignment branch rows
  const buildAssignmentBranchRows = (assignment) => {
    const rows = [];
    const timeline = [...(assignment.remarks_timeline || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const reassignRegex = /^Reassigned to\s+(.+?):\s*(.*)$/i;
    let currentOfficer = assignment.assigned_to_details?.full_name || '-';

    timeline.forEach((remark) => {
      const content = remark.content || '';
      const parsed = content.match(reassignRegex);
      const createdBy = remark.created_by_details?.full_name;

      if (parsed) {
        const nextOfficer = parsed[1]?.trim() || '-';
        const reason = parsed[2]?.trim();
        rows.push({
          officerId: null,
          officer: createdBy || currentOfficer,
          remarks: reason || '-',
          reassignedToId: null,
          reassignedTo: nextOfficer,
          on: remark.created_at,
        });
        currentOfficer = nextOfficer;
        return;
      }

      rows.push({
        officerId: remark.created_by || null,
        officer: createdBy || currentOfficer,
        remarks: content || '-',
        reassignedToId: null,
        reassignedTo: '-',
        on: remark.created_at,
      });
    });

    if (assignment.status === 'Active') {
      rows.push({
        officerId: assignment.reassigned_to || assignment.assigned_to || null,
        officer: currentOfficer,
        remarks: 'Still Working',
        reassignedToId: null,
        reassignedTo: '',
        on: '',
      });
    } else if (rows.length === 0) {
      rows.push({
        officerId: assignment.reassigned_to || assignment.assigned_to || null,
        officer: currentOfficer,
        remarks: '-',
        reassignedToId: null,
        reassignedTo: '-',
        on: assignment.completed_at || assignment.updated_at || assignment.created_at,
      });
    }

    return rows;
  };

  const renderBranchTable = (assignment, isChild = false) => {
    const branchRows = buildAssignmentBranchRows(assignment);
    return (
      <Paper
        key={`${isChild ? 'child' : 'root'}-${assignment.id}`}
        elevation={0}
        sx={{
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 1,
          mb: 2,
          ml: isChild ? 4 : 0,
          overflow: 'hidden',
          backgroundColor: PALETTE.paper,
        }}
      >
        <Box
          sx={{
            p: 1.5,
            backgroundColor: PALETTE.subtle,
            borderBottom: `1px solid ${PALETTE.border}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500, color: PALETTE.textPrimary }}>
            Assigned to {assignment.assigned_to_details?.full_name || '-'} by {assignment.assigned_by_details?.full_name || createdByName}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: PALETTE.cream }}>
              <TableCell sx={{ fontWeight: 500, width: '30%', color: PALETTE.textPrimary }}>Officer</TableCell>
              <TableCell sx={{ fontWeight: 500, width: '35%', color: PALETTE.textPrimary }}>Remarks</TableCell>
              <TableCell sx={{ fontWeight: 500, width: '20%', color: PALETTE.textPrimary }}>Reassigned to</TableCell>
              <TableCell sx={{ fontWeight: 500, width: '15%', color: PALETTE.textPrimary }}>On</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branchRows.map((row, rowIdx) => (
              <TableRow
                key={`${assignment.id}-row-${rowIdx}`}
                sx={{
                  backgroundColor: rowIdx % 2 === 0 ? 'inherit' : PALETTE.cream,
                  '&:hover': { backgroundColor: PALETTE.cream },
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: PALETTE.textPrimary }}>
                    {row.officer}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: PALETTE.textSecondary, whiteSpace: 'pre-wrap' }}>
                    {row.remarks}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                    {row.reassignedTo}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: PALETTE.textSecondary }} noWrap>
                    {row.on ? formatDateTime(row.on) : '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    );
  };

  const mailAssignments = mail.assignments || [];
  const topLevelAssignments = mailAssignments.filter(
    (a) => Number(a.assigned_by) === Number(mail.created_by)
  );
  const childAssignments = mailAssignments.filter(
    (a) => Number(a.assigned_by) !== Number(mail.created_by)
  );

  return (
    <Box>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
        onClick={() => navigate('/mails')}
        sx={{
          mb: 2,
          color: PALETTE.textSecondary,
          textTransform: 'none',
          fontWeight: 500,
          '&:hover': { color: PALETTE.textPrimary },
        }}
      >
        Back to Mail List
      </Button>

      {/* Alerts */}
      {pdfUploadWarning && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            border: `1px solid ${PALETTE.amber}`,
            backgroundColor: 'rgba(184, 134, 11, 0.05)',
            '& .MuiAlert-icon': { color: PALETTE.amber },
          }}
          onClose={() => setPdfUploadWarning(false)}
        >
          Mail was created successfully, but the PDF attachment could not be uploaded.
        </Alert>
      )}
      {closePdfUploadWarning && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            border: `1px solid ${PALETTE.amber}`,
            backgroundColor: 'rgba(184, 134, 11, 0.05)',
            '& .MuiAlert-icon': { color: PALETTE.amber },
          }}
          onClose={() => setClosePdfUploadWarning(false)}
        >
          Mail was closed successfully, but the closing PDF could not be uploaded.
        </Alert>
      )}

      {/* Header Card */}
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 1,
          p: { xs: 2, sm: 2.5 },
          mb: 3,
          backgroundColor: PALETTE.paper,
        }}
      >
        {/* Row 1: SL No, Letter No, Subject, Status */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 500,
              color: PALETTE.burgundy,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 90,
            }}
          >
            {mail.sl_no}
          </Typography>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                color: PALETTE.textSecondary,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.25,
              }}
            >
              Letter No: {mail.letter_no}{mail.dated ? ` | Dated: ${formatDate(mail.dated)}` : ''}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 500,
                color: PALETTE.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {mail.mail_reference_subject}
            </Typography>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <StatusIndicator status={mail.status} overdue={overdue} />
          </Box>
        </Box>

        <Divider sx={{ my: 2, borderColor: PALETTE.border }} />

        {/* Row 2: Created by, Currently with */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
            Created by{' '}
            <Box component="span" sx={{ fontWeight: 500, color: PALETTE.textPrimary }}>
              {createdByName}
            </Box>
            {createdAt && ` on ${formatDate(createdAt)}`}
          </Typography>

          <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
            Currently with{' '}
            <Box component="span" sx={{ fontWeight: 500, color: PALETTE.textPrimary }}>
              {mail.is_multi_assigned
                ? (mail.current_handlers_display?.length
                    ? mail.current_handlers_display.join(', ')
                    : '-')
                : mail.current_handler_details?.full_name || '—'}
            </Box>
            {' '}<Box component="span" sx={{ color: PALETTE.textMuted }}>
              from {calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
            </Box>
          </Typography>
        </Box>

        {/* Overdue banner */}
        {overdue && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              backgroundColor: 'rgba(139, 42, 42, 0.05)',
              border: `1px solid ${PALETTE.dotRed}`,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: PALETTE.burgundy,
                fontWeight: 500,
              }}
            >
              Overdue by {Math.floor((new Date() - new Date(mail.due_date)) / (1000 * 60 * 60 * 24))} days
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Main Content - Two Column */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3,
          mb: 3,
        }}
      >
        {/* Left Column */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* About Info */}
          {mail.initial_instructions && (
            <Paper
              elevation={0}
              sx={{
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 1,
                p: 2.5,
                mb: 2,
                backgroundColor: PALETTE.subtle,
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  mb: 1,
                  color: PALETTE.textSecondary,
                  letterSpacing: '0.08em',
                  fontWeight: 500,
                }}
              >
                About Info
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: PALETTE.textPrimary,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                }}
              >
                {mail.initial_instructions}
              </Typography>
            </Paper>
          )}

          {/* Handler Remarks */}
          {isHandler && (
            <Paper
              elevation={0}
              sx={{
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 1,
                p: 2.5,
                mb: 2,
                backgroundColor: PALETTE.burgundy,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'rgba(255,255,255,0.8)',
                    letterSpacing: '0.08em',
                    fontWeight: 500,
                  }}
                >
                  {mail.current_action_remarks ? 'Handler Remarks' : 'Add Remarks'}
                </Typography>
                {!remarksEditing && mail.status !== 'Closed' && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setRemarksValue(mail.current_action_remarks || '');
                      setRemarksEditing(true);
                    }}
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      '&:hover': { color: '#fff' },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {remarksEditing ? (
                <Box>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={remarksValue}
                    onChange={(e) => setRemarksValue(e.target.value)}
                    placeholder="Enter your remarks about this mail..."
                    variant="outlined"
                    size="small"
                    autoFocus
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '& textarea::placeholder': {
                        color: 'rgba(255,255,255,0.5)',
                      },
                    }}
                  />
                  <Box display="flex" gap={1} mt={1.5} justifyContent="flex-end">
                    <Button
                      size="small"
                      startIcon={<CancelIcon sx={{ fontSize: 16 }} />}
                      onClick={() => setRemarksEditing(false)}
                      disabled={remarksSaving}
                      sx={{
                        color: 'rgba(255,255,255,0.8)',
                        textTransform: 'none',
                        '&:hover': { color: '#fff' },
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                      onClick={handleSaveRemarks}
                      disabled={remarksSaving}
                      sx={{
                        color: '#fff',
                        borderColor: 'rgba(255,255,255,0.5)',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#fff',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                    >
                      {remarksSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: mail.current_action_remarks ? '#fff' : 'rgba(255,255,255,0.6)',
                    whiteSpace: 'pre-wrap',
                    fontStyle: mail.current_action_remarks ? 'normal' : 'italic',
                    lineHeight: 1.7,
                  }}
                >
                  {mail.current_action_remarks ||
                    'Remarks of the assigned officer — click the edit icon to fill in.'}
                </Typography>
              )}
            </Paper>
          )}

          {/* PDF Attachments */}
          {mail?.attachment_metadata?.has_attachment && (
            <Paper
              elevation={0}
              sx={{
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 1,
                p: 2,
                backgroundColor: PALETTE.paper,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <PdfIcon sx={{ color: PALETTE.burgundy, fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 500 }}>
                  PDF Attachments
                </Typography>
              </Box>

              <Stack spacing={1.5}>
                {(mail.attachment_metadata.attachments || []).map((attachment) => (
                  <Box
                    key={attachment.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      backgroundColor: PALETTE.cream,
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        backgroundColor:
                          attachment.upload_stage === 'closed' ? PALETTE.green : PALETTE.subtle,
                        borderRadius: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 500,
                          color: attachment.upload_stage === 'closed' ? '#fff' : PALETTE.textSecondary,
                          fontSize: '0.6875rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {attachment.upload_stage === 'closed' ? 'Closing' : 'Created'}
                      </Typography>
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: PALETTE.textPrimary,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {attachment.original_filename || 'attachment.pdf'}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: PALETTE.textMuted }}
                      >
                        {[attachment.file_size_human, attachment.uploaded_at ? formatDateTime(attachment.uploaded_at) : null]
                          .filter(Boolean)
                          .join(' • ')}
                      </Typography>
                    </Box>

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ViewIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleViewPdf(attachment.upload_stage)}
                      sx={{
                        borderColor: PALETTE.borderDark,
                        color: PALETTE.textSecondary,
                        textTransform: 'none',
                        fontSize: '0.8125rem',
                        '&:hover': {
                          borderColor: PALETTE.textSecondary,
                          backgroundColor: PALETTE.subtle,
                        },
                      }}
                    >
                      View
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleDownloadPdf(attachment.upload_stage)}
                      sx={{
                        borderColor: PALETTE.borderDark,
                        color: PALETTE.textSecondary,
                        textTransform: 'none',
                        fontSize: '0.8125rem',
                        '&:hover': {
                          borderColor: PALETTE.textSecondary,
                          backgroundColor: PALETTE.subtle,
                        },
                      }}
                    >
                      Download
                    </Button>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Box>

        {/* Right Column */}
        <Box
          sx={{
            width: { xs: '100%', lg: 280 },
            flexShrink: 0,
          }}
        >
          {/* Due Date */}
          {mail.due_date && (
            <Paper
              elevation={0}
              sx={{
                border: overdue ? `1px solid ${PALETTE.dotRed}` : `1px solid ${PALETTE.border}`,
                borderRadius: 1,
                p: 2,
                mb: 2,
                backgroundColor: overdue ? 'rgba(139, 42, 42, 0.04)' : PALETTE.paper,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: overdue ? PALETTE.burgundy : PALETTE.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                  mb: 0.5,
                }}
              >
                Due Date
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 500,
                  color: overdue ? PALETTE.burgundy : PALETTE.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDate(mail.due_date)}
              </Typography>
              {overdue && (
                <Typography
                  variant="caption"
                  sx={{
                    color: PALETTE.burgundy,
                    fontWeight: 500,
                  }}
                >
                  Overdue
                </Typography>
              )}
            </Paper>
          )}

          {/* Action buttons for handler */}
          {isHandler && hasActions && <ActionButtons fullWidth />}

          {/* Reopen only for non-handler */}
          {!isHandler && canReopenMail() && (
            <Button
              variant="outlined"
              startIcon={<ReopenIcon sx={{ fontSize: 18 }} />}
              onClick={() => setReopenDialogOpen(true)}
              fullWidth
              sx={{
                borderColor: PALETTE.dotRed,
                color: PALETTE.dotRed,
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  borderColor: PALETTE.burgundy,
                  backgroundColor: 'rgba(107, 26, 26, 0.04)',
                },
              }}
            >
              Reopen
            </Button>
          )}
        </Box>
      </Box>

      {/* Audit Trail */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 1.5,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.125rem',
              fontWeight: 500,
              color: PALETTE.textPrimary,
            }}
          >
            Audit Trail
          </Typography>

          {/* Watcher view: action buttons */}
          {!isHandler && hasActions && !canReopenMail() && <ActionButtons />}
        </Box>

        <Divider sx={{ mb: 2, borderColor: PALETTE.border }} />

        {/* Assignment tables for multi-assigned */}
        {mail.is_multi_assigned && mailAssignments.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {(topLevelAssignments.length > 0 ? topLevelAssignments : mailAssignments).map((assignment) => {
              const rootActorIds = new Set([assignment.assigned_to, assignment.reassigned_to].filter(Boolean).map(Number));
              const nestedChildren = childAssignments.filter((child) => rootActorIds.has(Number(child.assigned_by)));
              return (
                <Box key={`branch-${assignment.id}`}>
                  {renderBranchTable(assignment, false)}
                  {nestedChildren.map((child) => renderBranchTable(child, true))}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Main audit table */}
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 1,
            overflow: 'hidden',
            backgroundColor: PALETTE.paper,
          }}
        >
          {sortedAuditTrail.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                No history available
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: PALETTE.subtle }}>
                  <TableCell sx={{ fontWeight: 500, width: '18%', color: PALETTE.textPrimary }}>By</TableCell>
                  <TableCell sx={{ fontWeight: 500, width: '15%', color: PALETTE.textPrimary }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 500, color: PALETTE.textPrimary }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 500, width: '18%', color: PALETTE.textPrimary }}>When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedAuditTrail.map((entry, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      backgroundColor: idx % 2 === 0 ? 'inherit' : PALETTE.cream,
                      '&:hover': { backgroundColor: PALETTE.cream },
                      '&:last-child .MuiTableCell-root': { borderBottom: 'none' },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ color: PALETTE.textPrimary }}>
                        {entry.performed_by_details?.full_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: PALETTE.textSecondary }}>
                        {entry.action_display || entry.action}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: PALETTE.textSecondary,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {entry.remarks || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: PALETTE.textMuted,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                        noWrap
                      >
                        {formatDateTime(entry.timestamp)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Box>

      {/* Dialogs */}
      <ReassignDialog
        open={reassignDialogOpen}
        onClose={() => setReassignDialogOpen(false)}
        mailId={id}
        onReassign={handleReassign}
      />
      <CloseMailDialog
        open={closeDialogOpen}
        onDialogClose={() => setCloseDialogOpen(false)}
        mailSlNo={mail.sl_no}
        onClose={handleClose}
      />
      <ReopenDialog
        open={reopenDialogOpen}
        onClose={() => setReopenDialogOpen(false)}
        mailSlNo={mail.sl_no}
        onReopen={handleReopen}
      />
      <MultiAssignDialog
        open={multiAssignDialogOpen}
        onClose={() => setMultiAssignDialogOpen(false)}
        mailId={id}
        onSuccess={() => { loadMail(); loadAuditTrail(); }}
        currentUser={user}
      />
      <UpdateCurrentActionDialog
        open={updateActionDialogOpen}
        onClose={() => setUpdateActionDialogOpen(false)}
        currentActionStatus={mail.current_action_status}
        currentActionRemarks={mail.current_action_remarks}
        onUpdate={handleUpdateCurrentAction}
      />
    </Box>
  );
};

export default MailDetailPage;
