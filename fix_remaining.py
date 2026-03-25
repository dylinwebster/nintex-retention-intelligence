with open('public/index.html') as f:
    html = f.read()

# Fix 1: CSM_DATA -> CSM_BANDS in chat system prompt
html = html.replace("JSON.stringify(CSM_DATA[", "JSON.stringify(CSM_BANDS[")
html = html.replace("Object.keys(CSM_DATA)", "Object.keys(CSM_BANDS)")

# Fix 3: Enhance system prompt
old_sys = "s='You are a retention analytics assistant for Nintex. Answer concisely with specific numbers. Do not use em dashes. Be balanced."
new_sys = "s='You are a retention analytics assistant for Nintex. You have aggregate retention data by quarter, region, ARR tier, industry, product family (L2), and CSM assignment status. You can answer questions about rates, trends, comparisons, and portfolio composition. You do NOT have individual account names or account-level detail; if asked for specific customer lists, explain that this requires a live connection to Salesforce and Databricks which is on the roadmap. Always cite specific numbers. Do not use em dashes. Be balanced."
html = html.replace(old_sys, new_sys)

with open('public/index.html','w') as f:
    f.write(html)
print(f'Fixes applied. File size: {len(html):,} chars')
