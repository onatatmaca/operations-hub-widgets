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

        # Detect format: Check if Col A/B are empty or contain cluster/anlage names
        # Old format: Col A = Title (UPPERCASE), Col B = R&I ID (MS/AG prefix) OR Col A = empty, Col B = empty, Col C = Title
        # New format: Col A = Cluster, Col B = Anlage, Col C = Title, Col D = R&I ID

        # Check first few rows to determine format
        sample_rows = [r for r in all_rows[:10] if r]

        # Count how many rows have data in columns A and B
        rows_with_col_a = sum(1 for r in sample_rows if r.get(0, '').strip())
        rows_with_col_b = sum(1 for r in sample_rows if r.get(1, '').strip())

        # Check if column B contains R&I IDs (MS/AG prefix)
        col_b_is_ri = any(
            r.get(1, '').strip().startswith(('MS', 'AG', 'LME', 'TME', 'PME', 'FME'))
            for r in sample_rows if r.get(1, '').strip()
        )

        # OLD FORMAT if:
        # 1. Column A (Cluster) is empty - this means no hierarchy, show old way
        # 2. OR columns A and B are mostly empty (old structure starts from different column)
        # 3. OR column B contains R&I IDs
        col_a_is_empty = rows_with_col_a < 3
        is_old_format = col_a_is_empty or (rows_with_col_a < 3 and rows_with_col_b < 3) or col_b_is_ri

        if is_old_format:
            # OLD FORMAT: Parse into sections (backward compatibility)
            # Can have two structures:
            # 1. Data in cols A-E: Title, R&I, Description, Unit, Variable
            # 2. Data in cols C-H (A&B empty): Title, R&I, Description, Unit, Variable, Timeline
            sections = []
            current_section = None

            # Detect column offset based on where title data starts
            # If Column A is empty but B has data, titles are in Column C → offset = 2
            # If both A and B are empty, titles might be in Column C → offset = 2
            # If Column A has data, titles are in Column A → offset = 0
            first_row = next((r for r in all_rows if r), {})
            if col_a_is_empty:
                # Column A is empty, so data starts from Column C
                col_offset = 2
            else:
                col_offset = 0

            for row_dict in all_rows:
                if not row_dict:
                    continue

                # Read from correct columns based on offset
                title_col = row_dict.get(0 + col_offset, '').strip()
                ri_col = row_dict.get(1 + col_offset, '').strip()
                desc_col = row_dict.get(2 + col_offset, '').strip()
                unit_col = row_dict.get(3 + col_offset, '').strip()
                var_col = row_dict.get(4 + col_offset, '').strip()
                timeline_col = row_dict.get(5 + col_offset, '0').strip() or '0'

                # Check if this is a new section (title changed)
                is_new_section = (title_col and title_col.isupper() and
                                 not any(title_col.startswith(p) for p in ['MS', 'AG', 'LME', 'TME', 'PME', 'FME']) and
                                 (not current_section or current_section['title'] != title_col))

                if is_new_section:
                    # Save previous section
                    if current_section:
                        sections.append(current_section)

                    # Start new section
                    current_section = {
                        'title': title_col,
                        'tags': []
                    }

                # Add tag to current section
                if current_section and (ri_col or desc_col or var_col):
                    current_section['tags'].append({
                        'ri': ri_col,
                        'description': desc_col,
                        'unit': unit_col,
                        'variable': var_col,
                        'timeline': timeline_col
                    })

            if current_section:
                sections.append(current_section)

            filename = os.path.splitext(os.path.basename(excel_path))[0]
            output = {
                'name': filename,
                'sections': sections
            }

            total_tags = sum(len(s['tags']) for s in sections)
            print(f"    ✓ Parsed {len(sections)} sections with {total_tags} tags (OLD FORMAT)")

        else:
            # NEW FORMAT: Parse into clusters → anlagen → sections
            clusters = {}

            for row_dict in all_rows:
                if not row_dict:
                    continue

                cluster_name = row_dict.get(0, '').strip()
                anlage_name = row_dict.get(1, '').strip()
                title = row_dict.get(2, '').strip()
                ri = row_dict.get(3, '').strip()
                description = row_dict.get(4, '').strip()
                unit = row_dict.get(5, '').strip()
                variable = row_dict.get(6, '').strip()
                timeline = row_dict.get(7, '0').strip() or '0'

                # Skip if no useful data
                if not (anlage_name or title or ri or description or variable):
                    continue

                # Use default cluster if cluster_name is empty
                if not cluster_name:
                    cluster_name = 'CLUSTER 1'

                # Use default anlage if anlage_name is empty
                if not anlage_name:
                    anlage_name = 'Default'

                # Create cluster if needed
                if cluster_name not in clusters:
                    clusters[cluster_name] = {}
                    current_cluster = cluster_name

                # Track current cluster
                current_cluster_dict = clusters[cluster_name]

                # Create anlage if needed
                if anlage_name not in current_cluster_dict:
                    current_cluster_dict[anlage_name] = {}
                    current_anlage = anlage_name

                # Track current anlage
                current_anlage_dict = current_cluster_dict[anlage_name]

                # Create section if needed
                if title and title not in current_anlage_dict:
                    current_anlage_dict[title] = []

                # Add tag
                if title and (ri or description or variable):
                    current_anlage_dict[title].append({
                        'ri': ri,
                        'description': description,
                        'unit': unit,
                        'variable': variable,
                        'timeline': timeline
                    })

            # Convert dict structure to list structure
            clusters_list = []
            for cluster_name, anlagen_dict in clusters.items():
                anlagen_list = []
                for anlage_name, sections_dict in anlagen_dict.items():
                    sections_list = []
                    for title, tags in sections_dict.items():
                        sections_list.append({
                            'title': title,
                            'tags': tags
                        })
                    anlagen_list.append({
                        'name': anlage_name,
                        'sections': sections_list
                    })
                clusters_list.append({
                    'name': cluster_name,
                    'anlagen': anlagen_list
                })

            filename = os.path.splitext(os.path.basename(excel_path))[0]
            output = {
                'name': filename,
                'clusters': clusters_list
            }

            total_tags = sum(
                len(tag)
                for cluster in clusters_list
                for anlage in cluster['anlagen']
                for section in anlage['sections']
                for tag in section['tags']
            )
            total_sections = sum(len(anlage['sections']) for cluster in clusters_list for anlage in cluster['anlagen'])
            total_anlagen = sum(len(cluster['anlagen']) for cluster in clusters_list)
            print(f"    ✓ Parsed {len(clusters_list)} clusters, {total_anlagen} anlagen, {total_sections} sections with {total_tags} tags (NEW FORMAT)")

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
