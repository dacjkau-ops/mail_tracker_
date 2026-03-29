import { THEME_TOKENS } from '../theme';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const ROLES = {
  AG: 'AG',
  DAG: 'DAG',
  SRAO: 'SrAO',
  AAO: 'AAO',
};

export const MAIL_STATUS = {
  CREATED: 'Created',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
};

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

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  ASSIGN: 'ASSIGN',
  REASSIGN: 'REASSIGN',
  UPDATE: 'UPDATE',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
};

export const STATUS_COLORS = {
  [MAIL_STATUS.CREATED]: 'warning',
  [MAIL_STATUS.ASSIGNED]: 'warning',
  [MAIL_STATUS.IN_PROGRESS]: 'warning',
  [MAIL_STATUS.CLOSED]: 'secondary',
};

export const DETAIL_STATUS_CHIP = {
  [MAIL_STATUS.CREATED]: { label: 'Pending', color: 'default' },
  [MAIL_STATUS.ASSIGNED]: { label: 'Pending', color: 'default' },
  [MAIL_STATUS.IN_PROGRESS]: { label: 'In Progress', color: 'warning' },
  [MAIL_STATUS.CLOSED]: { label: 'Closed', color: 'success' },
};

export const ACTION_STATUS_COLORS = {
  'Under Review': 'warning',
  'Drafting Reply': 'warning',
  'Seeking Clarification': 'warning',
  'Awaiting Information': 'warning',
  'Processing': 'warning',
  'Finalizing': 'success',
  'Completed': 'success',
  'On Hold': 'error',
  'Consulting': 'warning',
  'Verification': 'warning',
};

export const STATUS_INDICATOR = {
  [MAIL_STATUS.CREATED]: {
    dotColor: THEME_TOKENS.accent,
    label: 'Created',
    textColor: THEME_TOKENS.accent,
    fontWeight: 400,
  },
  [MAIL_STATUS.ASSIGNED]: {
    dotColor: THEME_TOKENS.accent,
    label: 'Assigned',
    textColor: THEME_TOKENS.accent,
    fontWeight: 400,
  },
  [MAIL_STATUS.IN_PROGRESS]: {
    dotColor: THEME_TOKENS.accent,
    label: 'In Progress',
    textColor: THEME_TOKENS.accent,
    fontWeight: 400,
  },
  [MAIL_STATUS.CLOSED]: {
    dotColor: THEME_TOKENS.closed,
    label: 'Closed',
    textColor: THEME_TOKENS.closed,
    fontWeight: 400,
  },
  Completed: {
    dotColor: THEME_TOKENS.success,
    label: 'Completed',
    textColor: THEME_TOKENS.success,
    fontWeight: 400,
  },
  Overdue: {
    dotColor: THEME_TOKENS.error,
    label: 'Overdue',
    textColor: THEME_TOKENS.overdueText,
    fontWeight: 500,
  },
};

export const PALETTE = {
  burgundy: THEME_TOKENS.primary,
  burgundyLight: THEME_TOKENS.primaryLight,
  burgundyDark: THEME_TOKENS.primaryDark,
  cream: THEME_TOKENS.backgroundDefault,
  paper: THEME_TOKENS.backgroundPaper,
  subtle: THEME_TOKENS.hover,
  headerBackground: THEME_TOKENS.headerBackground,
  hover: THEME_TOKENS.hover,
  textPrimary: THEME_TOKENS.textPrimary,
  textSecondary: THEME_TOKENS.textSecondary,
  textMuted: THEME_TOKENS.textMuted,
  border: THEME_TOKENS.divider,
  borderDark: THEME_TOKENS.divider,
  borderLight: THEME_TOKENS.dividerLight,
  amber: THEME_TOKENS.accent,
  amberLight: THEME_TOKENS.accentLight,
  green: THEME_TOKENS.success,
  greenBg: THEME_TOKENS.successBackground,
  greenBorder: THEME_TOKENS.successBorder,
  closedBlue: THEME_TOKENS.closed,
  dotGray: THEME_TOKENS.textMuted,
  dotAmber: THEME_TOKENS.accent,
  dotGreen: THEME_TOKENS.success,
  dotRed: THEME_TOKENS.error,
  overdueText: THEME_TOKENS.overdueText,
  overdueBg: THEME_TOKENS.overdueBackground,
  overdueBorder: THEME_TOKENS.overdueBorder,
  shadow: THEME_TOKENS.shadow,
  radiusButton: THEME_TOKENS.buttonRadius,
  radiusCard: THEME_TOKENS.cardRadius,
};
