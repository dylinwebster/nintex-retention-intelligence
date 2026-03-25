with open('public/index.html') as f:
    html = f.read()

# Fix 1: Strip any remaining markdown from displayed chat text
# Replace the line that sets thinking.textContent
old_display = "thinking.textContent=responseText;"
new_display = "thinking.textContent=responseText.replace(/\\*\\*/g,'').replace(/^#+\\s/gm,'').replace(/^\\s*[-]\\s/gm,'\\u2022 ');"

html = html.replace(old_display, new_display)

with open('public/index.html','w') as f:
    f.write(html)
print('Chat display fix applied')
