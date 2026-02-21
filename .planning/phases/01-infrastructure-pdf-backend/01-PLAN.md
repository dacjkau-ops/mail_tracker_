---
phase: 01-infrastructure-pdf-backend
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/Dockerfile
  - backend/entrypoint.sh
  - docker-compose.yml
  - .env.example
  - nginx/nginx.conf
  - nginx/Dockerfile
  - backend/requirements.txt
autonomous: true
requirements:
  - DOCKER-01
  - DOCKER-02
  - DOCKER-03
  - DOCKER-04
  - DOCKER-05
  - DOCKER-06
  - DOCKER-07
  - DOCKER-08
  - DOCKER-09
  - DOCKER-10
  - NGINX-01
  - NGINX-02
  - NGINX-03
  - NGINX-04
  - NGINX-05
  - NGINX-06
  - NGINX-07
  - NGINX-08

must_haves:
  truths:
    - "docker-compose config validates without errors"
    - "docker-compose build completes successfully for all three services"
    - "nginx /_protected_pdfs/ location has internal directive"
    - "pdf_storage volume is mounted read-write in backend and read-only in nginx"
    - "X-Accel-Redirect header handling is configured in nginx"
  artifacts:
    - path: "backend/Dockerfile"
      provides: "Production-ready Django backend container image"
      contains: "gunicorn"
    - path: "backend/entrypoint.sh"
      provides: "Container startup script (wait for postgres, migrate, start gunicorn)"
      contains: "pg_isready"
    - path: "docker-compose.yml"
      provides: "Three-service orchestration (postgres, backend, nginx)"
      contains: "pdf_storage"
    - path: "nginx/nginx.conf"
      provides: "Reverse proxy config with X-Accel-Redirect internal location"
      contains: "_protected_pdfs"
    - path: "nginx/Dockerfile"
      provides: "Custom nginx image with config baked in"
      contains: "nginx:alpine"
    - path: ".env.example"
      provides: "Environment variable template for deployment"
      contains: "PDF_STORAGE_PATH"
    - path: "backend/requirements.txt"
      provides: "Python dependencies including gunicorn, psycopg2-binary, dj-database-url"
      contains: "gunicorn"
  key_links:
    - from: "docker-compose.yml nginx service"
      to: "nginx/Dockerfile"
      via: "build: ./nginx context"
      pattern: "build:.*nginx"
    - from: "nginx/nginx.conf /_protected_pdfs/"
      to: "pdf_storage volume at /srv/mailtracker/pdfs"
      via: "alias /srv/mailtracker/pdfs/ with internal directive"
      pattern: "internal"
    - from: "backend/entrypoint.sh"
      to: "postgres service"
      via: "pg_isready health check before migration"
      pattern: "pg_isready"
---

<objective>
Establish complete Docker-based deployment infrastructure with PostgreSQL database, Django backend with Gunicorn, and Nginx reverse proxy with internal PDF serving via X-Accel-Redirect.

Purpose: This is the foundational infrastructure wave. Nothing else can run until Docker, nginx, and the database service are configured correctly.

Output: docker-compose.yml, backend Dockerfile + entrypoint, nginx config + Dockerfile, .env.example template, updated requirements.txt.
</objective>

<execution_context>
@C:/Users/vaish/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/vaish/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create backend Dockerfile and entrypoint script</name>
  <files>
    backend/Dockerfile
    backend/entrypoint.sh
  </files>
  <action>
Create `backend/Dockerfile`:
- Use python:3.11-slim base image
- Install system dependencies: postgresql-client (for pg_isready in healthchecks), libpq-dev, gcc, netcat-openbsd
- Set PYTHONUNBUFFERED=1 and PYTHONDONTWRITEBYTECODE=1
- Set working directory to /app
- Copy requirements.txt and run pip install --no-cache-dir -r requirements.txt
- Copy entire backend codebase (COPY . .)
- Copy entrypoint.sh and make it executable: RUN chmod +x /app/entrypoint.sh
- Expose port 8000
- Set ENTRYPOINT ["/app/entrypoint.sh"]

Create `backend/entrypoint.sh`:
- Shebang: #!/bin/sh
- set -e at the top
- Wait for PostgreSQL using pg_isready in a loop:
  ```sh
  echo "Waiting for postgres..."
  while ! pg_isready -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; do
    sleep 1
  done
  echo "Postgres is ready."
  ```
- Run: python manage.py migrate --noinput
- Run: python manage.py collectstatic --noinput
- Exec gunicorn: exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --threads 2 --timeout 60 --access-logfile - --error-logfile -
  </action>
  <verify>
```bash
docker build -t mailtracker-backend-test ./backend
```
Should complete without errors. Check the image exists:
```bash
docker images mailtracker-backend-test
```
  </verify>
  <done>
- backend/Dockerfile exists and builds successfully
- backend/entrypoint.sh exists with pg_isready wait loop, migrate, collectstatic, gunicorn exec
- entrypoint.sh is marked executable in the Dockerfile (chmod +x)
  </done>
</task>

<task type="auto">
  <name>Task 2: Create docker-compose.yml</name>
  <files>
    docker-compose.yml
  </files>
  <action>
Create root-level `docker-compose.yml` with three services:

**postgres service:**
- Image: postgres:16-alpine
- Environment variables from .env: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
- Volume: postgres_data mounted at /var/lib/postgresql/data
- Healthcheck: test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  interval: 10s, timeout: 5s, retries: 5
- Restart: unless-stopped
- Networks: mailtracker_network

**backend service:**
- Build context: ./backend
- Depends on: postgres with condition: service_healthy
- env_file: .env
- Environment: POSTGRES_HOST=postgres (override so Django connects to the postgres container)
- Volumes:
  - pdf_storage:/srv/mailtracker/pdfs (rw)
  - static_volume:/app/staticfiles (rw)
- Networks: mailtracker_network
- Restart: unless-stopped
- Do NOT expose port 8000 to the host (nginx handles that)

**nginx service:**
- Build context: ./nginx
- Depends on: backend (no healthcheck required — entrypoint handles timing)
- Ports: "80:80"
- Volumes:
  - pdf_storage:/srv/mailtracker/pdfs:ro
  - static_volume:/srv/mailtracker/static:ro
- Networks: mailtracker_network
- Restart: unless-stopped

**Networks section:**
```yaml
networks:
  mailtracker_network:
    driver: bridge
```

**Volumes section:**
```yaml
volumes:
  postgres_data:
  pdf_storage:
  static_volume:
```
  </action>
  <verify>
```bash
docker-compose config
```
Should output the merged configuration without errors. Verify all three services appear in the output and the networks/volumes sections are present.
  </verify>
  <done>
- docker-compose.yml exists at project root
- docker-compose config returns valid configuration without errors
- Three services defined: postgres, backend, nginx
- pdf_storage volume present in both backend (rw) and nginx (ro)
- static_volume present in both backend (rw) and nginx (ro)
- postgres_data volume present
- All services on mailtracker_network
  </done>
</task>

<task type="auto">
  <name>Task 3: Create nginx configuration and Dockerfile</name>
  <files>
    nginx/nginx.conf
    nginx/Dockerfile
  </files>
  <action>
Create the `nginx/` directory if it does not exist.

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name _;
        client_max_body_size 20M;

        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /admin/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /static/ {
            alias /srv/mailtracker/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /_protected_pdfs/ {
            internal;
            alias /srv/mailtracker/pdfs/;
            add_header Accept-Ranges bytes;
            add_header Content-Disposition "inline";
            types {
                application/pdf pdf;
            }
            default_type application/pdf;
        }
    }

    # To enable HTTPS, uncomment the server block below and update SSL certificate paths:
    #
    # server {
    #     listen 443 ssl;
    #     server_name _;
    #     client_max_body_size 20M;
    #
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #
    #     # Copy all location blocks from the HTTP server block above
    # }
    #
    # To redirect HTTP to HTTPS, replace the HTTP server listen with:
    # listen 80;
    # return 301 https://$host$request_uri;
}
```

Key points:
- `/_protected_pdfs/` MUST have the `internal` directive — this prevents direct browser access
- `alias /srv/mailtracker/pdfs/` — the trailing slash on both sides is required for correct path resolution
- `Accept-Ranges bytes` enables PDF range requests (page navigation in browser PDF viewer)
- MIME type for .pdf set to application/pdf
- Content-Disposition inline opens PDF in browser tab rather than downloading

Create `nginx/Dockerfile`:
```dockerfile
FROM nginx:alpine
RUN mkdir -p /srv/mailtracker/pdfs /srv/mailtracker/static
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```
  </action>
  <verify>
```bash
docker build -t mailtracker-nginx-test ./nginx
```
Should complete without errors.

Verify the internal directive is present:
```bash
grep -n "internal" nginx/nginx.conf
```
Should output a line containing `internal;` under the `/_protected_pdfs/` location block.
  </verify>
  <done>
- nginx/nginx.conf exists with all five location blocks (/, /api/, /admin/, /static/, /_protected_pdfs/)
- /_protected_pdfs/ location has internal directive
- /_protected_pdfs/ aliases to /srv/mailtracker/pdfs/
- Accept-Ranges bytes header present in /_protected_pdfs/ location
- application/pdf MIME type configured
- nginx/Dockerfile exists and builds successfully
  </done>
</task>

<task type="auto">
  <name>Task 4: Create configuration files and update requirements</name>
  <files>
    .env.example
    backend/requirements.txt
  </files>
  <action>
Create `.env.example` at the project root with all required environment variables:

```env
# Database
POSTGRES_DB=mailtracker
POSTGRES_USER=mailtracker_user
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Django
DEBUG=False
SECRET_KEY=change_me_to_random_50_char_string
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
DATABASE_URL=postgres://mailtracker_user:change_me@postgres:5432/mailtracker

# PDF Storage
PDF_STORAGE_PATH=/srv/mailtracker/pdfs
MAX_PDF_SIZE_MB=10

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=1440
REFRESH_TOKEN_LIFETIME_DAYS=7
```

Read `backend/requirements.txt` to check what is already present. Add the following dependencies if not already listed:
- psycopg2-binary>=2.9.9 (PostgreSQL adapter — must use binary variant, no system libs needed)
- gunicorn>=21.2.0 (WSGI server for production)
- dj-database-url>=2.1.0 (database URL parsing for DATABASE_URL env var)
- whitenoise>=6.6.0 (static file serving — needed for collectstatic in container)

Do not add duplicates. Preserve all existing entries.
  </action>
  <verify>
```bash
cat .env.example
```
Should show all variables including PDF_STORAGE_PATH and POSTGRES_HOST.

```bash
grep -E "psycopg2|gunicorn|dj-database-url|whitenoise" backend/requirements.txt
```
Should return all four packages.
  </verify>
  <done>
- .env.example exists at project root with all required variables including PDF_STORAGE_PATH
- backend/requirements.txt includes psycopg2-binary, gunicorn, dj-database-url, whitenoise
- No duplicate entries in requirements.txt
  </done>
</task>

<task type="auto">
  <name>Task 5: Validate full Docker build</name>
  <files>
  </files>
  <action>
Run the complete Docker validation sequence to confirm all services build and compose file is valid.

Step 1 — Validate compose file syntax:
```bash
docker-compose config
```
Expected: Merged configuration printed without errors.

Step 2 — Build all images:
```bash
docker-compose build
```
Expected: All three images build successfully (postgres uses upstream image, backend and nginx build from local Dockerfiles).

Step 3 — Verify nginx internal directive:
```bash
grep -n "internal" nginx/nginx.conf
```
Expected: One line with `internal;` inside the `/_protected_pdfs/` block.

Step 4 — Verify volume configuration in compose:
```bash
docker-compose config | grep -A2 "pdf_storage"
```
Expected: pdf_storage appears once in backend service (no :ro suffix) and once in nginx service (with :ro suffix).

If any step fails, diagnose and fix before marking done.
  </action>
  <verify>
```bash
docker-compose config && echo "COMPOSE VALID"
docker-compose build && echo "BUILD COMPLETE"
```
Both commands must exit 0 and print their success messages.
  </verify>
  <done>
- docker-compose config exits 0 with no errors
- docker-compose build completes for all services without errors
- nginx/nginx.conf has internal directive on /_protected_pdfs/ location
- pdf_storage volume mounts confirmed (rw for backend, ro for nginx)
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run these checks:

1. Compose file is valid:
   ```bash
   docker-compose config
   ```
   Expected: No errors, all three services present.

2. All images build:
   ```bash
   docker-compose build
   ```
   Expected: Exit 0 for all services.

3. Nginx internal directive present:
   ```bash
   grep "internal;" nginx/nginx.conf
   ```
   Expected: Matches `internal;` inside `/_protected_pdfs/` block.

4. Required packages in requirements.txt:
   ```bash
   grep -E "psycopg2-binary|gunicorn|dj-database-url" backend/requirements.txt
   ```
   Expected: All three packages listed.

5. .env.example has PDF_STORAGE_PATH:
   ```bash
   grep "PDF_STORAGE_PATH" .env.example
   ```
   Expected: Line with PDF_STORAGE_PATH=/srv/mailtracker/pdfs.
</verification>

<success_criteria>
Wave 1 is complete when:
1. docker-compose.yml defines postgres, backend, nginx services with correct dependencies
2. backend/Dockerfile builds successfully using Python 3.11 slim
3. backend/entrypoint.sh waits for postgres, runs migrate, runs collectstatic, starts gunicorn
4. docker-compose build exits 0 with no errors
5. nginx/nginx.conf has /_protected_pdfs/ internal location with alias, Accept-Ranges bytes, and application/pdf MIME type
6. pdf_storage volume mounted rw in backend and ro in nginx
7. .env.example includes all required variables including PDF_STORAGE_PATH
8. backend/requirements.txt includes psycopg2-binary, gunicorn, dj-database-url, whitenoise
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-pdf-backend/01-01-SUMMARY.md` with:
- What was built (Docker infrastructure files created)
- Key implementation decisions (gunicorn workers/threads, pg_isready wait strategy, nginx internal directive setup)
- File list with brief description of each file
- Any deviations from this plan and why
</output>
