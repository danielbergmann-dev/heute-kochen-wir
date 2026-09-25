// The GitHub build uses a remote API. Only the short-lived login token lives in
// memory; cooking records are always read from and written to the server.
declare const __KITCHEN_API_ORIGIN__: string;
const apiOrigin=typeof __KITCHEN_API_ORIGIN__==='string'?__KITCHEN_API_ORIGIN__:'';
let token='';
export async function apiFetch(path:string,init:RequestInit={}){
 if(!apiOrigin)return fetch(path,init);
 const headers=new Headers(init.headers);
 if(token)headers.set('Authorization','Bearer '+token);
 const response=await fetch(apiOrigin+path,{...init,headers,credentials:'omit',mode:'cors'});
 if(path==='/api/access'&&init.method==='POST'&&response.ok){
  const data=await response.clone().json() as {token?:string};
  if(!data.token)throw Error('Anmeldung konnte nicht abgeschlossen werden.');
  token=data.token;
 }
 if(path==='/api/access'&&init.method==='DELETE'&&response.ok)token='';
 return response;
}
