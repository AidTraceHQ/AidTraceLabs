export type StellarNetwork = 'testnet' | 'mainnet';

export type RecordFormFields = {
  recipient: string;
  recipientAddress: string;
  purpose: string;
  amount: string;
  asset: string;
  assetIssuer: string;
  txHash: string;
  date: string;
  note: string;
  recipientConsent: boolean;
};

export type RecordFormState = {
  fields: RecordFormFields;
  networkOverride: StellarNetwork | null;
};

export type RecordCreatePayload = RecordFormFields & {
  network: StellarNetwork;
  csrfToken: string;
};

/** Return true when `value` is a supported Stellar network option. */
export function isStellarNetwork(value: string): value is StellarNetwork {
  return value === 'testnet' || value === 'mainnet';
}

/** Create the initial empty record form state synced to the selected network. */
export function createRecordFormState(
  date = new Date().toISOString().slice(0, 10),
): RecordFormState {
  return {
    fields: {
      recipient: '',
      recipientAddress: '',
      purpose: '',
      amount: '',
      asset: 'USDC',
      assetIssuer: '',
      txHash: '',
      date,
      note: '',
      recipientConsent: false,
    },
    networkOverride: null,
  };
}

/** Resolve the form's effective network from an explicit override or the app selection. */
export function resolveRecordFormNetwork(
  selectedNetwork: StellarNetwork,
  networkOverride: StellarNetwork | null,
): StellarNetwork {
  return networkOverride ?? selectedNetwork;
}

/** Re-sync a draft form to the selected app network when opening the dialog. */
export function openRecordForm(state: RecordFormState): RecordFormState {
  if (state.networkOverride === null) return state;
  return { ...state, networkOverride: null };
}

/** Record an explicit per-record network choice inside the form. */
export function chooseRecordFormNetwork(
  state: RecordFormState,
  network: StellarNetwork,
): RecordFormState {
  if (state.networkOverride === network) return state;
  return { ...state, networkOverride: network };
}

/** Update non-network draft fields while preserving any explicit network override. */
export function updateRecordFormFields(
  state: RecordFormState,
  patch: Partial<RecordFormFields>,
): RecordFormState {
  return {
    ...state,
    fields: {
      ...state.fields,
      ...patch,
    },
  };
}

/** Reset submitted draft fields and re-enable top-level network sync after saving. */
export function resetRecordFormAfterSave(state: RecordFormState): RecordFormState {
  return {
    fields: {
      ...state.fields,
      recipient: '',
      recipientAddress: '',
      purpose: '',
      amount: '',
      txHash: '',
      note: '',
      recipientConsent: false,
    },
    networkOverride: null,
  };
}

/** Build the `/api/records` request payload using the form's effective network. */
export function buildRecordPayload(
  state: RecordFormState,
  selectedNetwork: StellarNetwork,
  csrfToken: string,
): RecordCreatePayload {
  const { fields, networkOverride } = state;
  return {
    ...fields,
    network: resolveRecordFormNetwork(selectedNetwork, networkOverride),
    csrfToken,
    recipient: fields.recipient.trim(),
    recipientAddress: fields.recipientAddress.trim(),
    purpose: fields.purpose.trim(),
    amount: String(fields.amount),
    txHash: fields.txHash.trim(),
    note: fields.note.trim(),
  };
}
