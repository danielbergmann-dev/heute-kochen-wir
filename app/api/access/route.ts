import {cors,preflight,isPagesRequest,sessionToken} from '@/lib/class-access';
import {getAccess,sessionCookie,clearCookie,verifyCode,sameOrigin,permitAttempt,settings, type Access} from '@/lib/class-access';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
async function handleGET(request:Request){return reply({access:await getAccess(request)});}
async function handleDELETE(request:Request){if(!sameOrigin(request))return reply({error:'Ungültige Anfrage.'},403);return reply({access:null},200,clearCookie());}
async function handlePOST(request:Request){
 if(!sameOrigin(request))return reply({error:'Ungültige Anfrage.'},403);
 try{
 settings();
 const raw=await request.text();if(raw.length>500)return reply({error:'Ungültige Eingabe.'},400);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:'Ungültige Eingabe.'},400);}
 if(!['1','2'].includes(body?.access)||typeof body?.code!=='string'||body.code.length>100)return reply({error:'Bitte Klasse und Passwort eingeben.'},400);
 if(!await permitAttempt(request))return reply({error:'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.'},429);
 if(!await verifyCode(body.access as Access,body.code))return reply({error:'Das Passwort passt nicht zu diesem Zugang. Bitte prüfe deine Eingabe.'},401);
 if(isPagesRequest(request))return reply({access:body.access,token:await sessionToken(body.access)});
 return reply({access:body.access},200,await sessionCookie(body.access));
 }catch(e){console.error('Class access unavailable');return reply({error:'Der Zugang ist gerade nicht erreichbar. Bitte erneut versuchen.'},503);}
}

export async function GET(request:Request){return cors(request,await handleGET(request));}

export async function POST(request:Request){return cors(request,await handlePOST(request));}

export async function DELETE(request:Request){return cors(request,await handleDELETE(request));}

export function OPTIONS(request:Request){return preflight(request);}
