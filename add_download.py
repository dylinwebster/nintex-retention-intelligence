with open('public/index.html') as f:
    html = f.read()
old = "thinking.textContent=d.text||(typeof d.error==='string'?d.error:JSON.stringify(d.error))||'No response';"
new = """var responseText=d.text||(typeof d.error==='string'?d.error:JSON.stringify(d.error))||'No response';
      thinking.textContent=responseText;
      if(d.text&&d.text.length>100){
        var dlWrap=document.createElement('div');
        dlWrap.style.cssText='margin-top:6px;';
        var dlBtn=document.createElement('button');
        dlBtn.textContent='\\u2913 Download as Word';
        dlBtn.style.cssText='background:none;border:1px solid #E2E5ED;border-radius:6px;padding:4px 10px;font-family:DM Sans,sans-serif;font-size:10px;color:#3266ad;cursor:pointer;font-weight:600;';
        dlBtn.addEventListener('click',function(){
          dlBtn.textContent='Generating...';
          var ctx='';
          document.querySelectorAll('.tabs button.on').forEach(function(b){ctx=b.textContent;});
          fetch('/api/generate-doc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Retention Intelligence Report',content:responseText,context:ctx})})
          .then(function(r){return r.blob();})
          .then(function(blob){
            var url=window.URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=url;a.download='Retention_Report.docx';a.click();
            window.URL.revokeObjectURL(url);
            dlBtn.textContent='\\u2913 Download as Word';
          })
          .catch(function(e){dlBtn.textContent='Error: '+e.message;});
        });
        dlWrap.appendChild(dlBtn);
        thinking.parentNode.appendChild(dlWrap);
      }"""
html = html.replace(old, new)
with open('public/index.html','w') as f:
    f.write(html)
print(f'Download button added. Size: {len(html):,}')
