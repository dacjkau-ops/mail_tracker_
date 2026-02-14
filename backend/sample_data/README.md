# Sample Data Files

This directory contains sample import files for bulk data import in Django admin.

## Files

### 1. `sections_sample.csv` & `sections_sample.json`
Templates for bulk importing sections and subsections.

**How to use:**
1. Go to Django admin: `http://localhost:8000/admin/sections/section/`
2. Click "Import Sections/Subsections" button
3. Upload either CSV or JSON file
4. Review results

**CSV Format:**
- Required: `section_name`
- Optional: `description`, `directly_under_ag`, `subsection_name`, `subsection_description`
- To add multiple subsections to same section, repeat section name

**JSON Format:**
- Array of section objects with nested subsections array
- More structured and easier for complex hierarchies

### 2. User Import (Already Available)
For user import, go to: `http://localhost:8000/admin/users/user/`

**CSV Format:**
```csv
username,email,password,full_name,role,sections,subsection
dag1,dag1@office.gov,pass123,DAG Smith,DAG,"Admin, Finance",
srao1,srao1@office.gov,pass123,SrAO John,SRAO,,Admin-1
```

## Tips

1. **Import Order**: Import sections first, then users
2. **Existing Data**: Import skips duplicates (won't overwrite existing sections/users)
3. **Error Handling**: If import fails, check admin messages for specific row errors
4. **Validation**: Files are validated before import - fix errors and re-upload
5. **Testing**: Test with small sample first before bulk import

## Example Workflow

```bash
# 1. Import sections and subsections
Upload sections_sample.csv or sections_sample.json

# 2. Import users
Upload users_sample.csv (from users admin)

# 3. Verify in admin panel
Check Sections, Subsections, and Users
```
