@echo off
REM Build TabulaMythos.exe for Windows.
REM Requires Python 3.9+ on PATH. Produces dist\TabulaMythos.exe.

setlocal
echo === Tabula Mythos - Windows build ===

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on PATH. Install Python 3.9+ from python.org
    echo and tick "Add python.exe to PATH" during setup.
    pause
    exit /b 1
)

echo.
echo [1/3] Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
if errorlevel 1 goto :fail

echo.
echo [2/3] Running the test suite...
python -m unittest discover -s tests
if errorlevel 1 goto :fail

echo.
echo [3/3] Building the executable...
python -m PyInstaller --noconfirm TabulaMythos.spec
if errorlevel 1 goto :fail

echo.
echo Done. The game is at dist\TabulaMythos.exe
echo Double-click it, or run it from anywhere - saves go to %%APPDATA%%\TabulaMythos.
pause
exit /b 0

:fail
echo.
echo Build failed. See the messages above.
pause
exit /b 1
