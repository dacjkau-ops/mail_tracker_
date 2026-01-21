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
  Replay as ReopenIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, calculateTimeInStage, isOverdue } from '../utils/dateHelpers';
import { STATUS_COLORS } from '../utils/constants';
import RemarksEditDialog from '../components/RemarksEditDialog';
import ReassignDialog from '../components/ReassignDialog';
import CloseMailDialog from '../components/CloseMailDialog';
import ReopenDialog from '../components/ReopenDialog';

const MailDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canReopen } = useAuth();

  const [mail, setMail] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [remarksDialogOpen, setRemarksDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);

  useEffect(() => {
    loadMail();
    loadAuditTrail();
  }, [id]);

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

  const handleRemarksUpdate = async (remarks) => {
    try {
      await mailService.updateRemarks(id, remarks);
      setRemarksDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error('Failed to update remarks');
    }
  };

  const handleReassign = async (data) => {
    try {
      await mailService.reassignMail(id, data);
      setReassignDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error('Failed to reassign mail');
    }
  };

  const handleClose = async (remarks) => {
    try {
      await mailService.closeMail(id, remarks);
      setCloseDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error('Failed to close mail');
    }
  };

  const handleReopen = async (remarks) => {
    try {
      await mailService.reopenMail(id, remarks);
      setReopenDialogOpen(false);
      loadMail();
      loadAuditTrail();
    } catch (err) {
      throw new Error('Failed to reopen mail');
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
    if (user?.role === 'DAG' && user?.section === sectionId) return true;
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    if (user?.id === handlerId) return true;
    return false;
  };

  const canCloseMail = () => {
    if (!mail || mail.status === 'Closed') return false;
    if (user?.role === 'AG') return true;
    const handlerId = mail?.current_handler_details?.id || mail?.current_handler;
    if (user?.id === handlerId) return true;
    return false;
  };

  const canReopenMail = () => {
    return canReopen() && mail?.status === 'Closed';
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

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/mails')}
        sx={{ mb: 3 }}
      >
        Back to Mail List
      </Button>

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
              {mail.section_details?.name || 'N/A'}
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
            <Typography variant="body1" gutterBottom>
              {mail.assigned_to_details?.full_name || 'N/A'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Current Handler
            </Typography>
            <Typography variant="body1" gutterBottom>
              {mail.current_handler_details?.full_name || 'N/A'}
            </Typography>
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

      {/* Remarks Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Remarks</Typography>
          {canEditRemarks() && (
            <Button
              startIcon={<EditIcon />}
              onClick={() => setRemarksDialogOpen(true)}
              size="small"
            >
              Edit Remarks
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body1" color={mail.remarks ? 'inherit' : 'text.secondary'}>
          {mail.remarks || 'No remarks added yet'}
        </Typography>
      </Paper>

      {/* Action Buttons */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Actions
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" gap={2} flexWrap="wrap">
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
        </Box>
      </Paper>

      {/* Audit Trail */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Audit Trail / History Log
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <List>
          {auditTrail.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No audit trail available
            </Typography>
          ) : (
            auditTrail.map((entry, index) => (
              <ListItem key={index} divider={index < auditTrail.length - 1}>
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
      <RemarksEditDialog
        open={remarksDialogOpen}
        onClose={() => setRemarksDialogOpen(false)}
        currentRemarks={mail.remarks}
        onSave={handleRemarksUpdate}
      />

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
    </Box>
  );
};

export default MailDetailPage;
