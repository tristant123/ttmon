@echo off
REM Run Tabula Mythos straight from source (no build step).
setlocal
where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on PATH. Install Python 3.9+ from python.org
    echo and tick "Add python.exe to PATH" during setup.
    pause
    exit /b 1
)
python -c "import pygame, numpy" >nul 2>nul || python -m pip install -r requirements.txt
python main.py %*
if errorlevel 1 pause
