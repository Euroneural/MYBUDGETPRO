// account-manager.js
// Responsible for CRUD operations on user accounts and switching between them.
// Each account has isolated encrypted stores by appending `-<accountId>` suffix to store names.
// The active accountId is persisted in localStorage ('mybudgetpro.activeAccount').
// Emits window event 'account-switched' with detail { accountId } whenever switch occurs.

import { secureDB } from './secure-db.js';
import { localDB } from './local-db.js';

const ACCOUNTS_STORE = 'accounts';
const ACTIVE_KEY = 'mybudgetpro.activeAccount';

export class AccountManager {
  constructor() {
    this.currentAccountId = null;
  }

  async ensureStores(id) {
    // create object stores for this account if they don't exist
    const needed = [`transactions-${id}`, `categories-${id}`, `budgets-${id}`];
    const missing = needed.filter(name => !localDB.db.objectStoreNames.contains(name));
    if (missing.length === 0) return;
    // upgrade version
    const newVersion = localDB.db.version + 1;
    localDB.db.close();
    await new Promise((res, rej) => {
      const req = indexedDB.open(localDB.dbName, newVersion);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        missing.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            if (storeName.startsWith('transactions-')) {
              store.createIndex('date', 'date', { unique: false });
              store.createIndex('category', 'category', { unique: false });
            }
            if (storeName.startsWith('categories-')) {
              store.createIndex('name', 'name', { unique: true });
            }
            if (storeName.startsWith('budgets-')) {
              store.createIndex('month', 'month', { unique: true });
            }
          }
        });
      };
      req.onsuccess = e => {
        localDB.db = e.target.result;
        res();
      };
      req.onerror = e => rej(e.target.error);
    });
  }

  async init() {
    // Ensure base store exists (no account suffix).
    await secureDB.addItem(ACCOUNTS_STORE, { id: 'init', name: 'init', created: Date.now() }).catch(()=>{});
    // Remove dummy if existed
    await secureDB.deleteItem(ACCOUNTS_STORE, 'init').catch(()=>{});

    // Load or create default account
    const stored = localStorage.getItem(ACTIVE_KEY);
    const accounts = await this.listAccounts();
    if (stored && accounts.find(a => a.id === stored)) {
      await this.switchAccount(stored);
    } else if (accounts.length) {
      await this.switchAccount(accounts[0].id);
    }
  }

  async listAccounts() {
    const all = await secureDB.getAllItems(ACCOUNTS_STORE);
    return all.filter(Boolean);
  }

  async createAccount(name) {
    const id = crypto.randomUUID();
    const acc = { id, name, created: Date.now() };
    await secureDB.addItem(ACCOUNTS_STORE, acc);
    await this.ensureStores(id);
    await this.switchAccount(id);
    return acc;
  }

  async deleteAccount(id) {
    if (this.currentAccountId === id) throw new Error('Cannot delete active account');
    await secureDB.deleteItem(ACCOUNTS_STORE, id);
    // TODO: optionally clear stores for that account.
  }

  async switchAccount(id) {
    await this.ensureStores(id);
    if (id === this.currentAccountId) return;
    this.currentAccountId = id;
    localStorage.setItem(ACTIVE_KEY, id);
    window.dispatchEvent(new CustomEvent('account-switched', { detail: { accountId: id } }));
  }

  getActiveAccountId() {
    return this.currentAccountId;
  }
}

// Helper producing an account-scoped DB facade.
export function createAccountDB(accountId) {
  let ensurePromise = null;
  async function ensure() {
    if (ensurePromise) return ensurePromise; // already ensuring or in-flight
    ensurePromise = (async () => {
      const needed = [`transactions-${accountId}`, `categories-${accountId}`, `budgets-${accountId}`];
    const missing = needed.filter(name => !localDB.db.objectStoreNames.contains(name));
    if (missing.length===0) return;
    const newVersion = localDB.db.version + 1;
    localDB.db.close();
    await new Promise((res, rej) => {
      const req = indexedDB.open(localDB.dbName, newVersion);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        missing.forEach(storeName=>{
          if(!db.objectStoreNames.contains(storeName)){
            const store=db.createObjectStore(storeName,{keyPath:'id',autoIncrement:true});
            if(storeName.startsWith('transactions-')){
              store.createIndex('date','date',{unique:false});
              store.createIndex('category','category',{unique:false});
            }
            if(storeName.startsWith('categories-')){
              store.createIndex('name','name',{unique:true});
            }
            if(storeName.startsWith('budgets-')){
              store.createIndex('month','month',{unique:true});
            }
          }
        });
      };
      req.onsuccess=e=>{localDB.db=e.target.result;res();};
      req.onerror=e=>rej(e.target.error);
    });
  })();
    return ensurePromise;
  }

  async function withRetry(fn){
    if (ensurePromise) await ensurePromise;
    try{
      return await fn();
    }catch(err){
      if(err.name==='NotFoundError' || err.name==='InvalidStateError'){
        await ensure();
        if (ensurePromise) await ensurePromise;
        return fn();
      }
      throw err;
    }
  }
  function withAccount(store) {
    return `${store}-${accountId}`;
  }
  return {
    ensureStores: ensure,
    addItem: (store, item) => withRetry(()=>secureDB.addItem(withAccount(store), item)),
    getItem: (store, id) => withRetry(()=>secureDB.getItem(withAccount(store), id)),
    updateItem: (store, id, updates) => withRetry(()=>secureDB.updateItem(withAccount(store), id, updates)),
    deleteItem: (store, id) => withRetry(()=>secureDB.deleteItem(withAccount(store), id)),
    getAllItems: (store) => withRetry(()=>secureDB.getAllItems(withAccount(store))),
    queryItems: (store, idx, keyRange) => withRetry(()=>secureDB.queryItems(withAccount(store), idx, keyRange)),
    getTransactions: (filters) => withRetry(()=>secureDB.getTransactions({ ...filters, storeNameSuffix: `-${accountId}` })),
    clearAllTransactions: () => withRetry(()=>secureDB.clearAllTransactions(withAccount('transactions')))
  };
}
