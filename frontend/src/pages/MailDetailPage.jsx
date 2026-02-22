import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  TextField,
  IconButton,
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
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, calculateTimeInStage, isOverdue, getRelativeTime } from '../utils/dateHelpers';
import { STATUS_COLORS, ACTION_STATUS_COLORS, DETAIL_STATUS_CHIP } from '../utils/constants';
import ReassignDialog from '../components/ReassignDialog';
import CloseMailDialog from '../components/CloseMailDialog';
import ReopenDialog from '../components/ReopenDialog';
import MultiAssignDialog from '../components/MultiAssignDialog';
import AssignmentsPanel from '../components/AssignmentsPanel';
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

  // Inline remarks editing state
  const [remarksEditing, setRemarksEditing] = useState(false);
  const [remarksValue, setRemarksValue] = useState('');
  const [remarksSaving, setRemarksSaving] = useState(false);

  useEffect(() => {
    loadMail();
    loadAuditTrail();
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pdfError') === '1') {
      setPdfUploadWarning(true);
    }
  }, []);

  const loadMail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await mailService.getMailById(id);
      setMail(data);
    } catch (err) {
      setError('Failed to load mail details. Please try again.');
      console.error('Error loading mail:', err);
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
    if (mail.is_multi_assigned) {
      return user?.role === 'AG';
    }
    if (user?.role === 'AG') return true;
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    if (user?.id === handlerId) return true;
    return false;
  };

  const canReopenMail = () => {
    return canReopen() && mail?.status === 'Closed';
  };

  const canMultiAssign = () => {
    if (!mail || mail.status === 'Closed') return false;
    if (user?.role === 'AG') return true;
    const sectionId = mail?.section_details?.id || mail?.section;
    if (user?.role === 'DAG' && sectionId && user?.sections?.includes(sectionId)) return true;
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
        <Button onClick={() => navigate('/mails')} sx={{ mt: 2 }}>
          Back to Mail List
        </Button>
      </Box>
    );
  }

  const overdue = isOverdue(mail.due_date, mail.status);

  const sortedAuditTrail = [...auditTrail].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/mails')}
        sx={{ mb: 3 }}
      >
        Back to Mail List
      </Button>

      {pdfUploadWarning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setPdfUploadWarning(false)}>
          Mail was created successfully, but the PDF attachment could not be uploaded. You can retry uploading later if needed.
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Title row: Subject (h5) + Status chip */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box flex={1}>
            <Typography variant="h5" component="h1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {mail.mail_reference_subject}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {mail.sl_no}
            </Typography>
          </Box>
          <Chip
            label={DETAIL_STATUS_CHIP[mail.status]?.label || mail.status}
            color={DETAIL_STATUS_CHIP[mail.status]?.color || 'default'}
            sx={{ flexShrink: 0, fontWeight: 600 }}
          />
        </Box>

        {/* Overdue banner: only shown when overdue and not Closed */}
        {overdue && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'error.lighter',
              border: '1px solid',
              borderColor: 'error.light',
            }}
          >
            <WarningIcon color="error" fontSize="small" />
            <Typography variant="body2" color="error.dark" fontWeight={600}>
              Overdue by {Math.floor((new Date() - new Date(mail.due_date)) / (1000 * 60 * 60 * 24))} days
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Two-column layout */}
      <Grid container spacing={3} alignItems="flex-start">

        {/* LEFT COLUMN — 65% */}
        <Grid item xs={12} md={8}>

          {/* Origin Card */}
          <Card sx={{ mb: 2, borderRadius: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                Origin
              </Typography>
              <Divider sx={{ my: 1 }} />
              {mail.from_office && (
                <Box mb={1.5}>
                  <Typography variant="caption" color="text.secondary">From Office</Typography>
                  <Typography variant="body1">{mail.from_office}</Typography>
                </Box>
              )}
              {mail.date_received && (
                <Box mb={1.5}>
                  <Typography variant="caption" color="text.secondary">Date Received</Typography>
                  <Typography variant="body1">{formatDate(mail.date_received)}</Typography>
                </Box>
              )}
              {mail.letter_no && (
                <Box mb={1.5}>
                  <Typography variant="caption" color="text.secondary">Letter No</Typography>
                  <Typography variant="body1">{mail.letter_no}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Instructions Card — only render if action_required is non-empty */}
          {mail.action_required && (
            <Card sx={{ mb: 2, borderRadius: 2 }} elevation={1}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Instructions
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {mail.action_required}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Handler Remarks Card — ALWAYS rendered */}
          <Card
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '2px solid',
              borderColor: 'primary.light',
            }}
            elevation={2}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="overline" color="primary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
                  Handler Remarks
                </Typography>
                {canEditRemarks() && mail.status !== 'Closed' && !remarksEditing && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setRemarksValue(mail.current_action_remarks || '');
                      setRemarksEditing(true);
                    }}
                    title="Edit remarks"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Divider sx={{ my: 1 }} />
              {remarksEditing ? (
                <Box>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={remarksValue}
                    onChange={(e) => setRemarksValue(e.target.value)}
                    placeholder="What are you doing with this mail? What's the current status?"
                    variant="outlined"
                    size="small"
                    autoFocus
                  />
                  <Box display="flex" gap={1} mt={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={() => setRemarksEditing(false)}
                      disabled={remarksSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveRemarks}
                      disabled={remarksSaving}
                    >
                      {remarksSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    color: mail.current_action_remarks ? 'text.primary' : 'text.secondary',
                    fontStyle: mail.current_action_remarks ? 'normal' : 'italic',
                  }}
                >
                  {mail.current_action_remarks || 'No remarks yet'}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* PDF Attachment — only if present */}
          {mail?.attachment_metadata?.has_attachment && (
            <Card sx={{ mb: 2, borderRadius: 2 }} elevation={1}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Attachment
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                  <PdfIcon color="error" />
                  <Box flex={1}>
                    <Typography variant="body2">
                      {mail.attachment_metadata.original_filename || 'attachment.pdf'}
                    </Typography>
                    {(mail.attachment_metadata.file_size_human || mail.attachment_metadata.uploaded_at) && (
                      <Typography variant="caption" color="text.secondary">
                        {mail.attachment_metadata.file_size_human || ''}
                        {mail.attachment_metadata.uploaded_at
                          ? ` · Uploaded ${formatDateTime(mail.attachment_metadata.uploaded_at)}`
                          : ''}
                      </Typography>
                    )}
                  </Box>
                  <Button variant="outlined" size="small" onClick={handleViewPdf}>View</Button>
                  <Button variant="outlined" size="small" onClick={handleDownloadPdf}>Download</Button>
                </Box>
              </CardContent>
            </Card>
          )}

        </Grid>

        {/* RIGHT COLUMN — 35% */}
        <Grid item xs={12} md={4}>

          {/* Action Buttons — shown only when user has permission */}
          {(canReassignMail() || canCloseMail() || canReopenMail() || canMultiAssign()) && (
            <Card sx={{ mb: 2, borderRadius: 2 }} elevation={1}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Actions
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" flexDirection="column" gap={1}>
                  {canReassignMail() && (
                    <Button
                      variant="outlined"
                      startIcon={<ReassignIcon />}
                      onClick={() => setReassignDialogOpen(true)}
                      fullWidth
                    >
                      Reassign
                    </Button>
                  )}
                  {canCloseMail() && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CloseIcon />}
                      onClick={() => setCloseDialogOpen(true)}
                      fullWidth
                    >
                      Close Mail
                    </Button>
                  )}
                  {canReopenMail() && (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<ReopenIcon />}
                      onClick={() => setReopenDialogOpen(true)}
                      fullWidth
                    >
                      Reopen
                    </Button>
                  )}
                  {canMultiAssign() && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<MultiAssignIcon />}
                      onClick={() => setMultiAssignDialogOpen(true)}
                      fullWidth
                    >
                      Assign to Multiple
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Current Handler Card */}
          <Card sx={{ mb: 2, borderRadius: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                Current Handler
              </Typography>
              <Divider sx={{ my: 1 }} />
              {mail.is_multi_assigned && mail.current_handlers_display?.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {mail.current_handlers_display.map((name, idx) => (
                    <Chip key={`${name}-${idx}`} label={name} color="primary" size="small" variant="outlined" />
                  ))}
                </Box>
              ) : (
                mail.current_handler_details?.full_name && (
                  <Typography variant="body1" fontWeight={600}>
                    {mail.current_handler_details.full_name}
                  </Typography>
                )
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                In stage for {calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
              </Typography>
            </CardContent>
          </Card>

          {/* Due Date Card */}
          {mail.due_date && (
            <Card sx={{ mb: 2, borderRadius: 2 }} elevation={1}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Due Date
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color={overdue ? 'error' : 'text.primary'}
                >
                  {formatDate(mail.due_date)}
                </Typography>
                {overdue && (
                  <Typography variant="caption" color="error">
                    Overdue
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

        </Grid>

      </Grid>

      {/* Assignments Panel */}
      <AssignmentsPanel
        mailId={id}
        onUpdate={() => { loadMail(); loadAuditTrail(); }}
        mailData={mail}
      />

      {/* Audit Trail — MUI Timeline */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          {mail.is_multi_assigned ? 'Global Activity Log' : 'Audit Trail'}
        </Typography>
        {mail.is_multi_assigned && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            For detailed per-assignee history, see the Assignments Overview above.
          </Typography>
        )}
        <Divider sx={{ mb: 2 }} />

        {sortedAuditTrail.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No audit trail available
          </Typography>
        ) : (
          <Timeline
            sx={{
              p: 0,
              [`& .MuiTimelineItem-root::before`]: { flex: 0, padding: 0 },
            }}
          >
            {sortedAuditTrail
              .filter(entry => {
                if (mail.is_multi_assigned) {
                  return ['CREATE', 'MULTI_ASSIGN', 'CLOSE', 'REOPEN'].includes(entry.action);
                }
                return true;
              })
              .map((entry, index, arr) => (
                <TimelineItem key={index}>
                  <TimelineSeparator>
                    {{
                      CREATE: <TimelineDot color="primary" />,
                      ASSIGN: <TimelineDot color="info" />,
                      REASSIGN: <TimelineDot color="warning" />,
                      UPDATE: <TimelineDot color="secondary" />,
                      CLOSE: <TimelineDot color="success" />,
                      REOPEN: <TimelineDot color="warning" />,
                      MULTI_ASSIGN: <TimelineDot color="info" />,
                    }[entry.action] || <TimelineDot />}
                    {index < arr.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent sx={{ pb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {getRelativeTime(entry.timestamp)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {formatDateTime(entry.timestamp)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>{entry.action_display || entry.action}</strong>
                      {' '}by {entry.performed_by_details?.full_name || 'Unknown'}
                    </Typography>
                    {entry.remarks && (
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.5,
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          borderLeft: '3px solid',
                          borderColor: 'grey.300',
                          fontStyle: 'italic',
                        }}
                      >
                        {entry.remarks}
                      </Typography>
                    )}
                  </TimelineContent>
                </TimelineItem>
              ))}
          </Timeline>
        )}
      </Paper>

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
