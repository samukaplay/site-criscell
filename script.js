/* ==========================================================================
   CRISCELL - SCRIPT DE INTERATIVIDADE, TEMA PERSISTENTE, PERFIL, CARRINHO
   E PRODUTOS DINÂMICOS (dados salvos em localStorage — sem backend por ora)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // 1. GERENCIAMENTO DE TEMA (DARK MODE PERSISTENTE)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const body = document.body;

  const applyStoredTheme = () => {
    const savedTheme = localStorage.getItem('criscell_theme') || 'light';
    if (savedTheme === 'dark') {
      body.classList.remove('theme-light');
      body.classList.add('theme-dark');
      if (themeToggleBtn) themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
    } else {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      if (themeToggleBtn) themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
    }
  };

  applyStoredTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      if (body.classList.contains('theme-dark')) {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        localStorage.setItem('criscell_theme', 'light');
        themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
      } else {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        localStorage.setItem('criscell_theme', 'dark');
        themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
      }
    });
  }

  // 2. INICIALIZAÇÃO DE ANIMAÇÕES AOS
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      once: true,
      offset: 100
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

  // 4. CONTAS DE USUÁRIO — LOGIN / CADASTRO / PERFIL
  // Simulado 100% no navegador (localStorage): cada "conta" fica salva em
  // criscell_users (por e-mail) e a sessão ativa em criscell_session.
  // Isso ainda não é autenticação segura de verdade — será substituído por
  // um backend real futuramente — mas já vincula os pedidos a cada usuário.
  const USERS_KEY = 'criscell_users';
  const SESSION_KEY = 'criscell_session';

  const getUsers = () => {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    } catch (e) {
      return {};
    }
  };

  const saveUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const getSession = () => localStorage.getItem(SESSION_KEY) || null;
  const setSession = (email) => localStorage.setItem(SESSION_KEY, email);
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const getCurrentUser = () => {
    const session = getSession();
    if (!session) return null;
    return getUsers()[session] || null;
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
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;
      const errorEl = document.getElementById('loginError');
      const user = getUsers()[email];

      if (!user || user.password !== password) {
        if (errorEl) {
          errorEl.textContent = 'E-mail ou senha incorretos.';
          errorEl.classList.remove('d-none');
        }
        return;
      }

      if (errorEl) errorEl.classList.add('d-none');
      setSession(email);
      updateAuthUI();
      formLogin.reset();

      const modalEl = document.getElementById('authModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    });
  }

  // Cadastro
  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim().toLowerCase();
      const phone = document.getElementById('regPhone').value.trim();
      const password = document.getElementById('regPassword').value;
      const errorEl = document.getElementById('registerError');
      const users = getUsers();

      if (users[email]) {
        if (errorEl) {
          errorEl.textContent = 'Este e-mail já está cadastrado. Faça login.';
          errorEl.classList.remove('d-none');
        }
        return;
      }

      if (errorEl) errorEl.classList.add('d-none');
      users[email] = { name, email, phone, password, createdAt: new Date().toISOString() };
      saveUsers(users);
      setSession(email);
      updateAuthUI();
      formRegister.reset();
      alert('Cadastro efetuado com sucesso!');

      const modalEl = document.getElementById('authModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    });
  }

  // Salvar alterações do perfil (nome e telefone; e-mail é a chave da conta)
  const formProfile = document.getElementById('formProfile');
  if (formProfile) {
    formProfile.addEventListener('submit', (e) => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;

      const users = getUsers();
      if (!users[session]) return;

      users[session].name = document.getElementById('profileName').value.trim();
      users[session].phone = document.getElementById('profilePhone').value.trim();
      saveUsers(users);
      loadProfile();

      alert('Informações salvas com sucesso!');

      const modalEl = document.getElementById('authModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    });
  }

  // Sair (mantém a conta salva, apenas encerra a sessão)
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      clearSession();
      updateAuthUI();
      if (formLogin) formLogin.reset();
    });
  }

  // 5. HISTÓRICO DE COMPRAS E PEDIDOS (Meus Pedidos) — com status Pendente/Concluído
  const ORDERS_KEY = 'criscell_orders';

  const getOrders = () => {
    try {
      return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  };

  const saveOrders = (orders) => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 50)));
  };

  const saveOrder = (order) => {
    const orders = getOrders();
    const currentUser = getCurrentUser();
    orders.unshift({
      status: 'pendente',
      owner: currentUser ? currentUser.email : null,
      customerName: currentUser ? currentUser.name : 'Convidado (sem login)',
      ...order
    });
    saveOrders(orders);
  };

  const renderOrders = () => {
    const list = document.getElementById('ordersList');
    const emptyState = document.getElementById('ordersEmptyState');
    if (!list || !emptyState) return;

    const session = getSession();
    const orders = getOrders().filter((order) => session && order.owner === session);
    list.innerHTML = '';

    if (orders.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }
    emptyState.classList.add('d-none');

    orders.forEach((order) => {
      const status = order.status || 'pendente';
      const statusBadge = status === 'concluido'
        ? '<span class="badge bg-success rounded-pill">Concluído</span>'
        : '<span class="badge bg-warning text-dark rounded-pill">Pendente</span>';

      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `
        <div class="order-info">
          <span class="fw-bold small d-block">${order.name}</span>
          <small>${order.type}${order.price ? ' • ' + order.price : ''} — ${order.date}</small>
        </div>
        ${statusBadge}
      `;
      list.appendChild(li);
    });
  };

  updateAuthUI();

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
      const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      saveOrder({ name, price, type, date });
      renderOrders();
      // Não usamos preventDefault: o link para o WhatsApp continua abrindo normalmente.
    });
  });

  const btnClearOrders = document.getElementById('btnClearOrders');
  if (btnClearOrders) {
    btnClearOrders.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      const remaining = getOrders().filter((order) => order.owner !== session);
      saveOrders(remaining);
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
      if (stored && Array.isArray(stored) && stored.length > 0) return stored;
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
      col.setAttribute('data-aos', 'fade-up');
      col.innerHTML = `
        <div class="product-card rounded-4 overflow-hidden border-0 shadow-sm h-100 d-flex flex-column">
          <div class="product-img-box position-relative overflow-hidden">
            ${p.badge ? `<span class="badge ${p.badgeClass || 'bg-blue-accent text-white'} position-absolute top-0 start-0 m-3 z-2">${p.badge}</span>` : ''}
            <img src="${p.image}" alt="${p.name}" class="img-fluid w-100 object-fit-cover product-img">
          </div>
          <div class="p-3 d-flex flex-column flex-grow-1">
            <span class="small text-muted-adaptive">${p.category || ''}</span>
            <h6 class="fw-bold mb-2">${p.name}</h6>
            <p class="small text-muted-adaptive mb-3 flex-grow-1">${p.description || ''}</p>
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
          <span class="fw-bold small d-block">${item.name}</span>
          <small>${item.qty}x ${prefix}${formatBRL(item.price)} = ${prefix}${formatBRL(subtotal)}</small>
        </div>
        <button type="button" class="btn btn-sm btn-link text-danger p-0" data-remove-cart="${item.id}" title="Remover">
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
      if (btn) removeFromCart(btn.getAttribute('data-remove-cart'));
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
        if (cartEl && typeof bootstrap !== 'undefined') {
          const oc = bootstrap.Offcanvas.getInstance(cartEl);
          if (oc) oc.hide();
        }
        requireLogin(e);
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
      const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      saveOrder({
        name: `Pedido do Carrinho (${cart.reduce((s, i) => s + i.qty, 0)} itens)`,
        price: formatBRL(total),
        type: 'Carrinho',
        date
      });
      renderOrders();

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
      clearCart();

      const cartOffcanvasEl = document.getElementById('cartOffcanvas');
      if (cartOffcanvasEl && typeof bootstrap !== 'undefined') {
        const offcanvas = bootstrap.Offcanvas.getInstance(cartOffcanvasEl);
        if (offcanvas) offcanvas.hide();
      }
    });
  }

  // 8. PAINEL ADMINISTRATIVO (admin.html) — gerencia produtos e status de pedidos
  // Só é executado quando os elementos do admin existem na página.
  const adminProductsList = document.getElementById('adminProductsList');
  const formAdminProduct = document.getElementById('formAdminProduct');

  if (adminProductsList || formAdminProduct) {
    let editingId = null;

    const renderAdminProducts = () => {
      if (!adminProductsList) return;
      const products = getProducts();
      adminProductsList.innerHTML = '';

      if (products.length === 0) {
        adminProductsList.innerHTML = '<div class="text-center text-muted-adaptive py-4">Nenhum produto cadastrado.</div>';
        return;
      }

      products.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info d-flex align-items-center gap-3">
            <img src="${p.image}" alt="${p.name}" style="width:48px;height:48px;object-fit:cover;border-radius:10px;">
            <div>
              <span class="fw-bold small d-block">${p.name}</span>
              <small>${p.category || ''} • ${formatBRL(p.price)}</small>
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

    renderAdminProducts();

    if (formAdminProduct) {
      formAdminProduct.addEventListener('submit', (e) => {
        e.preventDefault();
        const products = getProducts();

        const productData = {
          category: document.getElementById('adminProdCategoria').value.trim(),
          name: document.getElementById('adminProdNome').value.trim(),
          description: document.getElementById('adminProdDescricao').value.trim(),
          price: parseFloat(document.getElementById('adminProdPreco').value) || 0,
          image: document.getElementById('adminProdImagem').value.trim(),
          badge: document.getElementById('adminProdBadge').value.trim(),
          badgeClass: 'bg-blue-accent text-white'
        };

        if (editingId) {
          const idx = products.findIndex((p) => String(p.id) === String(editingId));
          if (idx > -1) products[idx] = { ...products[idx], ...productData };
          editingId = null;
          formAdminProduct.querySelector('button[type="submit"]').innerHTML = '<i class="fa-solid fa-plus me-1"></i> Adicionar Produto';
        } else {
          const newId = products.length > 0 ? Math.max(...products.map((p) => Number(p.id))) + 1 : 1;
          products.push({ id: newId, ...productData });
        }

        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
        formAdminProduct.reset();
        renderAdminProducts();
        renderProducts();
      });
    }

    if (adminProductsList) {
      adminProductsList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-product]');
        const delBtn = e.target.closest('[data-delete-product]');

        if (editBtn) {
          const id = editBtn.getAttribute('data-edit-product');
          const product = getProducts().find((p) => String(p.id) === String(id));
          if (!product) return;
          document.getElementById('adminProdCategoria').value = product.category || '';
          document.getElementById('adminProdNome').value = product.name || '';
          document.getElementById('adminProdDescricao').value = product.description || '';
          document.getElementById('adminProdPreco').value = product.price || 0;
          document.getElementById('adminProdImagem').value = product.image || '';
          document.getElementById('adminProdBadge').value = product.badge || '';
          editingId = id;
          formAdminProduct.querySelector('button[type="submit"]').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Salvar Edição';
          formAdminProduct.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (delBtn) {
          const id = delBtn.getAttribute('data-delete-product');
          if (!confirm('Tem certeza que deseja excluir este produto?')) return;
          const products = getProducts().filter((p) => String(p.id) !== String(id));
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
          renderAdminProducts();
          renderProducts();
        }
      });
    }
  }

  // Evita injeção de HTML ao exibir dados digitados por usuários
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  // Gestão de pedidos no painel administrativo
  const adminOrdersList = document.getElementById('adminOrdersList');
  if (adminOrdersList) {
    const renderAdminOrders = () => {
      const orders = getOrders();
      adminOrdersList.innerHTML = '';

      if (orders.length === 0) {
        adminOrdersList.innerHTML = '<div class="text-center text-muted-adaptive py-4">Nenhum pedido registrado neste navegador ainda.</div>';
        return;
      }

      orders.forEach((order, index) => {
        const status = order.status || 'pendente';
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info">
            <span class="fw-bold small d-block">${escapeHTML(order.name)}</span>
            <small>${escapeHTML(order.customerName || 'Convidado')} • ${escapeHTML(order.type)}${order.price ? ' • ' + escapeHTML(order.price) : ''} — ${escapeHTML(order.date)}</small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${status === 'concluido' ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${status === 'concluido' ? 'Concluído' : 'Pendente'}</span>
            <button type="button" class="btn btn-sm btn-navy-outline rounded-pill extra-small" data-toggle-status="${index}">
              Marcar ${status === 'concluido' ? 'Pendente' : 'Concluído'}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle" data-delete-order="${index}" title="Excluir pedido" aria-label="Excluir pedido">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
        adminOrdersList.appendChild(row);
      });
    };

    renderAdminOrders();

    adminOrdersList.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-delete-order]');
      if (delBtn) {
        const delIndex = Number(delBtn.getAttribute('data-delete-order'));
        if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
        const current = getOrders();
        if (!current[delIndex]) return;
        current.splice(delIndex, 1);
        saveOrders(current);
        renderAdminOrders();
        return;
      }

      const btn = e.target.closest('[data-toggle-status]');
      if (!btn) return;
      const index = Number(btn.getAttribute('data-toggle-status'));
      const orders = getOrders();
      if (!orders[index]) return;
      orders[index].status = (orders[index].status || 'pendente') === 'concluido' ? 'pendente' : 'concluido';
      saveOrders(orders);
      renderAdminOrders();
    });
  }

  // Lista de usuários no painel administrativo (sem senhas)
  const adminUsersList = document.getElementById('adminUsersList');
  if (adminUsersList) {
    const formatSince = (iso) => {
      if (!iso) return 'Data não registrada';
      const d = new Date(iso);
      return isNaN(d) ? 'Data não registrada' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const renderAdminUsers = () => {
      const users = Object.values(getUsers());
      adminUsersList.innerHTML = '';

      if (users.length === 0) {
        adminUsersList.innerHTML = '<div class="text-center text-muted-adaptive py-4">Nenhum usuário cadastrado neste navegador ainda.</div>';
        return;
      }

      users.forEach((u) => {
        const row = document.createElement('div');
        row.className = 'order-item align-items-center';
        row.innerHTML = `
          <div class="order-info">
            <span class="fw-bold small d-block">${escapeHTML(u.name || '—')}</span>
            <small><i class="fa-solid fa-user me-1"></i>${escapeHTML(u.email)} • <i class="fa-solid fa-phone me-1"></i>${escapeHTML(u.phone || '—')}</small>
          </div>
          <small class="text-nowrap"><i class="fa-regular fa-calendar me-1"></i>Desde ${formatSince(u.createdAt)}</small>
        `;
        adminUsersList.appendChild(row);
      });
    };

    renderAdminUsers();
  }

});
