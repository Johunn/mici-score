const CACHE='mici-score-v8-2';
const CORE=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/icon-512-maskable.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
/* Réseau d'abord : tu as toujours la dernière version quand tu es en ligne ; sinon la copie en cache (mode hors ligne). */
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  e.respondWith(fetch(r).then(res=>{if(res&&res.status===200){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res}).catch(()=>caches.match(r)));
});
