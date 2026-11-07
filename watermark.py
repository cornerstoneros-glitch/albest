from PIL import Image, ImageChops
import glob
import os

def make_white_transparent(image):
    image = image.convert("RGBA")
    data = image.getdata()
    new_data = []
    for item in data:
        # If it's mostly white, make it transparent
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    image.putdata(new_data)
    return image

def watermark_image(img_path, logo):
    try:
        img = Image.open(img_path).convert("RGBA")
        img_w, img_h = img.size
        
        # Resize logo to be 20% of image width
        logo_w = int(img_w * 0.2)
        ratio = logo_w / logo.size[0]
        logo_h = int(logo.size[1] * ratio)
        logo_resized = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
        
        # Position at bottom right with padding
        padding = int(img_w * 0.05)
        pos = (img_w - logo_w - padding, img_h - logo_h - padding)
        
        # Paste logo using alpha channel as mask
        img.paste(logo_resized, pos, logo_resized)
        
        # Save
        if img_path.endswith('.jpg'):
            img = img.convert("RGB")
        img.save(img_path)
        print(f"Watermarked {img_path}")
    except Exception as e:
        print(f"Error on {img_path}: {e}")

if __name__ == "__main__":
    logo_path = "logo.jpg"
    if not os.path.exists(logo_path):
        print(f"Logo not found at {logo_path}")
        exit(1)
        
    logo = Image.open(logo_path)
    logo_transparent = make_white_transparent(logo)
    
    images = glob.glob("images/categories/*.png") + glob.glob("images/home/*.png") + glob.glob("images/services/*.png") + glob.glob("images/contact/*.png") + glob.glob("images/devis/*.png") + glob.glob("images/slider/*.png")
    for img_path in images:
        watermark_image(img_path, logo_transparent)
