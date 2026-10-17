import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRateLimiter,MemoryStore,ALGORITHMS} from '../src/middleware/rateLimiter.js';
import {createApp} from '../src/server.js';
for(const algorithm of ALGORITHMS)test(`${algorithm}: limits, isolation, recovery`,()=>{let now=10000;const c=createRateLimiter({algorithm,limit:2,windowMs:1000,clock:()=>now});assert.equal(c('a').remaining,1);assert.equal(c('a').remaining,0);assert.equal(c('a').allowed,false);assert.equal(c('b').allowed,true);now+=1000;assert.equal(c('a').allowed,true);});
test('sliding window boundary',()=>{let now=0;const c=createRateLimiter({limit:2,windowMs:1000,clock:()=>now});c('a');now=600;c('a');now=1000;assert.equal(c('a').allowed,true);assert.equal(c('a').allowed,false);now=1600;assert.equal(c('a').allowed,true);});
test('token bucket fractional refill',()=>{let now=0;const c=createRateLimiter({algorithm:'token-bucket',limit:2,windowMs:1000,clock:()=>now});c('a');c('a');now=250;assert.equal(c('a').allowed,false);now=500;assert.equal(c('a').allowed,true);assert.equal(c('a').allowed,false);});
test('capacity and expiration',()=>{const s=new MemoryStore({maxClients:1});s.set('a',{expires:100},0);assert.throws(()=>s.set('b',{expires:100},0),/CAPACITY/);s.set('b',{expires:200},100);assert.equal(s.clients.size,1);});
test('invalid config',()=>{assert.throws(()=>createRateLimiter({limit:0}));assert.throws(()=>createRateLimiter({algorithm:'bad'}));});
test('HTTP concurrency, headers, auth, metrics and routes',async(t)=>{const s=createApp({windowMs:1000,freeLimit:3,proLimit:5,demoKey:'demo-test',proKey:'pro-test',adminToken:'admin-test'});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));const base=`http://127.0.0.1:${s.address().port}`;
for(const algorithm of ALGORITHMS){const results=await Promise.all(Array.from({length:12},()=>fetch(`${base}/api/public?algorithm=${algorithm}`)));assert.equal(results.filter(r=>r.status===200).length,3);assert.equal(results.filter(r=>r.status===429).length,9);const d=results.find(r=>r.status===429);assert.equal(d.headers.get('x-ratelimit-limit'),'3');assert.equal(d.headers.get('x-ratelimit-remaining'),'0');assert.ok(Number(d.headers.get('retry-after'))>=1);assert.ok(Number(d.headers.get('x-ratelimit-reset'))>0);}
assert.equal((await fetch(base+'/api/protected')).status,401);assert.equal((await fetch(base+'/api/protected',{headers:{'X-API-Key':'demo-test'}})).status,200);const pro=await fetch(base+'/api/protected',{headers:{'X-API-Key':'pro-test'}});assert.equal(pro.headers.get('x-ratelimit-limit'),'5');assert.equal((await fetch(base+'/api/public',{headers:{'X-API-Key':'bad'}})).status,401);assert.equal((await fetch(base+'/api/metrics')).status,401);const m=await(await fetch(base+'/api/metrics',{headers:{Authorization:'Bearer admin-test'}})).json();assert.equal(m.total,38);assert.equal(m.blocked,27);assert.ok(!JSON.stringify(m).includes('demo-test'));assert.equal((await fetch(base+'/api/public?algorithm=bad')).status,400);assert.equal((await fetch(base+'/api/public',{method:'POST'})).status,405);assert.equal((await fetch(base+'/missing')).status,404);assert.equal((await fetch(base+'/health')).status,200);const page=await fetch(base+'/');assert.match(await page.text(),/FlowGuard/);assert.ok(page.headers.get('content-security-policy'));});
test('forwarded address does not bypass quota',async(t)=>{const s=createApp({freeLimit:1});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));const url=`http://127.0.0.1:${s.address().port}/api/public`;assert.equal((await fetch(url,{headers:{'X-Forwarded-For':'1.1.1.1'}})).status,200);assert.equal((await fetch(url,{headers:{'X-Forwarded-For':'2.2.2.2'}})).status,429);});

test('enforced policy rejects algorithm switching and preserves quota',async(t)=>{
 const s=createApp({mode:'enforced',algorithm:'sliding-window',freeLimit:1});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));const base=`http://127.0.0.1:${s.address().port}`;
 assert.equal((await fetch(base+'/api/public')).status,200);
 assert.equal((await fetch(base+'/api/public?algorithm=token-bucket')).status,400);
 assert.equal((await fetch(base+'/api/public?algorithm=sliding-window')).status,429);
 const config=await(await fetch(base+'/api/config')).json();assert.equal(config.mode,'enforced');assert.equal(config.algorithm,'sliding-window');
 const spec=await(await fetch(base+'/openapi.json')).json();assert.equal(spec.openapi,'3.0.3');assert.ok(spec.paths['/api/protected']);
});
test('capacity errors fail closed with 503',async(t)=>{
 const s=createApp({maxClients:1,demoKey:'free-capacity-test',proKey:'pro-capacity-test'});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));const base=`http://127.0.0.1:${s.address().port}`;
 assert.equal((await fetch(base+'/api/public',{headers:{'X-API-Key':'free-capacity-test'}})).status,200);
 assert.equal((await fetch(base+'/api/public',{headers:{'X-API-Key':'pro-capacity-test'}})).status,503);
});
test('startup rejects ambiguous keys and invalid policy',()=>{
 assert.throws(()=>createApp({demoKey:'same',proKey:'same'}),/distinct/);
 assert.throws(()=>createApp({mode:'unknown'}),/policy/);
 assert.throws(()=>createApp({algorithm:'unknown'}),/policy/);
});
test('HTTP recovers after a rolling window expires',async(t)=>{
 const s=createApp({windowMs:100,freeLimit:1});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));const url=`http://127.0.0.1:${s.address().port}/api/public`;
 assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url)).status,429);
 await new Promise(r=>setTimeout(r,120));assert.equal((await fetch(url)).status,200);
});
