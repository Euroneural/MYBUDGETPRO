// Budget Manager: generates & renders auto budget with editing capability
import { generateAutoBudget } from './auto-budget.js';
// Attempt to import localDB for fallback; primary is appInstance.db (secureDB)
import { localDB } from './local-db.js';
const { format } = window.dateFns;
const addMonths = window.dateFns && window.dateFns.addMonths ? window.dateFns.addMonths : (date, delta) => { const d = new Date(date); d.setMonth(d.getMonth() + delta); return d; };

// Global-like state for currently viewed budget month (initially current month)
let currentMonthDate = new Date();

function monthKey(date){ return format(date,'yyyy-MM'); }

function updateMonthHeader(autoBudget){
  const labelEl = document.getElementById('budget-month-label');
  const toBeEl = document.getElementById('to-be-budgeted');
  if(labelEl) labelEl.textContent = format(currentMonthDate, 'MMMM yyyy');
  if(toBeEl && autoBudget){
    const totalBudgeted = Object.values(autoBudget.categories).reduce((s,c)=>s + (c.monthly||0),0);
    const income = autoBudget.income || 0; // placeholder, may compute later
    const toBe = income - totalBudgeted;
    toBeEl.textContent = formatCurrency(toBe);
    toBeEl.className = toBe<0?'text-danger': 'text-primary';
  }
}

function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2
  }).format(num || 0);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function ensureDBReady(){
  if(!localDB.db){
    try {
      await localDB.init();
    } catch(e){
      console.error('DB init failed', e);
    }
  }
}

async function calculateAndSave(appInstance) {
  const db = (appInstance && appInstance.db) ? appInstance.db : localDB;
  console.log('[BudgetManager] calculating auto budget...');
  let txns = [];
  if (appInstance) {
    // Ensure the app's transactions are loaded
    try {
      if (!Array.isArray(appInstance.transactions) || appInstance.transactions.length === 0) {
        if (typeof appInstance.loadTransactions === 'function') {
          await appInstance.loadTransactions();
        }
      }
    } catch(e){
      console.warn('[BudgetManager] Failed loading transactions from app instance', e);
    }
    if (Array.isArray(appInstance.transactions) && appInstance.transactions.length) {
      txns = appInstance.transactions;
    }
  }
  if (!txns.length) {
    // Fallback to db helper
    if (typeof db.getTransactions === 'function') {
      txns = await db.getTransactions();
    } else if (typeof db.getAllItems === 'function') {
      txns = await db.getAllItems('transactions');
    }
  }
  const autoBudget = generateAutoBudget(txns);
  if (typeof db.saveBudget === 'function') {
    await db.saveBudget(autoBudget);
  } else if (typeof db.putItem === 'function') {
    await db.putItem('budgets', autoBudget);
  }
  return { autoBudget, txns, db };
}

function buildProgressBar(percent) {
  const clamped = Math.min(100, Math.max(0, percent));
  return `<div class="progress" style="height: 8px;">
            <div class="progress-bar ${clamped>90?'bg-danger':clamped>75?'bg-warning':'bg-success'}" role="progressbar" style="width:${clamped}%" aria-valuenow="${clamped}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>`;
}

let budgetChart;
function renderCategoryChart(cat, txns){
  const ctx = document.getElementById('budget-category-chart');
  if(!ctx) return;
  const labels=[]; const data=[];
  let d = new Date();
  for(let i=11;i>=0;i--){
    const m = addMonths(d,-i);
    const key = monthKey(m);
    labels.push(format(m,'MMM yy'));
    const spent = txns.filter(t=> (t.category||t.description)===cat && monthKey(new Date(t.date))===key)
                      .reduce((s,t)=> s+ Math.abs(t.amount),0);
    data.push(spent);
  }
  const cfg={type:'line',data:{labels,datasets:[{label:`${cat} Activity`,data,fill:false,borderColor:'#0d6efd'}]},options:{plugins:{legend:{display:false}}}};
  if(budgetChart){ budgetChart.destroy();}
  budgetChart = new Chart(ctx,cfg);
  document.getElementById('budget-chart-title').textContent=`${cat} – last 12 months`;
}

function renderTable(autoBudget, txns, date=currentMonthDate) {
  // Wait until the Budget view markup has been inserted
  const tbody = document.getElementById('budget-categories');
  if (!tbody) {
    // If the view hasn’t rendered yet, retry shortly
    setTimeout(() => renderTable(autoBudget, txns), 60);
    return;
  }

  tbody.innerHTML = '';
  const currentMonthKey = monthKey(date);
  const monthTxns = txns.filter(t => format(new Date(t.date),'yyyy-MM') === currentMonthKey);

  let categoriesEntries = Object.entries(autoBudget.categories||{});
  if(categoriesEntries.length===0){
    // auto-create categories based on unique descriptions in txns
    const unique = [...new Set(txns.map(t=>t.category||t.description))];
    unique.forEach(desc=>{
      autoBudget.categories = autoBudget.categories || {};
      autoBudget.categories[desc]={monthly:0, yearly:0};
    });
    categoriesEntries = Object.entries(autoBudget.categories);
  }

  categoriesEntries.forEach(([cat, data]) => {
    const spent = monthTxns.filter(t => (t.category||t.description)===cat)
                           .reduce((s, t) => s + Math.abs(t.amount), 0);
    const remaining = data.monthly - spent;
    const percent = data.monthly ? (spent / data.monthly) * 100 : 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="cat-name" style="cursor:pointer">${cat}</td>
      <td>${formatCurrency(data.monthly)}</td>
      <td>${formatCurrency(spent)}</td>
      <td>${formatCurrency(remaining)}</td>`;
    row.style.cursor='pointer';
    row.addEventListener('click',()=>renderCategoryChart(cat, txns));
    // rename on name click
    row.querySelector('.cat-name').addEventListener('click', async (e)=>{
      e.stopPropagation();
      const newName = prompt('Rename category', cat);
      if(newName && newName!==cat){
        await renameCategory(cat,newName, txns, db);
        autoBudget.categories[newName]=autoBudget.categories[cat];
        delete autoBudget.categories[cat];
        renderTable(autoBudget, txns, date);
      }
    });
    tbody.appendChild(row);
  });
}

async function renameCategory(oldCat,newCat, txns, db){
  // update transactions
  txns.forEach(t=>{
    if((t.category||t.description)===oldCat){ t.category=newCat; }
  });
  if(typeof db.bulkPut==='function'){
    await db.bulkPut('transactions', txns);
  } else if(typeof db.putItem==='function'){
    for(const t of txns){ await db.putItem('transactions', t);} }
  // save mapping for future imports
  const mapping={pattern:oldCat, category:newCat};
  if(typeof db.addMapping==='function') await db.addMapping(mapping);
}

function attachHandlers(autoBudget, db) {
  // click listeners handled in renderTable

  document.querySelectorAll('.edit-budget').forEach(btn => {
    btn.addEventListener('click', async e => {
      const cat = e.currentTarget.dataset.cat;
      const current = autoBudget.categories[cat];
      const input = prompt(`Set monthly budget for ${cat}`, current.monthly);
      const val = parseFloat(input);
      if (!isNaN(val) && val>=0) {
        current.monthly = val;
        current.yearly = val*12;
        if (typeof db.saveBudget === 'function') {
          await db.saveBudget(autoBudget);
        } else if (typeof db.putItem === 'function') {
          await db.putItem('budgets', autoBudget);
        }
        // Re-render with updated numbers
        const txns = (typeof db.getTransactions === 'function') ? await db.getTransactions() : await db.getAllItems('transactions');
        renderTable(autoBudget, txns);
      }
    });
  });
  document.querySelectorAll('.outlier-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      const cat = e.currentTarget.dataset.cat;
      const data = autoBudget.categories[cat];
      alert(`${data.outlierCount} outlier transaction amounts for ${cat}:\n${data.outliers.map(o=>formatCurrency(o)).join('\n')}`);
    });
  });
}

export async function initBudgetManager(appInstance){
  if (window.__budgetManagerReady) {
    // Already initialised – just recalc once in case data changed
    try {
      const { autoBudget, txns, db } = await calculateAndSave(appInstance);
      renderTable(autoBudget, txns);
      attachHandlers(autoBudget, db);
    } catch (e) { console.error('[BudgetManager] refresh failed', e);}  
    return;
  }
  window.__budgetManagerReady = true;
  console.log('[BudgetManager] init called');
  // When Budget view button clicked, generate & render
  const budgetBtn = document.querySelector('[data-view="ynab"]');
  if (budgetBtn){
    budgetBtn.addEventListener('click', async ()=>{
      const {autoBudget, txns, db} = await calculateAndSave(appInstance);
      renderTable(autoBudget, txns, currentMonthDate);
      updateMonthHeader(autoBudget);
      attachHandlers(autoBudget, db);
    });
  }

  // Also recalc right after app start so table ready on first visit
  const {autoBudget, txns, db} = await calculateAndSave(appInstance);
  renderTable(autoBudget, txns, currentMonthDate);
  updateMonthHeader(autoBudget);
  attachHandlers(autoBudget, db);

  // Month navigation buttons
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  if(prevBtn) prevBtn.onclick = ()=>{ currentMonthDate = addMonths(currentMonthDate, -1); renderTable(autoBudget, txns, currentMonthDate); updateMonthHeader(autoBudget);} ;
  if(nextBtn) nextBtn.onclick = ()=>{ currentMonthDate = addMonths(currentMonthDate, 1); renderTable(autoBudget, txns, currentMonthDate); updateMonthHeader(autoBudget);} ;
  console.log('[BudgetManager] initial table rendered.');
 }

// Expose globally for debugging
window.initBudgetManager = initBudgetManager;
