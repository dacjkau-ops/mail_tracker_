# Mail Tracker - Start Backend and Frontend Servers
# This script starts both Django backend and Vite frontend development servers

$projectRoot = "d:\Office\2026\Mail_Tracker"

# Define backend and frontend directories
$backendDir = "$projectRoot\backend"
$frontendDir = "$projectRoot\frontend"

Write-Host "Starting Mail Tracker Servers..." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Start Backend Server in a new window
Write-Host "Starting Django Backend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$backendDir'; python manage.py runserver`"" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start Frontend Server in a new window
Write-Host "Starting Vite Frontend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$frontendDir'; npm run dev`"" -WindowStyle Normal

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Servers started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend: http://localhost:8000/" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Close the individual server windows to stop them." -ForegroundColor Gray
