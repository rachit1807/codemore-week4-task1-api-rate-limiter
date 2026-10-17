export const ALGORITHMS = ['sliding-window', 'fixed-window', 'token-bucket'];
export class MemoryStore {
  constructor({maxClients = 10000} = {}) { this.clients = new Map(); this.maxClients = maxClients; }
  sweep(now) { for (const [k,v] of this.clients) if (v.expires <= now) this.clients.delete(k); }
  get(key, now) { const v=this.clients.get(key); if(v && v.expires<=now) {this.clients.delete(key); return undefined;} return v; }
  set(key, value, now) { if(!this.clients.has(key) && this.clients.size>=this.maxClients) {this.sweep(now); if(this.clients.size>=this.maxClients) throw new Error('STORE_CAPACITY');} this.clients.set(key,value); }
}
export function createRateLimiter({limit=10, windowMs=10000, algorithm='sliding-window', store=new MemoryStore(), clock=Date.now}={}) {
  if(!Number.isInteger(limit)||limit<1||!Number.isSafeInteger(windowMs)||windowMs<1||!ALGORITHMS.includes(algorithm)) throw new TypeError('Invalid limiter configuration');
  return function consume(key) {
    const now=clock(); let state=store.get(key,now); let allowed,remaining,reset;
    if(algorithm==='sliding-window') {
      const times=(state?.times??[]).filter(t=>t>now-windowMs);
      allowed=times.length<limit; if(allowed) times.push(now);
      remaining=limit-times.length; reset=(times[0]??now)+windowMs;
      store.set(key,{times,expires:now+windowMs},now);
    } else if(algorithm==='fixed-window') {
      const start=Math.floor(now/windowMs)*windowMs;
      if(!state||state.start!==start) state={start,count:0};
      allowed=state.count<limit; if(allowed) state.count++;
      remaining=limit-state.count; reset=start+windowMs;
      store.set(key,{...state,expires:reset},now);
    } else {
      const tokens=Math.min(limit,(state?.tokens??limit)+(now-(state?.last??now))*limit/windowMs);
      allowed=tokens>=1; const left=allowed?tokens-1:tokens;
      remaining=Math.floor(left); reset=now+Math.ceil((allowed?limit-left:1-left)*windowMs/limit);
      store.set(key,{tokens:left,last:now,expires:now+windowMs},now);
    }
    return {allowed,limit,remaining,reset:Math.ceil(reset/1000),retryAfter:allowed?0:Math.max(1,Math.ceil((reset-now)/1000)),algorithm};
  };
}
export function rateHeaders(result) {
  return {'X-RateLimit-Limit':String(result.limit),'X-RateLimit-Remaining':String(result.remaining),'X-RateLimit-Reset':String(result.reset),'X-RateLimit-Algorithm':result.algorithm,...(!result.allowed?{'Retry-After':String(result.retryAfter)}:{})};
}
