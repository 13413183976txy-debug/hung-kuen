@echo off
title Hung Kuen Hordes Launcher
cd /d "%~dp0"
where python >nul 2>&1
if %errorlevel%==0 (
    python launcher.py
) else (
    where py >nul 2>&1
    if %errorlevel%==0 (
        py launcher.py
    ) else (
        echo Python not found. Please install Python:
        echo   https://www.python.org/downloads/
        pause
    )
)
