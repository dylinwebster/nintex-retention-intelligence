with open('public/index.html') as f:
    html = f.read()

# Fix 1: Update font from DM Sans to Aptos
html = html.replace("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap", "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap")
html = html.replace("font-family:'DM Sans',sans-serif", "font-family:'Aptos',Calibri,sans-serif")
html = html.replace("font-family:DM Sans,sans-serif", "font-family:Aptos,Calibri,sans-serif")
html = html.replace('font-family:"DM Sans"', 'font-family:"Aptos"')

# Fix 2: Update brand colors
# Nav/header dark: #1B1464
html = html.replace("--ink:#0F1729", "--ink:#1B1464")
# Primary blue accent -> magenta
html = html.replace("--blue:#3266ad", "--blue:#E91E8C")
# Green stays for positive indicators
# Table header backgrounds
html = html.replace("background:#1a1a2e", "background:#1B1464")
# Active tab
html = html.replace("background:var(--ink);color:#fff", "background:#1B1464;color:#fff")
# Auth screen
html = html.replace("background:#0F1729;color:#fff;border:none;border-radius:8px;padding:10px", "background:#1B1464;color:#fff;border:none;border-radius:8px;padding:10px")
# Chat bubble user
html = html.replace("background:#0F1729;color:#fff;", "background:#1B1464;color:#fff;")
# Chat header
html = html.replace("color:#0F1729;", "color:#1B1464;")
# Fab button
html = html.replace("background:#0F1729;color:#fff;border:none;border-radius:50px", "background:#1B1464;color:#fff;border:none;border-radius:50px")
# Signal accent colors stay (they're semantic)
# Chart color primary
html = html.replace("'#3266ad'", "'#1B1464'")
# Pill active state
html = html.replace("border-color:var(--blue);background:rgba(50,102,173,.08);color:var(--blue)", "border-color:#E91E8C;background:rgba(233,30,140,.08);color:#E91E8C")

with open('public/index.html','w') as f:
    f.write(html)
print('Brand CSS updated: Aptos font, Nintex colors')
