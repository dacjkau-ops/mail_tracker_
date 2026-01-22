import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';

const statusColors = {
  Active: 'primary',
  Completed: 'success',
  Revoked: 'error',
};

const AssignmentCard = ({ assignment, onUpdate, currentUser }) => {
  const [expanded, setExpanded] = useState(false);
  const [remarksDialogOpen, setRemarksDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAssignee = currentUser?.id === assignment.assigned_to;
  const isSupervisor = currentUser?.role === 'AG' ||
    (currentUser?.role === 'DAG' && currentUser?.id === assignment.assigned_by);
  const isActive = assignment.status === 'Active';

  const handleUpdateRemarks = async () => {
    if (!remarks.trim()) {
      setError('Please provide remarks');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mailService.updateAssignmentRemarks(assignment.id, remarks.trim());
      setRemarksDialogOpen(false);
      setRemarks('');
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update remarks');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!remarks.trim()) {
      setError('Please provide completion remarks');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mailService.completeAssignment(assignment.id, remarks.trim());
      setCompleteDialogOpen(false);
      setRemarks('');
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!remarks.trim()) {
      setError('Please provide reason for revoking');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mailService.revokeAssignment(assignment.id, remarks.trim());
      setRevokeDialogOpen(false);
      setRemarks('');
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to revoke assignment');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {assignment.assigned_to_details?.full_name || 'Unknown'}
            </Typography>
            <Chip
              label={assignment.status}
              color={statusColors[assignment.status]}
              size="small"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Assigned by: {assignment.assigned_by_details?.full_name || 'Unknown'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Assigned on: {formatDate(assignment.created_at)}
          </Typography>
          {assignment.completed_at && (
            <Typography variant="body2" color="text.secondary">
              Completed on: {formatDate(assignment.completed_at)}
            </Typography>
          )}
        </Box>
        <IconButton onClick={() => setExpanded(!expanded)} size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Divider sx={{ my: 1 }} />

        {assignment.assignment_remarks && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Assignment Instructions:
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {assignment.assignment_remarks}
            </Typography>
          </Box>
        )}

        {assignment.user_remarks && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Officer's Remarks:
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {assignment.user_remarks}
            </Typography>
          </Box>
        )}

        {isActive && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {isAssignee && (
              <>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setRemarks(assignment.user_remarks || '');
                    setRemarksDialogOpen(true);
                  }}
                >
                  Update Remarks
                </Button>
                <Button
                  size="small"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => {
                    setRemarks('');
                    setCompleteDialogOpen(true);
                  }}
                >
                  Mark Complete
                </Button>
              </>
            )}
            {isSupervisor && (
              <Button
                size="small"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => {
                  setRemarks('');
                  setRevokeDialogOpen(true);
                }}
              >
                Revoke
              </Button>
            )}
          </Box>
        )}
      </Collapse>

      {/* Update Remarks Dialog */}
      <Dialog open={remarksDialogOpen} onClose={() => setRemarksDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Your Remarks</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="Your Remarks"
            fullWidth
            multiline
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemarksDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateRemarks} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onClose={() => setCompleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Assignment as Complete</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="Completion Remarks"
            fullWidth
            multiline
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Describe what was done..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleComplete} variant="contained" color="success" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Complete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onClose={() => setRevokeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Revoke Assignment</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will remove the assignment from {assignment.assigned_to_details?.full_name}.
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Revoking"
            fullWidth
            multiline
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRevoke} variant="contained" color="error" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

const AssignmentsPanel = ({ mailId, onUpdate }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);

  const loadAssignments = async () => {
    if (!mailId) return;
    setLoading(true);
    setError('');
    try {
      const data = await mailService.getAssignments(mailId);
      setAssignments(data);
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [mailId]);

  const handleAssignmentUpdate = () => {
    loadAssignments();
    onUpdate?.();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (assignments.length === 0) {
    return null;
  }

  const activeCount = assignments.filter(a => a.status === 'Active').length;
  const completedCount = assignments.filter(a => a.status === 'Completed').length;

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            Parallel Assignments ({assignments.length})
          </Typography>
          <Chip label={`${activeCount} Active`} color="primary" size="small" />
          <Chip label={`${completedCount} Completed`} color="success" size="small" />
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Box sx={{ mt: 2 }}>
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onUpdate={handleAssignmentUpdate}
              currentUser={user}
            />
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default AssignmentsPanel;
