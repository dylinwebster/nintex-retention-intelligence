with open('public/index.html') as f:
    html = f.read()

# Fix 1: CSM_DATA -> CSM_BANDS in chat system prompt
html = html.replace("JSON.stringify(CSM_DATA[", "JSON.stringify(CSM_BANDS[")
html = html.replace("Object.keys(CSM_DATA)", "Object.keys(CSM_BANDS)")

# Fix 2: Add auth screen
auth_screen = '''<div id="authWall" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#F5F6FA;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:DM Sans,sans-serif;">
<div style="background:#fff;border:1px solid #E2E5ED;border-radius:12px;padding:32px;width:340px;text-align:center;">
<div style="font-size:20px;font-weight:700;color:#0F1729;margin-bottom:4px;">Nintex Retention Intelligence</div>
<div style="font-size:12px;color:#8892A8;margin-bottom:20px;">Enter password to continue</div>
<input id="authPw" type="password" placeholder="Password" style="width:100%;padding:10px 14px;border:1.5px solid #E2E5ED;border-radius:8px;font-size:13px;margin-bottom:12px;outline:none;font-family:DM Sans,sans-serif;" />
<button id="authBtn" style="width:100%;padding:10px;background:#0F1729;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;">Enter</button>
<div id="authErr" style="font-size:11px;color:#A32D2D;margin-top:8px;display:none;">Incorrect password</div>
</div></div>
<script>
(function(){
var pw="nintex2026";
var wall=document.getElementById("authWall");
var btn=document.getElementById("authBtn");
var inp=document.getElementById("authPw");
var err=document.getElementById("authErr");
if(sessionStorage.getItem("authed")==="yes"){wall.style.display="none";}
btn.addEventListener("click",check);
inp.addEventListener("keydown",function(e){if(e.key==="Enter")check();});
function check(){if(inp.value===pw){sessionStorage.setItem("authed","yes");wall.style.display="none";}else{err.style.display="block";}}
})();
</script>
'''
html = html.replace('<div class="shell">', auth_screen + '<div class="shell">', 1)

# Fix 3: Enhance system prompt with explicit guidance on what it can/can't answer
old_sys_start = "s='You are a retention analytics assistant for Nintex."
new_sys_start = "s='You are a retention analytics assistant for Nintex. You have aggregate retention data by quarter, region, ARR tier, industry, product family (L2), and CSM assignment status. You can answer questions about rates, trends, comparisons, and portfolio composition. You do NOT have individual account names or account-level detail; if asked for specific customer lists, explain that this requires a live connection to Salesforce/Databricks which is on the roadmap. Always cite specific numbers from the data."
html = html.replace(old_sys_start, new_sys_start)

with open('public/index.html','w') as f:
    f.write(html)
print(f'All fixes applied. File size: {len(html):,} chars')
print('Auth password: nintex2026')
