import { formatDistance, format, isPast } from 'date-fns';

/**
 * Calculate time in current stage
 * @param {string} lastStatusChangeDate - ISO date string
 * @param {string} dateOfCompletion - ISO date string (optional, for closed mails)
 * @returns {string} - Formatted time duration
 */
export const calculateTimeInStage = (lastStatusChangeDate, dateOfCompletion = null) => {
  if (!lastStatusChangeDate) return 'N/A';

  const startDate = new Date(lastStatusChangeDate);
  const endDate = dateOfCompletion ? new Date(dateOfCompletion) : new Date();

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
  return isPast(new Date(dueDate));
};

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @param {string} formatString - Date format (default: 'dd-MM-yyyy')
 * @returns {string}
 */
export const formatDate = (dateString, formatString = 'dd-MM-yyyy') => {
  if (!dateString) return 'N/A';
  return format(new Date(dateString), formatString);
};

/**
 * Format date and time for display
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return format(new Date(dateString), 'dd-MM-yyyy HH:mm');
};
