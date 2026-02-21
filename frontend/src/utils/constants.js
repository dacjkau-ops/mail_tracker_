// API Base URL - use environment variable in production, localhost in development
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// User Roles
export const ROLES = {
  AG: 'AG',
  DAG: 'DAG',
  SRAO: 'SrAO',
  AAO: 'AAO',
};

// Mail Status
export const MAIL_STATUS = {
  RECEIVED: 'Received',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
};

// Current Action Status Options (what handler is actively doing)
export const CURRENT_ACTION_STATUS_OPTIONS = [
  'Under Review',
  'Drafting Reply',
  'Seeking Clarification',
  'Awaiting Information',
  'Processing',
  'Finalizing',
  'Completed',
  'On Hold',
  'Consulting',
  'Verification',
];

// Audit Actions
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  ASSIGN: 'ASSIGN',
  REASSIGN: 'REASSIGN',
  UPDATE: 'UPDATE',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
};

// Status Colors for MUI Chips
export const STATUS_COLORS = {
  [MAIL_STATUS.RECEIVED]: 'info',
  [MAIL_STATUS.ASSIGNED]: 'warning',
  [MAIL_STATUS.IN_PROGRESS]: 'primary',
  [MAIL_STATUS.CLOSED]: 'success',
};

// Current Action Status Colors
export const ACTION_STATUS_COLORS = {
  'Under Review': 'info',
  'Drafting Reply': 'primary',
  'Seeking Clarification': 'warning',
  'Awaiting Information': 'warning',
  'Processing': 'primary',
  'Finalizing': 'success',
  'Completed': 'success',
  'On Hold': 'error',
  'Consulting': 'secondary',
  'Verification': 'info',
};
