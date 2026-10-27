import { router, json, error, db } from '@appdeploy/sdk';
import { createHash, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';

type Network = 'testnet'|'mainnet';
type Role = 'donor'|'organization'|'beneficiary'|'admin';
type Status = 'verified'|'mismatch'|'not-found'|'unverified'|'voided';
type SessionRecord = { address:string; network:Network; role:Role; expiresAt:number; csrfToken:string; createdAt:string };
type ChallengeRecord = { address:string; network:Network; nonce:string; message:string; expiresAt:number; used:boolean };
type Verification = { status:Status; checkedAt:string; differences:string[]; ledger?:number; createdAt?:string; destination?:string; amount?:string; asset?:string; link?:string; reason?:string };
type AidRecord = { id:string; recipient:string; recipientAddress:string; purpose:string; amount:string; asset:string; assetIssuer?:string; network:Network; txHash:string; date:string; note:string; organization:string; organizationName?:string; createdAt:string; status:Status; createdBy:string; verification?:Verification; voidReason?:string; voidedAt?:string; updatedAt?:string };
type Audit = { id:string; action:string; summary:string; address:string; recordId?:string; createdAt:string };
const SESSION_TTL=7*24*60*60*1000, CHALLENGE_TTL=5*60*1000, COOKIE='aidtrace_session';
const tables={sessions:'aidtrace_sessions',challenges:'aidtrace_challenges',roles:'aidtrace_roles',records:'aidtrace_public_records',audit:'aidtrace_audit',limits:'aidtrace_rate_limits'};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const validNetwork=(v:unknown):v is Network=>v==='testnet'||v==='mainnet';
const validRole=(v:unknown):v is Role=>['donor','organization','beneficiary','admin'].includes(String(v));
const validAddress=(v:unknown):v is string=>typeof v==='string'&&/^G[A-Z2-7]{55}$/.test(v)&&validPublicKey(v);
const validHash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-fA-F]{64}$/.test(v);
function validPublicKey(address:string){try{const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0;const out:number[]=[];for(const c of address){const n=alphabet.indexOf(c);if(n<0)return false;value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((value>>bits)&255);}}const d=Buffer.from(out);if(d.length!==35||d[0]!==48)return false;const payload=d.subarray(0,33);let crc=0;for(const b of payload){crc^=b<<8;for(let i=0;i<8;i++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=65535;}}return d.readUInt16LE(33)===crc;}catch{return false;}}
function publicKeyBytes(address:string):Buffer{const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0;const out:number[]=[];for(const c of address){const n=alphabet.indexOf(c);if(n<0)throw new Error('Invalid address');value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((value>>bits)&255);}}const d=Buffer.from(out);if(d.length!==35||d[0]!==48)throw new Error('Invalid Stellar public key');let crc=0;for(const b of d.subarray(0,33)){crc^=b<<8;for(let i=0;i<8;i++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=65535;}}if(d.readUInt16LE(33)!==crc)throw new Error('Invalid public key checksum');return d.subarray(1,33);}
function signatureBytes(s:string){if(/^[0-9a-fA-F]{128}$/.test(s))return Buffer.from(s,'hex');return Buffer.from(s,'base64');}
function verifySep53(address:string,message:string,encoded:string){const prefix=Buffer.from('302a300506032b6570032100','hex');const key=createPublicKey({key:Buffer.concat([prefix,publicKeyBytes(address)]),format:'der',type:'spki'});const digest=createHash('sha256').update('Stellar Signed Message:\n','utf8').update(message,'utf8').digest();const sig=signatureBytes(encoded);return sig.length===64&&verifySignature(null,digest,key,sig);}
function cookieFrom(event:{headers?:Record<string,string|undefined>}){const raw=event.headers?.cookie||event.headers?.Cookie||'';const found=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));try{return found?decodeURIComponent(found.slice(COOKIE.length+1)):'';}catch{return '';}}
function responseCookie(data:unknown,cookie:string,status=200){const r=json(data,status);r.headers['Set-Cookie']=cookie;r.headers['Cache-Control']='no-store';return r;}
const clearCookie=()=>COOKIE+'=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
function originAllowed(event:{headers?:Record<string,string|undefined>}){const origin=event.headers?.origin||event.headers?.Origin;if(!origin)return true;try{const u=new URL(origin);if(u.protocol!=='https:'&&u.hostname!=='localhost'&&u.hostname!=='127.0.0.1')return false;const trustedHosts=new Set(['aidtrace-stellar-aid-transparency-8t0vkt.v2.appdeploy.ai','localhost:5173','127.0.0.1:5173']);const host=event.headers?.host||event.headers?.Host;const forwarded=event.headers?.['x-forwarded-host']||event.headers?.['X-Forwarded-Host'];return trustedHosts.has(u.host)||u.host===host||u.host===forwarded;}catch{return false;}}
async function rateLimit(key:string,max:number,windowMs:number){const now=Date.now(),bucket=Math.floor(now/windowMs),id=sha(key+':'+bucket);const [existing]=await db.get<{count:number;expiresAt:number}>(tables.limits,[id],{consistent:true});if(!existing){const [created]=await db.tx.add(tables.limits,[{id,count:1,expiresAt:(bucket+1)*windowMs}]);if(created)return true;const [retry]=await db.get<{count:number}>(tables.limits,[id],{consistent:true});return !!retry&&retry.count<=max;}if(existing.count>=max)return false;const [updated]=await db.tx.update(tables.limits,[{id,record:{count:existing.count+1,expiresAt:existing.expiresAt},if:{count:existing.count}}],{patch:true});return !!updated;}
async function roleFor(address:string):Promise<Role>{const [r]=await db.get<{role:Role}>(tables.roles,[address],{consistent:true});return r&&validRole(r.role)?r.role:'donor';}
async function currentSession(event:{headers?:Record<string,string|undefined>}){const token=cookieFrom(event);if(!token||token.length<40)return null;const tokenHash=sha(token);const [s]=await db.get<SessionRecord>(tables.sessions,[tokenHash],{consistent:true});if(!s||s.expiresAt<=Date.now())return null;return {...s,role:await roleFor(s.address),tokenHash};}
function csrfOK(body:unknown,session:{csrfToken:string}){return !!body&&typeof body==='object'&&(body as {csrfToken?:string}).csrfToken===session.csrfToken;}
async function requireSession(event:unknown){const s=await currentSession(event as {headers?:Record<string,string|undefined>});return s;}
function roleError(session:{role:Role}|null,roles:Role[]){return !session?error('Session expired. Reconnect Freighter to continue.',401):!roles.includes(session.role)?error('Your wallet role is not permitted to perform this action.',403):null;}
async function log(action:string,summary:string,address:string,recordId=''){const id=randomBytes(12).toString('hex');await db.tx.add(tables.audit,[{id,action,summary:summary.slice(0,1000),address,recordId,createdAt:new Date().toISOString()}]);}
async function listAll<T>(table:string,limit=100){const r=await db.list<T>(table,{limit});return r.items;}
function cleanText(v:unknown,max:number){return typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max):'';}
function validDate(v:unknown){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));}
function canonicalAmount(value:unknown):string|null{const raw=String(value??'');if(!/^\d+(?:\.\d{1,7})?$/.test(raw))return null;const parts=raw.split('.');const whole=parts[0].replace(/^0+(?=\d)/,'');const fraction=(parts[1]||'').replace(/0+$/,'');return fraction?whole+'.'+fraction:whole;}
function validateRecord(body:unknown):Omit<AidRecord,'id'|'organization'|'createdAt'|'createdBy'|'status'|'verification'|'voidReason'|'voidedAt'>|null{
 if(!body||typeof body!=='object')return null;const x=body as Partial<AidRecord>;
 const recipient=cleanText(x.recipient,160),purpose=cleanText(x.purpose,240),note=cleanText(x.note,500),asset=cleanText(x.asset,12).toUpperCase();
 const amount=canonicalAmount(x.amount);
 if(!recipient||!purpose||!validAddress(x.recipientAddress)||typeof x.amount!=='string'||!amount||Number(amount)<=0||!/^[A-Z0-9]{1,12}$/.test(asset)||!validNetwork(x.network)||!validDate(x.date)||typeof x.txHash!=='string'||(x.txHash!==''&&!validHash(x.txHash))||typeof x.assetIssuer!=='string'&&x.assetIssuer!==undefined)return null;
 if(asset==='XLM'&&x.assetIssuer)return null;
 if(asset!=='XLM'&&!validAddress(x.assetIssuer))return null;
 if(x.assetIssuer&& !validAddress(x.assetIssuer))return null;
 return {recipient,recipientAddress:x.recipientAddress,purpose,amount,asset,assetIssuer:x.assetIssuer||'',network:x.network,txHash:x.txHash.toLowerCase(),date:x.date,note,organizationName:'',updatedAt:undefined};
}
async function ownedRecord(id:string){const [r]=await db.get<AidRecord>(tables.records,[id],{consistent:true});return r&&r.id===id?r:null;}
async function checkTransaction(record:AidRecord):Promise<Verification>{
 const checkedAt=new Date().toISOString();
 if(!record.txHash)return {status:'unverified',checkedAt,differences:[],reason:'No transaction hash was supplied.'};
 if(!validHash(record.txHash))return {status:'not-found',checkedAt,differences:[],reason:'Transaction hash format is invalid.'};
 const base=record.network==='mainnet'?'https://horizon.stellar.org':'https://horizon-testnet.stellar.org';
 let txResponse:Response;
 try{txResponse=await fetch(base+'/transactions/'+record.txHash,{headers:{Accept:'application/json'}});}catch{return {status:'pending',checkedAt,differences:[],reason:'Horizon is unavailable. Retry verification.'};}
 if(txResponse.status===404)return {status:'not-found',checkedAt,differences:[],reason:'Hash was not found on the selected network.'};
 if(!txResponse.ok)return {status:'pending',checkedAt,differences:[],reason:'Horizon returned HTTP '+txResponse.status+'. Retry later.'};
 const tx=await txResponse.json() as {successful?:boolean;ledger?:number;created_at?:string};
 if(!tx.successful)return {status:'mismatch',checkedAt,differences:['Transaction is marked unsuccessful on Stellar.'],ledger:tx.ledger,createdAt:tx.created_at,link:(record.network==='mainnet'?'https://stellar.expert/explorer/public/tx/':'https://stellar.expert/explorer/testnet/tx/')+record.txHash};
 let opResponse:Response;try{opResponse=await fetch(base+'/transactions/'+record.txHash+'/operations?limit=200&order=asc',{headers:{Accept:'application/json'}});}catch{return {status:'pending',checkedAt,differences:[],reason:'Horizon operations endpoint is unavailable.'};}
 if(!opResponse.ok)return {status:'pending',checkedAt,differences:[],reason:'Could not read transaction operations from Horizon.'};
 const ops=await opResponse.json() as {_embedded?:{records?:Record<string,unknown>[]}};
 const payments=(ops._embedded?.records||[]).filter(o=>['payment','create_account','path_payment_strict_receive','path_payment_strict_send','path_payment'].includes(String(o.type)));
 const differences:string[]=[];
 const destination=record.recipientAddress;
 const expectedAmount=Number(record.amount);
 const expectedAsset=record.asset.toUpperCase();
 const match=payments.find(o=>{
   const dest=String(o.to||o.destination||'');const amount=String(o.amount||o.starting_balance||'');
   const code=String(o.asset_type==='native'?'XLM':o.asset_code||'').toUpperCase();const issuer=String(o.asset_issuer||'');
   return dest===destination&&canonicalAmount(amount)===canonicalAmount(record.amount)&&code===expectedAsset&&(expectedAsset==='XLM'||issuer===record.assetIssuer);
 });
 if(!match){
   const destMatches=payments.filter(o=>String(o.to||o.destination||'')===destination);
   if(!payments.length)differences.push('No payment operation was found in this transaction.');
   else if(!destMatches.length)differences.push('Destination differs: expected '+destination+'.');
   else {
     const amountMatch=destMatches.some(o=>Number(o.amount||o.starting_balance||'')===expectedAmount);
     if(!amountMatch)differences.push('Amount differs: expected '+record.amount+'.');
     const codeMatch=destMatches.some(o=>String(o.asset_type==='native'?'XLM':o.asset_code||'').toUpperCase()===expectedAsset);
     if(!codeMatch)differences.push('Asset differs: expected '+expectedAsset+'.');
     if(codeMatch&&record.assetIssuer&&!destMatches.some(o=>String(o.asset_issuer||'')===record.assetIssuer))differences.push('Asset issuer differs.');
     if(amountMatch&&codeMatch&&!differences.length)differences.push('No single payment operation matches all recorded fields.');
   }
   return {status:'mismatch',checkedAt,differences,ledger:tx.ledger,createdAt:tx.created_at,link:(record.network==='mainnet'?'https://stellar.expert/explorer/public/tx/':'https://stellar.expert/explorer/testnet/tx/')+record.txHash};
 }
 return {status:'verified',checkedAt,differences:[],ledger:tx.ledger,createdAt:tx.created_at,destination:String(match.to||match.destination||''),amount:String(match.amount||match.starting_balance||''),asset:String(match.asset_type==='native'?'XLM':match.asset_code||''),link:(record.network==='mainnet'?'https://stellar.expert/explorer/public/tx/':'https://stellar.expert/explorer/testnet/tx/')+record.txHash};
}
export const handler=router({
 'GET /api/_healthcheck':[async()=>json({ok:true,service:'aidtrace-wallet-api'})],
 'POST /api/auth/challenge':[async({body,event})=>{
   if(!originAllowed(event))return error('Cross-origin request rejected.',403);
   const x=body as {address?:string;network?:Network}|null;
   if(!x||!validAddress(x.address)||!validNetwork(x.network))return error('A valid Stellar public address and network are required.',400);
   if(!await rateLimit('challenge:'+x.address,8,15*60*1000))return error('Too many challenges. Wait a few minutes and try again.',429);
   const nonce=randomBytes(32).toString('hex'),challengeId=randomBytes(24).toString('hex'),expiresAt=Date.now()+CHALLENGE_TTL;
   const message='AidTrace wallet login\nAddress: '+x.address+'\nNetwork: '+x.network+'\nNonce: '+nonce+'\nExpires: '+new Date(expiresAt).toISOString()+'\nPurpose: prove wallet ownership; no transaction will be sent.';
   const [saved]=await db.tx.add(tables.challenges,[{id:challengeId,address:x.address,network:x.network,nonce,message,expiresAt,used:false}]);
   if(!saved)return error('Could not issue a challenge. Please retry.',503);
   return json({challengeId,message,expiresAt});
 }],
 'POST /api/auth/verify':[async({body,event})=>{
   if(!originAllowed(event))return error('Cross-origin request rejected.',403);
   const x=body as {challengeId?:string;address?:string;network?:Network;signature?:string}|null;
   if(!x||typeof x.challengeId!=='string'||!/^[a-f0-9]{48}$/.test(x.challengeId)||!validAddress(x.address)||!validNetwork(x.network)||typeof x.signature!=='string'||x.signature.length>1000)return error('Invalid signature verification request.',400);
   if(!await rateLimit('verify:'+x.address,12,60*1000))return error('Too many signature attempts. Wait a minute and retry.',429);
   const [challenge]=await db.get<ChallengeRecord>(tables.challenges,[x.challengeId],{consistent:true});
   if(!challenge||challenge.used||challenge.expiresAt<=Date.now())return error('Challenge expired or already used. Request a fresh challenge.',401);
   if(challenge.address!==x.address||challenge.network!==x.network)return error('Wallet or network does not match the challenge.',401);
   let ok=false;try{ok=verifySep53(x.address,challenge.message,x.signature);}catch{ok=false;}
   if(!ok)return error('Signature verification failed. No session was created.',401);
   const [used]=await db.tx.update(tables.challenges,[{id:x.challengeId,record:{used:true},if:{used:false}}],{patch:true});
   if(!used)return error('Challenge was already used. Connect again for a new challenge.',409);
   const token=randomBytes(32).toString('base64url'),tokenHash=sha(token),csrfToken=randomBytes(32).toString('base64url'),expiresAt=Date.now()+SESSION_TTL;
   const role=await roleFor(x.address);
   const [sid]=await db.tx.add(tables.sessions,[{id:tokenHash,address:x.address,network:x.network,role,csrfToken,expiresAt,createdAt:new Date().toISOString()}]);
   if(!sid)return error('Could not create a secure session. Retry.',503);
   await log('wallet_authenticated','Wallet ownership verified on '+x.network,x.address);
   return responseCookie({session:{address:x.address,network:x.network,role,csrfToken,expiresAt:new Date(expiresAt).toISOString()}},COOKIE+'='+encodeURIComponent(token)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age='+Math.floor(SESSION_TTL/1000));
 }],
 'GET /api/me':[async({event})=>{const s=await currentSession(event);if(!s)return responseCookie({session:null},clearCookie());return json({session:{address:s.address,network:s.network,role:s.role,csrfToken:s.csrfToken,expiresAt:new Date(s.expiresAt).toISOString()}});}],
 'POST /api/auth/logout':[async({event,body})=>{const s=await currentSession(event);if(s&&!csrfOK(body,s))return error('CSRF check failed. Refresh the app and retry.',403);if(s)await db.delete(tables.sessions,[s.tokenHash]);return responseCookie({ok:true},clearCookie());}],
 'POST /api/auth/logout-everywhere':[async({event,body})=>{const s=await currentSession(event);if(!s)return error('Session expired. Reconnect Freighter.',401);if(!originAllowed(event)||!csrfOK(body,s))return error('CSRF check failed. Refresh the app and retry.',403);const sessions=await listAll<SessionRecord & {id:string}>(tables.sessions,100);const ids=sessions.filter(v=>v.address===s.address).map(v=>v.id);if(ids.length)await db.delete(tables.sessions,ids);await log('wallet_logout_everywhere','Revoked all active sessions for this wallet.',s.address);return responseCookie({ok:true},clearCookie());}],
 'GET /api/transparency':[async()=>{const rows=await listAll<AidRecord>(tables.records,100);return json({records:rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))})}],
 'GET /api/beneficiary':[async({event})=>{const s=await requireSession(event);const denied=roleError(s,['beneficiary','admin']);if(denied)return denied;const rows=await listAll<AidRecord>(tables.records,100);return json({records:rows.filter(r=>r.recipientAddress===s!.address)})}],
 'POST /api/records':[async({event,body})=>{
   const s=await requireSession(event);const denied=roleError(s,['organization','admin']);if(denied)return denied;if(!originAllowed(event)||!csrfOK(body,s!))return error('CSRF check failed. Refresh the app and retry.',403);
   const x=validateRecord(body);if(!x)return error('Invalid record. Check address, positive amount, asset, network, date and transaction hash.',400);
   const id=randomBytes(16).toString('hex');const record:AidRecord={...x,id,organization:s!.address,createdAt:new Date().toISOString(),createdBy:s!.address,status:x.txHash?'pending' as Status:'unverified' as Status};
   const [saved]=await db.tx.add(tables.records,[record]);if(!saved)return error('Could not save disbursement.',503);
   await log('record_created','Created aid record for '+record.recipient+'; '+record.amount+' '+record.asset+'.',s!.address,id);
   if(record.txHash){const verification=await checkTransaction(record);record.verification=verification;record.status=verification.status;await db.update(tables.records,[{id,record}]);}
   return json({record},201);
 }],
 'POST /api/records/:id/verify':[async({event,body,params})=>{
   const s=await requireSession(event);if(!s)return error('Session expired. Reconnect Freighter.',401);if(!originAllowed(event)||!csrfOK(body,s))return error('CSRF check failed. Refresh the app and retry.',403);
   if(!await rateLimit('record-verify:'+s.address,30,60*1000))return error('Verification rate limit reached. Retry in a minute.',429);
   const record=await ownedRecord(params.id);if(!record)return error('Record not found.',404);
   const cached=record.verification;
   if(cached&&cached.status!=='pending'&&Date.now()-Date.parse(cached.checkedAt)<60*60*1000)return json({record});
   const verification=await checkTransaction(record);
   const updated={...record,verification,status:record.voidedAt?'voided' as Status:verification.status,updatedAt:new Date().toISOString()};
   await db.update(tables.records,[{id:record.id,record:updated}]);await log('record_verification_checked','Verification status '+updated.status+'.',s.address,record.id);return json({record:updated});
 }],
 'PUT /api/records/:id':[async({event,body,params})=>{
   const s=await requireSession(event);const denied=roleError(s,['organization','admin']);if(denied)return denied;if(!originAllowed(event)||!csrfOK(body,s!))return error('CSRF check failed. Refresh the app and retry.',403);
   const old=await ownedRecord(params.id);if(!old)return error('Record not found.',404);
   if(s!.role!=='admin'&&old.organization!==s!.address)return error('Organizations can edit only their own records.',403);
   if(old.voidedAt)return error('Voided records cannot be edited.',409);
   const x=validateRecord(body);if(!x)return error('Invalid record fields.',400);
   const updated:AidRecord={...old,...x,organization:old.organization,createdBy:old.createdBy,updatedAt:new Date().toISOString(),status:x.txHash?'pending':'unverified',verification:undefined};
   const [ok]=await db.tx.update(tables.records,[{id:old.id,record:updated,if:{organization:old.organization,updatedAt:old.updatedAt}}],{patch:true});if(!ok)return error('Record changed concurrently. Refresh before editing.',409);
   await log('record_updated','Updated aid record for '+updated.recipient+'.',s!.address,old.id);
   if(updated.txHash){updated.verification=await checkTransaction(updated);updated.status=updated.verification.status;await db.update(tables.records,[{id:updated.id,record:updated}]);}
   return json({record:updated});
 }],
 'POST /api/records/:id/void':[async({event,body,params})=>{
   const s=await requireSession(event);const denied=roleError(s,['organization','admin']);if(denied)return denied;if(!originAllowed(event)||!csrfOK(body,s!))return error('CSRF check failed. Refresh the app and retry.',403);
   const old=await ownedRecord(params.id);if(!old)return error('Record not found.',404);if(s!.role!=='admin'&&old.organization!==s!.address)return error('Organizations can void only their own records.',403);if(old.voidedAt)return error('Record is already voided.',409);
   const x=body as {reason?:string};const reason=cleanText(x.reason,500);if(reason.length<5)return error('Provide a meaningful void reason (at least five characters).',400);
   const updated={...old,status:'voided' as Status,voidReason:reason,voidedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   const [ok]=await db.tx.update(tables.records,[{id:old.id,record:updated,if:{organization:old.organization,voidedAt:undefined}}],{patch:true});if(!ok)return error('Record changed or was already voided.',409);
   await log('record_voided','Voided record for '+old.recipient+'. Reason: '+reason,s!.address,old.id);return json({record:updated});
 }],
 'GET /api/admin/roles':[async({event})=>{const s=await requireSession(event);const denied=roleError(s,['admin']);if(denied)return denied;return json({roles:await listAll<{address:string;role:Role;updatedAt:string;updatedBy:string} & {id:string}>(tables.roles,100)})}],
 'POST /api/admin/roles':[async({event,body})=>{
   const s=await requireSession(event);const denied=roleError(s,['admin']);if(denied)return denied;if(!originAllowed(event)||!csrfOK(body,s!))return error('CSRF check failed. Refresh the app and retry.',403);
   const x=body as {address?:string;role?:Role};if(!validAddress(x.address)||!validRole(x.role))return error('Valid wallet address and role required.',400);
   if(x.address===s!.address&&x.role!=='admin')return error('You cannot demote your own active admin wallet.',409);
   const [old]=await db.get<{role:Role}>(tables.roles,[x.address],{consistent:true});const entry={id:x.address,address:x.address,role:x.role,updatedAt:new Date().toISOString(),updatedBy:s!.address};
   if(old){const [ok]=await db.tx.update(tables.roles,[{id:x.address,record:entry,if:{role:old.role}}],{patch:true});if(!ok)return error('Role changed concurrently. Refresh and retry.',409);}else{const [id]=await db.tx.add(tables.roles,[entry]);if(!id)return error('Could not assign role.',503);}
   await log('wallet_role_changed','Changed '+x.address+' role from '+(old?.role||'implicit donor')+' to '+x.role+'.',s!.address);return json({ok:true});
 }],
 'DELETE /api/admin/roles/:address':[async({event,params,body})=>{
   const s=await requireSession(event);const denied=roleError(s,['admin']);if(denied)return denied;if(!originAllowed(event)||!csrfOK(body,s!))return error('CSRF check failed. Refresh the app and retry.',403);
   if(!validAddress(params.address))return error('Invalid wallet address.',400);if(params.address===s!.address)return error('Cannot remove your own active admin role.',409);
   const [old]=await db.get<{role:Role}>(tables.roles,[params.address],{consistent:true});if(!old)return error('Explicit role not found.',404);
   const [ok]=await db.delete(tables.roles,[params.address]);if(!ok)return error('Could not remove role.',503);await log('wallet_role_removed','Removed '+params.address+' role '+old.role+'; wallet now defaults to donor.',s!.address);return json({ok:true});
 }],
 'GET /api/audit':[async({event})=>{const s=await requireSession(event);const denied=roleError(s,['admin']);if(denied)return denied;const rows=await listAll<Audit>(tables.audit,100);return json({entries:rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})}]
});