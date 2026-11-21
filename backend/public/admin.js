(() => {
'use strict';
const messages = JSON.parse(document.querySelector('#admin-messages')?.textContent || '{}');
const t = text => messages[text] || text;
const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
const post = (url,body) => fetch(url,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-CSRF-TOKEN':csrf,Accept:'application/json'},body:JSON.stringify(body||{})});
document.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{
 const input=document.getElementById(button.dataset.passwordToggle),show=input.type==='password';
 input.type=show?'text':'password';button.textContent=show?button.dataset.hideLabel:button.dataset.showLabel;
 button.setAttribute('aria-label',button.textContent);button.setAttribute('aria-pressed',String(show));
}));
document.querySelectorAll('[data-confirm]').forEach(form=>form.addEventListener('submit',event=>{
 if(!confirm(form.dataset.confirm)){event.preventDefault();return;}
 form.querySelectorAll('button[type="submit"],button:not([type])').forEach(button=>{button.disabled=true;});
}));
window.addEventListener('pageshow',()=>document.querySelectorAll('[data-confirm] button').forEach(button=>{button.disabled=false;}));
const panel=document.querySelector('#notices');if(!panel)return;
const status=document.querySelector('#notification-status'),refreshButton=document.querySelector('#refresh-notices'),pushButton=document.querySelector('#enable-push'),pushStatus=document.querySelector('#push-status');
let pushKey,busy=false;
async function refresh(){
 if(busy)return;busy=true;refreshButton.disabled=true;status.textContent=t('Loading notifications…');
 try{
 const response=await fetch('/admin/notifications',{headers:{Accept:'application/json'}});
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error();
 const data=await response.json();if(!Array.isArray(data.notices))throw Error();pushKey=data.push_key;
 document.querySelector('#unread').textContent=data.unread;
 const list=document.querySelector('#notice-list');list.replaceChildren();
 for(const notice of data.notices){const link=document.createElement('a');link.textContent=t('Payment request needs review')+' · '+notice.created_at;link.href='/admin/payments/'+encodeURIComponent(notice.payment_id);link.addEventListener('click',()=>{post('/admin/notifications/'+encodeURIComponent(notice.id)+'/read').catch(()=>{});});list.appendChild(link);}
 status.textContent=t(data.notices.length?'Notifications are up to date.':'No payment notifications yet.');
 if(!pushKey)pushStatus.textContent=t('Background notifications are not configured. In-panel notifications remain available.');
 }catch{status.textContent=t('Unable to refresh notifications. Please retry.');}
 finally{busy=false;refreshButton.disabled=false;}
}
refreshButton.addEventListener('click',refresh);
const noticesButton=document.querySelector('#notices-button');
noticesButton.addEventListener('click',()=>{panel.open=!panel.open;if(panel.open)panel.scrollIntoView({behavior:'smooth'});});
panel.addEventListener('toggle',()=>noticesButton.setAttribute('aria-expanded',String(panel.open)));
pushButton.addEventListener('click',async()=>{
 pushButton.disabled=true;
 try{
 if(!pushKey)throw Error(t('Background notifications are not configured. In-panel notifications remain available.'));
 if(!isSecureContext||!('PushManager'in window)||!('serviceWorker'in navigator))throw Error(t('This browser cannot receive background notifications.'));
 if(await Notification.requestPermission()!=='granted')throw Error(t('Notification permission was not granted.'));
 const registration=await navigator.serviceWorker.register('/admin-sw.js');await navigator.serviceWorker.ready;
 const b64=pushKey.replace(/-/g,'+').replace(/_/g,'/'),bytes=Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0));
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 if(!(await post('/admin/push',subscription.toJSON())).ok)throw Error(t('Unable to save the notification subscription.'));
 pushStatus.textContent=t('Background notifications enabled. Delivery depends on the server configuration.');
 }catch(error){pushStatus.textContent=error.message||t('Unable to save the notification subscription.');}finally{pushButton.disabled=false;}
});
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh();},20000);
})();
