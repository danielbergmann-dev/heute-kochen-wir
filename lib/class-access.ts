import { env } from 'cloudflare:workers';
import { database } from './store';
export type Access = '1' | '2';
const COOKIE = '__Host-kitchen';
const encoder = new TextEncoder();
export function settings() {
 const e=env as unknown as Record<string,string>;
 if(!e.KITCHEN_SESSION_SECRET||!e.KITCHEN_WS1_CODE||!e.KITCHEN_WS2_CODE) throw Error('Access not configured');
 return e;
}
function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function decode(text:string){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(){return crypto.subtle.importKey('raw',encoder.encode(settings().KITCHEN_SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function digest(value:string){return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
function codeFor(access:Access){const e=settings();return access==='1'?e.KITCHEN_WS1_CODE:e.KITCHEN_WS2_CODE;}
export async function verifyCode(access:Access,code:string){return await digest(code.trim().replace(/\s/g,''))===await digest(codeFor(access));}
export async function sessionToken(access:Access){
 const payload=encode(encoder.encode(JSON.stringify({access,expires:Date.now()+8*60*60*1000,revision:await digest(codeFor(access))})));
 const signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(),encoder.encode(payload))));
 return `${payload}.${signature}`;
}
export async function sessionCookie(access:Access){return `${COOKIE}=${await sessionToken(access)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;}
export function clearCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}
export async function getAccess(request:Request):Promise<Access|null>{
 try{
 const bearer=request.headers.get('authorization');
 const token=bearer?.startsWith('Bearer ')?bearer.slice(7):request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token||token.length>1000)return null;
 const [payload,signature,extra]=token.split('.');if(!payload||!signature||extra)return null;
 if(!await crypto.subtle.verify('HMAC',await key(),decode(signature),encoder.encode(payload)))return null;
 const data=JSON.parse(new TextDecoder().decode(decode(payload)));
 if(!['1','2'].includes(data.access)||!Number.isFinite(data.expires)||data.expires<=Date.now()||data.revision!==await digest(codeFor(data.access)))return null;
 return data.access;
 }catch{return null;}
}
const PAGES_ORIGIN='https://danielbergmann-dev.github.io';
export function isPagesRequest(request:Request){return request.headers.get('origin')===PAGES_ORIGIN;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return isPagesRequest(request)||(request.headers.get('sec-fetch-site')!=='cross-site'&&!!origin&&origin===new URL(request.url).origin);}
export function cors(request:Request,response:Response){
 response.headers.set('Vary','Origin');
 if(isPagesRequest(request)){
  response.headers.set('Access-Control-Allow-Origin',PAGES_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age','600');
 }
 return response;
}
export function preflight(request:Request){return cors(request,new Response(null,{status:sameOrigin(request)?204:403}));}
export async function permitAttempt(request:Request){
 const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/900);
 const id=await digest(settings().KITCHEN_SESSION_SECRET+':'+(request.headers.get('cf-connecting-ip')||'unknown'))+':'+bucket;
 const db=database();
 const result=await db.prepare('INSERT INTO access_attempts (id, attempts, expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(id,(bucket+1)*900).first<{attempts:number}>();
 await db.prepare('DELETE FROM access_attempts WHERE expires < ?').bind(now-900).run();
 return !!result&&result.attempts<=20;
}
