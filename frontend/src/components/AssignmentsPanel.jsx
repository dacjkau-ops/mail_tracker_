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
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Add as AddIcon,
  SwapHoriz as ReassignIcon,
} from '@mui/icons-material';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';

const statusColors = {
  Active: 'primary',
  Completed: 'success',
  Revoked: 'error',
};

/**
 * Isolated Assignment View - for assignees who can only see their own assignment
 * No peer visibility, no other assignee names or remarks
 */
const IsolatedAssignmentView = ({ assignment, mailId, onUpdate, currentUser }) => {
  const [addRemarkDialogOpen, setAddRemarkDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [reassignData, setReassignData] = useState({ new_assignee: null, remarks: '' });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isActive = assignment.status === 'Active';
  const remarksTimeline = assignment.remarks_timeline || [];

  useEffect(() => {
    if (reassignDialogOpen) {
      loadUsersForReassign();
    }
  }, [reassignDialogOpen]);

  const loadUsersForReassign = async () => {
    try {
      const eligibleUsers = await mailService.getReassignCandidates(mailId);
      setUsers(eligibleUsers);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleAddRemark = async () => {
    if (!newRemark.trim()) {
      setError('Please provide remarks');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mailService.addAssignmentRemark(mailId, assignment.id, newRemark.trim());
      setAddRemarkDialogOpen(false);
      setNewRemark('');
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to add remark');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      await mailService.completeAssignmentViaRecord(mailId, assignment.id);
      setCompleteDialogOpen(false);
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to complete assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignData.new_assignee || !reassignData.remarks.trim()) {
      setError('Please select a user and provide remarks');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mailService.reassignAssignment(mailId, assignment.id, {
        new_assignee: reassignData.new_assignee.id,
        remarks: reassignData.remarks.trim(),
      });
      setReassignDialogOpen(false);
      setReassignData({ new_assignee: null, remarks: '' });
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to reassign');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Your Assignment</Typography>
      <Divider sx={{ mb: 2 }} />

      {/* Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Status:</Typography>
        <Chip label={assignment.status} color={statusColors[assignment.status]} size="small" />
      </Box>

      {/* Initial Instructions (read-only) */}
      {assignment.assignment_remarks && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight="bold">
            Instructions from Supervisor:
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
            {assignment.assignment_remarks}
          </Typography>
        </Box>
      )}

      {/* Remarks Timeline (read-only previous remarks) */}
      {remarksTimeline.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>Your Remarks History:</Typography>
          <List dense>
            {remarksTimeline.map((remark, idx) => (
              <ListItem
                key={remark.id || idx}
                sx={{
                  borderLeft: 3,
                  borderColor: 'primary.main',
                  ml: 1,
                  mb: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <ListItemText
                  primary={remark.content}
                  secondary={`${formatDateTime(remark.created_at)}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Action Buttons */}
      {isActive && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddRemarkDialogOpen(true)}
          >
            Add Remark
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => setCompleteDialogOpen(true)}
          >
            Mark Complete
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ReassignIcon />}
            onClick={() => setReassignDialogOpen(true)}
          >
            Reassign
          </Button>
        </Box>
      )}

      {/* Add Remark Dialog */}
      <Dialog open={addRemarkDialogOpen} onClose={() => setAddRemarkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Remark</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Your remark will be added to the timeline. Previous remarks cannot be edited.
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="Your Remark"
            fullWidth
            multiline
            rows={4}
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
            placeholder="Enter your progress update or findings..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRemarkDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddRemark} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Add Remark'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onClose={() => setCompleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Assignment as Complete</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {remarksTimeline.length === 0 && !assignment.user_remarks ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Please add at least one remark before marking as complete.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Once completed, you won't be able to add more remarks. Are you sure?
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleComplete}
            variant="contained"
            color="success"
            disabled={loading || (remarksTimeline.length === 0 && !assignment.user_remarks)}
          >
            {loading ? <CircularProgress size={24} /> : 'Complete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onClose={() => setReassignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reassign to Another Officer</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            {currentUser?.role === 'AG'
              ? 'You can reassign to any officer.'
              : 'You can only reassign to officers within your subsection.'}
          </Alert>
          <Autocomplete
            sx={{ mt: 2 }}
            options={users}
            getOptionLabel={(option) => `${option.full_name} (${option.role})`}
            value={reassignData.new_assignee}
            onChange={(e, newValue) => setReassignData(prev => ({ ...prev, new_assignee: newValue }))}
            renderInput={(params) => (
              <TextField {...params} label="Select Officer *" fullWidth />
            )}
          />
          <TextField
            margin="dense"
            label="Reason for Reassignment *"
            fullWidth
            multiline
            rows={3}
            value={reassignData.remarks}
            onChange={(e) => setReassignData(prev => ({ ...prev, remarks: e.target.value }))}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReassign} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Reassign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

/**
 * Supervisor Assignments Table - for AG/DAG to see all assignments in tabular format
 * Shows all assignees in columns with their remarks timeline
 */
const SupervisorAssignmentsTable = ({ assignments, onUpdate, currentUser }) => {
  const [expanded, setExpanded] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [revokeRemarks, setRevokeRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSupervisor = (assignment) =>
    currentUser?.role === 'AG' ||
    (currentUser?.role === 'DAG' && currentUser?.id === assignment.assigned_by);

  const handleRevoke = async () => {
    if (!revokeRemarks.trim()) {
      setError('Please provide reason for revoking');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mailService.revokeAssignment(selectedAssignment.id, revokeRemarks.trim());
      setRevokeDialogOpen(false);
      setRevokeRemarks('');
      setSelectedAssignment(null);
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to revoke assignment');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeCount = assignments.filter(a => a.status === 'Active').length;
  const completedCount = assignments.filter(a => a.status === 'Completed').length;
  const notRespondedCount = assignments.filter(a => a.status === 'Active' && !a.has_responded).length;

  return (
    <Paper sx={{ p: 2, mt: 2, border: 1, borderColor: 'primary.light' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6">
            Assignments History ({assignments.length} Assignees)
          </Typography>
          <Chip label={`${activeCount} Active`} color="primary" size="small" />
          <Chip label={`${completedCount} Completed`} color="success" size="small" />
          {notRespondedCount > 0 && (
            <Chip label={`${notRespondedCount} Not Responded`} color="error" size="small" />
          )}
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <TableContainer sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Officer</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Remarks Timeline</strong></TableCell>
                <TableCell><strong>Completed At</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow
                  key={assignment.id}
                  sx={{
                    bgcolor: !assignment.has_responded && assignment.status === 'Active'
                      ? 'error.lighter'
                      : 'inherit'
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {assignment.assigned_to_details?.full_name || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {assignment.assigned_to_details?.role}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Assigned: {formatDateTime(assignment.created_at)}
                      </Typography>
                      {assignment.reassigned_to_details && (
                        <Box sx={{ mt: 0.5, p: 0.5, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                          <Typography variant="caption" color="warning.dark" display="block">
                            ↳ Reassigned to: {assignment.reassigned_to_details.full_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            On: {formatDateTime(assignment.reassigned_at)}
                          </Typography>
                        </Box>
                      )}
                      {assignment.assignment_remarks && (
                        <Typography variant="caption" color="info.main" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                          Instructions: {assignment.assignment_remarks.substring(0, 50)}{assignment.assignment_remarks.length > 50 ? '...' : ''}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={assignment.status}
                      color={statusColors[assignment.status]}
                      size="small"
                    />
                    {!assignment.has_responded && assignment.status === 'Active' && (
                      <Typography variant="caption" color="error" display="block">
                        Not responded
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 350 }}>
                    {/* Show reassignment info prominently if reassigned */}
                    {assignment.reassigned_to_details && (
                      <Box sx={{ 
                        mb: 1, 
                        p: 1, 
                        bgcolor: 'warning.lighter', 
                        borderRadius: 1,
                        borderLeft: 3,
                        borderColor: 'warning.main'
                      }}>
                        <Typography variant="caption" color="warning.dark" fontWeight="bold">
                          ↳ Reassigned to: {assignment.reassigned_to_details.full_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          on {formatDateTime(assignment.reassigned_at)}
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Remarks timeline */}
                    {assignment.remarks_timeline && assignment.remarks_timeline.length > 0 ? (
                      <Box>
                        {assignment.remarks_timeline.map((remark, idx) => {
                          // Check if this is a reassignment remark
                          const isReassignRemark = remark.content?.startsWith('Reassigned to');
                          return (
                            <Box
                              key={remark.id || idx}
                              sx={{
                                borderLeft: 2,
                                borderColor: isReassignRemark ? 'warning.main' : 'primary.main',
                                pl: 1,
                                mb: 1,
                                bgcolor: isReassignRemark ? 'warning.lighter' : 'transparent',
                                borderRadius: isReassignRemark ? 1 : 0,
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                [{formatDateTime(remark.created_at)}]
                              </Typography>
                              <Typography variant="body2" fontWeight={isReassignRemark ? 'medium' : 'normal'}>
                                {remark.content}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : assignment.user_remarks ? (
                      <Typography variant="body2">{assignment.user_remarks}</Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        No remarks yet
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignment.completed_at ? formatDateTime(assignment.completed_at) : '-'}
                  </TableCell>
                  <TableCell>
                    {isSupervisor(assignment) && assignment.status === 'Active' && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => {
                          setSelectedAssignment(assignment);
                          setRevokeDialogOpen(true);
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onClose={() => setRevokeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Revoke Assignment</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will remove the assignment from {selectedAssignment?.assigned_to_details?.full_name}.
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Revoking"
            fullWidth
            multiline
            rows={4}
            value={revokeRemarks}
            onChange={(e) => setRevokeRemarks(e.target.value)}
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

/**
 * Main AssignmentsPanel component
 * Determines which view to show based on user role and assignments
 */
const AssignmentsPanel = ({ mailId, onUpdate, mailData }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAssignments = async () => {
    if (!mailId) return;
    
    // First, try to use assignments from mailData (already loaded in parent)
    if (mailData?.assignments && mailData.assignments.length > 0) {
      setAssignments(mailData.assignments);
      return;
    }
    
    // Fallback: fetch from API
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
  }, [mailId, mailData?.assignments]);

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

  // Determine if user is a supervisor (can see all assignments)
  const isCreator = mailData?.created_by === user?.id;
  const isSupervisor = user?.role === 'AG' || user?.role === 'DAG' || isCreator;

  // If user is assignee (not supervisor), show only their assignment in isolated view
  if (!isSupervisor) {
    // Find user's assignment
    const userAssignment = assignments.find(a => a.assigned_to === user?.id);
    if (!userAssignment) {
      return null; // User has no assignment for this mail
    }
    return (
      <IsolatedAssignmentView
        assignment={userAssignment}
        mailId={mailId}
        onUpdate={handleAssignmentUpdate}
        currentUser={user}
      />
    );
  }

  // Supervisor view - show all assignments in tabular format
  return (
    <SupervisorAssignmentsTable
      assignments={assignments}
      onUpdate={handleAssignmentUpdate}
      currentUser={user}
    />
  );
};

export default AssignmentsPanel;
