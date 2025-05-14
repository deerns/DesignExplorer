# -*- coding: utf-8 -*-
"""
Created on Mon May 12 14:47:33 2025

@author: NL1212
"""


import os

# Use the current folder where the script is located
folder_path = os.path.dirname(os.path.abspath(__file__))

# Loop through all .png files that contain spaces
for filename in os.listdir(folder_path):
    if filename.endswith(".png") and " " in filename:
        new_filename = filename.replace(" ", "_")
        old_path = os.path.join(folder_path, filename)
        new_path = os.path.join(folder_path, new_filename)
        os.rename(old_path, new_path)
        print(f"Renamed: {filename} ➡️ {new_filename}")

