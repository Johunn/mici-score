// Service worker MICI Score (v14) : réseau d'abord, copie locale en secours hors ligne.
// Il n'intercepte JAMAIS les requêtes vers d'autres sites (Google, Drive) : aucune donnée de compte n'est mise en cache ici.
const CACHE='mici-score-v14';
self.addEventListener('install',()=>{self.skipWaiting()});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin)return;
  e.respondWith(
    fetch(r).then(res=>{
      if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(ch=>ch.put(r,c))}
      return res;
    }).catch(()=>caches.match(r).then(m=>m||caches.match(self.registration.scope)))
  );
});
