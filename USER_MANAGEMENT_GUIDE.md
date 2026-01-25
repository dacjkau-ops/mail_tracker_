# Django Admin User Management Guide

## Adding Users Through Django Admin

### Step 1: Access Django Admin
1. Open browser and go to: **http://127.0.0.1:8000/admin/**
2. Login with admin credentials:
   - Username: `admin`
   - Password: `admin123`

---

## Method 1: Add Single User (Recommended for Few Users)

### Step-by-Step:

1. **Navigate to Users**
   - Click on "Users" in the left sidebar
   - Click the "ADD USER +" button (top right)

2. **Fill Required Fields (Page 1):**
   - **Username:** e.g., `john_doe`
   - **Password:** Enter password
   - **Password confirmation:** Re-enter same password
   - Click "SAVE AND CONTINUE EDITING"

3. **Fill Additional Info (Page 2):**
   - **Full name:** e.g., `John Doe`
   - **Email:** e.g., `john@office.gov` (must be unique)
   - **Role:** Select from dropdown:
     - `AG` - Additional General (Full access)
     - `DAG` - Deputy Additional General (Section head)
     - `SrAO` - Senior Accounts Officer (Staff)
     - `AAO` - Assistant Accounts Officer (Staff)
   - **Section:** Select section (required for DAG/SrAO/AAO, leave blank for AG)
   - **Active:** Check this box to enable login
   - **Staff status:** Check if you want them to access admin (optional)
   - **Superuser status:** Check only for AG with full admin rights

4. **Click "SAVE"**

---

## Method 2: Import Multiple Users from CSV

### Step 1: Create CSV File

Create a file named `users.csv` with these columns:

```csv
username,email,password,full_name,role,section_name
john_doe,john@office.gov,password123,John Doe,DAG,Administration
jane_smith,jane@office.gov,password123,Jane Smith,SRAO,Accounts
raj_kumar,raj@office.gov,password123,Raj Kumar,AAO,Accounts
```

**Required Columns:**
- `username` - Unique login name
- `email` - Unique email address
- `password` - Initial password (users should change later)
- `full_name` - Display name
- `role` - Must be: `AG`, `DAG`, `SRAO`, or `AAO`
- `section_name` - Section name (leave empty for AG, required for others)

### Step 2: Import via Admin

1. Go to Django Admin → Users
2. Click "IMPORT USERS" button (top right)
3. Choose your CSV file
4. Click "Submit"
5. Review the results:
   - ✓ Green: Users created successfully
   - ⚠ Orange: Skipped (already exists)
   - ✗ Red: Errors (fix and re-import)

---

## Method 3: Import Multiple Users from JSON

### Step 1: Create JSON File

Create a file named `users.json`:

```json
[
  {
    "username": "john_doe",
    "email": "john@office.gov",
    "password": "password123",
    "full_name": "John Doe",
    "role": "DAG",
    "section_name": "Administration"
  },
  {
    "username": "jane_smith",
    "email": "jane@office.gov",
    "password": "password123",
    "full_name": "Jane Smith",
    "role": "SRAO",
    "section_name": "Accounts"
  }
]
```

### Step 2: Import via Admin
Same as CSV method above.

---

## Managing Sections

### Add Section:
1. Go to Django Admin → Sections
2. Click "ADD SECTION +"
3. Fill in:
   - **Name:** e.g., `Human Resources`
   - **Description:** Brief description (optional)
4. Click "SAVE"

### View Existing Sections:
- Accounts
- Administration  
- Establishment
- Legal

You can add more sections as needed.

---

## User Role Permissions

| Role | Can Create Mails | Can Assign | Can View | Section Restricted |
|------|------------------|-----------|----------|-------------------|
| **AG** | All sections | Anyone | All mails | No |
| **DAG** | Own section only | Within section | Section + touched mails | Yes |
| **SrAO/AAO** | No | Can reassign own | Assigned mails only | Yes |

---

## Important Notes

### For DAG and Staff Officers:
- **Section is REQUIRED** - They must be assigned to a section
- Without a section, they cannot function properly

### For AG:
- **Section should be blank** - AG works across all sections
- Can create mails for any section
- Can assign to anyone

### Passwords:
- Set initial password during creation
- Users should change password after first login
- Use strong passwords for production

### Email Addresses:
- Must be UNIQUE across all users
- Required field
- Used for identification

### Usernames:
- Must be UNIQUE
- Cannot be changed after creation
- Use simple, memorable names (e.g., first.last)

---

## Sample User Creation

### Example 1: Creating an AG User

```
Username: director_general
Email: dg@office.gov
Password: SecurePass123
Full Name: Dr. Arvind Mehta
Role: AG
Section: (leave blank)
Active: ✓
Staff status: ✓
Superuser status: ✓
```

### Example 2: Creating a DAG User

```
Username: dag_finance
Email: dag.finance@office.gov
Password: SecurePass123
Full Name: Sanjay Patel
Role: DAG
Section: Accounts
Active: ✓
Staff status: (optional)
Superuser status: (leave unchecked)
```

### Example 3: Creating a Staff Officer

```
Username: ao_sharma
Email: sharma@office.gov
Password: SecurePass123
Full Name: Priya Sharma
Role: SRAO
Section: Administration
Active: ✓
Staff status: (leave unchecked)
Superuser status: (leave unchecked)
```

---

## Troubleshooting

### Error: "User with this username already exists"
- Choose a different username
- Or edit the existing user instead

### Error: "User with this email already exists"
- Email must be unique
- Use a different email address
- Or update the existing user

### Error: "Section does not exist"
- Create the section first in Sections admin
- Then create the user

### User created but can't login
- Check "Active" checkbox is enabled
- Verify password is correct
- Check if user is in the right section

---

## Quick Reference

**Admin URL:** http://127.0.0.1:8000/admin/

**Valid Roles:**
- `AG` - Additional General
- `DAG` - Deputy Additional General  
- `SRAO` - Senior Accounts Officer (note: use SRAO, not SrAO in CSV)
- `AAO` - Assistant Accounts Officer

**Available Sections:**
- Accounts
- Administration
- Establishment
- Legal

**Current Test Credentials:**
All test users have password: `test123`
- `admin` / `admin123` (AG)
- `ag_sharma` / `test123` (AG)
- `dag_admin` / `test123` (DAG - Administration)
- `dag_accounts` / `test123` (DAG - Accounts)
- `srao_reddy` / `test123` (SrAO - Administration)
- `srao_verma` / `test123` (SrAO - Accounts)
- `aao_patel` / `test123` (AAO - Accounts)

---

## Next Steps

1. **Delete test users** (if needed) through Django Admin
2. **Create real users** with proper names and secure passwords
3. **Assign sections** correctly based on organizational structure
4. **Test login** with each new user to verify permissions
5. **Update passwords** for all users in production

**Note:** Never use default passwords like `test123` in production!
