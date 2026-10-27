/* ==========================================================================
   CRISCELL - INTERATIVIDADE, TEMA, CONTA, CARRINHO, CATÁLOGO E PAINEL ADMIN
   Todos os dados (contas, produtos, serviços, pedidos) vêm do banco MySQL
   através da API em api/index.php (XAMPP: Apache + MySQL ligados).
   No navegador ficam apenas preferências: tema e itens do carrinho.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  /* ------------------------------------------------------------------
     UTILITÁRIOS
     ------------------------------------------------------------------ */
  const API = 'api/index.php';
  const WHATSAPP_NUMBER = '55219922201888';

  // Evita injeção de HTML ao exibir qualquer dado vindo do banco
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const formatBRL = (value) => 'R$ ' + Number(value).toFixed(2).replace('.', ',');

  // O MySQL devolve "2026-10-26 14:30:00" (horário de Brasília)
  const formatDate = (value) => {
    if (!value) return 'Data não registrada';
    const d = new Date(String(value).replace(' ', 'T'));
    return isNaN(d) ? 'Data não registrada'
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const TYPE_LABEL = { servico: 'Serviço', produto: 'Produto', carrinho: 'Carrinho' };

  // Chamada à API (JSON). Lança Error com a mensagem do servidor.
  const api = async (route, { method = 'GET', body, query = {}, keepalive = false } = {}) => {
    const qs = new URLSearchParams({ r: route, ...query });
    const options = {
      method,
      credentials: 'same-origin',
      keepalive,
      headers: { 'X-Requested-With': 'criscell' }
    };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(`${API}?${qs}`, options);
    } catch (e) {
      throw new Error('Sem conexão com o servidor. Confira se o Apache e o MySQL do XAMPP estão ligados e abra o site por http://localhost/criscell/.');
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* resposta sem JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Erro ${res.status} no servidor.`);
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const hideModal = (id) => {
    const el = document.getElementById(id);
    if (el && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getInstance(el);
      if (modal) modal.hide();
    }
  };

  const showError = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('d-none');
  };

  /* ------------------------------------------------------------------
     1. TEMA CLARO/ESCURO (preferência do navegador)
     ------------------------------------------------------------------ */
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const body = document.body;

  const applyStoredTheme = () => {
    const savedTheme = localStorage.getItem('criscell_theme') || 'light';
    body.classList.toggle('theme-dark', savedTheme === 'dark');
    body.classList.toggle('theme-light', savedTheme !== 'dark');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = savedTheme === 'dark'
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';
    }
  };

  applyStoredTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const goingLight = body.classList.contains('theme-dark');
      localStorage.setItem('criscell_theme', goingLight ? 'light' : 'dark');
      applyStoredTheme();
    });
  }

  /* ------------------------------------------------------------------
     2. ANIMAÇÕES AOS  |  3. NAVBAR AO ROLAR
     ------------------------------------------------------------------ */
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, offset: 100 });
  }

  const mainHeader = document.getElementById('mainHeader');
  if (mainHeader) {
    window.addEventListener('scroll', () => {
      mainHeader.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  /* ------------------------------------------------------------------
     4. CONTA DO USUÁRIO — login / cadastro / perfil (sessão no servidor)
     ------------------------------------------------------------------ */
  let currentUser = null;

  const refreshUser = async () => {
    try {
      currentUser = (await api('auth/me')).user;
    } catch (e) {
      currentUser = null;
    }
  };

  const loginTabItem = document.getElementById('loginTabItem');
  const registerTabItem = document.getElementById('registerTabItem');
  const profileTabItem = document.getElementById('profileTabItem');
  const ordersTabItem = document.getElementById('ordersTabItem');

  const activateTab = (tabBtnId) => {
    const tabBtn = document.getElementById(tabBtnId);
    if (tabBtn && typeof bootstrap !== 'undefined') new bootstrap.Tab(tabBtn).show();
  };

  const loadProfile = () => {
    const user = currentUser;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('profileName', user ? user.name : '');
    set('profileEmail', user ? user.email : '');
    set('profilePhone', user ? user.phone : '');

    const profileInitials = document.getElementById('profileInitials');
    if (profileInitials) {
      if (user && user.name) {
        const parts = user.name.trim().split(' ');
        let initials = parts[0].charAt(0).toUpperCase();
        if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();
        profileInitials.textContent = initials;
      } else {
        profileInitials.textContent = '?';
      }
    }

    const navAccountBtnText = document.getElementById('navAccountBtnText');
    if (navAccountBtnText) navAccountBtnText.textContent = user ? user.name.split(' ')[0] : 'Entrar';
  };

  const updateAuthUI = () => {
    if (!loginTabItem) return; // página sem modal de conta (ex.: admin.html)
    const logged = !!currentUser;

    loginTabItem.classList.toggle('d-none', logged);
    registerTabItem.classList.toggle('d-none', logged);
    profileTabItem.classList.toggle('d-none', !logged);
    ordersTabItem.classList.toggle('d-none', !logged);
    activateTab(logged ? 'profile-tab' : 'login-tab');

    loadProfile();
    renderOrders();
  };

  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('loginError');
      try {
        const res = await api('auth/login', {
          method: 'POST',
          body: {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
          }
        });
        currentUser = res.user;
        if (errorEl) errorEl.classList.add('d-none');
        formLogin.reset();
        updateAuthUI();
        hideModal('authModal');
      } catch (err) {
        showError(errorEl, err.message);
      }
    });
  }

  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('registerError');
      try {
        const res = await api('auth/register', {
          method: 'POST',
          body: {
            name: document.getElementById('regName').value,
            email: document.getElementById('regEmail').value,
            phone: document.getElementById('regPhone').value,
            password: document.getElementById('regPassword').value
          }
        });
        currentUser = res.user;
        if (errorEl) errorEl.classList.add('d-none');
        formRegister.reset();
        updateAuthUI();
        alert('Cadastro efetuado com sucesso!');
        hideModal('authModal');
      } catch (err) {
        showError(errorEl, err.message);
      }
    });
  }

  const formProfile = document.getElementById('formProfile');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      try {
        const res = await api('auth/profile', {
          method: 'POST',
          body: {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value
          }
        });
        currentUser = res.user;
        loadProfile();
        alert('Informações salvas com sucesso!');
        hideModal('authModal');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try { await api('auth/logout', { method: 'POST' }); } catch (e) { /* segue mesmo assim */ }
      currentUser = null;
      updateAuthUI();
      if (formLogin) formLogin.reset();
    });
  }

  /* ------------------------------------------------------------------
     5. PEDIDOS DO CLIENTE ("Meus Pedidos")
     ------------------------------------------------------------------ */
  const statusBadge = (status) => status === 'concluido'
    ? '<span class="badge bg-success rounded-pill">Concluído</span>'
    : '<span class="badge bg-warning text-dark rounded-pill">Pendente</span>';

  async function renderOrders() {
    const list = document.getElementById('ordersList');
    const emptyState = document.getElementById('ordersEmptyState');
    if (!list || !emptyState) return;

    list.innerHTML = '';
    if (!currentUser) { emptyState.classList.remove('d-none'); return; }

    let orders = [];
    try {
      orders = (await api('orders')).orders;
    } catch (e) { /* mostra estado vazio */ }

    if (orders.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }
    emptyState.classList.add('d-none');

    orders.forEach((order) => {
      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `
        <div class="order-info">
          <span class="fw-bold small d-block">${escapeHTML(order.title)}</span>
          <small>${escapeHTML(TYPE_LABEL[order.type] || order.type)}${order.total !== null ? ' • ' + formatBRL(order.total) : ''} — ${formatDate(order.createdAt)}</small>
        </div>
        ${statusBadge(order.status)}
      `;
      list.appendChild(li);
    });
  }

  const btnClearOrders = document.getElementById('btnClearOrders');
  if (btnClearOrders) {
    btnClearOrders.addEventListener('click', async () => {
      if (!currentUser) return;
      try {
        await api('orders/clear', { method: 'POST' });
        renderOrders();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  /* ------------------------------------------------------------------
     LOGIN OBRIGATÓRIO (a validação real é feita pela API em cada pedido)
     ------------------------------------------------------------------ */
  const requireLogin = (e) => {
    if (currentUser) return true;
    if (e) e.preventDefault();

    const notice = document.getElementById('loginRequiredNotice');
    if (notice) notice.classList.remove('d-none');

    const modalEl = document.getElementById('authModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
      activateTab('login-tab');
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    return false;
  };

  const authModalEl = document.getElementById('authModal');
  if (authModalEl) {
    authModalEl.addEventListener('hidden.bs.modal', () => {
      const notice = document.getElementById('loginRequiredNotice');
      if (notice) notice.classList.add('d-none');
    });
  }

  document.querySelectorAll('[data-require-login="1"]').forEach((link) => {
    link.addEventListener('click', (e) => { requireLogin(e); });
  });

  /* ------------------------------------------------------------------
     6. CATÁLOGO — produtos e serviços vindos do banco
     ------------------------------------------------------------------ */
  let productsCache = [];
  let servicesCache = [];

  const loadProducts = async () => {
    try {
      productsCache = (await api('products')).products;
    } catch (e) {
      productsCache = [];
      throw e;
    }
  };

  const renderProducts = () => {
    const grid = document.getElementById('produtosGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (productsCache.length === 0) {
      grid.innerHTML = '<div class="col-12 text-center text-muted-adaptive py-4">Nenhum produto cadastrado no momento.</div>';
      return;
    }

    productsCache.forEach((p) => {
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3';
      col.setAttribute('data-aos', 'fade-up');
      col.innerHTML = `
        <div class="product-card rounded-4 overflow-hidden border-0 shadow-sm h-100 d-flex flex-column">
          <div class="product-img-box position-relative overflow-hidden">
            ${p.badge ? `<span class="badge ${escapeHTML(p.badgeClass || 'bg-blue-accent text-white')} position-absolute top-0 start-0 m-3 z-2">${escapeHTML(p.badge)}</span>` : ''}
            <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="img-fluid w-100 object-fit-cover product-img">
          </div>
          <div class="p-3 d-flex flex-column flex-grow-1">
            <span class="small text-muted-adaptive">${escapeHTML(p.category)}</span>
            <h6 class="fw-bold mb-2">${escapeHTML(p.name)}</h6>
            <p class="small text-muted-adaptive mb-3 flex-grow-1">${escapeHTML(p.description)}</p>
            <div class="d-flex align-items-center justify-content-between pt-2 border-top border-adaptive">
              <span class="fw-bold text-blue-accent">${formatBRL(p.price)}</span>
              <button type="button" class="btn btn-sm btn-soft-navy rounded-circle" data-add-cart="${p.id}" title="Adicionar ao Carrinho" aria-label="Adicionar ${escapeHTML(p.name)} ao carrinho">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);
    });
  };

  const renderServices = () => {
    const grid = document.getElementById('servicosGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (servicesCache.length === 0) {
      grid.innerHTML = '<div class="col-12 text-center text-muted-adaptive py-4">Nenhum serviço disponível no momento.</div>';
      return;
    }

    servicesCache.forEach((s, i) => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';
      col.setAttribute('data-aos', 'fade-up');
      col.setAttribute('data-aos-delay', String(((i % 3) + 1) * 100));
      col.innerHTML = `
        <div class="service-card p-4 rounded-4 h-100 shadow-sm hover-lift">
          <div class="media-placeholder rounded-3 mb-3 overflow-hidden">
            <img src="${escapeHTML(s.image)}" alt="${escapeHTML(s.name)}" class="img-fluid w-100 object-fit-cover">
          </div>
          <h5 class="fw-bold mb-2">${escapeHTML(s.title)}</h5>
          <p class="text-muted-adaptive small mb-3">${escapeHTML(s.description)}</p>
          <div class="d-flex align-items-center justify-content-between pt-3 border-top border-adaptive flex-wrap gap-2">
            <span class="srv-price">A partir de ${formatBRL(s.price)}</span>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-sm btn-soft-navy rounded-circle" data-add-service="${s.id}" title="Adicionar ao Carrinho" aria-label="Adicionar ${escapeHTML(s.name)} ao carrinho">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
              <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(s.whatsappText)}" target="_blank" rel="noopener" class="btn btn-sm btn-navy-outline rounded-pill" data-quote-service="${s.id}">Pedir Orçamento</a>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);
    });
  };

  const loadCatalog = async () => {
    const tasks = [];
    if (document.getElementById('produtosGrid')) tasks.push(loadProducts());
    if (document.getElementById('servicosGrid')) {
      tasks.push(api('services').then((r) => { servicesCache = r.services; }));
    }
    try {
      await Promise.all(tasks);
    } catch (e) {
      const msg = `<div class="col-12 text-center text-muted-adaptive py-4">${escapeHTML(e.message)}</div>`;
      ['produtosGrid', 'servicosGrid'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = msg;
      });
      return;
    }
    renderProducts();
    renderServices();
  };

  /* ------------------------------------------------------------------
     7. CARRINHO (fica no navegador até o cliente finalizar o pedido)
     Guarda só {kind, id, qty} + nome/preço para exibição. No fechamento,
     o servidor confere tudo no banco e calcula o total real.
     ------------------------------------------------------------------ */
  const CART_KEY = 'criscell_cart';

  const getCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(cart) ? cart : [];
    } catch (e) {
      return [];
    }
  };

  const saveCart = (cart) => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const cartKey = (item) => `${item.kind}-${item.id}`;

  const addItemToCart = (newItem) => {
    const cart = getCart();
    const existing = cart.find((item) => cartKey(item) === cartKey(newItem));
    if (existing) existing.qty += 1;
    else cart.push({ ...newItem, qty: 1 });
    saveCart(cart);
    renderCart();
  };

  const flashAdded = (btn) => {
    const icon = btn.querySelector('i');
    if (!icon) return;
    if (!btn.dataset.origIcon) btn.dataset.origIcon = icon.className;
    icon.className = 'fa-solid fa-check';
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => { icon.className = btn.dataset.origIcon; }, 900);
  };

  const removeFromCart = (key) => {
    saveCart(getCart().filter((item) => cartKey(item) !== key));
    renderCart();
  };

  const clearCart = () => {
    localStorage.removeItem(CART_KEY);
    renderCart();
  };

  function renderCart() {
    const list = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmptyState');
    const footer = document.getElementById('cartFooter');
    const totalEl = document.getElementById('cartTotal');
    const badge = document.getElementById('cartBadge');
    if (!list || !emptyState || !footer || !totalEl) return;

    const cart = getCart();
    list.innerHTML = '';

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    if (badge) {
      badge.textContent = totalItems;
      badge.classList.toggle('d-none', totalItems === 0);
    }

    if (cart.length === 0) {
      emptyState.classList.remove('d-none');
      footer.style.display = 'none';
      return;
    }
    emptyState.classList.add('d-none');
    footer.style.display = 'block';

    let total = 0;
    let hasService = false;
    cart.forEach((item) => {
      const subtotal = item.price * item.qty;
      total += subtotal;
      const isService = item.kind === 'servico';
      if (isService) hasService = true;
      const prefix = isService ? 'a partir de ' : '';
      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `
        <div class="order-info">
          <span class="fw-bold small d-block">${escapeHTML(item.name)}</span>
          <small>${item.qty}x ${prefix}${formatBRL(item.price)} = ${prefix}${formatBRL(subtotal)}</small>
        </div>
        <button type="button" class="btn btn-sm btn-link text-danger p-0" data-remove-cart="${escapeHTML(cartKey(item))}" title="Remover">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
      list.appendChild(li);
    });

    totalEl.textContent = formatBRL(total);
    const totalLabel = document.getElementById('cartTotalLabel');
    const estimateNote = document.getElementById('cartEstimateNote');
    if (totalLabel) totalLabel.textContent = hasService ? 'Total estimado' : 'Total';
    if (estimateNote) estimateNote.classList.toggle('d-none', !hasService);
  }

  // Produtos -> carrinho
  const produtosGrid = document.getElementById('produtosGrid');
  if (produtosGrid) {
    produtosGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add-cart]');
      if (!btn) return;
      const product = productsCache.find((p) => String(p.id) === btn.getAttribute('data-add-cart'));
      if (!product) return;
      addItemToCart({ kind: 'produto', id: product.id, name: product.name, price: product.price });
      flashAdded(btn);
    });
  }

  // Serviços -> carrinho / pedir orçamento
  const servicosGrid = document.getElementById('servicosGrid');
  if (servicosGrid) {
    servicosGrid.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-service]');
      if (addBtn) {
        const service = servicesCache.find((s) => String(s.id) === addBtn.getAttribute('data-add-service'));
        if (!service) return;
        addItemToCart({ kind: 'servico', id: service.id, name: service.name, price: service.price });
        flashAdded(addBtn);
        return;
      }

      const quoteLink = e.target.closest('[data-quote-service]');
      if (quoteLink) {
        if (!requireLogin(e)) return;
        // Registra o orçamento no banco; o link do WhatsApp abre normalmente.
        api('orders', {
          method: 'POST',
          keepalive: true,
          body: { via: 'orcamento', items: [{ kind: 'servico', id: Number(quoteLink.getAttribute('data-quote-service')), qty: 1 }] }
        }).then(renderOrders).catch(() => { /* o WhatsApp já abriu; falha silenciosa */ });
      }
    });
  }

  const cartItemsList = document.getElementById('cartItemsList');
  if (cartItemsList) {
    cartItemsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-cart]');
      if (btn) removeFromCart(btn.getAttribute('data-remove-cart'));
    });
  }

  const btnClearCart = document.getElementById('btnClearCart');
  if (btnClearCart) btnClearCart.addEventListener('click', clearCart);

  const btnCheckoutWhatsapp = document.getElementById('btnCheckoutWhatsapp');
  if (btnCheckoutWhatsapp) {
    btnCheckoutWhatsapp.addEventListener('click', async (e) => {
      const cart = getCart();
      if (cart.length === 0) return;

      const closeCart = () => {
        const cartEl = document.getElementById('cartOffcanvas');
        if (cartEl && typeof bootstrap !== 'undefined') {
          const oc = bootstrap.Offcanvas.getInstance(cartEl);
          if (oc) oc.hide();
        }
      };

      if (!currentUser) {
        closeCart(); // os itens continuam salvos no carrinho
        requireLogin(e);
        return;
      }

      // Abre a aba já no clique (evita bloqueio de pop-up) e preenche depois do servidor responder.
      const waWindow = window.open('', '_blank');

      try {
        const { order } = await api('orders', {
          method: 'POST',
          body: { via: 'carrinho', items: cart.map(({ kind, id, qty }) => ({ kind, id, qty })) }
        });

        const hasService = order.items.some((i) => i.kind === 'servico');
        const lines = order.items.map((i) => {
          const isService = i.kind === 'servico';
          return `${i.qty}x ${i.name}${isService ? ' (Serviço)' : ''} (${isService ? 'a partir de ' : ''}${formatBRL(i.unitPrice * i.qty)})`;
        });
        const message = `Olá! Gostaria de fechar o pedido:\n${lines.join('\n')}\n${hasService ? 'Total estimado' : 'Total'}: ${formatBRL(order.total)}` +
          (hasService ? '\n(Serviços a partir do valor indicado — aguardo o diagnóstico para confirmar.)' : '');
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

        if (waWindow) waWindow.location.href = url;
        else window.location.href = url;

        clearCart();
        closeCart();
        renderOrders();
      } catch (err) {
        if (waWindow) waWindow.close();
        alert(err.message);
      }
    });
  }

  /* ------------------------------------------------------------------
     8. PAINEL ADMINISTRATIVO (admin.html) — exige conta com perfil admin
     ------------------------------------------------------------------ */
  const adminGate = document.getElementById('adminLoginGate');
  const adminContent = document.getElementById('adminContent');

  if (adminGate && adminContent) {
    const adminProductsList = document.getElementById('adminProductsList');
    const adminOrdersList = document.getElementById('adminOrdersList');
    const adminUsersList = document.getElementById('adminUsersList');
    const formAdminProduct = document.getElementById('formAdminProduct');
    const submitBtn = formAdminProduct.querySelector('button[type="submit"]');
    let editingId = null;

    const emptyMsg = (text) => `<div class="text-center text-muted-adaptive py-4">${text}</div>`;

    const resetProductForm = () => {
      formAdminProduct.reset();
      editingId = null;
      submitBtn.innerHTML = '<i class="fa-solid fa-plus me-1"></i> Adicionar Produto';
    };

    /* ---- Produtos ---- */
    const renderAdminProducts = async () => {
      try {
        await loadProducts();
      } catch (e) {
        adminProductsList.innerHTML = emptyMsg(escapeHTML(e.message));
        return;
      }
      if (productsCache.length === 0) {
        adminProductsList.innerHTML = emptyMsg('Nenhum produto cadastrado.');
        return;
      }
      adminProductsList.innerHTML = '';
      productsCache.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info d-flex align-items-center gap-3">
            <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:10px;">
            <div>
              <span class="fw-bold small d-block">${escapeHTML(p.name)}</span>
              <small>${escapeHTML(p.category)} • ${formatBRL(p.price)}</small>
            </div>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-soft-navy rounded-circle" data-edit-product="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle" data-delete-product="${p.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        adminProductsList.appendChild(row);
      });
    };

    formAdminProduct.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        category: document.getElementById('adminProdCategoria').value,
        name: document.getElementById('adminProdNome').value,
        description: document.getElementById('adminProdDescricao').value,
        price: document.getElementById('adminProdPreco').value,
        image: document.getElementById('adminProdImagem').value,
        badge: document.getElementById('adminProdBadge').value
      };
      try {
        if (editingId) await api('admin/products', { method: 'PUT', query: { id: editingId }, body });
        else await api('admin/products', { method: 'POST', body });
        resetProductForm();
        renderAdminProducts();
      } catch (err) {
        alert(err.message);
      }
    });

    adminProductsList.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-product]');
      const delBtn = e.target.closest('[data-delete-product]');

      if (editBtn) {
        const product = productsCache.find((p) => String(p.id) === editBtn.getAttribute('data-edit-product'));
        if (!product) return;
        document.getElementById('adminProdCategoria').value = product.category;
        document.getElementById('adminProdNome').value = product.name;
        document.getElementById('adminProdDescricao').value = product.description;
        document.getElementById('adminProdPreco').value = product.price;
        document.getElementById('adminProdImagem').value = product.image;
        document.getElementById('adminProdBadge').value = product.badge;
        editingId = product.id;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Salvar Edição';
        formAdminProduct.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (delBtn) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;
        try {
          await api('admin/products', { method: 'DELETE', query: { id: delBtn.getAttribute('data-delete-product') } });
          renderAdminProducts();
        } catch (err) {
          alert(err.message);
        }
      }
    });

    /* ---- Serviços ---- */
    const adminServicesList = document.getElementById('adminServicesList');
    const formAdminService = document.getElementById('formAdminService');
    const srvSubmitBtn = formAdminService.querySelector('button[type="submit"]');
    const btnCancelServiceEdit = document.getElementById('btnCancelServiceEdit');
    let editingServiceId = null;

    const resetServiceForm = () => {
      formAdminService.reset();
      editingServiceId = null;
      srvSubmitBtn.innerHTML = '<i class="fa-solid fa-plus me-1"></i> Adicionar Serviço';
      btnCancelServiceEdit.classList.add('d-none');
    };

    const renderAdminServices = async () => {
      try {
        servicesCache = (await api('services')).services;
      } catch (e) {
        adminServicesList.innerHTML = emptyMsg(escapeHTML(e.message));
        return;
      }
      if (servicesCache.length === 0) {
        adminServicesList.innerHTML = emptyMsg('Nenhum serviço cadastrado.');
        return;
      }
      adminServicesList.innerHTML = '';
      servicesCache.forEach((sv) => {
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info d-flex align-items-center gap-3">
            <img src="${escapeHTML(sv.image)}" alt="${escapeHTML(sv.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:10px;">
            <div>
              <span class="fw-bold small d-block">${escapeHTML(sv.name)}</span>
              <small>a partir de ${formatBRL(sv.price)}</small>
            </div>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-soft-navy rounded-circle" data-edit-service="${sv.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle" data-delete-service="${sv.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        adminServicesList.appendChild(row);
      });
    };

    formAdminService.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('adminSrvNome').value,
        title: document.getElementById('adminSrvTitulo').value,
        description: document.getElementById('adminSrvDescricao').value,
        price: document.getElementById('adminSrvPreco').value,
        image: document.getElementById('adminSrvImagem').value,
        whatsappText: document.getElementById('adminSrvWhats').value
      };
      try {
        if (editingServiceId) await api('admin/services', { method: 'PUT', query: { id: editingServiceId }, body });
        else await api('admin/services', { method: 'POST', body });
        resetServiceForm();
        renderAdminServices();
      } catch (err) {
        alert(err.message);
      }
    });

    btnCancelServiceEdit.addEventListener('click', resetServiceForm);

    adminServicesList.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-service]');
      const delBtn = e.target.closest('[data-delete-service]');

      if (editBtn) {
        const sv = servicesCache.find((x) => String(x.id) === editBtn.getAttribute('data-edit-service'));
        if (!sv) return;
        document.getElementById('adminSrvNome').value = sv.name;
        document.getElementById('adminSrvTitulo').value = sv.title;
        document.getElementById('adminSrvDescricao').value = sv.description;
        document.getElementById('adminSrvPreco').value = sv.price;
        document.getElementById('adminSrvImagem').value = sv.image;
        document.getElementById('adminSrvWhats').value = sv.whatsappText;
        editingServiceId = sv.id;
        srvSubmitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Salvar Edição';
        btnCancelServiceEdit.classList.remove('d-none');
        formAdminService.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (delBtn) {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
        try {
          await api('admin/services', { method: 'DELETE', query: { id: delBtn.getAttribute('data-delete-service') } });
          renderAdminServices();
        } catch (err) {
          alert(err.message);
        }
      }
    });

    /* ---- Pedidos ---- */
    const renderAdminOrders = async () => {
      let orders;
      try {
        orders = (await api('admin/orders')).orders;
      } catch (e) {
        adminOrdersList.innerHTML = emptyMsg(escapeHTML(e.message));
        return;
      }
      if (orders.length === 0) {
        adminOrdersList.innerHTML = emptyMsg('Nenhum pedido registrado ainda.');
        return;
      }
      adminOrdersList.innerHTML = '';
      orders.forEach((order) => {
        const done = order.status === 'concluido';
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info">
            <span class="fw-bold small d-block">${escapeHTML(order.title)}</span>
            <small>${escapeHTML(order.customerName)} • ${escapeHTML(TYPE_LABEL[order.type] || order.type)}${order.total !== null ? ' • ' + formatBRL(order.total) : ''} — ${formatDate(order.createdAt)}</small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${done ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${done ? 'Concluído' : 'Pendente'}</span>
            <button type="button" class="btn btn-sm btn-navy-outline rounded-pill extra-small" data-toggle-status="${order.id}" data-next-status="${done ? 'pendente' : 'concluido'}">
              Marcar ${done ? 'Pendente' : 'Concluído'}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle" data-delete-order="${order.id}" title="Excluir pedido" aria-label="Excluir pedido">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
        adminOrdersList.appendChild(row);
      });
    };

    adminOrdersList.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-delete-order]');
      const toggleBtn = e.target.closest('[data-toggle-status]');
      try {
        if (delBtn) {
          if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
          await api('admin/orders', { method: 'DELETE', query: { id: delBtn.getAttribute('data-delete-order') } });
          renderAdminOrders();
        } else if (toggleBtn) {
          await api('admin/orders', {
            method: 'PATCH',
            query: { id: toggleBtn.getAttribute('data-toggle-status') },
            body: { status: toggleBtn.getAttribute('data-next-status') }
          });
          renderAdminOrders();
        }
      } catch (err) {
        alert(err.message);
      }
    });

    /* ---- Usuários (a API nunca envia senhas) ---- */
    const renderAdminUsers = async () => {
      let users;
      try {
        users = (await api('admin/users')).users;
      } catch (e) {
        adminUsersList.innerHTML = emptyMsg(escapeHTML(e.message));
        return;
      }
      if (users.length === 0) {
        adminUsersList.innerHTML = emptyMsg('Nenhum usuário cadastrado ainda.');
        return;
      }
      adminUsersList.innerHTML = '';
      users.forEach((u) => {
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info">
            <span class="fw-bold small d-block">${escapeHTML(u.name)}${u.role === 'admin' ? ' <span class="badge bg-secondary rounded-pill">Admin</span>' : ''}</span>
            <small><i class="fa-solid fa-user me-1"></i>${escapeHTML(u.email)} • <i class="fa-solid fa-phone me-1"></i>${escapeHTML(u.phone || '—')}</small>
          </div>
          <small class="text-nowrap"><i class="fa-regular fa-calendar me-1"></i>Desde ${formatDate(u.createdAt)}</small>
        `;
        adminUsersList.appendChild(row);
      });
    };

    /* ---- Acesso: só administradores entram ---- */
    const showAdmin = (isAdmin) => {
      adminGate.classList.toggle('d-none', isAdmin);
      adminContent.classList.toggle('d-none', !isAdmin);
      document.querySelectorAll('[data-admin-only]').forEach((el) => el.classList.toggle('d-none', !isAdmin));
      if (isAdmin) {
        renderAdminProducts();
        renderAdminServices();
        renderAdminOrders();
        renderAdminUsers();
      }
    };

    const formAdminLogin = document.getElementById('formAdminLogin');
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('adminLoginError');
      try {
        const res = await api('auth/login', {
          method: 'POST',
          body: {
            email: document.getElementById('adminLoginEmail').value,
            password: document.getElementById('adminLoginPassword').value
          }
        });
        if (res.user.role !== 'admin') {
          await api('auth/logout', { method: 'POST' });
          showError(errorEl, 'Esta conta não tem permissão de administrador.');
          return;
        }
        currentUser = res.user;
        errorEl.classList.add('d-none');
        formAdminLogin.reset();
        showAdmin(true);
      } catch (err) {
        showError(errorEl, err.message);
      }
    });

    const btnAdminLogout = document.getElementById('btnAdminLogout');
    if (btnAdminLogout) {
      btnAdminLogout.addEventListener('click', async () => {
        try { await api('auth/logout', { method: 'POST' }); } catch (e) { /* segue */ }
        currentUser = null;
        showAdmin(false);
      });
    }

    await refreshUser();
    showAdmin(!!currentUser && currentUser.role === 'admin');
    return; // admin.html não usa o restante (carrinho, catálogo público)
  }

  /* ------------------------------------------------------------------
     INICIALIZAÇÃO DO SITE PÚBLICO
     ------------------------------------------------------------------ */
  renderCart();
  await refreshUser();
  updateAuthUI();
  loadCatalog();
});
