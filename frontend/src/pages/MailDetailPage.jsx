import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Chip,
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
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { DETAIL_STATUS_CHIP } from '../utils/constants';
import ReassignDialog from '../components/ReassignDialog';
import CloseMailDialog from '../components/CloseMailDialog';
import ReopenDialog from '../components/ReopenDialog';
import MultiAssignDialog from '../components/MultiAssignDialog';
import UpdateCurrentActionDialog from '../components/UpdateCurrentActionDialog';

// Palette aligned with reference mock (test_2.jpg)
const GREEN_BORDER = '#6ea55d';
const HEADER_BLUE = 'linear-gradient(180deg, #8faec8 0%, #6f8ea9 100%)';
const HEADER_BLUE_DARK = 'linear-gradient(180deg, #7f9fbb 0%, #6282a0 100%)';
const BUTTON_PEACH = 'linear-gradient(180deg, #f2b8a2 0%, #e39d84 100%)';
const BUTTON_PEACH_HOVER = 'linear-gradient(180deg, #e8a98f 0%, #d7896f 100%)';
const BUTTON_TEXT = '#2a2a2a';
const STATUS_GREEN = '#9ab496';
const STATUS_GREEN_BORDER = '#6b8f6b';
const ROW_LIGHT = '#d7e5d8';
const HEAD_LIGHT = '#edf0f2';

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
    } catch (err) {
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

  const handleViewPdf = async () => {
    try {
      const blob = await mailService.viewPdf(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await mailService.viewPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mail?.attachment_metadata?.original_filename || 'attachment.pdf';
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

  const handleClose = async (remarks) => {
    try {
      await mailService.closeMail(id, remarks);
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
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mail) {
    return (
      <Box>
        <Alert severity="error">{error || 'Mail not found'}</Alert>
        <Button onClick={() => navigate('/mails')} sx={{ mt: 2 }}>Back to Mail List</Button>
      </Box>
    );
  }

  const overdue = isOverdue(mail.due_date, mail.status);

  // Sort audit trail newest-first
  const sortedAuditTrail = [...auditTrail].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Get creator from audit trail (oldest CREATE entry)
  const createEntry = auditTrail.find(e => e.action === 'CREATE');
  const createdByName = createEntry?.performed_by_details?.full_name || '—';
  const createdAt = createEntry?.timestamp;

  // Handler view = user is the current handler
  const isHandler = canEditRemarks();

  // Assignments list (included in mail API response)
  const mailAssignments = mail.assignments || [];
  const topLevelAssignments = mailAssignments.filter(
    (a) => Number(a.assigned_by) === Number(mail.created_by)
  );
  const childAssignments = mailAssignments.filter(
    (a) => Number(a.assigned_by) !== Number(mail.created_by)
  );
  const buildAssignmentBranchRows = (assignment) => {
    const rows = [];
    const timeline = [...(assignment.remarks_timeline || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const remarkByOfficer = {};
    const reassignRegex = /^Reassigned to\s+(.+?):\s*(.*)$/i;
    let currentOfficer = assignment.assigned_to_details?.full_name || '-';

    timeline.forEach((remark) => {
      const content = remark.content || '';
      const parsed = content.match(reassignRegex);
      const createdBy = remark.created_by_details?.full_name;

      if (!parsed) {
        if (createdBy) {
          remarkByOfficer[createdBy] = content;
        } else {
          remarkByOfficer[currentOfficer] = content;
        }
        return;
      }

      const nextOfficer = parsed[1]?.trim() || '-';
      const reason = parsed[2]?.trim();
      rows.push({
        officerId: null,
        officer: currentOfficer,
        remarks: remarkByOfficer[currentOfficer] || reason || '-',
        reassignedToId: null,
        reassignedTo: nextOfficer,
        on: remark.created_at,
      });
      currentOfficer = nextOfficer;
    });

    const isUntouchedActiveAssignment =
      assignment.status === 'Active' &&
      timeline.length === 0;

    rows.push({
      officerId: assignment.reassigned_to || assignment.assigned_to || null,
      officer: currentOfficer,
      remarks: isUntouchedActiveAssignment
        ? 'Still Working'
        : (remarkByOfficer[currentOfficer] || '-'),
      reassignedToId: null,
      reassignedTo: isUntouchedActiveAssignment ? '' : '-',
      on: isUntouchedActiveAssignment
        ? ''
        : (assignment.completed_at || assignment.updated_at || assignment.created_at),
    });

    return rows;
  };
  const renderBranchTable = (assignment, isChild = false) => {
    const branchRows = buildAssignmentBranchRows(assignment);
    return (
      <Paper
        key={`${isChild ? 'child' : 'root'}-${assignment.id}`}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: GREEN_BORDER,
          borderRadius: 2,
          mb: 2,
          ml: isChild ? 4 : 0,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 1.5, bgcolor: ROW_LIGHT, borderBottom: '1px solid', borderColor: GREEN_BORDER }}>
          <Typography variant="body1" fontWeight={700}>
            Assigned to {assignment.assigned_to_details?.full_name || '-'} by {assignment.assigned_by_details?.full_name || createdByName}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: HEAD_LIGHT }}>
              <TableCell sx={{ fontWeight: 700, width: '30%' }}>Officer</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '35%' }}>Remarks</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '20%' }}>Reassigned to</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '15%' }}>On</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branchRows.map((row, rowIdx) => (
              <TableRow key={`${assignment.id}-row-${rowIdx}`} sx={{ bgcolor: rowIdx % 2 === 0 ? 'inherit' : ROW_LIGHT }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{row.officer}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{row.remarks}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.reassignedTo}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>{row.on ? formatDateTime(row.on) : '-'}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    );
  };

  // Action buttons — shown in right column for handler, beside section header for watcher
  const hasActions = canReassignMail() || canCloseMail() || canMultiAssign() || canReopenMail();

  const ActionButtons = ({ fullWidth = false }) => (
    <Stack spacing={1} direction={fullWidth ? 'column' : 'row'} flexWrap="wrap">
      {canCloseMail() && (
        <Button
          variant="contained"
          startIcon={<CloseIcon />}
          onClick={() => setCloseDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            background: BUTTON_PEACH,
            color: BUTTON_TEXT,
            border: '1px solid #cf8c74',
            '&:hover': { background: BUTTON_PEACH_HOVER },
          }}
        >
          Task Completed
        </Button>
      )}
      {canReassignMail() && (
        <Button
          variant="contained"
          startIcon={<ReassignIcon />}
          onClick={() => setReassignDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            background: BUTTON_PEACH,
            color: BUTTON_TEXT,
            border: '1px solid #cf8c74',
            '&:hover': { background: BUTTON_PEACH_HOVER },
          }}
        >
          Reassign
        </Button>
      )}
      {canMultiAssign() && (
        <Button
          variant="outlined"
          startIcon={<MultiAssignIcon />}
          onClick={() => setMultiAssignDialogOpen(true)}
          fullWidth={fullWidth}
          sx={{
            borderColor: GREEN_BORDER,
            color: '#2f4a31',
            '&:hover': { borderColor: '#5a8c4d', bgcolor: '#f2f7f0' },
          }}
        >
          Assign to Multiple
        </Button>
      )}
      {canReopenMail() && (
        <Button
          variant="outlined"
          color="error"
          startIcon={<ReopenIcon />}
          onClick={() => setReopenDialogOpen(true)}
          fullWidth={fullWidth}
        >
          Reopen
        </Button>
      )}
    </Stack>
  );

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/mails')} sx={{ mb: 2 }}>
        Back to Mail List
      </Button>

      {pdfUploadWarning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setPdfUploadWarning(false)}>
          Mail was created successfully, but the PDF attachment could not be uploaded.
        </Alert>
      )}

      {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
      <Paper
        sx={{
          border: '2px solid',
          borderColor: GREEN_BORDER,
          borderRadius: 2,
          p: { xs: 1.5, sm: 2 },
          mb: 3,
        }}
        elevation={0}
      >
        {/* Row 1: SL No | Letter label + No | Subject | Status chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight={700} sx={{ minWidth: 90, lineHeight: 1 }}>
            {mail.sl_no}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 1, minWidth: 0 }}>
            {/* "Letter No." label box */}
            <Box
              sx={{
                border: '1px solid',
                borderColor: GREEN_BORDER,
                borderRadius: 0.5,
                px: 1,
                py: 0.5,
                whiteSpace: 'nowrap',
              }}
            >
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Letter No.
              </Typography>
            </Box>

            {/* Letter number value */}
            <Box
              sx={{
                bgcolor: 'grey.200',
                borderRadius: 0.5,
                px: 1.5,
                py: 0.5,
                maxWidth: 200,
                overflow: 'hidden',
              }}
            >
              <Typography variant="body2" noWrap color="text.secondary">
                {mail.letter_no}
              </Typography>
            </Box>

            {/* Subject */}
            <Typography
              variant="body1"
              fontWeight={500}
              sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {mail.mail_reference_subject}
            </Typography>
          </Box>

          {/* Status chip */}
          <Chip
            label={DETAIL_STATUS_CHIP[mail.status]?.label || mail.status}
            color={DETAIL_STATUS_CHIP[mail.status]?.color || 'default'}
            sx={{
              fontWeight: 700,
              flexShrink: 0,
              bgcolor: STATUS_GREEN,
              color: '#243526',
              border: `1px solid ${STATUS_GREEN_BORDER}`,
            }}
          />
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Row 2: Created by (left) | Currently with (right) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Created by{' '}
            <Box component="span" fontWeight={700} color="text.primary">
              {createdByName}
            </Box>
            {createdAt ? ` on ${formatDate(createdAt)}` : ''}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Currently with{' '}
            <Box component="span" fontWeight={700} color="text.primary">
              {mail.is_multi_assigned
                ? (mail.current_handlers_display?.length
                    ? mail.current_handlers_display.join(', ')
                    : '-')
                : mail.current_handler_details?.full_name || '—'}
            </Box>
            {' '}from {calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
          </Typography>
        </Box>

        {/* Overdue banner */}
        {overdue && (
          <Alert severity="error" icon={<WarningIcon fontSize="small" />} sx={{ mt: 1.5 }}>
            Overdue by {Math.floor((new Date() - new Date(mail.due_date)) / (1000 * 60 * 60 * 24))} days
          </Alert>
        )}
      </Paper>

      {/* ── MAIN TWO-COLUMN CONTENT ──────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', mb: 3 }}>

        {/* LEFT COLUMN */}
        <Box sx={{ width: '100%', minWidth: 0 }}>

          {/* About Info */}
          {mail.initial_instructions && (
            <Box
              sx={{
                background: HEADER_BLUE,
                color: '#17222c',
                border: '1px solid #5f7e99',
                borderRadius: 1.5,
                p: 2.5,
                mb: 2,
              }}
            >
              <Typography
                variant="overline"
                sx={{ opacity: 0.75, display: 'block', mb: 0.5, letterSpacing: 1 }}
              >
                About Info
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {mail.initial_instructions}
              </Typography>
            </Box>
          )}

          {/* Handler Remarks — shown for current handler */}
          {isHandler && (
            <Box
              sx={{
                background: HEADER_BLUE_DARK,
                color: 'white',
                borderRadius: 1.5,
                p: 2.5,
                mb: 2,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="overline" sx={{ opacity: 0.75, letterSpacing: 1 }}>
                  {mail.current_action_remarks ? 'Handler Remarks' : 'Add Remarks'}
                </Typography>
                {!remarksEditing && mail.status !== 'Closed' && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setRemarksValue(mail.current_action_remarks || '');
                      setRemarksEditing(true);
                    }}
                    sx={{ color: 'rgba(255,255,255,0.75)' }}
                    title="Edit remarks"
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
                      '& .MuiOutlinedInput-root': { color: 'white' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.6)',
                      },
                      '& textarea::placeholder': { color: 'rgba(255,255,255,0.5)' },
                    }}
                  />
                  <Box display="flex" gap={1} mt={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={() => setRemarksEditing(false)}
                      disabled={remarksSaving}
                      sx={{ color: 'rgba(255,255,255,0.8)' }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveRemarks}
                      disabled={remarksSaving}
                      sx={{
                        color: 'white',
                        borderColor: 'rgba(255,255,255,0.5)',
                        '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
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
                    fontStyle: mail.current_action_remarks ? 'normal' : 'italic',
                    opacity: mail.current_action_remarks ? 1 : 0.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {mail.current_action_remarks ||
                    'Remarks of the assigned officer — click the edit icon to fill in.'}
                </Typography>
              )}
            </Box>
          )}

          {/* PDF Attachment */}
          {mail?.attachment_metadata?.has_attachment && (
            <Box
              sx={{
                border: '1px solid',
                borderColor: GREEN_BORDER,
                borderRadius: 1.5,
                p: 2,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <PdfIcon color="error" />
              <Box flex={1}>
                <Typography variant="body2">
                  {mail.attachment_metadata.original_filename || 'attachment.pdf'}
                </Typography>
                {mail.attachment_metadata.file_size_human && (
                  <Typography variant="caption" color="text.secondary">
                    {mail.attachment_metadata.file_size_human}
                  </Typography>
                )}
              </Box>
              <Button variant="outlined" size="small" onClick={handleViewPdf}>View</Button>
              <Button variant="outlined" size="small" onClick={handleDownloadPdf}>Download</Button>
            </Box>
          )}

        </Box>

        {/* RIGHT COLUMN — dashed left border acts as the divider */}
        <Box
          sx={{
            width: '100%',
            mt: 1,
            pt: 2,
            borderTop: '2px dashed',
            borderColor: 'grey.300',
          }}
        >
          {/* Due Date */}
          {mail.due_date && (
            <Box
              sx={{
                border: '2px solid',
                borderColor: GREEN_BORDER,
                borderRadius: 1.5,
                p: 1.5,
                mb: 2,
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
                Due Date
              </Typography>
              <Typography variant="h6" fontWeight={700} color={overdue ? 'error.main' : 'text.primary'}>
                {formatDate(mail.due_date)}
              </Typography>
              {overdue && (
                <Typography variant="caption" color="error" fontWeight={600}>
                  Overdue
                </Typography>
              )}
            </Box>
          )}

          {/* Action buttons — in right column for handler view */}
          {isHandler && hasActions && <ActionButtons fullWidth={false} />}

          {/* Reopen only (for closed mails, non-handler) */}
          {!isHandler && canReopenMail() && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<ReopenIcon />}
              onClick={() => setReopenDialogOpen(true)}
              fullWidth
            >
              Reopen
            </Button>
          )}
        </Box>

      </Box>

      {/* ── AUDIT TRAIL / ASSIGNMENT HISTORY ────────────────────────────── */}
      <Box sx={{ mt: 1 }}>

        {/* Section header row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 1,
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Audit Trail / Assignment History
          </Typography>

          {/* Watcher view: action buttons appear here (beside the heading) */}
          {!isHandler && hasActions && !canReopenMail() && (
            <ActionButtons fullWidth={false} />
          )}
        </Box>

        <Divider sx={{ borderStyle: 'dashed', mb: 2 }} />

        {/* Assignment table (multi-assigned mails only) */}
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

        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: GREEN_BORDER,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {sortedAuditTrail.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">No history available</Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: HEAD_LIGHT }}>
                  <TableCell sx={{ fontWeight: 700, width: '18%' }}>By</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '15%' }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '18%' }}>When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedAuditTrail.map((entry, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: idx % 2 === 0 ? ROW_LIGHT : 'inherit' }}>
                    <TableCell>
                      <Typography variant="body2">
                        {entry.performed_by_details?.full_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {entry.action_display || entry.action}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {entry.remarks || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
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

      {/* ── DIALOGS (unchanged) ──────────────────────────────────────────── */}
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
