# Mail Tracking System - Frontend

React-based frontend for the Mail Tracking System using Material-UI (MUI).

## Technology Stack

- **React 18** - UI framework
- **Material-UI (MUI) v5** - Component library
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client
- **React Hook Form** - Form validation
- **MUI X Date Pickers** - Date selection components
- **jsPDF** - PDF generation
- **date-fns** - Date formatting and manipulation

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── CloseMailDialog.jsx
│   │   ├── RemarksEditDialog.jsx
│   │   ├── ReassignDialog.jsx
│   │   └── ReopenDialog.jsx
│   ├── context/          # React Context providers
│   │   └── AuthContext.jsx
│   ├── layouts/          # Page layouts
│   │   └── MainLayout.jsx
│   ├── pages/            # Page-level components
│   │   ├── LoginPage.jsx
│   │   ├── MailListPage.jsx
│   │   ├── MailDetailPage.jsx
│   │   └── CreateMailPage.jsx
│   ├── services/         # API services
│   │   ├── api.js
│   │   ├── authService.js
│   │   └── mailService.js
│   ├── utils/            # Utility functions
│   │   ├── constants.js
│   │   ├── dateHelpers.js
│   │   └── pdfExport.js
│   ├── App.jsx           # Main app component with routing
│   └── main.jsx          # Entry point
├── package.json
└── README.md
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Base URL:**
   - Open `src/utils/constants.js`
   - Update `API_BASE_URL` if backend is not running on `http://localhost:8000`

3. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```
   Production files will be in the `dist/` folder

## Features Implemented

### Authentication
- JWT-based authentication with access and refresh tokens
- Automatic token refresh on expiry
- Protected routes with role-based access control
- Persistent login state using localStorage

### Mail List View
- View all mails (filtered by user permissions on backend)
- Filter by status
- Search by sl_no, letter_no, or subject
- Sortable columns
- Overdue highlighting (red background for mails past due date)
- Status badges with color coding
- Click-through to detail view
- PDF export functionality

### Mail Detail View
- Complete mail information display
- Remarks section with edit capability (for current handler)
- Action buttons based on permissions:
  - **Reassign** - Reassign to another user with mandatory remarks
  - **Close** - Mark mail as completed with mandatory final remarks
  - **Reopen** - Reopen closed mail (AG only)
- Full audit trail/history log

### Create Mail Form
- All required fields with validation
- Date pickers for date_received and due_date
- Dynamic user dropdown (filtered by backend permissions)
- Section selection
- Action required dropdown with "Other" option
- Optional initial remarks

### Role-Based UI Controls
- **AG (Additional General):**
  - Can see "Create Mail" button
  - Can reassign any mail
  - Can close any mail
  - Can reopen closed mails

- **DAG (Deputy Additional General):**
  - Can see "Create Mail" button
  - Can reassign mails in their section
  - Can close mails they're handling
  - Cannot reopen mails

- **SrAO/AAO (Staff Officers):**
  - Cannot see "Create Mail" button
  - Can reassign their own mails
  - Can close mails assigned to them
  - Cannot reopen mails

## Key Components

### AuthContext
Provides authentication state and methods throughout the app:
- `user` - Current user object
- `login(username, password)` - Login method
- `logout()` - Logout method
- `isAuthenticated` - Boolean auth status
- `canCreateMail()` - Check if user can create mails
- `canReopen()` - Check if user can reopen closed mails

### API Service Layer
- **api.js** - Axios instance with JWT interceptor
- **authService.js** - Authentication API calls
- **mailService.js** - Mail-related API calls

### Utilities
- **constants.js** - App-wide constants and enums
- **dateHelpers.js** - Date formatting and calculations
- **pdfExport.js** - PDF generation for mail reports

## Environment Variables

Currently using hardcoded values in `src/utils/constants.js`. For production, consider using environment variables:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

Access in code:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
```

## Backend Integration

The frontend expects these API endpoints:

### Authentication
- `POST /api/auth/login/` - Login with username/password
- `POST /api/auth/token/refresh/` - Refresh access token

### Mails
- `GET /api/mails/` - List mails (with query params for filtering)
- `GET /api/mails/:id/` - Get mail details
- `POST /api/mails/` - Create new mail
- `PATCH /api/mails/:id/update_remarks/` - Update remarks
- `POST /api/mails/:id/reassign/` - Reassign mail
- `POST /api/mails/:id/close/` - Close mail
- `POST /api/mails/:id/reopen/` - Reopen mail
- `GET /api/mails/:id/audit_trail/` - Get audit history

### Reference Data
- `GET /api/sections/` - List sections
- `GET /api/users/` - List users (filtered by permissions)

## Troubleshooting

### CORS Errors
Ensure Django backend has CORS properly configured:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

### API Connection Issues
1. Check if backend is running on `http://localhost:8000`
2. Verify `API_BASE_URL` in `src/utils/constants.js`
3. Check browser console for detailed error messages

### Authentication Issues
1. Clear localStorage and try logging in again
2. Check if JWT tokens are being properly stored
3. Verify backend authentication endpoints are working

## Development Guidelines

1. **Components** - Use functional components with hooks
2. **State Management** - Use local state + Context API for auth
3. **Styling** - Use MUI's sx prop and theme system
4. **Forms** - Use React Hook Form for validation
5. **API Calls** - Always use the service layer, never direct axios calls
6. **Error Handling** - Display user-friendly error messages
7. **Permissions** - Backend enforces permissions, frontend only hides UI elements

## Next Steps

To fully integrate with backend:
1. Ensure backend is running and accessible
2. Verify all API endpoints are implemented
3. Test with different user roles (AG, DAG, SrAO/AAO)
4. Test all CRUD operations and permission scenarios
5. Test token refresh mechanism
6. Test PDF export with real data

## License

Internal use only - Office Mail Tracking System
