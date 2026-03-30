import { describe, expect, it } from 'vitest';
import { ET, parseErr } from '../utils/errors.js';

describe('parseErr', () => {
  it('WALLET from not found message', () => {
    expect(parseErr(new Error('wallet not found')).t).toBe(ET.WALLET);
  });

  it('REJECTED from declined message', () => {
    expect(parseErr(new Error('user declined request')).t).toBe(ET.REJECTED);
  });

  it('BALANCE from underfunded message', () => {
    expect(parseErr(new Error('underfunded')).t).toBe(ET.BALANCE);
  });

  it('LIQUIDITY from liquidity message', () => {
    expect(parseErr(new Error('liquidity pool unavailable')).t).toBe(ET.LIQUIDITY);
  });

  it('CONTRACT from simulation message', () => {
    expect(parseErr(new Error('simulation failed')).t).toBe(ET.CONTRACT);
  });

  it('NETWORK as default fallback', () => {
    expect(parseErr(new Error('connection reset')).t).toBe(ET.NETWORK);
  });

  it('handles plain string not Error object', () => {
    expect(parseErr('wallet not installed').t).toBe(ET.WALLET);
  });
});
