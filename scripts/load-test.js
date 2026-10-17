// Bounded, local-only load simulation; never targets a third-party URL.
import {createApp} from '../src/server.js';
const server=createApp({windowMs:10000,freeLimit:10,mode:'enforced',algorithm:'sliding-window'});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
 const url=`http://127.0.0.1:${server.address().port}/api/public`;
 const started=performance.now();
 const results=await Promise.all(Array.from({length:50},async()=>{const start=performance.now();const r=await fetch(url);await r.json();return {status:r.status,ms:performance.now()-start,limit:r.headers.get('x-ratelimit-limit'),remaining:r.headers.get('x-ratelimit-remaining'),retryAfter:r.headers.get('retry-after')};}));
 const latencies=results.map(r=>r.ms).sort((a,b)=>a-b);
 const output={timestamp:new Date().toISOString(),requests:50,accepted:results.filter(r=>r.status===200).length,throttled:results.filter(r=>r.status===429).length,durationMs:Math.round(performance.now()-started),p50Ms:Math.round(latencies[24]),p95Ms:Math.round(latencies[47]),example429:results.find(r=>r.status===429)};
 console.log(JSON.stringify(output,null,2));
 if(output.accepted!==10||output.throttled!==40)process.exitCode=1;
} finally {await new Promise(resolve=>server.close(resolve));}
