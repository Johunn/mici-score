/* MICI Score : service worker « réseau d'abord » (v39). Ignore les requêtes vers d'autres sites. */
const CACHE='mici-score-v50';
const CORE=['./','index.html','score-core.js','recipes.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/icon-512-maskable.png','fonts/bricolage-grotesque-latin-opsz-normal.woff2','fonts/figtree-latin-wght-normal.woff2','fonts/montserrat-latin-wght-normal.woff2'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(u=>c.add(u)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('mici-score-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  if(new URL(r.url).origin!==self.location.origin)return;   /* Google, sources, etc. : jamais interceptés */
  e.respondWith(
    fetch(r).then(res=>{
      if(res&&res.status===200){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
      return res;
    }).catch(()=>caches.open(CACHE).then(c=>c.match(r)))
  );
});
