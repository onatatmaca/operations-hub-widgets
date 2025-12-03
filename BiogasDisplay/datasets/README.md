# Excel to JSON Converter for BiogasDisplay Widget

This folder contains tools to convert Excel files (`.xlsx`) to JSON format for the BiogasDisplay widget.

## Files

- **convert_excel_to_json.py** - Python script that converts all Excel files in this folder
- **BUILD_EXE.bat** - Batch file to build the script into a standalone `.exe`
- **Erfstadt_v1.xlsx** - Example Excel file
- **Erfstadt_v1.json** - Example JSON output

## Excel File Format

Your Excel files must follow this structure:

| Title | R&I | Details / Bezeichnung | Einheit | Variable |
|-------|-----|----------------------|---------|----------|
| *(empty line)* | | | | |
| **SECTION NAME** | MS008 | Description | % | STAT6.TAG_NAME |
| | MS007 | Description | °C | STAT6.TAG_NAME |
| *(empty line)* | | | | |
| **NEXT SECTION** | MS069 | Description | % | STAT6.TAG_NAME |

**Rules:**
- Row 1: Headers (don't change)
- Row 2: Empty
- Section rows: Column A = UPPERCASE TITLE, then data in columns B-E
- Data rows: Column A = empty, data in columns B-E
- Empty rows separate sections
- R&I ID (column B) is optional - rows will be included even if missing

## Usage

### Option 1: Run Python Script Directly

**Requirements:** Python 3.x installed

1. Place your `.xlsx` files in this folder
2. Double-click `convert_excel_to_json.py` OR run from command line:
   ```bash
   python convert_excel_to_json.py
   ```
3. JSON files will be created automatically

### Option 2: Build and Use .exe (No Python Required)

**One-time setup:**
1. Install Python from https://www.python.org/
2. Double-click `BUILD_EXE.bat`
3. Wait for build to complete
4. Copy `Convert_Excel_to_JSON.exe` from `dist\` folder to this folder

**Usage:**
1. Place your `.xlsx` files in this folder
2. Double-click `Convert_Excel_to_JSON.exe`
3. Wait for conversion (console window shows progress)
4. JSON files created automatically
5. Press Enter to close

## Output Format

The script creates JSON files with this structure:

```json
{
  "name": "Erfstadt_v1",
  "sections": [
    {
      "title": "ROHWARE",
      "tags": [
        {
          "ri": "MS008",
          "description": "Füllstand Lagerbehälter Rohware",
          "unit": "%",
          "variable": "STAT6.111LME_A01_SCALE.F_CV"
        }
      ]
    }
  ]
}
```

## Troubleshooting

**"No .xlsx files found"**
- Make sure Excel files are in the same folder as the converter
- Don't use files starting with `~` (Excel temp files)

**"Error parsing Excel"**
- Check that your Excel follows the correct format
- Make sure Row 1 has the headers: Title, R&I, Details / Bezeichnung, Einheit, Variable

**Build .exe fails**
- Make sure Python is installed
- Run command prompt as Administrator
- Install PyInstaller manually: `pip install pyinstaller`

## Notes

- The converter processes ALL `.xlsx` files in the folder
- Existing JSON files will be overwritten
- Empty rows and columns are handled automatically
- Works with Excel 2007+ format (.xlsx)
