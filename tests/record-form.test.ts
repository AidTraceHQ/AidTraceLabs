import { describe, expect, it } from 'vitest';
import {
  buildRecordPayload,
  chooseRecordFormNetwork,
  createRecordFormState,
  isStellarNetwork,
  openRecordForm,
  resetRecordFormAfterSave,
  resolveRecordFormNetwork,
  updateRecordFormFields,
  type StellarNetwork,
} from '../src/record-form.js';

describe('record form default network', () => {
  it('initializes the form network to mainnet after switching the top-level selector and submits mainnet', () => {
    let selectedNetwork: StellarNetwork = 'testnet';
    let state = createRecordFormState('2026-11-20');

    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');

    selectedNetwork = 'mainnet';
    state = openRecordForm(state);

    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('mainnet');

    state = updateRecordFormFields(state, {
      recipient: '  Clinic Alpha  ',
      recipientAddress: '  GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF  ',
      purpose: '  Medical supplies  ',
      amount: '250.5',
      txHash: '  ' + 'a'.repeat(64) + '  ',
      note: '  First tranche  ',
      recipientConsent: true,
    });

    const payload = buildRecordPayload(state, selectedNetwork, 'csrf-token-1');
    expect(payload.network).toBe('mainnet');
    expect(payload).toEqual({
      recipient: 'Clinic Alpha',
      recipientAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      purpose: 'Medical supplies',
      amount: '250.5',
      asset: 'USDC',
      assetIssuer: '',
      txHash: 'a'.repeat(64),
      date: '2026-11-20',
      note: 'First tranche',
      recipientConsent: true,
      network: 'mainnet',
      csrfToken: 'csrf-token-1',
    });
    expect('networkOverride' in payload).toBe(false);
  });

  it('syncs with top-level network changes while open until the user explicitly chooses a form network', () => {
    let selectedNetwork: StellarNetwork = 'testnet';
    const state = openRecordForm(createRecordFormState('2026-11-20'));
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');

    selectedNetwork = 'mainnet';
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('mainnet');

    selectedNetwork = 'testnet';
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');
  });

  it('preserves an explicit form network choice across unrelated updates and top-level network changes', () => {
    let selectedNetwork: StellarNetwork = 'mainnet';
    let state = openRecordForm(createRecordFormState('2026-11-20'));
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('mainnet');

    state = chooseRecordFormNetwork(state, 'testnet');
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');

    // Simulate typing in unrelated fields / re-rendering while top-level stays mainnet.
    state = updateRecordFormFields(state, { recipient: 'Clinic Beta', amount: '42' });
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');
    expect(buildRecordPayload(state, selectedNetwork, 'csrf-token-override').network).toBe(
      'testnet',
    );

    // Even if the user re-selects the same network as top-level ('mainnet'), that choice is explicit.
    state = chooseRecordFormNetwork(state, 'mainnet');
    expect(chooseRecordFormNetwork(state, 'mainnet')).toBe(state);
    selectedNetwork = 'testnet';
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('mainnet');

    const payload = buildRecordPayload(state, selectedNetwork, 'csrf-token-2');
    expect(payload.network).toBe('mainnet');
  });

  it('resets submitted fields and re-syncs to the selected network after saving', () => {
    const selectedNetwork: StellarNetwork = 'mainnet';
    let state = openRecordForm(createRecordFormState('2026-11-20'));
    state = updateRecordFormFields(state, {
      recipient: 'Clinic Gamma',
      recipientAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      purpose: 'Food aid',
      amount: '100',
      asset: 'EURC',
      assetIssuer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD5B',
      txHash: 'b'.repeat(64),
      note: 'Delivered',
      recipientConsent: true,
    });
    state = chooseRecordFormNetwork(state, 'testnet');
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');

    state = resetRecordFormAfterSave(state);
    expect(state.networkOverride).toBeNull();
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('mainnet');
    expect(state.fields).toEqual({
      recipient: '',
      recipientAddress: '',
      purpose: '',
      amount: '',
      asset: 'EURC',
      assetIssuer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD5B',
      txHash: '',
      date: '2026-11-20',
      note: '',
      recipientConsent: false,
    });
  });

  it('re-initializes to the current selected network on reopen while preserving typed draft fields', () => {
    let selectedNetwork: StellarNetwork = 'testnet';
    let state = openRecordForm(createRecordFormState('2026-11-20'));
    expect(openRecordForm(state)).toBe(state);
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');

    state = updateRecordFormFields(state, { recipient: 'Draft Recipient', purpose: 'Water' });
    state = chooseRecordFormNetwork(state, 'testnet');
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('testnet');

    // User closes the modal without saving, switches top-level to mainnet, and reopens the modal.
    selectedNetwork = 'mainnet';
    state = openRecordForm(state);

    expect(state.fields.recipient).toBe('Draft Recipient');
    expect(state.fields.purpose).toBe('Water');
    expect(state.networkOverride).toBeNull();
    expect(resolveRecordFormNetwork(selectedNetwork, state.networkOverride)).toBe('mainnet');
  });

  it('accepts only supported Stellar network values', () => {
    expect(isStellarNetwork('testnet')).toBe(true);
    expect(isStellarNetwork('mainnet')).toBe(true);
    expect(isStellarNetwork('futurenet')).toBe(false);
    expect(isStellarNetwork('')).toBe(false);
  });
});
