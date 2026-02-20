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
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack,
  Edit as EditIcon,
  SwapHoriz as ReassignIcon,
  CheckCircle as CloseIcon,
  TaskAlt as TaskAltIcon,
  Replay as ReopenIcon,
  GroupAdd as MultiAssignIcon,
  Update as UpdateActionIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { STATUS_COLORS, ACTION_STATUS_COLORS } from '../utils/constants';
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
      // Revoke after a short delay to allow the new tab to load
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

  const canEditRemarks = () => {
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    return user?.id === handlerId;
  };

  const canReassignMail = () => {
    if (!mail) return false;
    if (user?.role === 'AG') return true;
    const sectionId = mail?.section_details?.id || mail?.section;
    // DAG can reassign if mail's section is in their managed sections
    if (user?.role === 'DAG' && sectionId && user?.sections?.includes(sectionId)) return true;
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    if (user?.id === handlerId) return true;
    return false;
  };

  const canCloseMail = () => {
    if (!mail || mail.status === 'Closed') return false;
    // Multi-assigned mails: only AG can close
    if (mail.is_multi_assigned) {
      return user?.role === 'AG';
    }
    // Single-assigned mails: AG or current handler can close
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
    // DAG can multi-assign if mail's section is in their managed sections
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
  const finalActionTaken = (mail.current_action_remarks || mail.remarks || '').trim();
  const isCompletedMail = mail.status === 'Closed';

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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" component="h1">
              {mail.sl_no}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created by {mail.created_by_details?.full_name || 'Unknown'} on {formatDateTime(mail.created_at)}
            </Typography>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            <Chip label={mail.status} color={STATUS_COLORS[mail.status]} />
            {overdue && <Chip label="OVERDUE" color="error" />}
          </Box>
        </Box>
      </Paper>

      {/* Completion Highlight */}
      {isCompletedMail && (
        <Paper
          sx={{
            p: 3,
            mb: 3,
            border: '2px solid',
            borderColor: 'success.main',
            bgcolor: 'success.lighter',
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <TaskAltIcon color="success" />
            <Typography variant="overline" color="success.dark" sx={{ fontWeight: 800, letterSpacing: 1 }}>
              Final Action Taken
            </Typography>
          </Box>
          <Typography
            variant="h5"
            sx={{
              color: 'success.dark',
              fontWeight: 800,
              lineHeight: 1.3,
              mb: 1,
            }}
          >
            {finalActionTaken || 'Task Completed'}
          </Typography>
          <Typography variant="body2" color="success.dark">
            Completed on {mail.date_of_completion ? formatDate(mail.date_of_completion) : 'N/A'} by{' '}
            {mail.current_handler_details?.full_name || 'Current Handler'}
          </Typography>
        </Paper>
      )}

      {/* Mail Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Mail Information
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Letter No
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.letter_no}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Date Received
            </Typography>
            <Typography variant="body1" gutterBottom>
              {formatDate(mail.date_received)}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Subject
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.mail_reference_subject}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              From Office
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.from_office}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Action Required
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.action_required}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Section
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.section_details?.name || (mail.is_multi_assigned ? 'Cross-Section' : 'N/A')}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Due Date
            </Typography>
            <Typography variant="body1" gutterBottom color={overdue ? 'error' : 'inherit'}>
              {formatDate(mail.due_date)}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Assigned To (Original)
            </Typography>
            {mail.is_multi_assigned && mail.assignees_display?.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {mail.assignees_display.map((name, idx) => (
                  <Chip key={`${name}-${idx}`} label={name} size="small" />
                ))}
              </Box>
            ) : (
              <Typography variant="body1" gutterBottom>
                {mail.assigned_to_details?.full_name || 'N/A'}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Current Handler
            </Typography>
            {mail.is_multi_assigned && mail.current_handlers_display?.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {mail.current_handlers_display.map((name, idx) => (
                  <Chip key={`${name}-${idx}`} label={name} color="primary" size="small" variant="outlined" />
                ))}
              </Box>
            ) : (
              <Typography variant="body1" gutterBottom>
                {mail.current_handler_details?.full_name || 'N/A'}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Monitoring Officer
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.monitoring_officer_details?.full_name || 'N/A'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Time in Current Stage
            </Typography>
            <Typography variant="body1" gutterBottom>
              {calculateTimeInStage(mail.last_status_change, mail.date_of_completion)}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Current Action Status
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              {mail.current_action_status ? (
                <Chip
                  label={mail.current_action_status}
                  color={ACTION_STATUS_COLORS[mail.current_action_status] || 'default'}
                  size={mail.current_action_status === 'Completed' ? 'medium' : 'small'}
                  sx={mail.current_action_status === 'Completed' ? { fontWeight: 700 } : undefined}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Not set
                </Typography>
              )}
              {mail.current_action_updated_at && (
                <Typography variant="caption" color="text.secondary">
                  (Updated: {formatDateTime(mail.current_action_updated_at)})
                </Typography>
              )}
            </Box>
            {mail.current_action_remarks && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                {mail.current_action_remarks}
              </Typography>
            )}
          </Grid>

          {mail.date_of_completion && (
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Date of Completion
              </Typography>
              <Typography variant="body1" gutterBottom>
                {formatDate(mail.date_of_completion)}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Initial Instructions Section */}
      {mail.initial_instructions && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Initial Instructions</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {mail.initial_instructions}
          </Typography>
        </Paper>
      )}

      {/* PDF Attachment */}
      {mail?.attachment_metadata?.has_attachment && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            PDF Attachment
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <PdfIcon color="error" />
            <Box>
              <Typography variant="body2">
                {mail.attachment_metadata.original_filename || 'attachment.pdf'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {mail.attachment_metadata.file_size_human || ''}{' '}
                {mail.attachment_metadata.uploaded_at
                  ? `· Uploaded ${formatDateTime(mail.attachment_metadata.uploaded_at)}`
                  : ''}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={handleViewPdf}
            >
              View
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleDownloadPdf}
            >
              Download
            </Button>
          </Box>
        </Paper>
      )}

      {/* Action Buttons */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Actions
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" gap={2} flexWrap="wrap">
          {canEditRemarks() && mail.status !== 'Closed' && (
            <Button
              variant="contained"
              startIcon={<UpdateActionIcon />}
              onClick={() => setUpdateActionDialogOpen(true)}
            >
              Update Current Action
            </Button>
          )}
          {canReassignMail() && (
            <Button
              variant="outlined"
              startIcon={<ReassignIcon />}
              onClick={() => setReassignDialogOpen(true)}
            >
              Reassign
            </Button>
          )}
          {canCloseMail() && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<CloseIcon />}
              onClick={() => setCloseDialogOpen(true)}
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
            >
              Assign to Multiple
            </Button>
          )}
        </Box>
      </Paper>

      {/* Parallel Assignments Panel - Primary view for multi-assigned mails */}
      <AssignmentsPanel
        mailId={id}
        onUpdate={() => { loadMail(); loadAuditTrail(); }}
        mailData={mail}
      />

      {/* Audit Trail - For single-assigned mails or as supplementary info */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {mail.is_multi_assigned ? 'Global Activity Log' : 'Audit Trail / History Log'}
        </Typography>
        {mail.is_multi_assigned && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            For detailed per-assignee history, see the Assignments Overview above.
          </Typography>
        )}
        <Divider sx={{ mb: 2 }} />
        <List>
          {auditTrail.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No audit trail available
            </Typography>
          ) : (
            auditTrail
              .filter(entry => {
                // For multi-assigned mails, show only high-level events in global log
                if (mail.is_multi_assigned) {
                  return ['CREATE', 'MULTI_ASSIGN', 'CLOSE', 'REOPEN'].includes(entry.action);
                }
                return true; // Show all for single-assignment
              })
              .map((entry, index, filteredArr) => (
                <ListItem key={index} divider={index < filteredArr.length - 1}>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body2" component="span" fontWeight="medium">
                          [{formatDateTime(entry.timestamp)}]
                        </Typography>
                        <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                          {entry.action_display || entry.action} by {entry.performed_by_details?.full_name || 'Unknown'}
                        </Typography>
                      </Box>
                    }
                    secondary={entry.remarks && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Remarks: {entry.remarks}
                      </Typography>
                    )}
                  />
                </ListItem>
              ))
          )}
        </List>
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
