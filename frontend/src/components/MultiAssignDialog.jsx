import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Alert,
  CircularProgress,
} from '@mui/material';
import mailService from '../services/mailService';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const MultiAssignDialog = ({ open, onClose, mailId, onSuccess, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadUsers();
      setSelectedUserIds([]);
      setRemarks('');
      setError('');
    }
  }, [open]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersData = await mailService.getUsers();
      // Filter out current user and apply section-based filtering
      let filteredUsers = usersData.filter(u => u.id !== currentUser?.id);

      if (currentUser?.role === 'DAG') {
        const dagSectionIds = currentUser.sections || [];
        filteredUsers = filteredUsers.filter((u) => {
          if (u.subsection_detail && dagSectionIds.includes(u.subsection_detail.section)) {
            return true;
          }
          if (u.role === 'DAG' && u.sections) {
            return u.sections.some((sId) => dagSectionIds.includes(sId));
          }
          return false;
        });
      }

      setUsers(filteredUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserChange = (event) => {
    const { value } = event.target;
    setSelectedUserIds(typeof value === 'string' ? value.split(',').map(Number) : value);
  };

  const handleSubmit = async () => {
    if (selectedUserIds.length === 0) {
      setError('Please select at least one user');
      return;
    }
    if (!remarks.trim()) {
      setError('Please provide assignment instructions/remarks');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await mailService.multiAssign(mailId, {
        user_ids: selectedUserIds,
        remarks: remarks.trim(),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error assigning mail:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to assign mail');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedUserNames = () => {
    return selectedUserIds.map(id => {
      const user = users.find(u => u.id === id);
      return user ? user.full_name : '';
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign to Multiple Officers</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <FormControl fullWidth>
            <InputLabel id="multi-assign-users-label">Select Officers</InputLabel>
            <Select
              labelId="multi-assign-users-label"
              id="multi-assign-users"
              multiple
              value={selectedUserIds}
              onChange={handleUserChange}
              input={<OutlinedInput label="Select Officers" />}
              renderValue={() => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {getSelectedUserNames().map((name, index) => (
                    <Chip key={selectedUserIds[index]} label={name} size="small" />
                  ))}
                </Box>
              )}
              MenuProps={MenuProps}
              disabled={loadingUsers}
            >
              {loadingUsers ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} /> Loading users...
                </MenuItem>
              ) : (
                users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Checkbox checked={selectedUserIds.indexOf(user.id) > -1} />
                    <ListItemText
                      primary={user.full_name}
                      secondary={`${user.role}${user.subsection_detail ? ` - ${user.subsection_detail.name}` : ''}`}
                    />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <TextField
            label="Assignment Instructions/Remarks"
            multiline
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            required
            placeholder="Provide instructions for the assigned officers..."
            helperText="This message will be visible to all assigned officers"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || selectedUserIds.length === 0}
        >
          {loading ? <CircularProgress size={24} /> : `Assign to ${selectedUserIds.length} Officer(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MultiAssignDialog;
