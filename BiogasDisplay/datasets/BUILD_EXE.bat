@echo off
REM Build script to create Excel to JSON converter executable
REM Requires Python 3 and PyInstaller

echo ============================================================
echo Building Excel to JSON Converter (.exe)
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

echo Python found!
echo.

REM Check if PyInstaller is installed
python -m pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo PyInstaller not found. Installing...
    python -m pip install pyinstaller
    echo.
)

echo Building executable with PyInstaller...
echo.

REM Build the executable
python -m PyInstaller --onefile --name "Convert_Excel_to_JSON" convert_excel_to_json.py

if errorlevel 0 (
    echo.
    echo ============================================================
    echo SUCCESS! Executable created in dist\ folder
    echo ============================================================
    echo.
    echo To use:
    echo 1. Copy "Convert_Excel_to_JSON.exe" from dist\ to this folder
    echo 2. Double-click the .exe to convert all Excel files
    echo.
) else (
    echo.
    echo ============================================================
    echo ERROR: Build failed
    echo ============================================================
    echo.
)

pause
