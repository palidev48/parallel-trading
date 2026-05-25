// PARALLEL Cart — localStorage-backed
(function(){
  const KEY = 'parallel_cart_v1';

  function read(){
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch(e){ return []; }
  }
  function write(items){
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
    document.dispatchEvent(new CustomEvent('cart:change', {detail: items}));
  }
  function add(pid, qty){
    qty = qty || 1;
    const items = read();
    const existing = items.find(i => i.pid === pid);
    if (existing) existing.qty += qty;
    else items.push({pid: pid, qty: qty});
    write(items);
    showToast('Added to bag');
  }
  function remove(pid){
    write(read().filter(i => i.pid !== pid));
  }
  function setQty(pid, qty){
    const items = read();
    const it = items.find(i => i.pid === pid);
    if (!it) return;
    it.qty = Math.max(1, qty);
    write(items);
  }
  function clear(){ write([]); }
  function count(){ return read().reduce((n,i)=>n+i.qty,0); }
  function subtotal(){
    const products = window.PARALLEL_PRODUCTS || {};
    return read().reduce((sum,i)=>{
      const p = products[i.pid];
      return p ? sum + p.price * i.qty : sum;
    }, 0);
  }
  function updateBadge(){
    const c = count();
    document.querySelectorAll('[data-cart-badge]').forEach(el=>{
      el.textContent = c > 0 ? c : '';
      el.style.display = c > 0 ? 'inline-flex' : 'none';
    });
  }
  function showToast(msg){
    let t = document.getElementById('parallel-toast');
    if (!t){
      t = document.createElement('div');
      t.id = 'parallel-toast';
      t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:14px 24px;border:1px solid #2a2a2a;border-radius:2px;font-family:Inter,sans-serif;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;z-index:10000;opacity:0;transition:opacity .25s;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(()=>{ t.style.opacity = '1'; });
    clearTimeout(t._h);
    t._h = setTimeout(()=>{ t.style.opacity = '0'; }, 2000);
  }

  window.PARALLEL_CART = { add, remove, setQty, clear, read, count, subtotal, updateBadge };

  document.addEventListener('DOMContentLoaded', updateBadge);
})();
