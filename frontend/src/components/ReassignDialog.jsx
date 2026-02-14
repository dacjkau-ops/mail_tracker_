import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import mailService from '../services/mailService';

const ReassignDialog = ({ open, onClose, mailId, onReassign, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState({
    new_handler: '',
    remarks: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
      setFormData({ new_handler: '', remarks: '' });
      setError('');
    }
  }, [open]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await mailService.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const getFilteredUsers = () => {
    if (!currentUser) return users;

    // AG sees all users
    if (currentUser.role === 'AG') return users;

    // DAG sees only users from their managed sections
    if (currentUser.role === 'DAG') {
      const dagSectionIds = currentUser.sections || [];
      return users.filter((u) => {
        // Don't show self
        if (u.id === currentUser.id) return false;
        // Show users whose subsection belongs to DAG's managed sections
        if (u.subsection_detail && dagSectionIds.includes(u.subsection_detail.section)) {
          return true;
        }
        // Show other DAGs who share the same sections
        if (u.role === 'DAG' && u.sections) {
          return u.sections.some((sId) => dagSectionIds.includes(sId));
        }
        return false;
      });
    }

    // SrAO/AAO: show users from the same section
    if (currentUser.subsection_detail) {
      const userSectionId = currentUser.subsection_detail.section;
      return users.filter((u) => {
        if (u.id === currentUser.id) return false;
        if (u.subsection_detail && u.subsection_detail.section === userSectionId) {
          return true;
        }
        // Also show DAGs managing that section
        if (u.role === 'DAG' && u.sections?.includes(userSectionId)) {
          return true;
        }
        return false;
      });
    }

    return users.filter((u) => u.id !== currentUser.id);
  };

  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.new_handler) {
      setError('Please select a user to reassign to');
      return;
    }

    if (!formData.remarks.trim()) {
      setError('Reason for reassignment is mandatory');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onReassign(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reassign mail');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = getFilteredUsers();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reassign Mail</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loadingUsers ? (
          <CircularProgress />
        ) : (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel>Reassign To *</InputLabel>
              <Select
                value={formData.new_handler}
                label="Reassign To *"
                onChange={(e) => handleChange('new_handler', e.target.value)}
              >
                {filteredUsers.length === 0 ? (
                  <MenuItem disabled>No users available in your section</MenuItem>
                ) : (
                  filteredUsers.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.full_name} ({user.role}{user.subsection_detail ? ` - ${user.subsection_detail.name}` : ''})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reason for Reassignment *"
              placeholder="e.g., Requires accounts expertise"
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              margin="normal"
              required
              helperText="Mandatory: Explain why you are reassigning this mail"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving || loadingUsers}>
          {saving ? 'Reassigning...' : 'Confirm Reassignment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReassignDialog;
