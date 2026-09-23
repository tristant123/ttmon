@echo off
REM Verify a build: unit tests, then three headless playthroughs that drive
REM the real game loop and save screenshots you can flip through.
REM
REM   check.bat        writes screenshots to check_output\
REM
REM Sets ERRORLEVEL if anything fails.

setlocal enabledelayedexpansion
cd /d "%~dp0"
set OUT=check_output
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%"
set FAIL=0

echo === Tabula Mythos: checking this build ===

call :step "engine tests"         python -m unittest discover -s tests -q
call :step "imports compile"      python -m compileall -q game main.py tools
call :step "playthrough"          python tools\run_playtest.py "%OUT%\1_playthrough"
call :step "world: village-boss"  python tools\run_world_test.py "%OUT%\2_world"
call :step "battle systems"       python tools\run_battle_demo.py "%OUT%\3_battle"
call :step "every map"            python tools\shot_maps.py "%OUT%\4_maps"
call :step "every monster"        python tools\make_roster_image.py
call :step "spell effects"        python tools\effect_strip.py "%OUT%\effects.png"

echo.
if "%FAIL%"=="0" (
    echo All checks passed. Screenshots are in %OUT%\ - open them and look.
) else (
    echo Something failed. See the output above.
)
pause
exit /b %FAIL%

:step
set LABEL=%~1
shift
set CMD=
:gather
if "%~1"=="" goto run
set CMD=!CMD! %1
shift
goto gather
:run
<nul set /p "=%LABEL%  "
!CMD! >"%TEMP%\ttmon_step.log" 2>&1
if errorlevel 1 (
    echo FAILED
    type "%TEMP%\ttmon_step.log"
    set FAIL=1
) else (
    echo ok
)
exit /b 0
