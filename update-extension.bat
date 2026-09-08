@echo off
setlocal
cd /d "%~dp0"
git pull --ff-only
if errorlevel 1 (
  echo.
  echo Update failed. The existing files were not changed.
  pause
  exit /b 1
)
echo.
echo Audio Lab is current. Now press Reload on chrome://extensions.
pause
