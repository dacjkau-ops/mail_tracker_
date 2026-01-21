import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from '@mui/material';

const RemarksEditDialog = ({ open, onClose, currentRemarks, onSave }) => {
  const [remarks, setRemarks] = useState(currentRemarks || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setRemarks(currentRemarks || '');
      setError('');
    }
  }, [open, currentRemarks]);

  const handleSave = async () => {
    setError('');
    setSaving(true);

    try {
      await onSave(remarks);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update remarks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Remarks</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemarksEditDialog;
