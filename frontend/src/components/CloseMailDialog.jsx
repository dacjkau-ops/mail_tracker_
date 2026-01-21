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

const CloseMailDialog = ({ open, onDialogClose, mailSlNo, onClose }) => {
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
      setError('Final remarks are mandatory');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onClose(remarks);
      onDialogClose();
    } catch (err) {
      setError(err.message || 'Failed to close mail');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle>Complete Mail: {mailSlNo}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please provide final remarks before marking this mail as completed.
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Final Remarks *"
          placeholder="Example: Letter sent - Ref: ABC/123 dated 20-01-2026"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          margin="normal"
          required
          helperText="Mandatory: Describe the final outcome of this mail"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onDialogClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="success" disabled={saving}>
          {saving ? 'Closing...' : 'Mark as Completed'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CloseMailDialog;
