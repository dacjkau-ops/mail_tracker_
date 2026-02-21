import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
  LinearProgress,
} from '@mui/material';
import { ArrowBack, Save as SaveIcon, AttachFile as AttachFileIcon } from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import mailService from '../services/mailService';
import { useAuth } from '../context/AuthContext';

const CreateMailPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfError, setPdfError] = useState('');

  // DAG users can only create for their section
  const isDAG = user?.role === 'DAG';
  const userSection = user?.section;

  // AG can assign cross-section, so they see all users
  const isAG = user?.role === 'AG';

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
      section: '',
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
    try {
      const [sectionsData, usersData] = await Promise.all([
        mailService.getSections(),
        mailService.getUsers(),
      ]);
      setSections(sectionsData);
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load form data. Please refresh the page.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
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
    const maxBytes = 10 * 1024 * 1024; // 10 MB
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
      // Section is now auto-detected on backend based on role and assignees
      const mailData = {
        letter_no: data.letter_no,
        date_received: data.date_received.toISOString().split('T')[0],
        mail_reference_subject: data.mail_reference_subject,
        from_office: data.from_office,
        action_required: data.action_required,
        assigned_to: Array.isArray(data.assigned_to)
          ? data.assigned_to.map(u => u.id)
          : [data.assigned_to],
        section: data.section ? Number(data.section) : null,
        due_date: data.due_date ? data.due_date.toISOString().split('T')[0] : null,
        initial_instructions: data.initial_instructions || '',
      };

      const createdMail = await mailService.createMail(mailData);
      if (selectedPdf) {
        try {
          await mailService.uploadPdf(createdMail.id, selectedPdf);
        } catch (pdfErr) {
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/mails')}
        sx={{ mb: 3 }}
      >
        Back to Mail List
      </Button>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom sx={{ mb: 3 }}>
          Create New Mail Entry
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Row 1: Letter No and Date Received */}
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

            {/* Row 3: From Office and Action Required */}
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
            </Box>

            {/* Row 4: Optional Section (helps when assigning DAG handling multiple sections) */}
            {isAG && (
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px', maxWidth: '400px' }}>
                  <Controller
                    name="section"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Section (Optional)</InputLabel>
                        <Select {...field} label="Section (Optional)">
                          <MenuItem value="">Auto-detect / Cross-section</MenuItem>
                          {sections.map((section) => (
                            <MenuItem key={section.id} value={section.id}>
                              {section.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 2 }}>
                          Choose section when assigning to DAGs with multiple managed sections.
                        </Typography>
                      </FormControl>
                    )}
                  />
                </Box>
              </Box>
            )}

            {/* Row 5: Assign To (Section can be auto-detected on backend) */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 100%', minWidth: '250px' }}>
                <Controller
                  name="assigned_to"
                  control={control}
                  rules={{
                    required: 'At least one assignee is required',
                    validate: value => value.length > 0 || 'Please select at least one officer'
                  }}
                  render={({ field: { onChange, value, ...field } }) => {
                    // AG can assign to ANY user (cross-section allowed)
                    // DAG can only assign to users in their section
                    const filteredUsers = isAG
                      ? users
                      : users.filter(u => u.section === userSection);

                    // Group users by section for better UX
                    const groupedOptions = isAG
                      ? filteredUsers.sort((a, b) => {
                          // Sort by section name, then by full name
                          const sectionA = sections.find(s => s.id === a.section)?.name || '';
                          const sectionB = sections.find(s => s.id === b.section)?.name || '';
                          if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);
                          return a.full_name.localeCompare(b.full_name);
                        })
                      : filteredUsers;

                    return (
                      <Autocomplete
                        {...field}
                        multiple
                        options={groupedOptions}
                        groupBy={isAG ? (option) => {
                          const section = sections.find(s => s.id === option.section);
                          return section?.name || 'No Section';
                        } : undefined}
                        getOptionLabel={(option) => `${option.full_name} (${option.role})`}
                        value={value || []}
                        onChange={(event, newValue) => onChange(newValue)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Assign To *"
                            error={!!errors.assigned_to}
                            helperText={
                              errors.assigned_to?.message ||
                              (isAG
                                ? 'AG can assign to officers from any section (cross-section allowed)'
                                : 'Select one or more officers from your section')
                            }
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => {
                            const sectionName = sections.find(s => s.id === option.section)?.name;
                            return (
                              <Chip
                                label={`${option.full_name}${sectionName ? ` - ${sectionName}` : ''}`}
                                {...getTagProps({ index })}
                                size="small"
                                color={isAG && sectionName ? 'primary' : 'default'}
                              />
                            );
                          })
                        }
                      />
                    );
                  }}
                />
              </Box>
            </Box>

            {/* Row 6: Due Date */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px', maxWidth: '400px' }}>
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

            {/* Row 7: Initial Instructions (full width) */}
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
                    label="Initial Instructions (Optional)"
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
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Mail'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateMailPage;
