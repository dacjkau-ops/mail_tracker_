import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { CURRENT_ACTION_STATUS_OPTIONS } from '../utils/constants';

const UpdateCurrentActionDialog = ({
  open,
  onClose,
  currentActionStatus,
  currentActionRemarks,
  onUpdate
}) => {
  const [actionStatus, setActionStatus] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setActionStatus(currentActionStatus || '');
      setActionRemarks(currentActionRemarks || '');
      setError('');
    }
  }, [open, currentActionStatus, currentActionRemarks]);

  const handleSubmit = async () => {
    if (!actionStatus) {
      setError('Please select a current action status');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onUpdate({
        current_action_status: actionStatus,
        current_action_remarks: actionRemarks.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update current action');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Current Action Status</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Let others know what you're actively working on with this mail.
        </Typography>

        <FormControl fullWidth margin="normal" required>
          <InputLabel>What are you doing with this mail?</InputLabel>
          <Select
            value={actionStatus}
            label="What are you doing with this mail?"
            onChange={(e) => setActionStatus(e.target.value)}
          >
            {CURRENT_ACTION_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Additional Details (Optional)"
          placeholder="Example: Waiting for response from Finance Section"
          value={actionRemarks}
          onChange={(e) => setActionRemarks(e.target.value)}
          margin="normal"
          helperText="Optional: Add any additional context about what you're doing"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? 'Updating...' : 'Update Action'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateCurrentActionDialog;
