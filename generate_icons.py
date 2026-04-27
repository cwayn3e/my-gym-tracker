from PIL import Image
import os

source_path = "c:/antigravity/gymtracker/icons/rabbit_girl_new.png"
sizes = {
    "icon-192.png": (192, 192),
    "icon-512.png": (512, 512),
    "apple-touch-icon.png": (180, 180)
}

try:
    with Image.open(source_path) as img:
        for filename, size in sizes.items():
            # Resize with Lanczos resampling
            resized_img = img.resize(size, Image.Resampling.LANCZOS)
            output_path = os.path.join("c:/antigravity/gymtracker/icons", filename)
            resized_img.save(output_path, format="PNG")
            print(f"Generated {filename} at {size}")
except Exception as e:
    print(f"Error: {e}")
