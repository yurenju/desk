interface Entry {
  value: string;
  expiresAt?: number;
}

export function makeKvStub(): KVNamespace {
  const store = new Map<string, Entry>();

  const stub = {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ): Promise<void> {
      const expiresAt =
        options?.expirationTtl !== undefined
          ? Date.now() + options.expirationTtl * 1000
          : undefined;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };

  return new Proxy(stub, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      // Safely ignore standard promise/JSON properties and symbol queries
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") {
        return undefined;
      }
      throw new Error(`Unimplemented KVNamespace property/method accessed: ${String(prop)}`);
    }
  }) as unknown as KVNamespace;
}

