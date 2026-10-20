/* ==========================================================================
   CRISCELL - SCRIPT DE INTERATIVIDADE, TEMA PERSISTENTE, PERFIL, CARRINHO
   E PRODUTOS DINÂMICOS (dados salvos em localStorage — sem backend por ora)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Evita injeção de HTML ao exibir dados digitados por usuários
  // Comunicação com o backend (api.php). Devolve o JSON ou null se o servidor não responder.
  const API_URL = 'api.php';
  const apiRequest = async (acao, fields) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      let res;
      if (fields) {
        const fd = new FormData();
        fd.append('acao', acao);
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        res = await fetch(API_URL, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin', signal: ctrl.signal });
      } else {
        res = await fetch(`${API_URL}?acao=${acao}`, { credentials: 'same-origin', signal: ctrl.signal });
      }
      return await res.json();
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Estado da integração com o api.php (preenchido na seção 6b)
  const productsAPI = { online: false };

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));


  // 1. GERENCIAMENTO DE TEMA (DARK MODE PERSISTENTE)
  // O ícone mostra a ação do botão: lua no tema claro (vai para o escuro) e sol no escuro.
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const body = document.body;

  const setTheme = (theme) => {
    const dark = theme === 'dark';
    body.classList.toggle('theme-dark', dark);
    body.classList.toggle('theme-light', !dark);
    if (themeToggleBtn) themeToggleBtn.innerHTML = `<i class="fa-solid ${dark ? 'fa-sun' : 'fa-moon'}"></i>`;
  };

  setTheme(localStorage.getItem('criscell_theme') || 'light');

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const next = body.classList.contains('theme-dark') ? 'light' : 'dark';
      localStorage.setItem('criscell_theme', next);
      setTheme(next);
    });
  }

  // 3. EFEITO NAVBAR SCROLLED
  const mainHeader = document.getElementById('mainHeader');
  if (mainHeader) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        mainHeader.classList.add('scrolled');
      } else {
        mainHeader.classList.remove('scrolled');
      }
    });
  }

  // 4. CONTAS DE USUÁRIO — autenticadas pelo backend (api.php): sessão PHP e senha com hash no servidor
  let currentUser = null; // { name, email, phone, role } ou null
  const mapUser = (u) => (u ? { name: u.nome, email: u.email, phone: u.telefone || '', role: u.papel } : null);
  const getCurrentUser = () => currentUser;
  const showMsg = (el, msg) => { if (el) { el.textContent = msg; el.classList.remove('d-none'); } };
  const hideAuthModal = () => {
    const m = document.getElementById('authModal');
    if (m && typeof bootstrap !== 'undefined') {
      const inst = bootstrap.Modal.getInstance(m);
      if (inst) inst.hide();
    }
  };

  const loginTabItem = document.getElementById('loginTabItem');
  const registerTabItem = document.getElementById('registerTabItem');
  const profileTabItem = document.getElementById('profileTabItem');
  const ordersTabItem = document.getElementById('ordersTabItem');

  const activateTab = (tabBtnId) => {
    const tabBtn = document.getElementById(tabBtnId);
    if (tabBtn && typeof bootstrap !== 'undefined') {
      new bootstrap.Tab(tabBtn).show();
    }
  };

  const loadProfile = () => {
    const user = getCurrentUser();

    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const profileInitials = document.getElementById('profileInitials');
    const navAccountBtnText = document.getElementById('navAccountBtnText');

    if (profileName) profileName.value = user ? user.name : '';
    if (profileEmail) profileEmail.value = user ? user.email : '';
    if (profilePhone) profilePhone.value = user ? user.phone : '';

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

    if (navAccountBtnText) {
      navAccountBtnText.textContent = user ? user.name.split(' ')[0] : 'Entrar';
    }
  };

  // Mostra Entrar/Cadastrar para visitantes, e Minhas Informações/Meus Pedidos
  // para quem já está logado.
  const updateAuthUI = () => {
    if (!loginTabItem) return; // página sem modal de conta (ex: admin.html)
    const user = getCurrentUser();

    if (user) {
      loginTabItem.classList.add('d-none');
      registerTabItem.classList.add('d-none');
      profileTabItem.classList.remove('d-none');
      ordersTabItem.classList.remove('d-none');
      activateTab('profile-tab');
    } else {
      loginTabItem.classList.remove('d-none');
      registerTabItem.classList.remove('d-none');
      profileTabItem.classList.add('d-none');
      ordersTabItem.classList.add('d-none');
      activateTab('login-tab');
    }

    loadProfile();
    if (typeof renderOrders === 'function') renderOrders();
  };

  // Entrar
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('loginError');
      const r = await apiRequest('login', {
        email: document.getElementById('loginEmail').value.trim().toLowerCase(),
        senha: document.getElementById('loginPassword').value
      });
      if (!r || !r.sucesso) { showMsg(errorEl, r ? r.mensagem : 'Não foi possível conectar ao servidor.'); return; }
      if (errorEl) errorEl.classList.add('d-none');
      currentUser = mapUser(r.usuario);
      updateAuthUI();
      formLogin.reset();
      hideAuthModal();
    });
  }

  // Cadastro
  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('registerError');
      const r = await apiRequest('registrar', {
        nome: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim().toLowerCase(),
        telefone: document.getElementById('regPhone').value.trim(),
        senha: document.getElementById('regPassword').value
      });
      if (!r || !r.sucesso) { showMsg(errorEl, r ? r.mensagem : 'Não foi possível conectar ao servidor.'); return; }
      if (errorEl) errorEl.classList.add('d-none');
      currentUser = mapUser(r.usuario);
      updateAuthUI();
      formRegister.reset();
      alert('Cadastro efetuado com sucesso!');
      hideAuthModal();
    });
  }

  // Salvar alterações do perfil (nome e telefone; o e-mail identifica a conta)
  const formProfile = document.getElementById('formProfile');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      const r = await apiRequest('atualizar_perfil', {
        nome: document.getElementById('profileName').value.trim(),
        telefone: document.getElementById('profilePhone').value.trim()
      });
      if (!r || !r.sucesso) { alert((r && r.mensagem) || 'Não foi possível salvar. Tente novamente.'); return; }
      currentUser = mapUser(r.usuario);
      loadProfile();
      alert('Informações salvas com sucesso!');
      hideAuthModal();
    });
  }

  // Sair
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await apiRequest('logout', {});
      currentUser = null;
      updateAuthUI();
      if (formLogin) formLogin.reset();
    });
  }

  // 5. HISTÓRICO DE COMPRAS E PEDIDOS (Meus Pedidos) — com status Pendente/Concluído
  const saveOrder = async (order) => {
    const r = await apiRequest('criar_pedido', { nome: order.name, tipo: order.type, preco: order.price || '' });
    return !!(r && r.sucesso);
  };

  const renderOrders = async () => {
    const list = document.getElementById('ordersList');
    const emptyState = document.getElementById('ordersEmptyState');
    if (!list || !emptyState) return;

    const rows = currentUser ? await apiRequest('meus_pedidos', {}) : [];
    const orders = Array.isArray(rows) ? rows : [];
    list.innerHTML = '';

    if (orders.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }
    emptyState.classList.add('d-none');

    orders.forEach((order) => {
      const done = order.status === 'concluido';
      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `
        <div class="order-info">
          <span class="fw-bold small d-block">${escapeHTML(order.nome)}</span>
          <small>${escapeHTML(order.tipo)}${order.preco ? ' • ' + escapeHTML(order.preco) : ''} — ${escapeHTML(order.data)}</small>
        </div>
        <span class="badge ${done ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${done ? 'Concluído' : 'Pendente'}</span>
      `;
      list.appendChild(li);
    });
  };

  // Recupera a sessão do servidor ao abrir a página
  apiRequest('sessao').then((r) => {
    currentUser = mapUser(r && r.usuario);
    updateAuthUI();
  });

  // LOGIN OBRIGATÓRIO — se não houver sessão, interrompe a ação e abre o modal de login.
  // (Controle apenas de interface: a validação real precisa ser feita no backend.)
  const requireLogin = (e) => {
    if (getCurrentUser()) return true;
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

  // Esconde o aviso ao fechar o modal
  const authModalEl = document.getElementById('authModal');
  if (authModalEl) {
    authModalEl.addEventListener('hidden.bs.modal', () => {
      const notice = document.getElementById('loginRequiredNotice');
      if (notice) notice.classList.add('d-none');
    });
  }

  // Links de pedido/agendamento sem registro de pedido (hero e promoção)
  document.querySelectorAll('[data-require-login="1"]').forEach((link) => {
    link.addEventListener('click', (e) => { requireLogin(e); });
  });

  document.querySelectorAll('[data-order-log="1"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!requireLogin(e)) return;
      const name = btn.getAttribute('data-order-name') || 'Item';
      const price = btn.getAttribute('data-order-price') || '';
      const type = btn.getAttribute('data-order-type') || 'Pedido';
      saveOrder({ name, price, type }).then(renderOrders);
      // Não usamos preventDefault: o link para o WhatsApp continua abrindo normalmente.
    });
  });

  const btnClearOrders = document.getElementById('btnClearOrders');
  if (btnClearOrders) {
    btnClearOrders.addEventListener('click', async () => {
      if (!currentUser) return;
      await apiRequest('limpar_pedidos', {});
      renderOrders();
    });
  }

  // 6. PRODUTOS DINÂMICOS (catálogo salvo em localStorage, editável pelo admin)
  const PRODUCTS_KEY = 'criscell_products';

  const DEFAULT_PRODUCTS = [
    {
      id: 1,
      category: 'Proteção Tela',
      name: 'Película de Cerâmica 9D',
      description: 'Resistência máxima contra impactos, sem trincar as bordas.',
      price: 25.00,
      image: 'https://images.pexels.com/photos/719399/pexels-photo-719399.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop',
      badge: 'Mais Vendido',
      badgeClass: 'bg-blue-accent text-white'
    },
    {
      id: 2,
      category: 'Energia',
      name: 'Carregador Turbo 20W PD',
      description: 'Fonte USB-C de carregamento rápido para iPhone e Android.',
      price: 65.00,
      image: 'https://images.pexels.com/photos/5208777/pexels-photo-5208777.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop',
      badge: 'Carga Rápida',
      badgeClass: 'bg-warning text-dark'
    },
    {
      id: 3,
      category: 'Áudio',
      name: 'Fone Bluetooth TWS Pro',
      description: 'Som estéreo de alta fidelidade com graves profundos e estojo recarregável.',
      price: 110.00,
      image: 'https://images.pexels.com/photos/14979021/pexels-photo-14979021.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop',
      badge: '',
      badgeClass: ''
    },
    {
      id: 4,
      category: 'Proteção Corpo',
      name: 'Capa Anti-Impacto MagSafe',
      description: 'Bordas reforçadas em TPU flexível com alinhamento magnético.',
      price: 45.00,
      image: 'https://images.pexels.com/photos/18403789/pexels-photo-18403789.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop',
      badge: '',
      badgeClass: ''
    }
  ];

  const getProducts = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
      if (stored && Array.isArray(stored) && (stored.length > 0 || productsAPI.online)) return stored;
    } catch (e) { /* ignora e usa padrão */ }
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  };

  const formatBRL = (value) => 'R$ ' + Number(value).toFixed(2).replace('.', ',');

  const renderProducts = () => {
    const grid = document.getElementById('produtosGrid');
    if (!grid) return;

    const products = getProducts();
    grid.innerHTML = '';

    if (products.length === 0) {
      grid.innerHTML = '<div class="col-12 text-center text-muted-adaptive py-4">Nenhum produto cadastrado no momento.</div>';
      return;
    }

    products.forEach((p) => {
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3';
      col.innerHTML = `
        <div class="product-card rounded-4 overflow-hidden border-0 shadow-sm h-100 d-flex flex-column">
          <div class="product-img-box position-relative overflow-hidden">
            ${p.badge ? `<span class="badge ${p.badgeClass || 'bg-blue-accent text-white'} position-absolute top-0 start-0 m-3 z-2">${escapeHTML(p.badge)}</span>` : ''}
            <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="img-fluid w-100 object-fit-cover product-img">
          </div>
          <div class="p-3 d-flex flex-column flex-grow-1">
            <span class="small text-muted-adaptive">${escapeHTML(p.category)}</span>
            <h6 class="fw-bold mb-2">${escapeHTML(p.name)}</h6>
            <p class="small text-muted-adaptive mb-3 flex-grow-1">${escapeHTML(p.description)}</p>
            <div class="d-flex align-items-center justify-content-between pt-2 border-top border-adaptive">
              <span class="fw-bold text-blue-accent">${formatBRL(p.price)}</span>
              <button type="button" class="btn btn-sm btn-soft-navy rounded-circle" data-add-cart="${p.id}" title="Adicionar ao Carrinho">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);
    });
  };

  renderProducts();

  // 6b. PRODUTOS VINDOS DO BANCO
  // Com a API no ar, o banco é a fonte dos produtos. Sem ela (ou com o site aberto por file://),
  // o catálogo salvo no navegador continua sendo exibido.
  const NO_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500"><rect width="100%" height="100%" fill="#e8f1fd"/><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="28">Sem imagem</text></svg>');

  const fromDB = (row) => ({
    id: Number(row.id),
    category: row.categoria || '',
    name: row.nome || '',
    description: row.descricao || '',
    price: Number(row.preco) || 0,
    image: row.imagem || NO_IMAGE,
    badge: row.badge || '',
    badgeClass: 'bg-blue-accent text-white'
  });

  const syncProductsFromAPI = async () => {
    const rows = await apiRequest('listar_produtos');
    if (!Array.isArray(rows)) { productsAPI.online = false; return; }
    productsAPI.online = true;
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(rows.map(fromDB)));
    document.dispatchEvent(new CustomEvent('criscell:products'));
  };

  document.addEventListener('criscell:products', renderProducts);
  syncProductsFromAPI();

  // 7. CARRINHO DE COMPRAS
  const CART_KEY = 'criscell_cart';
  const WHATSAPP_NUMBER = '55219922201888';

  const getCart = () => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  };

  const saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  };

  // Adiciona qualquer item (produto ou serviço) ao carrinho
  const addItemToCart = (newItem) => {
    const cart = getCart();
    const existing = cart.find((item) => String(item.id) === String(newItem.id));
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...newItem, qty: 1 });
    }
    saveCart(cart);
    renderCart();
  };

  const addToCart = (productId) => {
    const product = getProducts().find((p) => String(p.id) === String(productId));
    if (!product) return;
    addItemToCart({ id: product.id, name: product.name, price: product.price, kind: 'Produto' });
  };

  // Feedback visual rápido (ícone vira "check") ao adicionar
  const flashAdded = (btn) => {
    const icon = btn.querySelector('i');
    if (!icon) return;
    if (!btn.dataset.origIcon) btn.dataset.origIcon = icon.className;
    icon.className = 'fa-solid fa-check';
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => { icon.className = btn.dataset.origIcon; }, 900);
  };

  const changeQty = (itemId, delta) => {
    const cart = getCart();
    const item = cart.find((i) => String(i.id) === String(itemId));
    if (!item) return;
    item.qty += delta;
    saveCart(item.qty > 0 ? cart : cart.filter((i) => i !== item));
    renderCart();
  };

  const removeFromCart = (productId) => {
    const cart = getCart().filter((item) => String(item.id) !== String(productId));
    saveCart(cart);
    renderCart();
  };

  const clearCart = () => {
    localStorage.removeItem(CART_KEY);
    renderCart();
  };

  const renderCart = () => {
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
      if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
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
      const isService = item.kind === 'Serviço';
      if (isService) hasService = true;
      const prefix = isService ? 'a partir de ' : '';
      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `
        <div class="order-info">
          <span class="fw-bold small d-block">${escapeHTML(item.name)}</span>
          <small>${item.qty}x ${prefix}${formatBRL(item.price)} = ${prefix}${formatBRL(subtotal)}</small>
        </div>
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn btn-sm btn-soft-navy rounded-circle px-2 py-0" data-qty-minus="${escapeHTML(item.id)}" title="Diminuir" aria-label="Diminuir quantidade"><i class="fa-solid fa-minus"></i></button>
          <button type="button" class="btn btn-sm btn-soft-navy rounded-circle px-2 py-0" data-qty-plus="${escapeHTML(item.id)}" title="Aumentar" aria-label="Aumentar quantidade"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-1" data-remove-cart="${escapeHTML(item.id)}" title="Remover" aria-label="Remover item">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      list.appendChild(li);
    });

    totalEl.textContent = formatBRL(total);

    const totalLabel = document.getElementById('cartTotalLabel');
    const estimateNote = document.getElementById('cartEstimateNote');
    if (totalLabel) totalLabel.textContent = hasService ? 'Total estimado' : 'Total';
    if (estimateNote) estimateNote.classList.toggle('d-none', !hasService);
  };

  renderCart();

  // Delegação de eventos: adicionar ao carrinho a partir da grade de produtos
  const produtosGrid = document.getElementById('produtosGrid');
  if (produtosGrid) {
    produtosGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add-cart]');
      if (btn) {
        addToCart(btn.getAttribute('data-add-cart'));
        flashAdded(btn);
      }
    });
  }

  // Adicionar serviço ao carrinho (botões fixos no HTML da seção Serviços)
  document.querySelectorAll('[data-add-service]').forEach((btn) => {
    btn.addEventListener('click', () => {
      addItemToCart({
        id: btn.getAttribute('data-add-service'),
        name: btn.getAttribute('data-service-name') || 'Serviço',
        price: parseFloat(btn.getAttribute('data-service-price')) || 0,
        kind: 'Serviço'
      });
      flashAdded(btn);
    });
  });

  // Delegação de eventos: remover item do carrinho
  const cartItemsList = document.getElementById('cartItemsList');
  if (cartItemsList) {
    cartItemsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-cart]');
      if (btn) { removeFromCart(btn.getAttribute('data-remove-cart')); return; }
      const minus = e.target.closest('[data-qty-minus]');
      if (minus) { changeQty(minus.getAttribute('data-qty-minus'), -1); return; }
      const plus = e.target.closest('[data-qty-plus]');
      if (plus) changeQty(plus.getAttribute('data-qty-plus'), 1);
    });
  }

  const btnClearCart = document.getElementById('btnClearCart');
  if (btnClearCart) {
    btnClearCart.addEventListener('click', clearCart);
  }

  const btnCheckoutWhatsapp = document.getElementById('btnCheckoutWhatsapp');
  if (btnCheckoutWhatsapp) {
    btnCheckoutWhatsapp.addEventListener('click', (e) => {
      const cart = getCart();
      if (cart.length === 0) return;

      if (!getCurrentUser()) {
        // Fecha o carrinho e abre o login; os itens continuam salvos no carrinho.
        const cartEl = document.getElementById('cartOffcanvas');
        const oc = (cartEl && typeof bootstrap !== 'undefined') ? bootstrap.Offcanvas.getInstance(cartEl) : null;
        if (oc) {
          cartEl.addEventListener('hidden.bs.offcanvas', () => requireLogin(), { once: true });
          oc.hide();
        } else {
          requireLogin(e);
        }
        return;
      }

      let total = 0;
      let hasService = false;
      const lines = cart.map((item) => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        const isService = item.kind === 'Serviço';
        if (isService) hasService = true;
        return `${item.qty}x ${item.name}${isService ? ' (Serviço)' : ''} (${isService ? 'a partir de ' : ''}${formatBRL(subtotal)})`;
      });

      const message = `Olá! Gostaria de fechar o pedido:\n${lines.join('\n')}\n${hasService ? 'Total estimado' : 'Total'}: ${formatBRL(total)}` +
        (hasService ? '\n(Serviços a partir do valor indicado — aguardo o diagnóstico para confirmar.)' : '');

      saveOrder({
        name: `Pedido do Carrinho (${cart.reduce((s, i) => s + i.qty, 0)} itens)`,
        price: formatBRL(total),
        type: 'Carrinho'
      }).then(renderOrders);

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      clearCart();

      const cartOffcanvasEl = document.getElementById('cartOffcanvas');
      if (cartOffcanvasEl && typeof bootstrap !== 'undefined') {
        const offcanvas = bootstrap.Offcanvas.getInstance(cartOffcanvasEl);
        if (offcanvas) offcanvas.hide();
      }
    });
  }

  // 8. PAINEL ADMINISTRATIVO (admin.html) — exige login de administrador; tudo vem do banco via api.php
  const adminApp = document.getElementById('adminApp');
  if (adminApp) {
    const loginBox = document.getElementById('adminLoginBox');
    const logoutBtn = document.getElementById('btnAdminLogout');
    const productsList = document.getElementById('adminProductsList');
    const ordersList = document.getElementById('adminOrdersList');
    const usersList = document.getElementById('adminUsersList');
    const formProd = document.getElementById('formAdminProduct');
    const productsById = {};
    let editingId = null;

    const fmtDate = (s) => {
      const d = new Date(String(s || '').replace(' ', 'T'));
      return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
    };
    const emptyMsg = (el, msg) => { el.innerHTML = `<div class="text-center text-muted-adaptive py-4">${msg}</div>`; };
    const setField = (id, v) => { document.getElementById(id).value = v; };
    const resetProdForm = () => {
      formProd.reset();
      editingId = null;
      formProd.querySelector('button[type="submit"]').innerHTML = '<i class="fa-solid fa-plus me-1"></i> Adicionar Produto';
    };

    const loadProducts = async () => {
      const rows = await apiRequest('listar_produtos');
      if (!Array.isArray(rows)) return emptyMsg(productsList, 'Não foi possível carregar os produtos.');
      if (rows.length === 0) return emptyMsg(productsList, 'Nenhum produto cadastrado.');
      productsList.innerHTML = '';
      rows.forEach((r) => {
        const p = fromDB(r);
        productsById[p.id] = p;
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
            <button type="button" class="btn btn-sm btn-soft-navy rounded-circle" data-edit-product="${p.id}" title="Editar" aria-label="Editar produto"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle" data-delete-product="${p.id}" title="Excluir" aria-label="Excluir produto"><i class="fa-solid fa-trash"></i></button>
          </div>`;
        productsList.appendChild(row);
      });
    };

    const loadOrders = async () => {
      const rows = await apiRequest('listar_pedidos', {});
      if (!Array.isArray(rows)) return emptyMsg(ordersList, 'Não foi possível carregar os pedidos.');
      if (rows.length === 0) return emptyMsg(ordersList, 'Nenhum pedido registrado ainda.');
      ordersList.innerHTML = '';
      rows.forEach((o) => {
        const done = o.status === 'concluido';
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info">
            <span class="fw-bold small d-block">${escapeHTML(o.nome)}</span>
            <small>${escapeHTML(o.cliente)} (${escapeHTML(o.email)}) • ${escapeHTML(o.tipo)}${o.preco ? ' • ' + escapeHTML(o.preco) : ''} — ${escapeHTML(o.data)}</small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${done ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${done ? 'Concluído' : 'Pendente'}</span>
            <button type="button" class="btn btn-sm btn-navy-outline rounded-pill extra-small" data-toggle-status="${o.id}" data-status="${escapeHTML(o.status)}">Marcar ${done ? 'Pendente' : 'Concluído'}</button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle" data-delete-order="${o.id}" title="Excluir pedido" aria-label="Excluir pedido"><i class="fa-solid fa-trash"></i></button>
          </div>`;
        ordersList.appendChild(row);
      });
    };

    const loadUsers = async () => {
      const rows = await apiRequest('listar_usuarios', {});
      if (!Array.isArray(rows)) return emptyMsg(usersList, 'Não foi possível carregar os usuários.');
      if (rows.length === 0) return emptyMsg(usersList, 'Nenhum usuário cadastrado ainda.');
      usersList.innerHTML = '';
      rows.forEach((u) => {
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info">
            <span class="fw-bold small d-block">${escapeHTML(u.nome)}${u.papel === 'admin' ? ' <span class="badge bg-secondary">admin</span>' : ''}</span>
            <small><i class="fa-solid fa-user me-1"></i>${escapeHTML(u.email)} • <i class="fa-solid fa-phone me-1"></i>${escapeHTML(u.telefone || '—')}</small>
          </div>
          <small class="text-nowrap"><i class="fa-regular fa-calendar me-1"></i>Desde ${fmtDate(u.data_cadastro)}</small>`;
        usersList.appendChild(row);
      });
    };

    const showAdmin = (on) => {
      adminApp.classList.toggle('d-none', !on);
      loginBox.classList.toggle('d-none', on);
      if (logoutBtn) logoutBtn.classList.toggle('d-none', !on);
      if (on) { loadProducts(); loadOrders(); loadUsers(); }
    };

    apiRequest('sessao').then((r) => showAdmin(!!(r && r.usuario && r.usuario.papel === 'admin')));

    document.getElementById('formAdminLogin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('adminLoginError');
      const r = await apiRequest('login', {
        email: document.getElementById('adminLoginEmail').value.trim().toLowerCase(),
        senha: document.getElementById('adminLoginPassword').value
      });
      if (!r) return showMsg(errEl, 'Não foi possível conectar ao servidor.');
      if (!r.sucesso) return showMsg(errEl, r.mensagem);
      if (r.usuario.papel !== 'admin') return showMsg(errEl, 'Esta conta não tem permissão de administrador.');
      errEl.classList.add('d-none');
      e.target.reset();
      showAdmin(true);
    });

    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await apiRequest('logout', {}); showAdmin(false); });

    formProd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = {
        nome: document.getElementById('adminProdNome').value.trim(),
        categoria: document.getElementById('adminProdCategoria').value.trim(),
        descricao: document.getElementById('adminProdDescricao').value.trim(),
        preco: document.getElementById('adminProdPreco').value,
        imagem: document.getElementById('adminProdImagem').value.trim(),
        badge: document.getElementById('adminProdBadge').value.trim(),
        estoque: 1
      };
      if (editingId) fields.id = editingId;
      const r = await apiRequest(editingId ? 'editar_produto' : 'cadastrar_produto', fields);
      if (!r || !r.sucesso) { alert((r && r.mensagem) || 'Não foi possível salvar o produto.'); return; }
      resetProdForm();
      loadProducts();
    });

    productsList.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-product]');
      const delBtn = e.target.closest('[data-delete-product]');
      if (editBtn) {
        const p = productsById[editBtn.getAttribute('data-edit-product')];
        if (!p) return;
        setField('adminProdCategoria', p.category);
        setField('adminProdNome', p.name);
        setField('adminProdDescricao', p.description);
        setField('adminProdPreco', p.price);
        setField('adminProdImagem', p.image === NO_IMAGE ? '' : p.image);
        setField('adminProdBadge', p.badge);
        editingId = p.id;
        formProd.querySelector('button[type="submit"]').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Salvar Edição';
        formProd.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (delBtn) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;
        const r = await apiRequest('excluir_produto', { id: delBtn.getAttribute('data-delete-product') });
        if (!r || !r.sucesso) { alert((r && r.mensagem) || 'Não foi possível excluir o produto.'); return; }
        loadProducts();
      }
    });

    ordersList.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-delete-order]');
      if (delBtn) {
        if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
        await apiRequest('excluir_pedido', { id: delBtn.getAttribute('data-delete-order') });
        loadOrders();
        return;
      }
      const btn = e.target.closest('[data-toggle-status]');
      if (!btn) return;
      const next = btn.getAttribute('data-status') === 'concluido' ? 'pendente' : 'concluido';
      await apiRequest('atualizar_status_pedido', { id: btn.getAttribute('data-toggle-status'), status: next });
      loadOrders();
    });
  }
});
