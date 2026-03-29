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
  CREATED: 'Created',
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
  [MAIL_STATUS.CREATED]: 'info',
  [MAIL_STATUS.ASSIGNED]: 'warning',
  [MAIL_STATUS.IN_PROGRESS]: 'primary',
  [MAIL_STATUS.CLOSED]: 'success',
};

// Status Chip mapping for Mail Detail page header
// Groups Received+Assigned → "Pending", In Progress → "In Progress", Closed → "Closed"
export const DETAIL_STATUS_CHIP = {
  [MAIL_STATUS.CREATED]: { label: 'Pending', color: 'default' },
  [MAIL_STATUS.ASSIGNED]: { label: 'Pending', color: 'default' },
  [MAIL_STATUS.IN_PROGRESS]: { label: 'In Progress', color: 'warning' },
  [MAIL_STATUS.CLOSED]: { label: 'Closed', color: 'success' },
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

// Status Indicator Styles (dot + text pattern)
// For minimal, data-product-like status display
export const STATUS_INDICATOR = {
  [MAIL_STATUS.CREATED]: {
    dotColor: '#9CA3AF',    // Gray
    label: 'Created',
    textColor: '#636E72',
  },
  [MAIL_STATUS.ASSIGNED]: {
    dotColor: '#6B7280',    // Darker gray
    label: 'Assigned',
    textColor: '#2D3436',
  },
  [MAIL_STATUS.IN_PROGRESS]: {
    dotColor: '#B8860B',    // Amber/Gold - active state
    label: 'In Progress',
    textColor: '#2D3436',
  },
  [MAIL_STATUS.CLOSED]: {
    dotColor: '#5D7A5D',    // Muted green
    label: 'Closed',
    textColor: '#636E72',
  },
};

// Legacy status colors (for backward compatibility)
// Use STATUS_INDICATOR for new implementations
export const STATUS_COLORS = {
  [MAIL_STATUS.CREATED]: 'default',
  [MAIL_STATUS.ASSIGNED]: 'default',
  [MAIL_STATUS.IN_PROGRESS]: 'warning',
  [MAIL_STATUS.CLOSED]: 'success',
};

// Status Chip mapping for Mail Detail page header
export const DETAIL_STATUS_CHIP = {
  [MAIL_STATUS.CREATED]: { label: 'Pending', color: 'default' },
  [MAIL_STATUS.ASSIGNED]: { label: 'Pending', color: 'default' },
  [MAIL_STATUS.IN_PROGRESS]: { label: 'In Progress', color: 'warning' },
  [MAIL_STATUS.CLOSED]: { label: 'Closed', color: 'success' },
};

// Color palette reference (for inline styles when needed)
export const PALETTE = {
  // Primary
  burgundy: '#6B1A1A',
  burgundyLight: '#8B2A2A',
  burgundyDark: '#4A1212',

  // Background
  cream: '#FAFAF8',
  paper: '#FFFFFF',
  subtle: '#F5F4F2',

  // Text
  textPrimary: '#2D3436',
  textSecondary: '#636E72',
  textMuted: '#B2BEC3',

  // Borders
  border: '#E8E6E3',
  borderDark: '#D3D0CB',

  // Accents
  amber: '#B8860B',
  amberLight: '#D4A020',
  green: '#5D7A5D',

  // Status dots
  dotGray: '#6B7280',
  dotAmber: '#B8860B',
  dotGreen: '#5D7A5D',
  dotRed: '#8B2A2A',
};
