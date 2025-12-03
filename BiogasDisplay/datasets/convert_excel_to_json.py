#!/usr/bin/env python3
"""
Excel to JSON Converter for BiogasDisplay Widget
Converts all .xlsx files in the current directory to .json format
"""

import xml.etree.ElementTree as ET
import zipfile
import json
import os
import re
import sys

def col_to_index(col_letter):
    """Convert Excel column letter to 0-based index"""
    num = 0
    for c in col_letter:
        num = num * 26 + (ord(c) - ord('A')) + 1
    return num - 1

def parse_excel_to_json(excel_path):
    """Parse Excel file and return JSON structure"""
    print(f"  Processing: {os.path.basename(excel_path)}")

    try:
        # Extract and parse Excel
        with zipfile.ZipFile(excel_path) as z:
            with z.open('xl/worksheets/sheet1.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()

            # Get shared strings
            try:
                with z.open('xl/sharedStrings.xml') as f:
                    strings_tree = ET.parse(f)
                    strings_root = strings_tree.getroot()
                    shared_strings = [elem.find('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text
                                    for elem in strings_root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si')]
            except:
                shared_strings = []

        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = root.findall('.//main:row', ns)

        # Parse all rows
        all_rows = []
        for row in rows[1:]:  # Skip header
            cells = row.findall('.//main:c', ns)
            row_dict = {}

            for cell in cells:
                cell_ref = cell.get('r')
                col_letter = re.match(r'([A-Z]+)', cell_ref).group(1)
                col_idx = col_to_index(col_letter)

                value_elem = cell.find('.//main:v', ns)
                if value_elem is not None:
                    value = value_elem.text
                    cell_type = cell.get('t')
                    if cell_type == 's' and shared_strings:
                        try:
                            value = shared_strings[int(value)]
                        except:
                            pass
                    row_dict[col_idx] = str(value).strip()

            all_rows.append(row_dict)

        # Parse into sections
        sections = []
        current_section = None

        for row_dict in all_rows:
            if not row_dict:
                continue

            col_a = row_dict.get(0, '')
            col_b = row_dict.get(1, '')
            col_c = row_dict.get(2, '')
            col_d = row_dict.get(3, '')
            col_e = row_dict.get(4, '')

            # If col_a has a value and it's a title (uppercase, not MS/AG prefix), start new section
            is_title = col_a and col_a.isupper() and not col_a.startswith('MS') and not col_a.startswith('AG')

            if is_title:
                # Save previous section
                if current_section:
                    sections.append(current_section)

                # Start new section
                current_section = {
                    'title': col_a,
                    'tags': []
                }

                # Add the tag data from this title row (columns B, C, D, E)
                # Include even if R&I is missing - just need any data
                if col_b or col_c or col_d or col_e:
                    current_section['tags'].append({
                        'ri': col_b,
                        'description': col_c,
                        'unit': col_d,
                        'variable': col_e
                    })
            elif current_section:
                # This is a data row (col_a is empty, data in columns B, C, D, E)
                # Include even if R&I is missing - just need any data
                if col_b or col_c or col_d or col_e:
                    current_section['tags'].append({
                        'ri': col_b,
                        'description': col_c,
                        'unit': col_d,
                        'variable': col_e
                    })

        if current_section:
            sections.append(current_section)

        # Create output structure
        filename = os.path.splitext(os.path.basename(excel_path))[0]
        output = {
            'name': filename,
            'sections': sections
        }

        total_tags = sum(len(s['tags']) for s in sections)
        print(f"    ✓ Parsed {len(sections)} sections with {total_tags} tags")

        return output

    except Exception as e:
        print(f"    ✗ Error: {str(e)}")
        return None

def main():
    """Main function to convert all Excel files in current directory"""
    print("=" * 60)
    print("Excel to JSON Converter for BiogasDisplay Widget")
    print("=" * 60)
    print()

    # Get current directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not script_dir:
        script_dir = os.getcwd()

    print(f"Scanning directory: {script_dir}")
    print()

    # Find all .xlsx files
    xlsx_files = [f for f in os.listdir(script_dir) if f.endswith('.xlsx') and not f.startswith('~')]

    if not xlsx_files:
        print("No .xlsx files found in current directory.")
        input("\nPress Enter to exit...")
        return

    print(f"Found {len(xlsx_files)} Excel file(s):")
    for f in xlsx_files:
        print(f"  - {f}")
    print()

    # Convert each file
    converted = 0
    for xlsx_file in xlsx_files:
        xlsx_path = os.path.join(script_dir, xlsx_file)
        json_filename = os.path.splitext(xlsx_file)[0] + '.json'
        json_path = os.path.join(script_dir, json_filename)

        # Parse Excel
        data = parse_excel_to_json(xlsx_path)

        if data:
            # Save JSON
            try:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"    ✓ Saved to: {json_filename}")
                converted += 1
            except Exception as e:
                print(f"    ✗ Failed to save JSON: {str(e)}")

        print()

    print("=" * 60)
    print(f"Conversion complete: {converted}/{len(xlsx_files)} files converted")
    print("=" * 60)

    # Wait for user input before closing (for .exe)
    input("\nPress Enter to exit...")

if __name__ == '__main__':
    main()
