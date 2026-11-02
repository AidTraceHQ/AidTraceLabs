import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { getNetwork, isConnected, requestAccess, signMessage } from '@stellar/freighter-api';
import {
  networkPassphrase,
  signatureToBase64,
  throwFreighterError,
  waitForFreighter,
} from './freighter';
import { readNetworkPreference, writeNetworkPreference } from './network-preference';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Copy,
  ExternalLink,
  FileClock,
  HeartHandshake,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import './fullstack.css';

type Network = 'testnet' | 'mainnet';
type Role = 'donor' | 'organization' | 'beneficiary' | 'admin';
type Verification = 'verified' | 'mismatch' | 'not-found' | 'unverified' | 'pending' | 'voided';
type LedgerTotal = { status: Verification; asset: string; amount: string };
type Session = {
  address: string;
  network: Network;
  role: Role;
  expiresAt: string;
  csrfToken: string;
};
type AidRecord = {
  id: string;
  recipient: string;
  recipientAddress: string;
  purpose: string;
  amount: string;
  asset: string;
  assetIssuer?: string;
  network: Network;
  txHash: string;
  date: string;
  note: string;
  status: Verification;
  organization: string;
  organizationName?: string;
  createdAt: string;
  createdBy: string;
  recipientConsent?: boolean;
  verification?: {
    status: Verification;
    checkedAt: string;
    differences: string[];
    ledger?: number;
    createdAt?: string;
    destination?: string;
    amount?: string;
    asset?: string;
    assetIssuer?: string;
    link?: string;
    reason?: string;
  };
  voidReason?: string;
  voidedAt?: string;
};
type ActivityItem = {
  id: string;
  hash: string;
  date: string;
  type: string;
  amount: string;
  asset: string;
  counterparty: string;
  status: string;
  network: Network;
  publishedRecord?: AidRecord;
};
type AuditItem = {
  id: string;
  action: string;
  summary: string;
  address: string;
  recordId?: string;
  createdAt: string;
};
const horizon: Record<Network, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};
const explorer = (network: Network, hash: string) =>
  (network === 'mainnet'
    ? 'https://stellar.expert/explorer/public/tx/'
    : 'https://stellar.expert/explorer/testnet/tx/') + encodeURIComponent(hash);
const short = (value: string, left = 7, right = 5) =>
  value && value.length > left + right + 1
    ? value.slice(0, left) + '…' + value.slice(-right)
    : value || '—';
const formatAmount = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole || '0').toLocaleString() + (fraction ? '.' + fraction : '');
};
const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const labelStatus = (status: Verification) =>
  ({
    verified: 'Verified on-chain',
    mismatch: 'Mismatch',
    'not-found': 'Not found',
    unverified: 'Unverified',
    pending: 'Checking…',
    voided: 'Voided',
  })[status] || 'Unverified';
const isAddress = (value: string) => /^G[A-Z2-7]{55}$/.test(value);
const SkeletonRows = ({ columns = 6 }: { columns?: number }) => (
  <>
    {[0, 1, 2, 3, 4].map((row) => (
      <tr key={row} aria-hidden="true">
        {Array.from({ length: columns }, (_, col) => (
          <td key={col}>
            <span className="skeleton" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [network, setNetwork] = useState<Network>(readNetworkPreference);
  const [page, setPage] = useState<'transparency' | 'activity' | 'beneficiary' | 'admin'>(
    'transparency',
  );
  const [records, setRecords] = useState<AidRecord[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<string[]>([]);
  const [assetOptions, setAssetOptions] = useState<string[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState<LedgerTotal[]>([]);
  const [beneficiaryRecords, setBeneficiaryRecords] = useState<AidRecord[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [auditActionOptions, setAuditActionOptions] = useState<string[]>([]);
  const [roles, setRoles] = useState<
    { address: string; role: Role; updatedAt: string; updatedBy: string }[]
  >([]);
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
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activityType, setActivityType] = useState('all');
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [activityStream, setActivityStream] = useState<
    'connecting' | 'live' | 'polling' | 'offline'
  >('offline');
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState<AidRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    recipient: '',
    recipientAddress: '',
    purpose: '',
    amount: '',
    asset: 'USDC',
    assetIssuer: '',
    network,
    txHash: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
    recipientConsent: false,
  });
  const [roleAddress, setRoleAddress] = useState('');
  const [roleValue, setRoleValue] = useState<Role>('organization');
  const [auditAction, setAuditAction] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const pageSize = 10;
  const transparencyRequestId = useRef(0);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 3600);
  }, []);
  const loadTransparency = useCallback(async () => {
    const requestId = ++transparencyRequestId.current;
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (orgFilter !== 'all') params.set('organization', orgFilter);
    if (assetFilter !== 'all') params.set('asset', assetFilter);
    if (networkFilter !== 'all') params.set('network', networkFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const query = params.toString();
    setLoading(true);
    try {
      const result = await api.getAllPages<AidRecord>(
        '/api/transparency' + (query ? '?' + query : ''),
        'records',
      );
      if (requestId === transparencyRequestId.current) {
        setRecords(result.data.records || []);
        setOrganizationOptions(result.data.facets?.organizations || []);
        setAssetOptions(result.data.facets?.assets || []);
        setLedgerTotals(result.data.summary?.byStatus || []);
      }
    } catch (e) {
      if (requestId === transparencyRequestId.current) setError(messageOf(e));
    } finally {
      if (requestId === transparencyRequestId.current) setLoading(false);
    }
  }, [search, orgFilter, assetFilter, networkFilter, statusFilter, fromDate, toDate]);
  const loadBeneficiaryRecords = useCallback(async () => {
    try {
      const result = await api.getAllPages<AidRecord>('/api/beneficiary', 'records');
      setBeneficiaryRecords(result.data.records || []);
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  function chooseNetwork(value: string) {
    if (value !== 'testnet' && value !== 'mainnet') return;
    setNetwork(value);
    writeNetworkPreference(value);
  }
  const loadAudit = useCallback(async () => {
    if (!session || session.role !== 'admin') return;
    const params = new URLSearchParams();
    if (auditAction !== 'all') params.set('action', auditAction);
    if (auditSearch.trim()) params.set('q', auditSearch.trim());
    const query = params.toString();
    try {
      const r = await api.getAllPages<AuditItem>(
        '/api/audit' + (query ? '?' + query : ''),
        'entries',
      );
      setAudit(r.data.entries || []);
      setAuditActionOptions(r.data.facets?.actions || []);
    } catch (e) {
      setError(messageOf(e));
    }
  }, [session, auditAction, auditSearch]);
  const restoreSession = useCallback(async () => {
    try {
      const r = await api.get<{ session: Session | null }>('/api/me');
      const restored = r.data.session;
      setSession(restored);
    } catch (e) {
      setSession(null);
      setError(messageOf(e));
    }
  }, []);
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadTransparency(), 200);
    return () => window.clearTimeout(timer);
  }, [loadTransparency]);
  useEffect(() => {
    if (session?.role === 'admin') {
      void loadAudit();
      void loadRoles();
    }
  }, [session, loadAudit]);
  useEffect(() => {
    if (page === 'beneficiary' && session) void loadBeneficiaryRecords();
  }, [page, session, loadBeneficiaryRecords]);
  async function loadRoles() {
    try {
      const r = await api.getAllPages<{
        address: string;
        role: Role;
        updatedAt: string;
        updatedBy: string;
      }>('/api/admin/roles', 'roles');
      setRoles(r.data.roles || []);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const loadActivity = useCallback(
    async (address: string, selectedNetwork: Network) => {
      setActivityLoading(true);
      try {
        const base = horizon[selectedNetwork];
        const [accountRes, paymentsRes, txRes] = await Promise.all([
          fetch(base + '/accounts/' + encodeURIComponent(address), {
            headers: { Accept: 'application/json' },
          }),
          fetch(
            base + '/accounts/' + encodeURIComponent(address) + '/payments?order=desc&limit=50',
            { headers: { Accept: 'application/json' } },
          ),
          fetch(
            base +
              '/accounts/' +
              encodeURIComponent(address) +
              '/transactions?order=desc&limit=50&include_failed=true',
            { headers: { Accept: 'application/json' } },
          ),
        ]);
        if (accountRes.status === 404)
          throw new Error(
            'Wallet account not found on ' +
              selectedNetwork +
              '. Switch network or fund the Testnet account.',
          );
        if (!accountRes.ok || !paymentsRes.ok || !txRes.ok)
          throw new Error('Horizon is unavailable. Your records are safe; activity will retry.');
        const account = (await accountRes.json()) as {
          balances?: { asset_type: string; balance: string }[];
        };
        const payments = (await paymentsRes.json()) as {
          _embedded?: { records?: Record<string, unknown>[] };
        };
        const txs = (await txRes.json()) as { _embedded?: { records?: Record<string, unknown>[] } };
        setBalance(account.balances?.find((b) => b.asset_type === 'native')?.balance || '0');
        const published = records.filter((r) => r.network === selectedNetwork && r.txHash);
        const payItems: ActivityItem[] = (payments._embedded?.records || []).map((p, i) => {
          const hash = String(p.transaction_hash || '');
          const source = String(p.from || p.source_account || '');
          const dest = String(p.to || '');
          const sent = source === address;
          const code = p.asset_type === 'native' ? 'XLM' : String(p.asset_code || 'Unknown');
          return {
            id: String(p.id || hash + i),
            hash,
            date: String(p.created_at || ''),
            type: sent ? 'sent' : 'received',
            amount: String(p.amount || '—'),
            asset: code,
            counterparty: short(sent ? dest : source),
            status: 'Successful',
            network: selectedNetwork,
            publishedRecord: published.find((r) => r.txHash === hash),
          };
        });
        const hashes = new Set(payItems.map((p) => p.hash));
        const txItems: ActivityItem[] = (txs._embedded?.records || [])
          .filter((t) => !hashes.has(String(t.hash || '')))
          .map((t, i) => ({
            id: String(t.id || t.hash || i),
            hash: String(t.hash || ''),
            date: String(t.created_at || ''),
            type: 'transaction',
            amount: '—',
            asset: '—',
            counterparty: short(String(t.source_account || '')),
            status: t.successful ? 'Successful' : 'Failed',
            network: selectedNetwork,
          }));
        setActivity(
          [...payItems, ...txItems]
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
            .slice(0, 100),
        );
        setError('');
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setActivityLoading(false);
      }
    },
    [records],
  );

  useEffect(() => {
    if (!session) {
      setActivity([]);
      setBalance('0');
      setActivityStream('offline');
      return;
    }
    let source: EventSource | null = null;
    let pollTimer: number | undefined;
    let closed = false;
    setActivityStream('connecting');
    const startPolling = () => {
      if (closed) return;
      setActivityStream('polling');
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => void loadActivity(session.address, network), 30000);
    };
    void loadActivity(session.address, network);
    try {
      source = new EventSource(
        horizon[network] +
          '/accounts/' +
          encodeURIComponent(session.address) +
          '/payments?cursor=now',
      );
      source.onopen = () => {
        setActivityStream('live');
        if (pollTimer) {
          window.clearInterval(pollTimer);
          pollTimer = undefined;
        }
      };
      source.onmessage = (event) => {
        try {
          const payment = JSON.parse(event.data) as { transaction_hash?: string };
          if (payment.transaction_hash) void loadActivity(session.address, network);
        } catch {
          /* Ignore malformed stream frames and keep listening. */
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        startPolling();
      };
    } catch {
      startPolling();
    }
    return () => {
      closed = true;
      source?.close();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [session, network, loadActivity]);

  async function connectWallet() {
    setBusy(true);
    setError('');
    try {
      await waitForFreighter(isConnected);
      const access = await requestAccess();
      throwFreighterError(access);
      const address = access.address;
      if (!address || !isAddress(address))
        throw new Error('Freighter did not return a valid Stellar public address.');
      const walletNetwork = await getNetwork();
      throwFreighterError(walletNetwork);
      const currentNetwork = String(walletNetwork.network || '').toLowerCase();
      const walletNet = currentNetwork.includes('test')
        ? 'testnet'
        : currentNetwork === 'public' || currentNetwork === 'mainnet'
          ? 'mainnet'
          : null;
      if (!walletNet)
        throw new Error(
          'Freighter returned an unsupported network: ' + (walletNetwork.network || 'unknown'),
        );
      if (walletNet !== network)
        throw new Error(
          'Wrong network: AidTrace is on ' +
            network +
            ' but Freighter is on ' +
            walletNet +
            '. Switch one network and reconnect.',
        );
      const challenge = await api.post<{ message: string; challengeId: string }>(
        '/api/auth/challenge',
        { address, network },
      );
      const signed = await signMessage(challenge.data.message, {
        address,
        networkPassphrase: networkPassphrase(network),
      });
      throwFreighterError(signed);
      if (signed.signerAddress !== address)
        throw new Error('The challenge was signed by a different wallet.');
      const signature = signatureToBase64(signed.signedMessage);
      const verified = await api.post<{ session: Session }>('/api/auth/verify', {
        challengeId: challenge.data.challengeId,
        address,
        network,
        signature,
      });
      setSession(verified.data.session);
      notify('Wallet ownership verified.');
      await loadTransparency();
    } catch (e) {
      const msg = messageOf(e);
      setError(
        /expired or already used/i.test(msg)
          ? 'Challenge expired. Reconnect to request a fresh five-minute challenge.'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }
  async function disconnect(everywhere = false) {
    try {
      await api.post(everywhere ? '/api/auth/logout-everywhere' : '/api/auth/logout', {
        csrfToken: session?.csrfToken,
      });
      setSession(null);
      setActivity([]);
      setSelected(null);
      setPage('transparency');
      await loadTransparency();
      notify(everywhere ? 'All sessions for this wallet were signed out.' : 'Wallet disconnected.');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function copyAddress() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.address);
      notify('Public address copied.');
    } catch {
      setError('Clipboard is unavailable. Select the public address to copy it.');
    }
  }
  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setError('Connect your wallet first.');
      return;
    }
    if (
      !form.recipient.trim() ||
      !form.purpose.trim() ||
      !Number.isFinite(Number(form.amount)) ||
      Number(form.amount) <= 0
    ) {
      setError('Enter a recipient, purpose and positive amount.');
      return;
    }
    if (!isAddress(form.recipientAddress)) {
      setError('Enter the beneficiary Stellar public address (G…).');
      return;
    }
    if (form.txHash && !/^[0-9a-fA-F]{64}$/.test(form.txHash.trim())) {
      setError('A Stellar transaction hash must contain exactly 64 hexadecimal characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/api/records', {
        ...form,
        csrfToken: session.csrfToken,
        recipient: form.recipient.trim(),
        recipientAddress: form.recipientAddress.trim(),
        purpose: form.purpose.trim(),
        amount: String(form.amount),
        txHash: form.txHash.trim(),
        note: form.note.trim(),
      });
      setShowForm(false);
      setForm({
        ...form,
        recipient: '',
        recipientAddress: '',
        purpose: '',
        amount: '',
        txHash: '',
        note: '',
        recipientConsent: false,
      });
      await loadTransparency();
      notify('Disbursement saved and audit-logged.');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function verifyRecord(record: AidRecord) {
    setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'pending' } : r)));
    try {
      const r = await api.post<{ record: AidRecord }>(
        '/api/records/' + encodeURIComponent(record.id) + '/verify',
        { csrfToken: session?.csrfToken },
      );
      await loadTransparency();
      setSelected(r.data.record);
      notify('Verification check completed: ' + labelStatus(r.data.record.status));
    } catch (e) {
      setError(messageOf(e));
      await loadTransparency();
    }
  }
  async function voidRecord(record: AidRecord) {
    if (!voidReason.trim()) {
      setError('Provide a reason before voiding this record.');
      return;
    }
    try {
      await api.post('/api/records/' + encodeURIComponent(record.id) + '/void', {
        csrfToken: session?.csrfToken,
        reason: voidReason.trim(),
      });
      setVoidReason('');
      setSelected(null);
      await loadTransparency();
      notify('Record voided; it remains visible with an audit event.');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function editRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !session) return;
    try {
      const r = await api.put<{ record: AidRecord }>(
        '/api/records/' + encodeURIComponent(selected.id),
        {
          csrfToken: session.csrfToken,
          recipient: selected.recipient,
          recipientAddress: selected.recipientAddress,
          purpose: selected.purpose,
          amount: selected.amount,
          asset: selected.asset,
          assetIssuer: selected.assetIssuer || '',
          network: selected.network,
          txHash: selected.txHash,
          date: selected.date,
          note: selected.note,
          recipientConsent: selected.recipientConsent === true,
        },
      );
      setSelected(r.data.record);
      await loadTransparency();
      notify('Record updated and audit-logged.');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function saveRole() {
    if (!session) return;
    try {
      await api.post('/api/admin/roles', {
        csrfToken: session.csrfToken,
        address: roleAddress.trim(),
        role: roleValue,
      });
      setRoleAddress('');
      await loadRoles();
      await loadAudit();
      notify('Wallet role updated and audit-logged.');
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function removeRole(address: string) {
    if (
      !session ||
      !window.confirm(
        'Remove the explicit role for ' + short(address) + '? It will fall back to Donor.',
      )
    )
      return;
    try {
      await api.delete('/api/admin/roles/' + encodeURIComponent(address), {
        csrfToken: session.csrfToken,
      });
      await loadRoles();
      await loadAudit();
      notify('Wallet role removed and audit-logged.');
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const filteredAid = useMemo(() => {
    const rows = records.filter(
      (r) =>
        [r.id, r.purpose, r.organization, r.organizationName || '']
          .join(' ')
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (orgFilter === 'all' || r.organization === orgFilter) &&
        (assetFilter === 'all' || r.asset === assetFilter) &&
        (networkFilter === 'all' || r.network === networkFilter) &&
        (statusFilter === 'all' || r.status === statusFilter) &&
        (!fromDate || r.date >= fromDate) &&
        (!toDate || r.date <= toDate),
    );
    return rows.sort((a, b) => {
      const av =
        sortBy === 'amount'
          ? a.amount
          : sortBy === 'organization'
            ? a.organizationName || a.organization
            : a[sortBy as 'date' | 'recipient' | 'purpose'] || '';
      const bv =
        sortBy === 'amount'
          ? b.amount
          : sortBy === 'organization'
            ? b.organizationName || b.organization
            : b[sortBy as 'date' | 'recipient' | 'purpose'] || '';
      const cmp =
        sortBy === 'amount' ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    records,
    search,
    orgFilter,
    assetFilter,
    networkFilter,
    statusFilter,
    fromDate,
    toDate,
    sortBy,
    sortDir,
  ]);
  const filteredActivity = useMemo(
    () =>
      activity.filter(
        (a) =>
          [a.hash, a.type, a.asset, a.counterparty]
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (activityType === 'all' || a.type === activityType) &&
          (!activityFrom || a.date.slice(0, 10) >= activityFrom) &&
          (!activityTo || a.date.slice(0, 10) <= activityTo),
      ),
    [activity, search, activityType, activityFrom, activityTo],
  );
  const filteredAudit = useMemo(
    () =>
      audit.filter(
        (a) =>
          (auditAction === 'all' || a.action === auditAction) &&
          [a.summary, a.address, a.recordId || '']
            .join(' ')
            .toLowerCase()
            .includes(auditSearch.toLowerCase()),
      ),
    [audit, auditAction, auditSearch],
  );
  const verified = records.filter((r) => r.status === 'verified' && !r.voidedAt);
  const pageCount = Math.max(1, Math.ceil(filteredAid.length / pageSize));
  const visibleAid = filteredAid.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  const verifiedTotals = ledgerTotals.filter((total) => total.status === 'verified');
  const otherStatusTotals = ledgerTotals
    .filter((total) => total.status !== 'verified')
    .map((total) => `${labelStatus(total.status)}: ${formatAmount(total.amount)} ${total.asset}`);
  const canManageRecords = session?.role === 'organization' || session?.role === 'admin';
  const canVoidSelected =
    !!selected &&
    !!session &&
    (session.role === 'admin' ||
      (session.role === 'organization' && selected.organization === session.address));
  const selectedDifferences = selected?.verification?.differences || [];
  useEffect(() => {
    setPageNumber(1);
  }, [search, orgFilter, assetFilter, networkFilter, statusFilter, fromDate, toDate]);

  function sortRecords(field: string) {
    if (sortBy === field) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortDir('asc');
    }
  }
  function exportCsv() {
    const columns = [
      'recipient',
      'recipientAddress',
      'purpose',
      'amount',
      'asset',
      'network',
      'txHash',
      'date',
      'organization',
      'status',
    ];
    const escape = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = [
      columns.join(','),
      ...filteredAid.map((record) =>
        columns.map((column) => escape(record[column as keyof AidRecord])).join(','),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aidtrace-records.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`app${dark ? ' dark' : ''}`}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setPage('transparency');
          }}
        >
          <span className="mark">
            <HeartHandshake size={20} />
          </span>
          <span>
            <strong>AidTrace</strong>
            <small>STELLAR AID TRANSPARENCY</small>
          </span>
        </a>
        <div className="top-actions">
          <label className="network-picker">
            Network
            <select
              aria-label="Stellar network"
              value={network}
              onChange={(event) => chooseNetwork(event.target.value)}
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </label>
          <button
            className="icon-button"
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {session ? (
            <>
              <span className="wallet-chip" title={session.address}>
                <Wallet size={13} />
                {short(session.address)}
              </span>
              <button
                className="icon-button"
                aria-label="Copy wallet address"
                title="Copy wallet address"
                onClick={() => void copyAddress()}
              >
                <Copy size={14} />
              </button>
              <span className="role-pill">{session.role}</span>
              <button className="button secondary compact" onClick={() => void disconnect()}>
                <LogOut size={14} />
                Sign out
              </button>
              <button className="button secondary compact" onClick={() => void disconnect(true)}>
                Sign out everywhere
              </button>
            </>
          ) : (
            <button className="button primary" disabled={busy} onClick={() => void connectWallet()}>
              <Wallet size={15} />
              {busy ? 'Connecting…' : 'Connect Freighter'}
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">
            <ShieldCheck size={14} /> TRANSPARENT AID. PUBLIC EVIDENCE.
          </p>
          <h1>
            Trust, backed by <em>verifiable records.</em>
          </h1>
          <p>
            Explore aid disbursements and compare published details with public Stellar payment
            evidence. A verified payment confirms the transaction fields—not the real-world use of
            funds.
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              onClick={() =>
                document.getElementById('public-ledger')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              <ArrowDownToLine size={15} />
              Explore public records
            </button>
            {!session && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void connectWallet()}
              >
                <Wallet size={15} />
                Connect a wallet
              </button>
            )}
          </div>
          <div className="security-note">
            <ShieldCheck size={16} />
            <span>
              <b>Wallet safety:</b> AidTrace only requests a signed login challenge. It never asks
              for a seed phrase or submits payments.
            </span>
          </div>
        </section>

        {error && (
          <div className="alert error" role="alert">
            <CircleAlert size={16} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        <nav className="tabs" aria-label="AidTrace sections">
          <button
            className={`tab${page === 'transparency' ? ' active' : ''}`}
            onClick={() => setPage('transparency')}
          >
            Public Transparency
          </button>
          {session && (
            <button
              className={`tab${page === 'activity' ? ' active' : ''}`}
              onClick={() => setPage('activity')}
            >
              My Activity
            </button>
          )}
          {session && (session.role === 'beneficiary' || session.role === 'admin') && (
            <button
              className={`tab${page === 'beneficiary' ? ' active' : ''}`}
              onClick={() => setPage('beneficiary')}
            >
              Beneficiary Records
            </button>
          )}
          {session?.role === 'admin' && (
            <button
              className={`tab${page === 'admin' ? ' active' : ''}`}
              onClick={() => setPage('admin')}
            >
              Administration
            </button>
          )}
        </nav>

        {page === 'transparency' && (
          <section className="panel" id="public-ledger">
            <div className="section-head">
              <div>
                <p className="eyebrow">PUBLIC LEDGER</p>
                <h2>Published aid records</h2>
                <p>
                  Records are public. Verified means the payment fields matched a successful Stellar
                  transaction.
                </p>
              </div>
              <div className="section-actions">
                <button
                  className="button secondary compact"
                  onClick={() => void loadTransparency()}
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
                <button
                  className="button secondary compact"
                  onClick={exportCsv}
                  disabled={!filteredAid.length}
                >
                  <ArrowDownToLine size={14} />
                  Export CSV
                </button>
                {canManageRecords && (
                  <button className="button primary compact" onClick={() => setShowForm(true)}>
                    <Plus size={14} />
                    Add record
                  </button>
                )}
              </div>
            </div>
            <div className="summary-grid">
              <article>
                <span>Published records</span>
                <b>{records.length}</b>
                <small>Records matching the active filters</small>
              </article>
              <article>
                <span>Verified on-chain</span>
                <b>{verified.length}</b>
                <small>Successful transaction and matching payment fields</small>
              </article>
              <article>
                <span>Organizations</span>
                <b>{organizationOptions.length}</b>
                <small>Wallets that published records</small>
              </article>
              <article>
                <span>Disbursed by asset (verified only)</span>
                <b>
                  {verifiedTotals
                    .map((total) => `${formatAmount(total.amount)} ${total.asset}`)
                    .join(' · ') || '—'}
                </b>
                <small>Only verified records are included in this total.</small>
                {otherStatusTotals.length > 0 && (
                  <small>Other statuses (excluded): {otherStatusTotals.join(' · ')}</small>
                )}
              </article>
            </div>
            <div className="toolbar filters">
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search records"
                  placeholder="Search purpose, organization or record"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPageNumber(1);
                  }}
                />
              </label>
              <select
                aria-label="Filter organization"
                value={orgFilter}
                onChange={(event) => setOrgFilter(event.target.value)}
              >
                <option value="all">All organizations</option>
                {organizationOptions.map((org) => (
                  <option key={org} value={org}>
                    {short(org)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter asset"
                value={assetFilter}
                onChange={(event) => setAssetFilter(event.target.value)}
              >
                <option value="all">All assets</option>
                {assetOptions.map((asset) => (
                  <option key={asset}>{asset}</option>
                ))}
              </select>
              <select
                aria-label="Filter network"
                value={networkFilter}
                onChange={(event) => setNetworkFilter(event.target.value)}
              >
                <option value="all">All networks</option>
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {(
                  [
                    'verified',
                    'mismatch',
                    'not-found',
                    'unverified',
                    'pending',
                    'voided',
                  ] as Verification[]
                ).map((status) => (
                  <option key={status} value={status}>
                    {labelStatus(status)}
                  </option>
                ))}
              </select>
              <label className="date-filter">
                From
                <input
                  aria-label="From date"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>
              <label className="date-filter">
                To
                <input
                  aria-label="To date"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button className="sort-button" onClick={() => sortRecords('recipient')}>
                        RECIPIENT
                      </button>
                    </th>
                    <th>
                      <button className="sort-button" onClick={() => sortRecords('purpose')}>
                        PURPOSE
                      </button>
                    </th>
                    <th>
                      <button className="sort-button" onClick={() => sortRecords('amount')}>
                        AMOUNT
                      </button>
                    </th>
                    <th>NETWORK</th>
                    <th>
                      <button className="sort-button" onClick={() => sortRecords('date')}>
                        DATE
                      </button>
                    </th>
                    <th>STATUS</th>
                    <th>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows columns={7} />
                  ) : (
                    visibleAid.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.recipient}</strong>
                          <small className="subcell">{short(record.recipientAddress)}</small>
                        </td>
                        <td>{record.purpose}</td>
                        <td>
                          {record.amount} {record.asset}
                        </td>
                        <td>{record.network}</td>
                        <td>{record.date}</td>
                        <td>
                          <span className={`status ${record.status}`}>
                            <i />
                            {labelStatus(record.status)}
                          </span>
                        </td>
                        <td>
                          <button className="text-button" onClick={() => setSelected(record)}>
                            View <ArrowUpRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && !visibleAid.length && (
              <div className="empty-state">
                <Search size={22} />
                <b>No records match these filters</b>
                <p>Try changing or clearing the search and filter values.</p>
              </div>
            )}
            <div className="pagination">
              <span>
                {filteredAid.length
                  ? `Showing ${(pageNumber - 1) * pageSize + 1}–${Math.min(pageNumber * pageSize, filteredAid.length)} of ${filteredAid.length}`
                  : 'No records'}
              </span>
              <div>
                <button
                  className="button secondary compact"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {pageNumber} of {pageCount}
                </span>
                <button
                  className="button secondary compact"
                  disabled={pageNumber >= pageCount}
                  onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
                >
                  Next
                </button>
              </div>
            </div>
            <p className="panel-foot">
              A transaction hash alone does not establish impact. Review the on-chain evidence and
              publish identifying information only with appropriate consent.
            </p>
          </section>
        )}

        {page === 'activity' && session && (
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">CONNECTED WALLET</p>
                <h2>My Stellar activity</h2>
                <p>Your activity is loaded from the selected public Horizon network.</p>
              </div>
              <div className={`stream-status ${activityStream}`}>
                <span className="live-dot" />
                {activityStream === 'live'
                  ? 'Live stream'
                  : activityStream === 'polling'
                    ? 'Polling fallback'
                    : activityStream === 'connecting'
                      ? 'Connecting'
                      : 'Offline'}
              </div>
            </div>
            <div className="activity-stats">
              <span>
                Wallet <b>{short(session.address)}</b>
              </span>
              <span>
                Network <b>{network}</b>
              </span>
              <span>
                XLM balance <b>{balance} XLM</b>
              </span>
            </div>
            <div className="toolbar">
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search activity"
                  placeholder="Search activity"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="Filter activity type"
                value={activityType}
                onChange={(event) => setActivityType(event.target.value)}
              >
                <option value="all">All activity</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
                <option value="transaction">Other transactions</option>
              </select>
              <label className="date-filter">
                From
                <input
                  type="date"
                  value={activityFrom}
                  onChange={(event) => setActivityFrom(event.target.value)}
                />
              </label>
              <label className="date-filter">
                To
                <input
                  type="date"
                  value={activityTo}
                  onChange={(event) => setActivityTo(event.target.value)}
                />
              </label>
              <button
                className="button secondary compact"
                onClick={() => void loadActivity(session.address, network)}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TYPE</th>
                    <th>AMOUNT</th>
                    <th>COUNTERPARTY</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th>AID RECORD</th>
                    <th>TRANSACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLoading && !activity.length ? (
                    <SkeletonRows columns={7} />
                  ) : (
                    filteredActivity.map((item) => (
                      <tr key={item.id}>
                        <td>{item.type}</td>
                        <td>
                          {item.amount} {item.asset}
                        </td>
                        <td>{item.counterparty}</td>
                        <td>{item.date ? new Date(item.date).toLocaleString() : '—'}</td>
                        <td>{item.status}</td>
                        <td>
                          {item.publishedRecord ? (
                            <button
                              className="text-button"
                              onClick={() => {
                                setPage('transparency');
                                setSelected(item.publishedRecord || null);
                              }}
                            >
                              View record
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {item.hash ? (
                            <a
                              className="explorer-link"
                              href={explorer(item.network, item.hash)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open <ExternalLink size={12} />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!activityLoading && !filteredActivity.length && (
              <div className="empty-state">
                <Activity size={22} />
                <b>No activity found</b>
                <p>There are no matching payments for this wallet and network.</p>
              </div>
            )}
          </section>
        )}

        {page === 'beneficiary' &&
          session &&
          (session.role === 'beneficiary' || session.role === 'admin') && (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">PRIVATE WALLET VIEW</p>
                  <h2>Records for your wallet</h2>
                  <p>Results are scoped by the server to your connected beneficiary address.</p>
                </div>
                <button
                  className="button secondary compact"
                  onClick={() => void loadBeneficiaryRecords()}
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>RECIPIENT</th>
                      <th>PURPOSE</th>
                      <th>AMOUNT</th>
                      <th>DATE</th>
                      <th>STATUS</th>
                      <th>DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiaryRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.recipient}</td>
                        <td>{record.purpose}</td>
                        <td>
                          {record.amount} {record.asset}
                        </td>
                        <td>{record.date}</td>
                        <td>
                          <span className={`status ${record.status}`}>
                            <i />
                            {labelStatus(record.status)}
                          </span>
                        </td>
                        <td>
                          <button className="text-button" onClick={() => setSelected(record)}>
                            View <ArrowUpRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!beneficiaryRecords.length && (
                <div className="empty-state">
                  <HeartHandshake size={22} />
                  <b>No beneficiary records yet</b>
                  <p>Records addressed to this wallet will appear here.</p>
                </div>
              )}
            </section>
          )}

        {page === 'admin' && session?.role === 'admin' && (
          <section className="panel admin-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">ADMINISTRATION</p>
                <h2>Roles and audit history</h2>
                <p>Role changes and record actions are enforced and recorded by the backend.</p>
              </div>
            </div>
            <div className="summary-grid">
              <article>
                <span>Explicit role assignments</span>
                <b>{roles.length}</b>
                <small>Cursor-paginated assignments</small>
              </article>
              <article>
                <span>Recent audit events</span>
                <b>{audit.length}</b>
                <small>Cursor-paginated audit history</small>
              </article>
              <article>
                <span>Connected as</span>
                <b className="role-stat">Admin</b>
                <small>{short(session.address)}</small>
              </article>
              <article>
                <span>Security</span>
                <b>
                  <ShieldCheck size={20} />
                </b>
                <small>Administrative operations are server-authorized</small>
              </article>
            </div>
            <form
              className="role-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveRole();
              }}
            >
              <label>
                Wallet address
                <input
                  value={roleAddress}
                  onChange={(event) => setRoleAddress(event.target.value)}
                  placeholder="G…"
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={roleValue}
                  onChange={(event) => setRoleValue(event.target.value as Role)}
                >
                  <option value="donor">Donor</option>
                  <option value="organization">Organization</option>
                  <option value="beneficiary">Beneficiary</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button className="button primary" type="submit">
                <Plus size={14} />
                Assign role
              </button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>WALLET</th>
                    <th>ROLE</th>
                    <th>UPDATED</th>
                    <th>UPDATED BY</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((item) => (
                    <tr key={item.address}>
                      <td>{short(item.address)}</td>
                      <td>{item.role}</td>
                      <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</td>
                      <td>{short(item.updatedBy)}</td>
                      <td>
                        <button
                          className="text-button danger-text"
                          onClick={() => void removeRole(item.address)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="toolbar">
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search audit log"
                  placeholder="Search audit events"
                  value={auditSearch}
                  onChange={(event) => setAuditSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="Filter audit action"
                value={auditAction}
                onChange={(event) => setAuditAction(event.target.value)}
              >
                <option value="all">All actions</option>
                {auditActionOptions.map((action) => (
                  <option key={action}>{action}</option>
                ))}
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ACTION</th>
                    <th>SUMMARY</th>
                    <th>WALLET</th>
                    <th>RECORD</th>
                    <th>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((item) => (
                    <tr key={item.id}>
                      <td>{item.action}</td>
                      <td>{item.summary}</td>
                      <td>{short(item.address)}</td>
                      <td>{item.recordId || '—'}</td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredAudit.length && (
              <div className="empty-state">
                <FileClock size={22} />
                <b>No audit events found</b>
                <p>Audit events will appear here as users interact with AidTrace.</p>
              </div>
            )}
          </section>
        )}

        <section className="how">
          <h2>How verification works</h2>
          <div className="how-grid">
            <article>
              <span className="mark">
                <Wallet size={17} />
              </span>
              <h3>1. Connect safely</h3>
              <p>
                Sign a one-time challenge to prove wallet ownership. No transaction or secret key is
                requested.
              </p>
            </article>
            <article>
              <span className="mark">
                <BadgeCheck size={17} />
              </span>
              <h3>2. Compare evidence</h3>
              <p>
                The backend checks a successful Stellar transaction and compares the recorded
                payment fields.
              </p>
            </article>
            <article>
              <span className="mark">
                <CheckCircle2 size={17} />
              </span>
              <h3>3. Review the limits</h3>
              <p>
                On-chain matching confirms payment data only; it is not proof of identity or
                real-world impact.
              </p>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-foot">
        AidTrace · Public Stellar payment evidence, not proof of impact.
      </footer>

      {showForm && (
        <div
          className="backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowForm(false);
          }}
        >
          <form className="form modal-large" onSubmit={saveRecord}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">PUBLISH AID RECORD</p>
                <h2>New disbursement</h2>
                <p className="muted">
                  Beneficiary details, notes and transaction links are pseudonymous on the public
                  ledger by default.
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close form"
                onClick={() => setShowForm(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Recipient name
                <input
                  value={form.recipient}
                  onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                  required
                  maxLength={160}
                />
              </label>
              <label>
                Beneficiary Stellar address
                <input
                  value={form.recipientAddress}
                  onChange={(event) => setForm({ ...form, recipientAddress: event.target.value })}
                  required
                  maxLength={56}
                  placeholder="G…"
                />
              </label>
              <label>
                Purpose
                <input
                  value={form.purpose}
                  onChange={(event) => setForm({ ...form, purpose: event.target.value })}
                  required
                  maxLength={240}
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0.0000001"
                  step="0.0000001"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />
              </label>
              <label>
                Asset
                <select
                  value={form.asset === 'XLM' || form.asset === 'USDC' ? form.asset : 'other'}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      asset: event.target.value === 'other' ? '' : event.target.value,
                      assetIssuer: event.target.value === 'XLM' ? '' : form.assetIssuer,
                    })
                  }
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                  <option value="other">Other (enter asset code)</option>
                </select>
              </label>
              {form.asset !== 'XLM' && (
                <label>
                  Asset code
                  <input
                    value={form.asset === 'USDC' ? 'USDC' : form.asset}
                    onChange={(event) =>
                      setForm({ ...form, asset: event.target.value.toUpperCase() })
                    }
                    required
                    maxLength={12}
                  />
                </label>
              )}
              {form.asset !== 'XLM' && (
                <label>
                  Asset issuer
                  <input
                    value={form.assetIssuer}
                    onChange={(event) => setForm({ ...form, assetIssuer: event.target.value })}
                    required
                    placeholder="G…"
                  />
                </label>
              )}
              <label>
                Network
                <select
                  value={form.network}
                  onChange={(event) => setForm({ ...form, network: event.target.value as Network })}
                >
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </label>
              <label>
                Disbursement date
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  required
                />
              </label>
              <label>
                Stellar transaction hash (optional)
                <input
                  value={form.txHash}
                  onChange={(event) => setForm({ ...form, txHash: event.target.value })}
                  maxLength={64}
                  placeholder="64 hexadecimal characters"
                />
              </label>
              <label className="full">
                Note
                <textarea
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  maxLength={500}
                  rows={3}
                />
              </label>
              <label className="full">
                <input
                  type="checkbox"
                  checked={form.recipientConsent}
                  onChange={(event) => setForm({ ...form, recipientConsent: event.target.checked })}
                />{' '}
                I have explicit consent to publish the beneficiary name, wallet address, note and
                transaction link.
              </label>
            </div>
            <p className="form-hint">
              Only a successful payment with a matching organization source, destination, amount and
              asset can be verified on-chain.
            </p>
            <div className="form-actions">
              <button className="button secondary" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy} type="submit">
                <Plus size={14} />
                {busy ? 'Saving…' : 'Publish record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div
          className="backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="form detail-modal modal-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-heading"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">AID RECORD DETAILS</p>
                <h2 id="record-heading">{selected.recipient}</h2>
                <p className="muted">{selected.purpose}</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="detail-list">
              <p>
                <b>Amount</b>
                <span>
                  {selected.amount} {selected.asset}
                  {selected.assetIssuer ? ` · issuer ${short(selected.assetIssuer)}` : ''}
                </span>
              </p>
              <p>
                <b>Beneficiary</b>
                <span>{selected.recipientAddress || 'Pseudonymous by default'}</span>
              </p>
              <p>
                <b>Organization</b>
                <span>{selected.organizationName || selected.organization}</span>
              </p>
              <p>
                <b>Network and date</b>
                <span>
                  {selected.network} · {selected.date}
                </span>
              </p>
              <p>
                <b>Transaction</b>
                <span>
                  {selected.txHash ||
                    (!selected.recipientConsent && selected.verification
                      ? 'Hidden for beneficiary privacy'
                      : 'No transaction hash supplied')}
                </span>
              </p>
              <p>
                <b>Created</b>
                <span>
                  {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'} by{' '}
                  {short(selected.createdBy)}
                </span>
              </p>
              <p>
                <b>Status</b>
                <span className={`status ${selected.status}`}>
                  <i />
                  {labelStatus(selected.status)}
                </span>
              </p>
              {selected.verification?.reason && (
                <p>
                  <b>Verification note</b>
                  <span>{selected.verification.reason}</span>
                </p>
              )}
              {selectedDifferences.length > 0 && (
                <div className="diff-box">
                  {selectedDifferences.map((difference, index) => (
                    <p key={index}>{difference}</p>
                  ))}
                </div>
              )}
              {selected.voidReason && (
                <p>
                  <b>Void reason</b>
                  <span>{selected.voidReason}</span>
                </p>
              )}
            </div>
            <div className="detail-actions">
              {selected.txHash && (
                <a
                  className="explorer-link"
                  href={selected.verification?.link || explorer(selected.network, selected.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Stellar Expert <ExternalLink size={13} />
                </a>
              )}
              <button
                className="button secondary compact"
                onClick={() => void verifyRecord(selected)}
                disabled={!session}
              >
                <RefreshCw size={14} />
                Verify
              </button>
            </div>
            {session &&
              canManageRecords &&
              (session.role === 'admin' || selected.organization === session.address) &&
              !selected.voidedAt && (
                <form className="inline-edit" onSubmit={editRecord}>
                  <h3>Edit record</h3>
                  <label>
                    Recipient
                    <input
                      value={selected.recipient}
                      onChange={(event) =>
                        setSelected({ ...selected, recipient: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Purpose
                    <input
                      value={selected.purpose}
                      onChange={(event) =>
                        setSelected({ ...selected, purpose: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Amount
                    <input
                      type="number"
                      step="0.0000001"
                      value={selected.amount}
                      onChange={(event) => setSelected({ ...selected, amount: event.target.value })}
                    />
                  </label>
                  <label>
                    Transaction hash
                    <input
                      value={selected.txHash}
                      onChange={(event) => setSelected({ ...selected, txHash: event.target.value })}
                    />
                  </label>
                  <label className="full">
                    <input
                      type="checkbox"
                      checked={selected.recipientConsent === true}
                      onChange={(event) =>
                        setSelected({ ...selected, recipientConsent: event.target.checked })
                      }
                    />{' '}
                    I have explicit consent to publish beneficiary details and transaction link.
                  </label>
                  <button className="button primary compact" type="submit">
                    Save changes
                  </button>
                </form>
              )}
            {canVoidSelected && !selected.voidedAt && (
              <form
                className="void-box"
                onSubmit={(event) => {
                  event.preventDefault();
                  void voidRecord(selected);
                }}
              >
                <label>
                  Reason for voiding
                  <textarea
                    value={voidReason}
                    onChange={(event) => setVoidReason(event.target.value)}
                    minLength={5}
                    maxLength={500}
                    rows={2}
                  />
                </label>
                <button className="button danger compact" type="submit">
                  Confirm void
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
