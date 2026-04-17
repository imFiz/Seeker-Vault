from PIL import Image
import os

src = r'C:\Users\User\.gemini\antigravity\brain\1ca053c6-9c40-4a03-a022-c5510897e575\sv_icon_512_1774865066248.png'
base = r'c:\Users\User\Documents\work\Seeker Vault\seeker-vault\android\app\src\main\res'

sizes = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

img = Image.open(src).convert('RGBA')

for folder, size in sizes.items():
    out_dir = os.path.join(base, folder)
    os.makedirs(out_dir, exist_ok=True)
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(os.path.join(out_dir, 'ic_launcher.png'))
    resized.save(os.path.join(out_dir, 'ic_launcher_round.png'))
    print(f'Saved {size}x{size} to {folder}')

print('DONE')
