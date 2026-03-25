with open('api/generate-doc.js') as f:
    js = f.read()

old = """    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Retention_Report.docx"');
    res.status(200).send(buffer);"""

new = """    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString('base64');
    res.status(200).json({ base64: base64, filename: 'Retention_Report.docx' });"""

js = js.replace(old, new)

with open('api/generate-doc.js','w') as f:
    f.write(js)
print('API fixed: returns base64 JSON')

# Now fix the frontend to decode base64 into a proper file download
with open('public/index.html') as f:
    html = f.read()

old_dl = """fetch('/api/generate-doc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Retention Intelligence Report',content:responseText,context:ctx})})
          .then(function(r){return r.blob();})
          .then(function(blob){
            var url=window.URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=url;a.download='Retention_Report.docx';a.click();
            window.URL.revokeObjectURL(url);
            dlBtn.textContent='\\u2913 Download as Word';
          })"""

new_dl = """fetch('/api/generate-doc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Retention Intelligence Report',content:responseText,context:ctx})})
          .then(function(r){return r.json();})
          .then(function(data){
            if(data.error){dlBtn.textContent='Error: '+data.error;return;}
            var byteChars=atob(data.base64);
            var byteNums=new Array(byteChars.length);
            for(var i=0;i<byteChars.length;i++)byteNums[i]=byteChars.charCodeAt(i);
            var blob=new Blob([new Uint8Array(byteNums)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
            var url=window.URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=url;a.download=data.filename||'Retention_Report.docx';a.click();
            window.URL.revokeObjectURL(url);
            dlBtn.textContent='\\u2913 Download as Word';
          })"""

html = html.replace(old_dl, new_dl)

with open('public/index.html','w') as f:
    f.write(html)
print('Frontend fixed: decodes base64 to blob')
