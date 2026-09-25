import {cors,preflight,isPagesRequest,sessionToken} from '@/lib/class-access';
import { getAccess, sameOrigin } from '@/lib/class-access';
import { database } from '@/lib/store';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handleGET(request:Request){
 const access=await getAccess(request);if(!access)return reply({error:'Bitte mit deinem Zugangscode anmelden.'},401);
 try { const result=await database().prepare('SELECT id, class_id as classId, date, dish, answers, version FROM cooking_days ORDER BY date DESC').all(); return reply({records:result.results.map((r:any)=>({...r,answers:JSON.parse(r.answers)}))}); }catch(e){console.error(e);return reply({error:'Die Daten konnten nicht geladen werden. Bitte erneut versuchen.'},503);}
}
async function handlePOST(request:Request){
 const access=await getAccess(request);if(!access)return reply({error:'Bitte mit deinem Zugangscode anmelden.'},401);
 if(!sameOrigin(request))return reply({error:'Ungültige Anfrage.'},403);
 try{
 const raw=await request.text();if(raw.length>100000)return reply({error:'Zu viele Daten.'},413);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:'Ungültige Eingabe.'},400);}
 const rows=body?.records;
 if(!Array.isArray(rows)||rows.length<1||rows.length>100)return reply({error:'Bitte 1 bis 100 Tage speichern.'},400);
 const seen=new Set();
 for(const r of rows){if(r && r.dish===undefined)r.dish='';}
 for(const r of rows){if(!r||typeof r.dish!=='string'||r.dish.length>120||!['1','2'].includes(r.classId)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||isNaN(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||r.id!==r.classId+'|'+r.date||seen.has(r.id)||!Number.isSafeInteger(r.version)||r.version<0||!Array.isArray(r.answers)||r.answers.length!==8||r.answers.some((v:unknown)=>v!==true&&v!==false&&v!==null))return reply({error:'Ein Kochtag enthält ungültige Angaben.'},400);r.dish=r.dish.trim();seen.add(r.id);}
 if(rows.some(r=>r.classId!==access))return reply({error:'Du kannst nur Kochtage deiner eigenen Klasse speichern.'},403);
 const sql=`WITH incoming AS (SELECT json_extract(value,'$.id') id, json_extract(value,'$.classId') class_id, json_extract(value,'$.date') date, json_extract(value,'$.dish') dish, json_extract(value,'$.answers') answers, json_extract(value,'$.version') version FROM json_each(?)), conflicts AS MATERIALIZED (SELECT i.id FROM incoming i LEFT JOIN cooking_days d ON d.id=i.id WHERE coalesce(d.version,0) != i.version) INSERT INTO cooking_days (id,class_id,date,dish,answers,version) SELECT id,class_id,date,dish,answers,version+1 FROM incoming WHERE NOT EXISTS (SELECT 1 FROM conflicts) ON CONFLICT(id) DO UPDATE SET dish=excluded.dish,answers=excluded.answers,version=excluded.version RETURNING id, class_id as classId,date,dish,answers,version`;
 const result=await database().prepare(sql).bind(JSON.stringify(rows)).all();
 if(result.results.length!==rows.length)return reply({error:'Ein Kochtag wurde inzwischen auf einem anderen Gerät geändert. Deine Eingaben bleiben erhalten. Lade den aktuellen Stand und prüfe die Änderungen.',conflict:true},409);
 return reply({records:result.results.map((r:any)=>({...r,answers:JSON.parse(r.answers)}))});
 }catch(e){console.error(e);return reply({error:'Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten. Bitte erneut versuchen.'},503);}
}

export async function GET(request:Request){return cors(request,await handleGET(request));}

export async function POST(request:Request){return cors(request,await handlePOST(request));}

export function OPTIONS(request:Request){return preflight(request);}
