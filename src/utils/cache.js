class TTLCache {
  constructor() {
    this.map = new Map();
  }

  set(key, value, ttl = 15000) {
    this.map.set(key, { v: value, exp: Date.now() + ttl });
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }

    if (entry.exp <= Date.now()) {
      this.map.delete(key);
      return null;
    }

    return entry.v;
  }

  del(key) {
    this.map.delete(key);
  }

  bust(prefix) {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
      }
    }
  }

  clear() {
    this.map.clear();
  }
}

const cache = new TTLCache();

export default cache;
