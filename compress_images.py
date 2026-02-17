import os
from PIL import Image

def compress_images(directory, size=(256, 256)):
    """Resizes and optimizes all PNG images in the given directory."""
    if not os.path.exists(directory):
        print(f"Error: Directory {directory} not found.")
        return

    print(f"Starting compression in: {directory}")
    
    for filename in os.listdir(directory):
        if filename.lower().endswith(".png"):
            filepath = os.path.join(directory, filename)
            try:
                with Image.open(filepath) as img:
                    # Convert to RGBA if not already (safeguard for transparency)
                    img = img.convert("RGBA")
                    
                    # Calculate aspect ratio preserving size
                    img.thumbnail(size, Image.Resampling.LANCZOS)
                    
                    # Create a new transparent background of the target size
                    new_img = Image.new("RGBA", size, (255, 255, 255, 0))
                    # Center the thumbnail
                    offset = ((size[0] - img.size[0]) // 2, (size[1] - img.size[1]) // 2)
                    new_img.paste(img, offset)
                    
                    # Save optimized version
                    new_img.save(filepath, "PNG", optimize=True)
                    print(f"✓ Optimized: {filename} ({img.size[0]}x{img.size[1]})")
            except Exception as e:
                print(f"✗ Failed to process {filename}: {e}")

if __name__ == "__main__":
    # Path to your img folder
    img_dir = os.path.abspath("img")
    compress_images(img_dir)
    print("\nDone! Please refresh the game.")
