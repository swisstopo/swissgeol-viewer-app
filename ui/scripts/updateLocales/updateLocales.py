#!/usr/bin/env python3

# Import section
import json
import os
import shutil

# Define pathes
orig_path = r'../../locales/origLocals'
empty_path = r'../../locales/empty'
new_path = r'../../locales'

def checkAndCombineLocales(orig_pass, empty_path, new_path, ns, lng):
    """
    Doc-String:
        "name": checkAndCombineLocales
        "orig_path": Path to the original translation files
        "empty_path": Path to the empty (without translation) translation files created by i18next-scanner
        "new_path": path for the files create by this skript. Populate emtpy files with tranlations from orgianl translations if exisiting
        "ns": Namespace of the files
        "lng": Language of the files 
    """

    # Define variable
    orig_file = rf'{orig_path}/{ns}.{lng}.json'
    empty_file = rf'{empty_path}/{ns}-{lng}-empty.json'
    
    new_trans_object = {}

    # Read ORIG
    with open(orig_file, 'r') as fo:
        orig_trans = json.load(fo)
        #print(de_orig)

    # Rad NEW
    with open(empty_file, 'r') as fn:
        new_trans = json.load(fn)

    # Compare and combine files
    for key in new_trans:
        if key in orig_trans:
            #print(f"{key} : {orig_trans[key]}")
            new_trans_object[key] = orig_trans[key]
        else:
            print(f"{key} : NOT existing")
            new_trans_object[key] = "__ TO BE TANSLATED __"
    
    # Write compared and combined translations to file
    with open(os.path.join(new_path,f'{ns}-{lng}-new.json'), 'w') as f:    
        json.dump(new_trans_object, f, indent=2, ensure_ascii=False)

    # Statistiks
    print('=======')
    print(f"Count: of ORIG translation ({ns}-{lng}): {len(orig_trans)}")
    print(f"Count: of NEW translation ({ns}-{lng}): {len(new_trans)}")

#########################

current_dir = os.getcwd()
translation_files = os.listdir(empty_path)
print(translation_files)

# Move original files to origLocals
prev_files = os.listdir(new_path)

for file in prev_files:
    if file.endswith(".json"):
        print(file) 
        shutil.move(os.path.join(new_path,file), orig_path)

# Run script
print("Compare & Combine STARTED!")

# Iterate over the locales directory
for file in translation_files:
    lng = file.split('-')[1]
    ns = file.split('-')[0]

    print('=x=x=x=x=x=x=')
    print(f"Working on: {file}")

    # Call function
    checkAndCombineLocales(orig_path, empty_path, new_path, ns, lng)

    print('XxXxXxXxXxXxX')
    print('DONE!')