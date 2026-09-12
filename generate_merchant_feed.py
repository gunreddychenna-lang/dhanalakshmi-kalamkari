import json
import csv
import re
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen
from xml.dom import minidom

# Configuration
API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec'
DOMAIN_URL = 'https://www.dhanalakshmikalamkari.in/'
BRAND_NAME = 'Dhanalakshmi Kalamkari'
CATEGORY = 'Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing > Sarees'

def extract_drive_file_id(val):
    if not val or not isinstance(val, str):
        return None
    val = val.strip()
    if re.match(r'^[a-zA-Z0-9_-]{25,50}$', val):
        return val
    match = re.search(r'(?:id=|file/d/|/d/|document/d/)([a-zA-Z0-9_-]{25,50})', val)
    return match.group(1) if match else None

def get_image_url(item):
    for key in ['file id', 'fileid', 'image id', 'imageid', 'drive id', 'image link', 'imagelink', 'drive link', 'thumbnail link', 'thumbnail']:
        val = item.get(key)
        file_id = extract_drive_file_id(str(val or ''))
        if file_id:
            return f'https://lh3.googleusercontent.com/d/{file_id}=w1200'
    for key in ['image link', 'imagelink', 'drive link', 'photo link', 'thumbnail']:
        raw = str(item.get(key) or '').strip()
        if raw.startswith('http://') or raw.startswith('https://'):
            return raw
    return f'{DOMAIN_URL}/Banner.png'

def parse_price(val):
    if not val:
        return 14500
    cleaned = re.sub(r'[^0-9.]', '', str(val))
    try:
        n = float(cleaned)
        return int(n) if n > 0 else 14500
    except:
        return 14500

print("Fetching latest products from Google Sheets...")
req = Request(API_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urlopen(req, timeout=30) as resp:
    raw_data = json.loads(resp.read().decode('utf-8'))

print(f"Total raw items fetched: {len(raw_data)}")

products = []
for item in raw_data:
    code = str(item.get('style code') or item.get('code') or item.get('stylecode') or item.get('item code') or item.get('barcode') or '').strip()
    if not code:
        continue

    fabric = str(item.get('fabric') or item.get('material') or 'Pure Silk').strip()
    price = parse_price(item.get('price') or item.get('selling price') or item.get('offer price'))
    
    raw_qty = item.get('qty')
    try:
        qty = int(raw_qty) if raw_qty is not None and str(raw_qty).strip() != '' else 1
    except:
        qty = 1
    
    availability = 'in_stock' if qty > 0 else 'out_of_stock'
    image_url = get_image_url(item)
    product_link = f"{DOMAIN_URL}/?product={code}"
    
    # SEO Keyword Rich Title & Description
    title = f"Hand-Painted Srikalahasti Pen Kalamkari {fabric} Saree ({code})"
    description = (
        f"Authentic 100% hand-painted Srikalahasti Pen Kalamkari pure silk saree (Code: {code}). "
        f"Handcrafted with bamboo pens and natural organic vegetable mineral dyes in Srikalahasti, Andhra Pradesh. "
        f"Fabric: {fabric}. Direct from Dhanalakshmi Kalamkari master artisans."
    )

    products.append({
        'id': code,
        'title': title,
        'description': description,
        'link': product_link,
        'image_link': image_url,
        'availability': availability,
        'price': f"{price} INR",
        'brand': BRAND_NAME,
        'condition': 'new',
        'google_product_category': CATEGORY
    })

print(f"Processed {len(products)} valid products.")

# 1. EXPORT TO GOOGLE MERCHANT CSV
csv_filename = 'google_merchant_products.csv'
fieldnames = ['id', 'title', 'description', 'link', 'image_link', 'availability', 'price', 'brand', 'condition', 'google_product_category']
with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(products)
print(f"✅ Created '{csv_filename}' (for direct file upload in Merchant Center)")

# 2. EXPORT TO GOOGLE MERCHANT RSS 2.0 XML (For Automatic Scheduled Sync)
rss = ET.Element('rss', {
    'version': '2.0',
    'xmlns:g': 'http://base.google.com/ns/1.0'
})
channel = ET.SubElement(rss, 'channel')
ET.SubElement(channel, 'title').text = 'Dhanalakshmi Kalamkari Srikalahasti'
ET.SubElement(channel, 'link').text = DOMAIN_URL
ET.SubElement(channel, 'description').text = 'Authentic Hand-Painted Srikalahasti Pen Kalamkari Silk Sarees'

for p in products:
    item = ET.SubElement(channel, 'item')
    ET.SubElement(item, 'g:id').text = p['id']
    ET.SubElement(item, 'g:title').text = p['title']
    ET.SubElement(item, 'g:description').text = p['description']
    ET.SubElement(item, 'g:link').text = p['link']
    ET.SubElement(item, 'g:image_link').text = p['image_link']
    ET.SubElement(item, 'g:availability').text = p['availability']
    ET.SubElement(item, 'g:price').text = p['price']
    ET.SubElement(item, 'g:brand').text = p['brand']
    ET.SubElement(item, 'g:condition').text = p['condition']
    ET.SubElement(item, 'g:google_product_category').text = p['google_product_category']

xml_str = minidom.parseString(ET.tostring(rss, encoding='utf-8')).toprettyxml(indent="  ")
xml_filename = 'products.xml'
with open(xml_filename, 'w', encoding='utf-8') as f:
    f.write(xml_str)
print(f"✅ Created '{xml_filename}' (for automatic scheduled fetch)")