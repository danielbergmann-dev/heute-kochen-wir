import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const sqlite=new DatabaseSync(':memory:');
const dir=await mkdtemp(path.join(tmpdir(),'kitchen-access-'));
try{
 globalThis.__testEnv={KITCHEN_SESSION_SECRET:'test-secret-only',KITCHEN_WS1_CODE:'test-class-one',KITCHEN_WS2_CODE:'test-class-two'};
 let attempts=0;
 sqlite.exec('CREATE TABLE cooking_days (id TEXT PRIMARY KEY, class_id TEXT NOT NULL, date TEXT NOT NULL, dish TEXT NOT NULL DEFAULT "", answers TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)');
 globalThis.__testDB={prepare(sql){let params=[];return {bind(...p){params=p;return this},async first(){return {attempts:++attempts}},async run(){return {}},async all(){return {results:sqlite.prepare(sql).all(...params)}}}}};
 for(const [source,target] of [['lib/class-access.ts','access.mjs'],['app/api/access/route.ts','login.mjs'],['app/api/records/route.ts','records.mjs']]){
 let code=await readFile(source,'utf8');code=code.replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__testEnv;').replace(/import \{ database \} from ['"][^'"]+['"];?/, 'const database=()=>globalThis.__testDB;').replaceAll("'@/lib/class-access'","'./access.mjs'");
 await writeFile(path.join(dir,target),ts.transpile(code,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}));
 }
 const auth=await import(pathToFileURL(path.join(dir,'access.mjs'))),login=await import(pathToFileURL(path.join(dir,'login.mjs'))),records=await import(pathToFileURL(path.join(dir,'records.mjs')));
 const req=(method='GET',body,cookie='',origin='https://kitchen.test')=>new Request('https://kitchen.test/api/records',{method,headers:{cookie,origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await records.GET(req())).status,401);
 assert.equal((await login.POST(req('POST',{access:'1',code:'wrong'}))).status,401);
 assert.equal((await login.POST(req('POST',{access:'2',code:'test-class-one'}))).status,401);
 const signed=await login.POST(req('POST',{access:'1',code:'test-class-one'}));assert.equal(signed.status,200);
 const cookie=signed.headers.get('set-cookie').split(';')[0];assert.match(signed.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal(await auth.getAccess(req('GET',null,cookie)),'1');
 assert.equal(await auth.getAccess(req('GET',null,cookie+'tampered')),null);
 assert.equal((await records.GET(req('GET',null,cookie))).status,200);
 const day={dish:'Gemüse-Lasagne',id:'2|2026-09-24',classId:'2',date:'2026-09-24',answers:Array(8).fill(true),version:0};
 assert.equal((await records.POST(req('POST',{records:[day]},cookie))).status,403);
 assert.equal((await records.POST(req('POST',{records:[{...day,id:'1|2026-09-24',classId:'1'}]},cookie))).status,200);
 assert.equal(sqlite.prepare('SELECT dish FROM cooking_days').get().dish,'Gemüse-Lasagne');
 assert.equal((await records.POST(req('POST',{records:[day]},cookie,'https://evil.test'))).status,403);
 assert.equal((await login.DELETE(req('DELETE',null,cookie,'https://evil.test'))).status,403);
 assert.match((await login.DELETE(req('DELETE',null,cookie))).headers.get('set-cookie'),/Max-Age=0/);
 const pagesOrigin='https://danielbergmann-dev.github.io';
 const pre=await login.OPTIONS(req('OPTIONS',null,'',pagesOrigin));assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),pagesOrigin);
 assert.equal((await login.OPTIONS(req('OPTIONS',null,'','https://evil.test'))).status,403);
 const remoteLogin=await login.POST(req('POST',{access:'1',code:'test-class-one'},'',pagesOrigin));assert.equal(remoteLogin.status,200);assert.equal(remoteLogin.headers.get('access-control-allow-origin'),pagesOrigin);
 assert.equal(remoteLogin.headers.get('set-cookie'),null);
 const {token}=await remoteLogin.json();assert.ok(token);
 const remoteRequest=(method,body,origin=pagesOrigin)=>new Request('https://kitchen.test/api/records',{method,headers:{origin,authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await records.GET(remoteRequest('GET'))).status,200);
 assert.equal((await records.POST(remoteRequest('POST',{records:[{...day,id:'1|2026-09-24',classId:'1',version:1}]}))).status,200);
 assert.equal((await records.POST(remoteRequest('POST',{records:[day]}))).status,403);
 assert.equal((await records.POST(remoteRequest('POST',{records:[day]},'https://evil.test'))).status,403);
 assert.equal((await records.GET(req())).headers.get('access-control-allow-origin'),null);
 // Real SQLite rows from both classes: neither cookies nor bearer tokens may read the other class.
 sqlite.prepare('INSERT INTO cooking_days (id,class_id,date,dish,answers,version) VALUES (?,?,?,?,?,?)').run(day.id,day.classId,day.date,'WS 2 Gericht',JSON.stringify(day.answers),1);
 const signed2=await login.POST(req('POST',{access:'2',code:'test-class-two'}));assert.equal(signed2.status,200);
 const cookie2=signed2.headers.get('set-cookie').split(';')[0];
 for(const [classId,classCookie] of [['1',cookie],['2',cookie2]]){
  const response=await records.GET(req('GET',null,classCookie));assert.equal(response.status,200);
  assert.deepEqual((await response.json()).records.map(r=>r.classId),[classId]);
  const remote=await login.POST(req('POST',{access:classId,code:classId==='1'?'test-class-one':'test-class-two'},'',pagesOrigin));
  const bearer=(await remote.json()).token;
  for(const query of ['', '?classId='+ (classId==='1'?'2':'1'), '?scope=both']){
   const response=await records.GET(new Request('https://kitchen.test/api/records'+query,{headers:{origin:pagesOrigin,authorization:'Bearer '+bearer}}));
   assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),pagesOrigin);
   assert.deepEqual((await response.json()).records.map(r=>r.classId),[classId]);
  }
 }
 assert.equal((await records.POST(req('POST',{records:[{...day,id:'1|2026-09-24',classId:'1'}]},cookie2))).status,403);
 const clock=Date.now;Date.now=()=>clock()+9*60*60*1000;assert.equal(await auth.getAccess(req('GET',null,cookie)),null);Date.now=clock;
 globalThis.__testEnv.KITCHEN_WS1_CODE='87654321';assert.equal(await auth.getAccess(req('GET',null,cookie)),null);
 attempts=20;assert.equal((await login.POST(req('POST',{access:'2',code:'test-class-two'}))).status,429);
 console.log('PASS: anonymous denial, correct/wrong codes, role separation, signed cookies, expiry, code rotation, CSRF, logout and rate limit.');
}finally{sqlite.close();await rm(dir,{recursive:true,force:true});delete globalThis.__testEnv;delete globalThis.__testDB;}
