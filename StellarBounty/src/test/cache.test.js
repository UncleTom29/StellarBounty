import { beforeEach, describe, expect, it, vi } from 'vitest';
import cache from '../utils/cache.js';

describe('cache', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('stores and retrieves value', () => {
    cache.set('foo', 'bar');
    expect(cache.get('foo')).toBe('bar');
  });

  it('returns null for missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('expires after TTL', () => {
    vi.useFakeTimers();
    cache.set('soon', 'gone', 1000);

    vi.advanceTimersByTime(1500);
    expect(cache.get('soon')).toBeNull();

    vi.useRealTimers();
  });

  it('del removes specific key', () => {
    cache.set('a', 1);
    cache.del('a');
    expect(cache.get('a')).toBeNull();
  });

  it('bust removes prefix keys only, leaves others intact', () => {
    cache.set('bounties:1', 'one');
    cache.set('bounties:2', 'two');
    cache.set('count', 5);

    cache.bust('bounties');

    expect(cache.get('bounties:1')).toBeNull();
    expect(cache.get('bounties:2')).toBeNull();
    expect(cache.get('count')).toBe(5);
  });
});
