import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ALGORITHMS,MemoryStore,createRateLimiter,rateHeaders} from './middleware/rateLimiter.js';
const root=new URL('../public/',import.meta.url);
function integer(value,fallback,min,max) {const n=Number(value??fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error('Invalid numeric configuration');return n;}
function equal(a,b) {const x=Buffer.from(a??''),y=Buffer.from(b??'');return x.length===y.length&&timingSafeEqual(x,y);}
export function createApp(config={}) {
 const windowMs=integer(config.windowMs??process.env.WINDOW_MS,10000,100,3600000);
 const freeLimit=integer(config.freeLimit??process.env.FREE_LIMIT,10,1,1000),proLimit=integer(config.proLimit??process.env.PRO_LIMIT,30,1,1000);
 const adminToken=config.adminToken??process.env.ADMIN_TOKEN??'',demoKey=config.demoKey??process.env.DEMO_API_KEY??'',proKey=config.proKey??process.env.PRO_API_KEY??'';
 const mode=config.mode??process.env.POLICY_MODE??'lab';
 const policy=config.algorithm??process.env.RATE_ALGORITHM??'sliding-window';
 if(!['lab','enforced'].includes(mode)||!ALGORITHMS.includes(policy))throw new Error('Invalid policy configuration');
 if(demoKey&&proKey&&equal(demoKey,proKey))throw new Error('Free and pro API keys must be distinct');
 const store=new MemoryStore({maxClients:integer(config.maxClients??process.env.MAX_CLIENTS,10000,1,100000)}), limiters=new Map(), started=Date.now();
 let total=0,allowed=0,blocked=0;const events=[];
 const sweep=setInterval(()=>store.sweep(Date.now()),30000);sweep.unref();
 const server=http.createServer(async(req,res)=>{
  const requestId=randomUUID();
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'",'X-Request-Id':requestId};
  function json(status,data,extra={}) {res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(data));}
  try {
   const url=new URL(req.url,'http://localhost'),path=url.pathname;
   if(req.method!=='GET') return json(405,{error:'Method not allowed'},{Allow:'GET'});
   if(path==='/health') return json(200,{status:'ok',storage:'memory',uptimeSeconds:Math.floor((Date.now()-started)/1000)});
   if(path==='/api/config') return json(200,{algorithms:ALGORITHMS,windowMs,tiers:{free:freeLimit,pro:proLimit},storage:'memory',mode,algorithm:policy,protectedEnabled:!!(demoKey||proKey)});
   if(path==='/api/metrics') {
    if(!adminToken||!equal(req.headers.authorization,`Bearer ${adminToken}`)) return json(401,{error:'A configured admin token is required'});
    return json(200,{total,allowed,blocked,clients:store.clients.size,uptimeSeconds:Math.floor((Date.now()-started)/1000),events});
   }
   if(path==='/api/public'||path==='/api/protected') {
    const requested=url.searchParams.get('algorithm');
    if(mode==='enforced'&&requested&&requested!==policy)return json(400,{error:'This server uses a fixed rate limiting policy'});
    const algorithm=mode==='enforced'?policy:(requested??policy);
    if(!ALGORITHMS.includes(algorithm))return json(400,{error:'Unknown algorithm'});
    const key=req.headers['x-api-key']; if(Array.isArray(key))return json(400,{error:'Invalid API key'});
    const isPro=!!proKey&&equal(key,proKey),isDemo=!!demoKey&&equal(key,demoKey);
    if(path==='/api/protected'&&!isPro&&!isDemo)return json(401,{error:'Valid X-API-Key required'});
    if(key&&!isPro&&!isDemo)return json(401,{error:'Invalid API key'});
    const tier=isPro?'pro':'free',limit=isPro?proLimit:freeLimit;
    // Never trust user-supplied forwarded headers. Socket address is authoritative.
    const identity=createHash('sha256').update(key?`key:${key}`:`ip:${req.socket.remoteAddress}`).digest('hex');
    const limiterKey=`${algorithm}:${tier}`;
    if(!limiters.has(limiterKey))limiters.set(limiterKey,createRateLimiter({limit,windowMs,algorithm,store}));
    const result=limiters.get(limiterKey)(`${limiterKey}:${path}:${identity}`);
    total++;if(result.allowed)allowed++;else blocked++;
    events.unshift({time:new Date().toISOString(),status:result.allowed?200:429,route:path,algorithm,tier,remaining:result.remaining});if(events.length>100)events.pop();
    return json(result.allowed?200:429,result.allowed?{message:'Request accepted',tier,requestId,...result}:{error:'Too many requests',requestId,...result},rateHeaders(result));
   }
   const files={'/openapi.json':['../docs/openapi.json','application/json'],'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
   if(files[path]) {const [file,type]=files[path];const content=await readFile(new URL(file,root));res.writeHead(200,{...headers,'Content-Type':type+'; charset=utf-8'});return res.end(content);}
   json(404,{error:'Not found'});
  }catch(error){json(error.message==='STORE_CAPACITY'?503:500,{error:error.message==='STORE_CAPACITY'?'Rate limit store at capacity':'Internal server error'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 server.on('close',()=>clearInterval(sweep)); return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const host=process.env.HOST??'127.0.0.1',port=integer(process.env.PORT,3000,0,65535);
 const server=createApp();server.listen(port,host,()=>console.log(`API Rate Limiter listening at http://${host}:${server.address().port}`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
}
