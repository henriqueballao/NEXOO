self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  const options={
    body:data.body||'',
    tag:data.tag||undefined,
    renotify:false,
    data:data.data||{url:'./'}
  };
  event.waitUntil(self.registration.showNotification(data.title||'NEXO',options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'./';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(c=>'focus' in c);
    return existing?existing.focus():self.clients.openWindow(target);
  }));
});
