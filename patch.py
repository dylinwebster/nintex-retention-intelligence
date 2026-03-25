with open('public/index.html') as f:
    html = f.read()

# Find and remove the entire old chat IIFE
start = html.find('(function(){')
if start < 0:
    print('No IIFE found')
    exit()
# Find its closing
end = html.find('})();', start) + 5

old_chat = html[start:end]
print(f'Found chat block: {len(old_chat)} chars')

new_chat = r"""(function(){
var fab=document.createElement('button');
fab.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9999;background:#0F1729;color:#fff;border:none;border-radius:50px;padding:12px 20px;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;gap:6px;';
fab.textContent='\u2709 Ask a question';
document.body.appendChild(fab);

var dw=document.createElement('div');
dw.style.cssText='position:fixed;top:0;right:-420px;width:420px;height:100vh;background:#fff;border-left:1px solid #E2E5ED;z-index:10000;transition:right .3s;display:flex;flex-direction:column;font-family:DM Sans,sans-serif;box-shadow:-4px 0 24px rgba(0,0,0,.08);';

var hdr=document.createElement('div');
hdr.style.cssText='padding:14px 18px;border-bottom:1px solid #E2E5ED;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
var hdrLeft=document.createElement('div');
hdrLeft.innerHTML='<div style="font-size:14px;font-weight:700;color:#0F1729;">Retention Intelligence</div><div id="chatCtx" style="font-size:10px;color:#8892A8;margin-top:2px;">Context: Executive Summary</div>';
var closeBtn=document.createElement('button');
closeBtn.style.cssText='background:none;border:none;font-size:22px;cursor:pointer;color:#8892A8;padding:4px 8px;line-height:1;';
closeBtn.innerHTML='\u00D7';
closeBtn.addEventListener('click',function(){dw.style.right='-420px';fab.style.display='flex';});
hdr.appendChild(hdrLeft);
hdr.appendChild(closeBtn);
dw.appendChild(hdr);

var msgsEl=document.createElement('div');
msgsEl.style.cssText='flex:1;overflow-y:auto;padding:14px 18px;';
dw.appendChild(msgsEl);

var bar=document.createElement('div');
bar.style.cssText='padding:12px 18px;border-top:1px solid #E2E5ED;display:flex;gap:8px;flex-shrink:0;';
var inp=document.createElement('input');
inp.type='text';
inp.placeholder='Ask about retention, products, accounts...';
inp.style.cssText='flex:1;padding:10px 14px;border:1.5px solid #E2E5ED;border-radius:8px;font-family:DM Sans,sans-serif;font-size:12px;outline:none;';
var sendBtn=document.createElement('button');
sendBtn.textContent='Send';
sendBtn.style.cssText='background:#0F1729;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-family:DM Sans,sans-serif;font-size:12px;font-weight:600;cursor:pointer;';
bar.appendChild(inp);
bar.appendChild(sendBtn);
dw.appendChild(bar);
document.body.appendChild(dw);

fab.addEventListener('click',function(){
  dw.style.right='0';fab.style.display='none';
  var active='Executive Summary';
  document.querySelectorAll('.tabs button.on').forEach(function(b){active=b.textContent;});
  var sub=[];document.querySelectorAll('.pill.on').forEach(function(b){sub.push(b.textContent);});
  var ce=document.getElementById('chatCtx');
  if(ce)ce.textContent='Context: '+active+(sub.length?' > '+sub.join(', '):'');
});

function addBubble(role,text){
  var d=document.createElement('div');
  d.style.cssText='margin-bottom:12px;'+(role==='user'?'text-align:right;':'');
  var b=document.createElement('div');
  b.style.cssText='display:inline-block;max-width:88%;padding:10px 14px;border-radius:12px;font-size:12px;line-height:1.65;text-align:left;white-space:pre-wrap;'+(role==='user'?'background:#0F1729;color:#fff;':'background:#F5F6FA;color:#0F1729;');
  b.textContent=text;
  d.appendChild(b);
  msgsEl.appendChild(d);
  msgsEl.scrollTop=msgsEl.scrollHeight;
  return b;
}

addBubble('assistant','Hi! I have full access to Nintex retention data across customer segments, product families, and CSM coverage. Ask me anything, for example:\n\n\u2022 Which industries have the worst unassigned retention?\n\u2022 How has CE RPA trended over the last 9 quarters?\n\u2022 What is the expansion lift for $100-300K accounts?\n\u2022 Compare K2 Workflow vs CE Workflow and Apps');

var chatHist=[];

function buildSys(){
  var s='You are a retention analytics assistant for Nintex. Answer concisely with specific numbers. Do not use em dashes. Be balanced.\n\n';
  s+='=== CUSTOMER DATA (22Q) ===\n';
  s+='Quarters:'+JSON.stringify(CUST.quarters)+'\n';
  s+='GRR:'+JSON.stringify(CUST.overall.grr)+'\nNRR:'+JSON.stringify(CUST.overall.nrr)+'\n';
  s+='ARR($K):'+JSON.stringify(CUST.overall.arr)+'\nAccounts:'+JSON.stringify(CUST.overall.accounts)+'\n';
  s+='Churn($K):'+JSON.stringify(CUST.overall.churn)+'\nExpansion($K):'+JSON.stringify(CUST.overall.expansion)+'\n';
  s+='Downsell($K):'+JSON.stringify(CUST.overall.downsell)+'\n';
  var rk=Object.keys(CUST.regions);rk.forEach(function(r){s+=r+' GRR:'+JSON.stringify(CUST.regions[r].grr)+'\n'+r+' NRR:'+JSON.stringify(CUST.regions[r].nrr)+'\n';});
  s+='CSM Assigned GRR:'+JSON.stringify(CUST.csm.Assigned.grr)+'\nCSM Assigned NRR:'+JSON.stringify(CUST.csm.Assigned.nrr)+'\n';
  s+='CSM Unassigned GRR:'+JSON.stringify(CUST.csm.Unassigned.grr)+'\nCSM Unassigned NRR:'+JSON.stringify(CUST.csm.Unassigned.nrr)+'\n';
  var tk=Object.keys(CUST.tiers);tk.forEach(function(t){s+=t+' GRR:'+JSON.stringify(CUST.tiers[t].grr)+'\n'+t+' NRR:'+JSON.stringify(CUST.tiers[t].nrr)+'\n';});
  var ik=Object.keys(CUST.industries);ik.forEach(function(i){s+=i+' GRR:'+JSON.stringify(CUST.industries[i].grr)+'\n'+i+' NRR:'+JSON.stringify(CUST.industries[i].nrr)+'\n';});
  s+='\n=== PRODUCT DATA (9Q) ===\nQuarters:'+JSON.stringify(PROD.quarters)+'\n';
  var pk=Object.keys(PROD.products);pk.forEach(function(p){s+=p+' GRR:'+JSON.stringify(PROD.products[p].grr)+'\n'+p+' NRR:'+JSON.stringify(PROD.products[p].nrr)+'\n'+p+' ARR:'+JSON.stringify(PROD.products[p].arr)+'\n';});
  s+='\nAnnualized:\n';PROD.annualized.forEach(function(a){s+=a.p+': GRR='+a.g+'% NRR='+a.n+'% ARR=$'+a.arr+'K Accts='+a.a+'\n';});
  s+='\n=== CSM COVERAGE ===\n';
  var ck=Object.keys(CSM_DATA);ck.forEach(function(r){s+=r+':'+JSON.stringify(CSM_DATA[r])+'\n';});
  s+='\nIndustry CSM:'+JSON.stringify(CSM_IND)+'\n';
  return s;
}

function doSend(){
  var q=inp.value.trim();
  if(!q)return;
  inp.value='';
  addBubble('user',q);
  var thinking=addBubble('assistant','Thinking...');
  chatHist.push({role:'user',content:q});
  if(chatHist.length>12)chatHist=chatHist.slice(-12);
  fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system:buildSys(),messages:chatHist})}).then(function(r){return r.json();}).then(function(d){thinking.textContent=d.text||d.error||'No response';chatHist.push({role:'assistant',content:d.text||''});}).catch(function(e){thinking.textContent='Error: '+e.message;});
}

sendBtn.addEventListener('click',doSend);
inp.addEventListener('keydown',function(e){if(e.key==='Enter')doSend();});
})();"""

html = html.replace(old_chat, new_chat)
with open('public/index.html','w') as f:
    f.write(html)
print(f'Patched. New size: {len(html):,} chars')
