// API Base URL
export const API_BASE_URL = 'http://localhost:8000/api';

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

// Action Required Options
export const ACTION_REQUIRED_OPTIONS = [
  'Review',
  'Approve',
  'Process',
  'File',
  'Reply',
  'Other',
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
