import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
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
  MenuItem,
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
import { serializeDateOnly } from '../utils/dateHelpers';

const sortSectionOptions = (options) =>
  [...options].sort((left, right) => left.name.localeCompare(right.name));

const getAssigneeSectionOptions = (assignee) => {
  const sectionMap = new Map();

  if (assignee?.subsection_detail?.section && assignee?.subsection_detail?.section_name) {
    sectionMap.set(Number(assignee.subsection_detail.section), assignee.subsection_detail.section_name);
  }

  if (Array.isArray(assignee?.sections_list)) {
    assignee.sections_list.forEach((section) => {
      if (section?.id && section?.name) {
        sectionMap.set(Number(section.id), section.name);
      }
    });
  }

  return sortSectionOptions(
    [...sectionMap.entries()].map(([id, name]) => ({ id, name }))
  );
};

const intersectSectionOptions = (optionGroups) => {
  if (!optionGroups.length) return [];

  const intersectionIds = optionGroups.reduce((acc, group, index) => {
    const ids = new Set(group.map((option) => option.id));
    if (index === 0) return ids;
    return new Set([...acc].filter((id) => ids.has(id)));
  }, new Set());

  const sectionNameById = new Map(optionGroups.flat().map((option) => [option.id, option.name]));
  return sortSectionOptions(
    [...intersectionIds].map((id) => ({ id, name: sectionNameById.get(id) || `Section ${id}` }))
  );
};

const unionSectionOptions = (optionGroups) => {
  const sectionMap = new Map();
  optionGroups.flat().forEach((option) => {
    sectionMap.set(option.id, option.name);
  });
  return sortSectionOptions(
    [...sectionMap.entries()].map(([id, name]) => ({ id, name }))
  );
};

const getAssigneeScopeLabel = (assignee) => {
  const sectionOptions = getAssigneeSectionOptions(assignee);
  if (!sectionOptions.length) return 'No section';
  if (sectionOptions.length === 1) return sectionOptions[0].name;
  return sectionOptions.map((option) => option.name).join(', ');
};

const getAssigneeGroupLabel = (assignee) => {
  const sectionOptions = getAssigneeSectionOptions(assignee);
  if (!sectionOptions.length) return 'No Section';
  if (sectionOptions.length === 1) return sectionOptions[0].name;
  return assignee?.role === 'DAG' ? 'DAG (Multiple Sections)' : 'Multiple Sections';
};

const resolveSectionState = ({ assignees, isAG, isDAG, dagSectionName, lockedSectionName }) => {
  if (isDAG) {
    return {
      mode: 'locked',
      displayText: dagSectionName || 'No section assigned',
      helperText: 'Section is determined by your role',
      options: [],
    };
  }

  if (!isAG) {
    return {
      mode: 'auto',
      displayText: lockedSectionName || 'No section assigned',
      helperText: 'Section is determined by your role',
      options: [],
    };
  }

  if (!assignees.length) {
    return {
      mode: 'empty',
      displayText: '-',
      helperText: 'Select assignees to determine section',
      options: [],
    };
  }

  const optionGroups = assignees
    .map((assignee) => getAssigneeSectionOptions(assignee))
    .filter((group) => group.length > 0);

  if (!optionGroups.length) {
    return {
      mode: 'empty',
      displayText: '-',
      helperText: 'No section information is available for the selected assignees',
      options: [],
    };
  }

  const commonOptions = intersectSectionOptions(optionGroups);
  if (commonOptions.length === 1) {
    return {
      mode: 'auto',
      displayText: commonOptions[0].name,
      helperText: 'Auto-detected from selected assignees',
      options: commonOptions,
      autoSectionId: commonOptions[0].id,
    };
  }

  if (commonOptions.length > 1) {
    return {
      mode: 'required',
      displayText: 'Choose section',
      helperText: 'Selected DAG assignee manages multiple sections. Choose which section this letter pertains to.',
      options: commonOptions,
    };
  }

  const hasAmbiguousAssignee = optionGroups.some((group) => group.length > 1);
  if (hasAmbiguousAssignee) {
    return {
      mode: 'invalid',
      displayText: 'No common section',
      helperText: 'Selected assignees do not share a single valid section. Choose officers from one common section.',
      options: [],
    };
  }

  const distinctSections = unionSectionOptions(optionGroups);
  if (distinctSections.length > 1) {
    return {
      mode: 'cross',
      displayText: 'Cross-Section',
      helperText: 'This selection spans multiple fixed sections. The mail will be created as cross-section.',
      options: [],
    };
  }

  return {
    mode: 'empty',
    displayText: '-',
    helperText: 'Select assignees to determine section',
    options: [],
  };
};

const formatCreateError = (payload) => {
  if (!payload) return 'Failed to create mail. Please try again.';
  if (typeof payload === 'string') return payload;
  if (payload.error) return payload.error;
  if (payload.detail) return payload.detail;
  if (payload.message) return payload.message;

  const firstFieldError = Object.values(payload).find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
  });

  if (Array.isArray(firstFieldError)) return firstFieldError[0];
  if (typeof firstFieldError === 'string') return firstFieldError;

  return 'Failed to create mail. Please try again.';
};

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

  const isAG = user?.role === 'AG';
  const isDAG = user?.role === 'DAG';
  const dataReady = !loading && !usersError;

  const dagSectionName = useMemo(() => {
    if (!isDAG) return '';
    const secList = user?.sections_list || [];
    return secList.map((section) => section.name).join(', ') || 'No section assigned';
  }, [user, isDAG]);

  const lockedSectionName = useMemo(() => {
    if (isDAG) return dagSectionName;
    if (user?.subsection_detail?.section_name) return user.subsection_detail.section_name;
    const secList = user?.sections_list || [];
    return secList.map((section) => section.name).join(', ') || '';
  }, [dagSectionName, isDAG, user]);

  const groupedUsers = useMemo(() => {
    if (!isAG) return users;

    return [...users].sort((left, right) => {
      const leftGroup = getAssigneeGroupLabel(left);
      const rightGroup = getAssigneeGroupLabel(right);
      if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup);
      return left.full_name.localeCompare(right.full_name);
    });
  }, [users, isAG]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm({
    defaultValues: {
      letter_no: '',
      dated: null,
      date_received: new Date(),
      mail_reference_subject: '',
      from_office: '',
      action_required: '',
      assigned_to: [],
      section: '',
      due_date: null,
      initial_instructions: '',
    },
  });

  const watchedAssignees = watch('assigned_to');
  const selectedSection = watch('section');

  const sectionState = useMemo(
    () => resolveSectionState({
      assignees: Array.isArray(watchedAssignees) ? watchedAssignees : [],
      isAG,
      isDAG,
      dagSectionName,
      lockedSectionName,
    }),
    [watchedAssignees, isAG, isDAG, dagSectionName, lockedSectionName]
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isAG) return;

    if (sectionState.mode === 'auto') {
      if (selectedSection !== sectionState.autoSectionId) {
        setValue('section', sectionState.autoSectionId, { shouldValidate: true });
      }
      clearErrors('section');
      return;
    }

    if (sectionState.mode === 'required') {
      const selectedSectionId = Number(selectedSection);
      const isStillValid = sectionState.options.some((option) => option.id === selectedSectionId);
      if (selectedSection && !isStillValid) {
        setValue('section', '', { shouldValidate: true });
      }
      return;
    }

    if (selectedSection) {
      setValue('section', '', { shouldValidate: true });
    }

    if (sectionState.mode !== 'invalid') {
      clearErrors('section');
    }
  }, [clearErrors, isAG, sectionState, selectedSection, setValue]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    setUsersError(false);

    let usersOk = true;
    let usersData = [];

    try {
      usersData = await mailService.getUsers();
      if (!Array.isArray(usersData) || usersData.length === 0) {
        usersOk = false;
      }
    } catch {
      usersOk = false;
    }

    setUsers(usersData);
    setUsersError(!usersOk);
    setLoading(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setPdfError('');
    if (!file) {
      setSelectedPdf(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setPdfError('Only PDF files are accepted.');
      setSelectedPdf(null);
      event.target.value = '';
      return;
    }
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPdfError('PDF must be 10 MB or smaller.');
      setSelectedPdf(null);
      event.target.value = '';
      return;
    }
    setSelectedPdf(file);
  };

  const onSubmit = async (data) => {
    setError('');

    if (isAG && sectionState.mode === 'invalid') {
      setError(sectionState.helperText);
      return;
    }

    setSaving(true);

    try {
      const mailData = {
        letter_no: data.letter_no,
        dated: serializeDateOnly(data.dated),
        date_received: serializeDateOnly(data.date_received),
        mail_reference_subject: data.mail_reference_subject,
        from_office: data.from_office,
        action_required: data.action_required,
        assigned_to: Array.isArray(data.assigned_to)
          ? data.assigned_to.map((assignee) => assignee.id)
          : [data.assigned_to],
        section: isAG && data.section ? Number(data.section) : null,
        due_date: serializeDateOnly(data.due_date),
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
      setError(formatCreateError(err.response?.data));
      console.error('Error creating mail:', err);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = dataReady && !(isAG && sectionState.mode === 'invalid');
  const sectionFieldError =
    errors.section?.message || (isAG && sectionState.mode === 'invalid' ? sectionState.helperText : '');

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
            disabled={loading || saving}
            style={{ border: 'none', margin: 0, padding: 0 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Row 1: Letter No + Dated + Date Received */}
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 240px', minWidth: '220px' }}>
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
                <Box sx={{ flex: '1 1 240px', minWidth: '220px' }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Controller
                      name="dated"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          {...field}
                          label="Dated"
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              helperText: 'Actual date printed on the letter',
                            },
                          }}
                        />
                      )}
                    />
                  </LocalizationProvider>
                </Box>
                <Box sx={{ flex: '1 1 240px', minWidth: '220px' }}>
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

              {/* Row 2: Subject */}
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

              {/* Row 4: Action Required */}
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
                      (Array.isArray(value) && value.length > 0) || 'Please select at least one officer',
                  }}
                  render={({ field: { onChange, value, ...field } }) => (
                    <Box>
                      <Autocomplete
                        {...field}
                        multiple
                        options={groupedUsers}
                        groupBy={isAG ? (option) => getAssigneeGroupLabel(option) : undefined}
                        getOptionLabel={(option) => `${option.full_name} (${option.role})`}
                        value={value || []}
                        onChange={(event, newValue) => {
                          onChange(newValue);
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
                                ? 'AG can assign to officers from any section. Section will be auto-detected or requested when ambiguous.'
                                : 'Select one or more officers in your allowed scope (you can assign to yourself).')
                            }
                          />
                        )}
                      />

                      {value && value.length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {value.map((assignee, index) => (
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
                                  minWidth: 0,
                                }}
                              >
                                <Chip
                                  label={getAssigneeScopeLabel(assignee)}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ maxWidth: 220 }}
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
                                  const newValue = value.filter((_, itemIndex) => itemIndex !== index);
                                  onChange(newValue);
                                }}
                                disabled={saving}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

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

                      {isAG && sectionState.mode === 'required' ? (
                        <Controller
                          name="section"
                          control={control}
                          rules={{
                            validate: (fieldValue) => {
                              if (sectionState.mode === 'required' && !fieldValue) {
                                return 'Select which section this letter pertains to.';
                              }
                              return true;
                            },
                          }}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              select
                              fullWidth
                              label="Section *"
                              value={field.value || ''}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                field.onChange(nextValue ? Number(nextValue) : '');
                              }}
                              error={!!errors.section}
                              helperText={errors.section?.message || sectionState.helperText}
                              sx={{ mt: 1.5 }}
                            >
                              <MenuItem value="">
                                Select section
                              </MenuItem>
                              {sectionState.options.map((option) => (
                                <MenuItem key={option.id} value={option.id}>
                                  {option.name}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        />
                      ) : (
                        <TextField
                          fullWidth
                          label="Section"
                          value={loading ? 'Loading...' : sectionState.displayText}
                          InputProps={{ readOnly: true }}
                          variant="outlined"
                          size="small"
                          error={!!sectionFieldError}
                          sx={{
                            mt: 1.5,
                            '& .MuiInputBase-root': {
                              bgcolor: 'grey.50',
                            },
                          }}
                          helperText={sectionFieldError || sectionState.helperText}
                        />
                      )}
                    </Box>
                  )}
                />
              </Box>

              {/* Row 6: About Info */}
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

              {/* PDF Attachment */}
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
                  disabled={!canSubmit || saving}
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
