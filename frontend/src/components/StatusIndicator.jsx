import React from 'react';
import { Box, Typography } from '@mui/material';
import { STATUS_INDICATOR, PALETTE } from '../utils/constants';

/**
 * StatusIndicator - Minimal dot + text status display
 * Institutional, data-product aesthetic
 */
const StatusIndicator = ({
  status,
  size = 'default',        // 'small' | 'default'
  showDot = true,
  customLabel,
  customColor,
  overdue = false,
  sx = {},
}) => {
  // Get status config or fallback to gray
  const config = STATUS_INDICATOR[status] || {
    dotColor: PALETTE.dotGray,
    label: status || 'Unknown',
    textColor: PALETTE.textSecondary,
  };

  // Override for overdue items
  const dotColor = overdue ? PALETTE.dotRed : (customColor || config.dotColor);
  const label = customLabel || (overdue ? `${config.label} (Overdue)` : config.label);
  const textColor = overdue ? PALETTE.burgundy : (customColor || config.textColor);

  // Size variants
  const sizeConfig = {
    small: {
      dotSize: 5,
      fontSize: '0.75rem',
      gap: 0.75,
    },
    default: {
      dotSize: 6,
      fontSize: '0.875rem',
      gap: 1,
    },
  };

  const { dotSize, fontSize, gap } = sizeConfig[size];

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        ...sx,
      }}
    >
      {showDot && (
        <Box
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        sx={{
          fontSize,
          fontWeight: 500,
          color: textColor,
          lineHeight: 1.5,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

/**
 * OverdueBadge - Subtle indicator for overdue items
 */
export const OverdueBadge = ({ children }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      px: 1,
      py: 0.25,
      backgroundColor: 'rgba(139, 42, 42, 0.08)',
      borderRadius: 1,
    }}
  >
    <Typography
      sx={{
        fontSize: '0.75rem',
        fontWeight: 500,
        color: PALETTE.burgundy,
      }}
    >
      {children}
    </Typography>
  </Box>
);

/**
 * AssignmentStatusIndicator - For assignment-specific statuses
 */
export const AssignmentStatusIndicator = ({ status }) => {
  const config = {
    Active: { dotColor: PALETTE.dotAmber, label: 'Active' },
    Completed: { dotColor: PALETTE.dotGreen, label: 'Completed' },
    Revoked: { dotColor: PALETTE.dotGray, label: 'Revoked' },
  }[status] || { dotColor: PALETTE.dotGray, label: status };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: config.dotColor,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 500,
          color: PALETTE.textSecondary,
        }}
      >
        {config.label}
      </Typography>
    </Box>
  );
};

export default StatusIndicator;
