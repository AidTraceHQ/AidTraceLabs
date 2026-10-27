import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { getNetwork, isConnected, requestAccess, signMessage } from '@stellar/freighter-api';
import { Activity, ArrowDownToLine, ArrowUpRight, BadgeCheck, CheckCircle2, CircleAlert, ExternalLink, FileClock, HeartHandshake, LogOut, Plus, RefreshCw, Search, ShieldCheck, Wallet, X, Sun, Moon } from 'lucide-react';
import './fullstack.css';

type Network = 'testnet' | 'mainnet';
type Role = 'donor' | 'organization' | 'beneficiary' | 'admin';
type Verification = 'verified' | 'mismatch' | 'not-found' | 'unverified' | 'pending' | 'voided';
type Session = { address: string; network: Network; role: Role; expiresAt: string; csrfToken: string };
type AidRecord = { id: string; recipient: string; recipientAddress: string; purpose: string; amount: string; asset: string; assetIssuer?: string; network: Network; txHash: string; date: string; note: string; status: Verification; organization: string; organizationName?: string; createdAt: string; createdBy: string; verification?: { status: Verification; checkedAt: string; differences: string[]; ledger?: number; createdAt?: string; destination?: string; amount?: string; asset?: string; link?: string; reason?: string }; voidReason?: string; voidedAt?: string };
type ActivityItem = { id: string; hash: string; date: string; type: string; amount: string; asset: string; counterparty: string; status: string; network: Network; publishedRecord?: AidRecord };
type AuditItem = { id: string; action: string; summary: string; address: string; recordId?: string; createdAt: string };
const defaultNetwork: Network = import.meta.env.VITE_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const horizon: Record<Network, string> = { testnet: 'https://horizon-testnet.stellar.org', mainnet: 'https://horizon.stellar.org' };
const explorer = (network: Network, hash: string) => (network === 'mainnet' ? 'https://stellar.expert/explorer/public/tx/' : 'https://stellar.expert/explorer/testnet/tx/') + encodeURIComponent(hash);
const short = (value: string, left = 7, right = 5) => value && value.length > left + right + 1 ? value.slice(0, left) + '…' + value.slice(-right) : value || '—';
const messageOf = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const labelStatus = (status: Verification) => ({ verified: 'Verified on-chain', mismatch: 'Mismatch', 'not-found': 'Not found', unverified: 'Unverified', pending: 'Checking…', voided: 'Voided' }[status] || 'Unverified');
const isAddress = (value: string) => /^G[A-Z2-7]{55}$/.test(value);
const SkeletonRows = ({ columns = 6 }: { columns?: number }) => <>{[0,1,2,3,4].map(row => <tr key={row} aria-hidden="true">{Array.from({length:columns},(_,col)=><td key={col}><span className="skeleton" /></td>)}</tr>)}</>;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [network, setNetwork] = useState<Network>(defaultNetwork);
  const [page, setPage] = useState<'transparency'|'activity'|'beneficiary'|'admin'>('transparency');
  const [records, setRecords] = useState<AidRecord[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [roles, setRoles] = useState<{address:string;role:Role;updatedAt:string;updatedBy:string}[]>([]);
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [assetFilter, setAssetFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [activityType, setActivityType] = useState('all');
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [activityStream, setActivityStream] = useState<'connecting'|'live'|'polling'|'offline'>('offline');
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState<AidRecord|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [form, setForm] = useState({recipient:'',recipientAddress:'',purpose:'',amount:'',asset:'USDC',assetIssuer:'',network:defaultNetwork as Network,txHash:'',date:new Date().toISOString().slice(0,10),note:''});
  const [roleAddress, setRoleAddress] = useState('');
  const [roleValue, setRoleValue] = useState<Role>('organization');
  const [auditAction, setAuditAction] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const pageSize = 10;

  const notify = useCallback((text: string) => { setToast(text); window.setTimeout(() => setToast(''), 3600); }, []);
  const loadTransparency = useCallback(async () => {
    try { const result = await api.get('/api/transparency'); setRecords(result.data.records || []); }
    catch(e) { setError(messageOf(e)); }
    finally { setLoading(false); }
  }, []);
  const loadAudit = useCallback(async () => {
    if (!session || session.role !== 'admin') return;
    try { const r = await api.get('/api/audit'); setAudit(r.data.entries || []); } catch(e) { setError(messageOf(e)); }
  }, [session]);
  const restoreSession = useCallback(async () => {
    try { const r = await api.get('/api/me'); const restored = r.data.session as Session | null; setSession(restored); if (restored) setNetwork(restored.network); }
    catch { setSession(null); }
  }, []);
  useEffect(() => { void restoreSession(); void loadTransparency(); }, [restoreSession, loadTransparency]);
  useEffect(() => { if (session?.role === 'admin') { void loadAudit(); void loadRoles(); } }, [session, loadAudit]);
  async function loadRoles() { try { const r = await api.get('/api/admin/roles'); setRoles(r.data.roles || []); } catch(e) { setError(messageOf(e)); } }

  const loadActivity = useCallback(async (address: string, selectedNetwork: Network) => {
    setActivityLoading(true);
    try {
      const base = horizon[selectedNetwork];
      const [accountRes,paymentsRes,txRes] = await Promise.all([
        fetch(base+'/accounts/'+encodeURIComponent(address),{headers:{Accept:'application/json'}}),
        fetch(base+'/accounts/'+encodeURIComponent(address)+'/payments?order=desc&limit=50',{headers:{Accept:'application/json'}}),
        fetch(base+'/accounts/'+encodeURIComponent(address)+'/transactions?order=desc&limit=50&include_failed=true',{headers:{Accept:'application/json'}})
      ]);
      if (accountRes.status===404) throw new Error('Wallet account not found on '+selectedNetwork+'. Switch network or fund the Testnet account.');
      if (!accountRes.ok || !paymentsRes.ok || !txRes.ok) throw new Error('Horizon is unavailable. Your records are safe; activity will retry.');
      const account=await accountRes.json() as {balances?:{asset_type:string;balance:string}[]};
      const payments=await paymentsRes.json() as {_embedded?:{records?:Record<string,unknown>[]}};
      const txs=await txRes.json() as {_embedded?:{records?:Record<string,unknown>[]}};
      setBalance(account.balances?.find(b=>b.asset_type==='native')?.balance || '0');
      const published=records.filter(r=>r.network===selectedNetwork && r.txHash);
      const payItems:ActivityItem[]=(payments._embedded?.records||[]).map((p,i)=>{
        const hash=String(p.transaction_hash||''); const source=String(p.from||p.source_account||''); const dest=String(p.to||'');
        const sent=source===address; const code=p.asset_type==='native'?'XLM':String(p.asset_code||'Unknown');
        return {id:String(p.id||hash+i),hash,date:String(p.created_at||''),type:sent?'sent':'received',amount:String(p.amount||'—'),asset:code,counterparty:short(sent?dest:source),status:'Successful',network:selectedNetwork,publishedRecord:published.find(r=>r.txHash===hash)};
      });
      const hashes=new Set(payItems.map(p=>p.hash));
      const txItems:ActivityItem[]=(txs._embedded?.records||[]).filter(t=>!hashes.has(String(t.hash||''))).map((t,i)=>({id:String(t.id||t.hash||i),hash:String(t.hash||''),date:String(t.created_at||''),type:'transaction',amount:'—',asset:'—',counterparty:short(String(t.source_account||'')),status:t.successful?'Successful':'Failed',network:selectedNetwork}));
      setActivity([...payItems,...txItems].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,100));
      setError('');
    } catch(e) { setError(messageOf(e)); }
    finally { setActivityLoading(false); }
  }, [records]);

  useEffect(() => {
    if (!session) { setActivity([]); setBalance('0'); setActivityStream('offline'); return; }
    let source: EventSource | null = null; let pollTimer: number | undefined; let closed = false;
    setActivityStream('connecting');
    const startPolling = () => { if (closed) return; setActivityStream('polling'); if (pollTimer) window.clearInterval(pollTimer); pollTimer=window.setInterval(()=>void loadActivity(session.address,network),30000); };
    void loadActivity(session.address,network);
    try {
      source=new EventSource(horizon[network]+'/accounts/'+encodeURIComponent(session.address)+'/payments?cursor=now');
      source.onopen=()=>{ setActivityStream('live'); if(pollTimer){window.clearInterval(pollTimer);pollTimer=undefined;} };
      source.onmessage=event=>{ try { const payment=JSON.parse(event.data) as {transaction_hash?:string}; if(payment.transaction_hash) void loadActivity(session.address,network); } catch { /* Ignore malformed stream frames and keep listening. */ } };
      source.onerror=()=>{ source?.close(); source=null; startPolling(); };
    } catch { startPolling(); }
    return ()=>{ closed=true; source?.close(); if(pollTimer) window.clearInterval(pollTimer); };
  }, [session,network,loadActivity]);

  async function connectWallet() {
    setBusy(true); setError('');
    try {
      const installed=await isConnected();
      if(!installed.isConnected) throw new Error('Freighter is not installed or is disabled. Install the official Freighter wallet extension and try again.');
      const access=await requestAccess();
      if(access.error) throw new Error(/reject|cancel|declin/i.test(access.error.message||'')?'You rejected the wallet request. No transaction was sent.':access.error.message||'Wallet access was denied.');
      const address=access.address;
      if(!address || !isAddress(address)) throw new Error('Freighter did not return a valid Stellar public address.');
      const walletNetwork=await getNetwork();
      if(walletNetwork.error) throw new Error(walletNetwork.error.message||'Could not determine Freighter network.');
      const walletNet=String(walletNetwork.network||'').toLowerCase().includes('test')?'testnet':'mainnet';
      if(walletNet!==network) throw new Error('Wrong network: AidTrace is on '+network+' but Freighter is on '+walletNet+'. Switch one network and reconnect.');
      const challenge=await api.post('/api/auth/challenge',{address,network});
      const signed=await signMessage(challenge.data.message,{address,networkPassphrase:walletNetwork.networkPassphrase});
      if(signed.error) throw new Error(/reject|cancel|declin/i.test(signed.error.message||'')?'You rejected the signing request. No transaction was sent.':signed.error.message||'Message signing failed.');
      if(!signed.signedMessage || signed.signerAddress!==address) throw new Error('The challenge signature was missing or signed by a different wallet.');
      const verified=await api.post('/api/auth/verify',{challengeId:challenge.data.challengeId,address,network,signature:signed.signedMessage});
      setSession(verified.data.session); setNetwork(network); notify('Wallet ownership verified.'); await loadTransparency();
    } catch(e) { const msg=messageOf(e); setError(/expired or already used/i.test(msg)?'Challenge expired. Reconnect to request a fresh five-minute challenge.':msg); }
    finally { setBusy(false); }
  }
  async function disconnect(everywhere=false) {
    try { await api.post(everywhere?'/api/auth/logout-everywhere':'/api/auth/logout',{csrfToken:session?.csrfToken}); setSession(null); setActivity([]); notify(everywhere?'All sessions for this wallet were signed out.':'Wallet disconnected.'); }
    catch(e) { setError(messageOf(e)); }
  }
  async function copyAddress() { if(!session)return; try {await navigator.clipboard.writeText(session.address);notify('Public address copied.');} catch {setError('Clipboard is unavailable. Select the public address to copy it.');} }
  async function saveRecord(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!session){setError('Connect your wallet first.');return;}
    if(!form.recipient.trim()||!form.purpose.trim()||!Number.isFinite(Number(form.amount))||Number(form.amount)<=0){setError('Enter a recipient, purpose and positive amount.');return;}
    if(!isAddress(form.recipientAddress)){setError('Enter the beneficiary Stellar public address (G…).');return;}
    if(form.txHash && !/^[0-9a-fA-F]{64}$/.test(form.txHash.trim())){setError('A Stellar transaction hash must contain exactly 64 hexadecimal characters.');return;}
    setBusy(true);setError('');
    try {
      await api.post('/api/records',{...form,csrfToken:session.csrfToken,recipient:form.recipient.trim(),recipientAddress:form.recipientAddress.trim(),purpose:form.purpose.trim(),amount:String(form.amount),txHash:form.txHash.trim(),note:form.note.trim()});
      setShowForm(false);setForm({...form,recipient:'',recipientAddress:'',purpose:'',amount:'',txHash:'',note:''});await loadTransparency();notify('Disbursement saved and audit-logged.');
    } catch(e){setError(messageOf(e));} finally{setBusy(false);}
  }
  async function verifyRecord(record:AidRecord) {
    setRecords(prev=>prev.map(r=>r.id===record.id?{...r,status:'pending'}:r));
    try { const r=await api.post('/api/records/'+encodeURIComponent(record.id)+'/verify',{csrfToken:session?.csrfToken}); await loadTransparency(); setSelected(r.data.record); notify('Verification check completed: '+labelStatus(r.data.record.status)); }
    catch(e){setError(messageOf(e));await loadTransparency();}
  }
  async function voidRecord(record:AidRecord) {
    if(!voidReason.trim()){setError('Provide a reason before voiding this record.');return;}
    try {await api.post('/api/records/'+encodeURIComponent(record.id)+'/void',{csrfToken:session?.csrfToken,reason:voidReason.trim()});setVoidReason('');setSelected(null);await loadTransparency();notify('Record voided; it remains visible with an audit event.');}
    catch(e){setError(messageOf(e));}
  }
  async function editRecord(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!selected||!session)return;
    try {const r=await api.put('/api/records/'+encodeURIComponent(selected.id),{csrfToken:session.csrfToken,recipient:selected.recipient,recipientAddress:selected.recipientAddress,purpose:selected.purpose,amount:selected.amount,asset:selected.asset,assetIssuer:selected.assetIssuer||'',network:selected.network,txHash:selected.txHash,date:selected.date,note:selected.note});setSelected(r.data.record);await loadTransparency();notify('Record updated and audit-logged.');}
    catch(e){setError(messageOf(e));}
  }
  async function saveRole() {
    if(!session)return;
    try {await api.post('/api/admin/roles',{csrfToken:session.csrfToken,address:roleAddress.trim(),role:roleValue});setRoleAddress('');await loadRoles();await loadAudit();notify('Wallet role updated and audit-logged.');}
    catch(e){setError(messageOf(e));}
  }
  async function removeRole(address:string) {
    if(!session||!window.confirm('Remove the explicit role for '+short(address)+'? It will fall back to Donor.'))return;
    try {await api.delete('/api/admin/roles/'+encodeURIComponent(address),{csrfToken:session.csrfToken});await loadRoles();await loadAudit();notify('Wallet role removed and audit-logged.');}
    catch(e){setError(messageOf(e));}
  }

  const filteredAid=useMemo(()=>{
    const rows=records.filter(r=>[r.recipient,r.recipientAddress,r.purpose,r.txHash,r.organization,r.organizationName||'',r.asset].join(' ').toLowerCase().includes(search.toLowerCase())
      &&(orgFilter==='all'||r.organization===orgFilter)&&(assetFilter==='all'||r.asset===assetFilter)&&(networkFilter==='all'||r.network===networkFilter)&&(statusFilter==='all'||r.status===statusFilter)
      &&(!fromDate||r.date>=fromDate)&&(!toDate||r.date<=toDate));
    return rows.sort((a,b)=>{let av='',bv='';if(sortBy==='amount'){av=a.amount;bv=b.amount;}else if(sortBy==='organization'){av=a.organizationName||a.organization;bv=b.organizationName||b.organization;}else{av=a[sortBy as 'date'|'recipient'|'purpose']||'';bv=b[sortBy as 'date'|'recipient'|'purpose']||'';}const cmp=sortBy==='amount'?Number(av)-Number(bv):String(av).localeCompare(String(bv));return sortDir==='asc'?cmp:-cmp;});
  },[records,search,orgFilter,assetFilter,networkFilter,statusFilter,fromDate,toDate,sortBy,sortDir]);
  const filteredActivity=useMemo(()=>activity.filter(a=>[a.hash,a.type,a.asset,a.counterparty].join(' ').toLowerCase().includes(search.toLowerCase())&&(activityType==='all'||a.type===activityType)&&(!activityFrom||a.date.slice(0,10)>=activityFrom)&&(!activityTo||a.date.slice(0,10)<=activityTo)),[activity,search,activityType,activityFrom,activityTo]);
  const filteredAudit=useMemo(()=>audit.filter(a=>(auditAction==='all'||a.action===auditAction)&&[a.summary,a.address,a.recordId||''].join(' ').toLowerCase().includes(auditSearch.toLowerCase())),[audit,auditAction,auditSearch]);
  const organizations=useMemo(()=>Array.from(new Set(records.map(r=>r.organization).filter(Boolean))),[records]);
  const assets=useMemo(()=>Array.from(new Set(records.map(r=>r.asset))),[records]);
  const verified=records.filter(r=>r.status==='verified'&&!r.voidedAt);