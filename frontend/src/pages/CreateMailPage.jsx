import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Autocomplete,
  Chip,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  ArrowBack,
  Save as SaveIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';

const CreateMailPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usersError, setUsersError] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [derivedSection, setDerivedSection] = useState({ name: '', id: null });

  const isAG = user?.role === 'AG';
  const isDAG = user?.role === 'DAG';
  const dataReady = !loading && !usersError;

  // DAG's locked section name
  const dagSectionName = useMemo(() => {
    if (!isDAG) return '';
    const secList = user?.sections_list || [];
    return secList.map((s) => s.name).join(', ') || 'No section assigned';
  }, [user, isDAG]);

  const computeSectionFromAssignees = useCallback((assignees) => {
    if (!assignees || assignees.length === 0) {
      return { name: '', id: null };
    }
    const sectionMap = new Map();
    for (const a of assignees) {
      const sec = a.subsection_detail?.section;
      if (sec) {
        sectionMap.set(sec.id, sec.name);
      }
    }
    if (sectionMap.size === 0) return { name: '', id: null };
    if (sectionMap.size === 1) {
      const [id, name] = [...sectionMap.entries()][0];
      return { name, id };
    }
    return { name: 'Multiple', id: null };
  }, []);

  const getAssignableUsers = useCallback(() => {
    if (!user) return [];
    if (isAG) return users;

    if (isDAG) {
      const managedSectionIds = new Set((user.sections || []).map((id) => Number(id)));
      return users.filter((u) => {
        const userSectionId = u.subsection_detail?.section?.id;
        if (u.role === 'DAG') {
          return (u.sections || []).some((sectionId) => managedSectionIds.has(Number(sectionId)));
        }
        return userSectionId && managedSectionIds.has(Number(userSectionId));
      });
    }

    if (user.role === 'auditor') {
      const allowedSubIds = new Set((user.auditor_subsections || []).map((id) => Number(id)));
      return users.filter((u) => u.subsection && allowedSubIds.has(Number(u.subsection)));
    }

    if (user.subsection) {
      return users.filter((u) => Number(u.subsection) === Number(user.subsection));
    }

    return users;
  }, [user, users, isAG, isDAG]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      letter_no: '',
      date_received: new Date(),
      mail_reference_subject: '',
      from_office: '',
      action_required: '',
      assigned_to: [],
      due_date: null,
      initial_instructions: '',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    setUsersError(false);

    let usersOk = true;
    let usersData = [];

    try {
      usersData = await mailService.getUsers();
    } catch {
      usersOk = false;
    }

    setUsers(usersData);
    setUsersError(!usersOk);
    setLoading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setPdfError('');
    if (!file) {
      setSelectedPdf(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setPdfError('Only PDF files are accepted.');
      setSelectedPdf(null);
      e.target.value = '';
      return;
    }
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPdfError('PDF must be 10 MB or smaller.');
      setSelectedPdf(null);
      e.target.value = '';
      return;
    }
    setSelectedPdf(file);
  };

  const onSubmit = async (data) => {
    setError('');
    setSaving(true);

    try {
      const mailData = {
        letter_no: data.letter_no,
        date_received: data.date_received.toISOString().split('T')[0],
        mail_reference_subject: data.mail_reference_subject,
        from_office: data.from_office,
        action_required: data.action_required,
        assigned_to: Array.isArray(data.assigned_to)
          ? data.assigned_to.map((u) => u.id)
          : [data.assigned_to],
        section: isAG ? derivedSection.id : null,
        due_date: data.due_date ? data.due_date.toISOString().split('T')[0] : null,
        initial_instructions: data.initial_instructions || '',
      };

      const createdMail = await mailService.createMail(mailData);
      if (selectedPdf) {
        try {
          await mailService.uploadPdf(createdMail.id, selectedPdf);
        } catch {
          navigate(`/mails/${createdMail.id}?pdfError=1`);
          return;
        }
      }
      navigate(`/mails/${createdMail.id}`);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.response?.data?.assigned_to?.[0] ||
          'Failed to create mail. Please try again.'
      );
      console.error('Error creating mail:', err);
    } finally {
      setSaving(false);
    }
  };

  // Section display value
  const sectionDisplayValue = isDAG
    ? dagSectionName
    : derivedSection.name || '\u2014';

  return (
    <Box sx={{ width: '100%' }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/mails')}
        sx={{ mb: 3 }}
      >
        Back to Mail List
      </Button>

      <Paper sx={{ p: 3, width: '100%' }}>
        {loading && <LinearProgress sx={{ mb: 2, mx: -3, mt: -3, borderRadius: '4px 4px 0 0' }} />}

        <Typography variant="h5" component="h1" gutterBottom sx={{ mb: 3 }}>
          Create New Mail Entry
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <fieldset
            disabled={!dataReady || saving}
            style={{ border: 'none', margin: 0, padding: 0 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Row 1: Letter No + Date Received */}
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                  <Controller
                    name="letter_no"
                    control={control}
                    rules={{ required: 'Letter No is required' }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Letter No *"
                        error={!!errors.letter_no}
                        helperText={errors.letter_no?.message}
                      />
                    )}
                  />
                </Box>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Controller
                      name="date_received"
                      control={control}
                      rules={{ required: 'Date Received is required' }}
                      render={({ field }) => (
                        <DatePicker
                          {...field}
                          label="Date Received *"
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.date_received,
                              helperText: errors.date_received?.message,
                            },
                          }}
                        />
                      )}
                    />
                  </LocalizationProvider>
                </Box>
              </Box>

              {/* Row 2: Subject (full width) */}
              <Box>
                <Controller
                  name="mail_reference_subject"
                  control={control}
                  rules={{ required: 'Subject is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Subject *"
                      error={!!errors.mail_reference_subject}
                      helperText={errors.mail_reference_subject?.message}
                    />
                  )}
                />
              </Box>

              {/* Row 3: From Office + Due Date */}
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                  <Controller
                    name="from_office"
                    control={control}
                    rules={{ required: 'From Office is required' }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="From Office *"
                        error={!!errors.from_office}
                        helperText={errors.from_office?.message}
                      />
                    )}
                  />
                </Box>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Controller
                      name="due_date"
                      control={control}
                      rules={{ required: 'Due Date is required' }}
                      render={({ field }) => (
                        <DatePicker
                          {...field}
                          label="Due Date *"
                          minDate={new Date()}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.due_date,
                              helperText: errors.due_date?.message || 'Cannot be edited after creation',
                            },
                          }}
                        />
                      )}
                    />
                  </LocalizationProvider>
                </Box>
              </Box>

              {/* Row 4: Action Required (full width) */}
              <Box>
                <Controller
                  name="action_required"
                  control={control}
                  rules={{ required: 'Action Required is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Action Required *"
                      placeholder="e.g. Review, Approve, Process..."
                      error={!!errors.action_required}
                      helperText={errors.action_required?.message}
                    />
                  )}
                />
              </Box>

              {/* Row 5: Assign To + Section */}
              <Box>
                <Controller
                  name="assigned_to"
                  control={control}
                  rules={{
                    required: 'At least one assignee is required',
                    validate: (value) =>
                      value.length > 0 || 'Please select at least one officer',
                  }}
                  render={({ field: { onChange, value, ...field } }) => {
                    const filteredUsers = getAssignableUsers();

                    const groupedOptions = isAG
                      ? [...filteredUsers].sort((a, b) => {
                          const sectionA = a.subsection_detail?.section?.name || '';
                          const sectionB = b.subsection_detail?.section?.name || '';
                          if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);
                          return a.full_name.localeCompare(b.full_name);
                        })
                      : filteredUsers;

                    return (
                      <Box>
                        <Autocomplete
                          {...field}
                          multiple
                          options={groupedOptions}
                          groupBy={
                            isAG
                              ? (option) => {
                                  if (option.subsection_detail?.section?.name) {
                                    return option.subsection_detail.section.name;
                                  }
                                  if (option.role === 'DAG') {
                                    return 'DAG (Multi-section)';
                                  }
                                  return 'No Section';
                                }
                              : undefined
                          }
                          getOptionLabel={(option) =>
                            `${option.full_name} (${option.role})`
                          }
                          value={value || []}
                          onChange={(event, newValue) => {
                            onChange(newValue);
                            setDerivedSection(computeSectionFromAssignees(newValue));
                          }}
                          renderTags={() => null}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Assign To *"
                              placeholder={loading ? 'Loading officers...' : 'Search and select officers'}
                              error={!!errors.assigned_to}
                              helperText={
                                errors.assigned_to?.message ||
                                (isAG
                                  ? 'AG can assign to officers from any section (cross-section allowed)'
                                  : 'Select one or more officers in your allowed scope (you can assign to yourself).')
                              }
                            />
                          )}
                        />

                        {/* Assignee rows */}
                        {value && value.length > 0 && (
                          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {value.map((assignee, index) => {
                              const sectionName =
                                assignee.subsection_detail?.section?.name || 'No section';
                              return (
                                <Box
                                  key={assignee.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 1.5,
                                    py: 0.75,
                                    bgcolor: 'grey.50',
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'grey.200',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <Chip
                                      label={sectionName}
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      sx={{ minWidth: 80 }}
                                    />
                                    <Typography variant="body2">
                                      {assignee.full_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      ({assignee.role})
                                    </Typography>
                                  </Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      const newValue = value.filter((_, i) => i !== index);
                                      onChange(newValue);
                                      setDerivedSection(
                                        computeSectionFromAssignees(newValue)
                                      );
                                    }}
                                    disabled={saving}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              );
                            })}
                          </Box>
                        )}

                        {/* Users load error with retry */}
                        {usersError && (
                          <Alert
                            severity="error"
                            sx={{ mt: 1 }}
                            action={
                              <Button color="inherit" size="small" onClick={loadData}>
                                Retry
                              </Button>
                            }
                          >
                            Failed to load officers. Click retry to try again.
                          </Alert>
                        )}

                        {/* Section display */}
                        <TextField
                          fullWidth
                          label="Section"
                          value={loading ? 'Loading...' : sectionDisplayValue}
                          InputProps={{ readOnly: true }}
                          variant="outlined"
                          size="small"
                          sx={{
                            mt: 1.5,
                            '& .MuiInputBase-root': {
                              bgcolor: 'grey.50',
                            },
                          }}
                          helperText={
                            isDAG
                              ? 'Section is determined by your role'
                              : 'Auto-detected from selected assignees'
                          }
                        />
                      </Box>
                    );
                  }}
                />
              </Box>

              {/* Row 6: About Info (full width) */}
              <Box>
                <Controller
                  name="initial_instructions"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="About Info (Optional)"
                      placeholder="Add instructions that will be visible to all assigned officers"
                      helperText="These instructions will be shared with all assigned officers"
                    />
                  )}
                />
              </Box>

              {/* PDF Attachment (Optional) */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  PDF Attachment (Optional)
                </Typography>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AttachFileIcon />}
                  size="small"
                >
                  {selectedPdf ? selectedPdf.name : 'Choose PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={handleFileChange}
                  />
                </Button>
                {selectedPdf && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    {(selectedPdf.size / 1024 / 1024).toFixed(2)} MB selected
                  </Typography>
                )}
                {pdfError && (
                  <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                    {pdfError}
                  </Typography>
                )}
              </Box>

              {/* Action Buttons */}
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/mails')}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={!dataReady || saving}
                >
                  {saving ? 'Creating...' : 'Create Mail'}
                </Button>
              </Box>
            </Box>
          </fieldset>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateMailPage;
