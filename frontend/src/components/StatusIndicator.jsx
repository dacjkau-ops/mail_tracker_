import React from 'react';
import { Box, Typography } from '@mui/material';
import { STATUS_INDICATOR, PALETTE } from '../utils/constants';

const StatusIndicator = ({
  status,
  size = 'default',
  showDot = true,
  customLabel,
  customColor,
  overdue: _overdue = false,
  sx = {},
}) => {
  const config = STATUS_INDICATOR[status] || {
    dotColor: PALETTE.dotGray,
    label: status || 'Unknown',
    textColor: PALETTE.textSecondary,
    fontWeight: 400,
  };

  const sizeConfig = {
    small: {
      dotSize: 7,
      fontSize: '12px',
      gap: '5px',
    },
    default: {
      dotSize: 7,
      fontSize: '12px',
      gap: '5px',
    },
  };

  const { dotSize, fontSize, gap } = sizeConfig[size];
  const dotColor = customColor || config.dotColor;
  const label = customLabel || config.label;
  const textColor = customColor || config.textColor;
  const fontWeight = config.fontWeight || 400;

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
          fontWeight,
          color: textColor,
          lineHeight: 1.4,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

export const OverdueBadge = ({ children }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      mt: 0.5,
      px: '5px',
      py: '1px',
      backgroundColor: PALETTE.overdueBg,
      border: `1px solid ${PALETTE.overdueBorder}`,
      borderRadius: '3px',
    }}
  >
    <Typography
      sx={{
        fontSize: '10px',
        fontWeight: 500,
        color: PALETTE.overdueText,
        lineHeight: 1.2,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Typography>
  </Box>
);

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
        gap: '5px',
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: config.dotColor,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontSize: '12px',
          fontWeight: 400,
          color: PALETTE.textSecondary,
        }}
      >
        {config.label}
      </Typography>
    </Box>
  );
};

export default StatusIndicator;
