with open('public/index.html') as f:
    html = f.read()

old = "document.getElementById('chatSend').onclick=sendMessage;\n" + \
      "document.getElementById('chatInput').onkeydown=function(e){if(e.key==='Enter')sendMessage();};"

new = """setTimeout(function(){
  var sendBtn=document.getElementById('chatSend');
  var inputEl=document.getElementById('chatInput');
  if(sendBtn)sendBtn.addEventListener('click',sendMessage);
  if(inputEl)inputEl.addEventListener('keydown',function(e){if(e.key==='Enter')sendMessage();});
},500);"""

if old in html:
    html = html.replace(old, new)
    with open('public/index.html','w') as f:
        f.write(html)
    print('Fixed')
else:
    print('Pattern not found, checking...')
    if 'chatSend' in html:
        print('chatSend exists in file')
    if 'sendMessage' in html:
        print('sendMessage exists in file')
