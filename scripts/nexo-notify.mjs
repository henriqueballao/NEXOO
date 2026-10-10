import webpush from 'web-push';

const DROPBOX_APP_KEY='hgpycye1ooqazt7';
const DROPBOX_DATA_FILE='/nexo-dados-v2.json';
const TIME_ZONE='America/Sao_Paulo';
const refreshToken=process.env.NEXO_DROPBOX_REFRESH_TOKEN||'';
const vapidPrivate=process.env.NEXO_VAPID_PRIVATE_KEY||'';
const vapidPublic='BAW5lDoi53oRMvfNOVZWnFestpXXf8RZ71NJL4UYPrLZG3VbPHivH5CnXI2kw2hI035t5WDILyECfLhQz64GemQ';

if(!refreshToken||!vapidPrivate){
  console.log('NEXO notifications: secrets not configured; skipping.');
  process.exit(0);
}

webpush.setVapidDetails('mailto:nexo@local.invalid',vapidPublic,vapidPrivate);

function dateParts(){
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
  const p=Object.fromEntries(fmt.formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {iso:`${p.year}-${p.month}-${p.day}`,year:Number(p.year),month:Number(p.month),day:Number(p.day)};
}
function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))}
function paidMonths(s){
  if(Array.isArray(s?.paid))return s.paid.map(Number);
  if(s?.paid&&typeof s.paid==='object'){
    const y=String(dateParts().year);
    return Array.isArray(s.paid[y])?s.paid[y].map(Number):[];
  }
  return [];
}
async function accessToken(){
  const body=new URLSearchParams({refresh_token:refreshToken,grant_type:'refresh_token',client_id:DROPBOX_APP_KEY});
  const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error_description||d.error||'Dropbox token refresh failed');
  return d.access_token;
}
async function downloadData(token){
  const r=await fetch('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:'Bearer '+token,'Dropbox-API-Arg':JSON.stringify({path:DROPBOX_DATA_FILE})}});
  if(!r.ok)throw new Error('Dropbox download failed: '+await r.text());
  return r.json();
}
const today=dateParts();
const token=await accessToken();
const data=await downloadData(token);
const entries=Array.isArray(data.entries)?data.entries:[];
const subscriptions=Array.isArray(data.subscriptions)?data.subscriptions:[];
const devices=Array.isArray(data.notifications?.devices)?data.notifications.devices.filter(d=>d?.active!==false&&d?.subscription?.endpoint):[];

const dueEntries=entries.filter(e=>
  String(e?.tipo||'').toUpperCase()==='DESPESA' &&
  String(e?.data_vencimento||'')===today.iso &&
  !String(e?.data_pagamento||'').trim()
);
const dueSubscriptions=subscriptions.filter(s=>
  s?.active!==false &&
  String(s?.cycle||'').toLowerCase()==='mensal' &&
  Number(s?.due)===today.day &&
  !paidMonths(s).includes(today.month)
);

if(!devices.length){console.log('NEXO notifications: no active devices.');process.exit(0)}
if(!dueEntries.length&&!dueSubscriptions.length){console.log('NEXO notifications: nothing due today.');process.exit(0)}

const entriesTotal=dueEntries.reduce((a,e)=>a+Number(e.valor||0),0);
const subsTotal=dueSubscriptions.reduce((a,s)=>a+Number(s.value||0),0);
const parts=[];
if(dueEntries.length)parts.push(`${dueEntries.length} conta${dueEntries.length===1?'':'s'} · ${money(entriesTotal)}`);
if(dueSubscriptions.length)parts.push(`${dueSubscriptions.length} assinatura${dueSubscriptions.length===1?'':'s'} · ${money(subsTotal)}`);

let sent=0,failed=0;
for(const device of devices){
  const hasEntries=device.entriesToday!==false&&dueEntries.length>0;
  const hasSubs=device.subscriptionsToday!==false&&dueSubscriptions.length>0;
  if(!hasEntries&&!hasSubs)continue;
  const bodyParts=[];
  if(hasEntries)bodyParts.push(`${dueEntries.length} conta${dueEntries.length===1?'':'s'} · ${money(entriesTotal)}`);
  if(hasSubs)bodyParts.push(`${dueSubscriptions.length} assinatura${dueSubscriptions.length===1?'':'s'} · ${money(subsTotal)}`);
  const payload=JSON.stringify({
    title:'NEXO — vencimentos de hoje',
    body:bodyParts.join(' | '),
    tag:`nexo-due-${today.iso}`,
    data:{url:'./'}
  });
  try{
    await webpush.sendNotification(device.subscription,payload,{TTL:86400,urgency:'normal'});
    sent++;
  }catch(err){
    failed++;
    console.error('Push failed',err?.statusCode||'',err?.body||err?.message||err);
  }
}
console.log(`NEXO notifications: sent=${sent} failed=${failed} due_entries=${dueEntries.length} due_subscriptions=${dueSubscriptions.length}`);
if(failed&&sent===0)process.exitCode=1;
