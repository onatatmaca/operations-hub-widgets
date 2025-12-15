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

        # Detect format: Check if Col A/B look like cluster/anlage names (not tag IDs)
        # Old format: Col A = Title (UPPERCASE), Col B = R&I ID (MS/AG prefix)
        # New format: Col A = Cluster, Col B = Anlage, Col C = Title, Col D = R&I ID
        first_row_with_data = next((r for r in all_rows if r), {})
        col_a_first = first_row_with_data.get(0, '')
        col_b_first = first_row_with_data.get(1, '')

        # If col_b looks like R&I ID (MS/AG prefix), it's old format
        is_old_format = col_b_first.startswith('MS') or col_b_first.startswith('AG')

        if is_old_format:
            # OLD FORMAT: Parse into sections (backward compatibility)
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

                is_title = col_a and col_a.isupper() and not col_a.startswith('MS') and not col_a.startswith('AG')

                if is_title:
                    if current_section:
                        sections.append(current_section)

                    current_section = {
                        'title': col_a,
                        'tags': []
                    }

                    if col_b or col_c or col_d or col_e:
                        current_section['tags'].append({
                            'ri': col_b,
                            'description': col_c,
                            'unit': col_d,
                            'variable': col_e,
                            'timeline': '0'
                        })
                elif current_section:
                    if col_b or col_c or col_d or col_e:
                        current_section['tags'].append({
                            'ri': col_b,
                            'description': col_c,
                            'unit': col_d,
                            'variable': col_e,
                            'timeline': '0'
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
                if not (cluster_name or anlage_name or title or ri or description or variable):
                    continue

                # Create cluster if needed
                if cluster_name and cluster_name not in clusters:
                    clusters[cluster_name] = {}

                # Use the last non-empty cluster name
                if cluster_name:
                    current_cluster = cluster_name
                    current_cluster_dict = clusters[current_cluster]

                    # Create anlage if needed
                    if anlage_name and anlage_name not in current_cluster_dict:
                        current_cluster_dict[anlage_name] = {}

                    # Use the last non-empty anlage name
                    if anlage_name:
                        current_anlage = anlage_name
                        current_anlage_dict = current_cluster_dict[current_anlage]

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
