with open('public/index.html') as f:
    html = f.read()

html = html.replace(
    "Always cite specific numbers. Do not use em dashes. Be balanced.",
    "Always cite specific numbers. Do not use em dashes. Be balanced. Do not use any markdown formatting such as **bold** or *italics* or bullet points with dashes. Use plain text only."
)

with open('public/index.html','w') as f:
    f.write(html)
print('Fixed')
