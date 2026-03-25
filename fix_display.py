with open('public/index.html') as f:
    html = f.read()

# Fix: stringify error objects so we can see them
html = html.replace(
    "thinking.textContent=d.text||d.error||'No response';",
    "thinking.textContent=d.text||(typeof d.error==='string'?d.error:JSON.stringify(d.error))||'No response';"
)

with open('public/index.html','w') as f:
    f.write(html)
print('Fixed error display')
