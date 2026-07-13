import json
import simple_icd_10 as icd

def main():
    # Load old corpus
    with open('data/icd10Codes.json', 'r') as f:
        old_data = json.load(f)
    
    old_codes = old_data.get('codes', [])
    print(f"Old corpus size: {len(old_codes)}")
    
    clean_codes = []
    contaminated_codes = []
    
    for entry in old_codes:
        code = entry['code']
        # simple-icd-10 expects codes with or without dot, but icd.is_valid_item(code) works
        if icd.is_valid_item(code):
            clean_codes.append(entry)
        else:
            contaminated_codes.append(entry)
            
    print(f"Clean corpus size: {len(clean_codes)}")
    print(f"Contaminated entries removed: {len(contaminated_codes)}")
    
    # Save clean corpus
    clean_data = {
        "version": "WHO-ICD-10-2019-V1.0-CLEANED",
        "codes": clean_codes
    }
    
    with open('data/icd10Codes_clean.json', 'w') as f:
        json.dump(clean_data, f, indent=2)
        
    # Check specifically how many of the 77 known contaminated length>5 codes were removed
    length_gt_5 = [c for c in contaminated_codes if len(c['code']) > 5]
    print(f"Removed CM-like (length > 5) codes: {len(length_gt_5)}")

if __name__ == '__main__':
    main()
