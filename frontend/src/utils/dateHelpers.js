import { formatDistance, format, isBefore, startOfToday } from 'date-fns';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

export const serializeDateOnly = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'yyyy-MM-dd');
};

/**
 * Calculate time in current stage
 * @param {string} lastStatusChangeDate - ISO date string
 * @param {string} dateOfCompletion - ISO date string (optional, for closed mails)
 * @returns {string} - Formatted time duration
 */
export const calculateTimeInStage = (lastStatusChangeDate, dateOfCompletion = null) => {
  if (!lastStatusChangeDate) return 'N/A';

  const startDate = parseDateValue(lastStatusChangeDate);
  const endDate = dateOfCompletion ? parseDateValue(dateOfCompletion) : new Date();

  if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
    return 'N/A';
  }

  return formatDistance(startDate, endDate);
};

/**
 * Check if a mail is overdue
 * @param {string} dueDate - ISO date string
 * @param {string} status - Current status
 * @returns {boolean}
 */
export const isOverdue = (dueDate, status) => {
  if (!dueDate || status === 'Closed') return false;
  const parsedDueDate = parseDateValue(dueDate);
  if (!parsedDueDate || Number.isNaN(parsedDueDate.getTime())) return false;
  return isBefore(parsedDueDate, startOfToday());
};

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @param {string} formatString - Date format (default: 'dd-MM-yyyy')
 * @returns {string}
 */
export const formatDate = (dateString, formatString = 'dd-MM-yyyy') => {
  if (!dateString) return 'N/A';
  const parsedDate = parseDateValue(dateString);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return 'N/A';
  return format(parsedDate, formatString);
};

/**
 * Format date and time for display
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const parsedDate = parseDateValue(dateString);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return 'N/A';
  return format(parsedDate, 'dd-MM-yyyy HH:mm');
};
