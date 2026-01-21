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

const ReassignDialog = ({ open, onClose, mailId, onReassign }) => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState({
    assigned_to: '',
    remarks: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
      setFormData({ assigned_to: '', remarks: '' });
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

  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.assigned_to) {
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
                value={formData.assigned_to}
                label="Reassign To *"
                onChange={(e) => handleChange('assigned_to', e.target.value)}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.full_name} ({user.role})
                  </MenuItem>
                ))}
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
