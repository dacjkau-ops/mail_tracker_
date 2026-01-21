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
} from '@mui/material';

const ReopenDialog = ({ open, onClose, mailSlNo, onReopen }) => {
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setRemarks('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!remarks.trim()) {
      setError('Remarks are mandatory for reopening');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onReopen(remarks);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reopen mail');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reopen Mail: {mailSlNo}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This mail will be reopened and status will change to "In Progress".
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Reason for Reopening *"
          placeholder="e.g., Additional work required, correction needed"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          margin="normal"
          required
          helperText="Mandatory: Explain why you are reopening this mail"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="warning" disabled={saving}>
          {saving ? 'Reopening...' : 'Reopen Mail'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReopenDialog;
