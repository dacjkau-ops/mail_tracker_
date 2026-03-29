import { createTheme } from '@mui/material/styles';

export const THEME_TOKENS = {
  primary: '#6B1A1A',
  primaryDark: '#571515',
  primaryLight: '#864040',
  accent: '#92650A',
  accentLight: '#B07C1F',
  backgroundDefault: '#FAFAF8',
  backgroundPaper: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#5A5A5A',
  textMuted: '#9A9A9A',
  divider: '#E0E0E0',
  dividerLight: '#F0EFED',
  headerBackground: '#FDFDFC',
  hover: '#F7F5F3',
  subtle: '#F5F5F5',
  success: '#1B5E20',
  successBackground: '#EDF7EE',
  successBorder: '#A5D6A7',
  closed: '#1A237E',
  error: '#C62828',
  overdueText: '#7F1D1D',
  overdueBackground: '#FEF2F2',
  overdueBorder: '#FECACA',
  shadow: '0 1px 4px rgba(0,0,0,0.05)',
  buttonRadius: 5,
  cardRadius: 6,
};

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: THEME_TOKENS.primary,
      light: THEME_TOKENS.primaryLight,
      dark: THEME_TOKENS.primaryDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: THEME_TOKENS.accent,
      light: THEME_TOKENS.accentLight,
      dark: THEME_TOKENS.accent,
      contrastText: '#FFFFFF',
    },
    warning: {
      main: THEME_TOKENS.accent,
      light: THEME_TOKENS.accentLight,
      dark: THEME_TOKENS.accent,
      contrastText: '#FFFFFF',
    },
    success: {
      main: THEME_TOKENS.success,
      light: THEME_TOKENS.success,
      dark: THEME_TOKENS.success,
      contrastText: '#FFFFFF',
    },
    error: {
      main: THEME_TOKENS.error,
      light: THEME_TOKENS.error,
      dark: THEME_TOKENS.error,
      contrastText: '#FFFFFF',
    },
    info: {
      main: THEME_TOKENS.primary,
      light: THEME_TOKENS.primaryLight,
      dark: THEME_TOKENS.primaryDark,
      contrastText: '#FFFFFF',
    },
    background: {
      default: THEME_TOKENS.backgroundDefault,
      paper: THEME_TOKENS.backgroundPaper,
    },
    text: {
      primary: THEME_TOKENS.textPrimary,
      secondary: THEME_TOKENS.textSecondary,
      disabled: THEME_TOKENS.textMuted,
    },
    divider: THEME_TOKENS.divider,
    action: {
      hover: THEME_TOKENS.hover,
      focus: 'rgba(107, 26, 26, 0.08)',
      selected: 'rgba(107, 26, 26, 0.04)',
    },
  },
  shape: {
    borderRadius: THEME_TOKENS.buttonRadius,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 500,
    h1: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.375rem',
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.3,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.35,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '0.9375rem',
      fontWeight: 500,
      lineHeight: 1.45,
    },
    subtitle1: {
      fontSize: '0.9375rem',
      fontWeight: 500,
      lineHeight: 1.45,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.45,
    },
    body1: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.55,
    },
    body2: {
      fontSize: '0.8125rem',
      fontWeight: 400,
      lineHeight: 1.55,
    },
    button: {
      fontSize: '0.8125rem',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '0.02em',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.45,
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          height: '100%',
        },
        body: {
          minHeight: '100%',
          margin: 0,
          backgroundColor: THEME_TOKENS.backgroundDefault,
          color: THEME_TOKENS.textPrimary,
          fontFeatureSettings: '"cv11", "ss01"',
          fontVariantNumeric: 'tabular-nums',
        },
        '#root': {
          minHeight: '100vh',
        },
        '::selection': {
          backgroundColor: 'rgba(107, 26, 26, 0.14)',
          color: THEME_TOKENS.primary,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'transparent',
      },
      styleOverrides: {
        root: {
          backgroundColor: THEME_TOKENS.backgroundPaper,
          color: THEME_TOKENS.textPrimary,
          borderBottom: `1.5px solid ${THEME_TOKENS.divider}`,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: THEME_TOKENS.backgroundPaper,
          borderRadius: THEME_TOKENS.cardRadius,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: THEME_TOKENS.cardRadius,
          border: `1px solid ${THEME_TOKENS.divider}`,
          boxShadow: THEME_TOKENS.shadow,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: THEME_TOKENS.buttonRadius,
          boxShadow: 'none',
          minHeight: 34,
          padding: '7px 14px',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: THEME_TOKENS.divider,
          '&:hover': {
            borderColor: THEME_TOKENS.primary,
            backgroundColor: 'rgba(107, 26, 26, 0.02)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: THEME_TOKENS.buttonRadius,
          backgroundColor: THEME_TOKENS.backgroundPaper,
          '& fieldset': {
            borderColor: THEME_TOKENS.divider,
          },
          '&:hover fieldset': {
            borderColor: '#CCCCCC',
          },
          '&.Mui-focused fieldset': {
            borderColor: THEME_TOKENS.primary,
            borderWidth: 1,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: THEME_TOKENS.buttonRadius,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 3,
          fontWeight: 500,
          maxWidth: '100%',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          width: 28,
          height: 28,
          backgroundColor: THEME_TOKENS.primary,
          color: '#FFFFFF',
          fontSize: '0.75rem',
          fontWeight: 500,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: THEME_TOKENS.cardRadius,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${THEME_TOKENS.dividerLight}`,
          padding: '12px 14px',
          fontSize: '0.8125rem',
          color: THEME_TOKENS.textPrimary,
        },
        head: {
          backgroundColor: THEME_TOKENS.headerBackground,
          color: THEME_TOKENS.textMuted,
          fontSize: '10.5px',
          fontWeight: 500,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: THEME_TOKENS.hover,
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: THEME_TOKENS.cardRadius,
          border: `1px solid ${THEME_TOKENS.divider}`,
          boxShadow: THEME_TOKENS.shadow,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: THEME_TOKENS.cardRadius,
          border: `1px solid ${THEME_TOKENS.divider}`,
          boxShadow: THEME_TOKENS.shadow,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: THEME_TOKENS.textSecondary,
          '&:hover': {
            backgroundColor: 'rgba(107, 26, 26, 0.04)',
            color: THEME_TOKENS.primary,
          },
        },
      },
    },
  },
});
