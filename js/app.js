// Main Application
document.addEventListener('DOMContentLoaded', () => {
    const config = window.appConfig || {};
    const supabase = config.supabase;
    const showNotification = config.showNotification || console.log;
    const formatCurrency = config.formatCurrency || (amount => `$${amount}`);
    const formatDate = config.formatDate || (date => date);

    // Global State
    let currentUser = null;
    let cart = [];
    let products = [];
    let customers = [];
    let categories = [];
    
    // Chart instances
    let salesChart = null;
    let topProductsChart = null;

    // DOM Elements
    const loginScreen = document.getElementById('loginScreen');
    const app = document.getElementById('app');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const menuItems = document.querySelectorAll('.menu-item');

    // Initialize
    init();

    function init() {
        // Check Supabase connection
        if (!supabase) {
            console.error('Supabase no está disponible');
            showNotification('Error de conexión a la base de datos', 'error');
        }

        // Event Listeners
        loginForm.addEventListener('submit', handleLogin);
        logoutBtn.addEventListener('click', handleLogout);
        menuToggle.addEventListener('click', toggleSidebar);
        
        // Navigation
        menuItems.forEach(item => {
            item.addEventListener('click', handleNavigation);
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 1024 && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Login
    async function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!supabase) {
            showNotification('Error de conexión', 'error');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('username', username)
                .eq('activo', true);

            if (error) {
                console.error('Database error:', error);
                showNotification('Error al consultar usuario', 'error');
                return;
            }

            if (!data || data.length === 0) {
                showNotification('Usuario no encontrado', 'error');
                return;
            }

            const user = data[0];

            if (user.password !== password) {
                showNotification('Contraseña incorrecta', 'error');
                return;
            }

            currentUser = user;
            
            document.getElementById('currentUser').textContent = user.nombre;
            document.getElementById('currentRole').textContent = user.role === 'admin' ? 'Administrador' : 'Empleado';

            const adminSections = document.querySelectorAll('.admin-only');
            if (user.role === 'admin') {
                adminSections.forEach(el => el.classList.remove('hidden'));
            } else {
                adminSections.forEach(el => el.classList.add('hidden'));
            }

            loginScreen.classList.add('hidden');
            app.classList.remove('hidden');

            await loadInitialData();
            
            if (user.role === 'admin') {
                loadDashboard();
            } else {
                document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
                document.getElementById('posSection').classList.remove('hidden');
                menuItems.forEach(item => item.classList.remove('active'));
                document.querySelector('[data-section="pos"]').classList.add('active');
                loadPOS();
            }
            
            showNotification('Bienvenido ' + user.nombre, 'success');
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Error al iniciar sesión', 'error');
        }
    }

    function handleLogout() {
        if (confirm('¿Cerrar sesión?')) {
            currentUser = null;
            cart = [];
            app.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            loginForm.reset();
            showNotification('Sesión cerrada', 'info');
        }
    }

    function toggleSidebar() {
        sidebar.classList.toggle('active');
    }

    function handleNavigation(e) {
        const section = e.currentTarget.getAttribute('data-section');
        
        menuItems.forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');

        document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));

        const sectionElement = document.getElementById(section + 'Section');
        if (sectionElement) {
            sectionElement.classList.remove('hidden');
        }

        loadSectionData(section);

        if (window.innerWidth < 1024) {
            sidebar.classList.remove('active');
        }
    }

    async function loadInitialData() {
        await Promise.all([
            loadCategories(),
            loadProducts(),
            loadCustomers()
        ]);
        loadDashboard();
    }

    function loadSectionData(section) {
        switch(section) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'pos':
                loadPOS();
                break;
            case 'products':
                loadProductsSection();
                break;
            case 'customers':
                loadCustomersSection();
                break;
            case 'debts':
                loadDebtsSection();
                break;
            case 'sales':
                loadSalesSection();
                break;
            case 'employees':
                loadEmployeesSection();
                break;
            case 'profile':
                loadProfileSection();
                break;
            case 'reports':
                loadReports();
                break;
            case 'config':
                loadConfig();
                break;
        }
    }

    // ==================== CATEGORIES ====================
    async function loadCategories() {
        if (!supabase) return;
        
        try {
            const { data, error } = await supabase
                .from('categorias')
                .select('*')
                .order('nombre');

            if (error) throw error;
            categories = data || [];
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // ==================== PRODUCTS ====================
    async function loadProducts() {
        if (!supabase) return;
        
        try {
            const { data, error } = await supabase
                .from('productos')
                .select(`
                    *,
                    categorias (nombre)
                `)
                .eq('activo', true)
                .order('nombre');

            if (error) throw error;
            products = data || [];
        } catch (error) {
            console.error('Error loading products:', error);
            products = [];
        }
    }

    async function loadProductsSection() {
        await loadProducts();
        
        const tbody = document.querySelector('#productsTable tbody');
        tbody.innerHTML = '';

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay productos</td></tr>';
            return;
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.codigo || '-'}</td>
                <td>${product.nombre}</td>
                <td>${product.categorias?.nombre || '-'}</td>
                <td>${formatCurrency(product.precio)}</td>
                <td>
                    <span class="status-badge ${product.stock <= product.stock_minimo ? 'status-warning' : 'status-active'}">
                        ${product.stock}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-active">Activo</span>
                </td>
                <td>
                    <button class="btn-secondary" style="padding: 6px 12px; margin-right: 5px;" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-secondary" style="padding: 6px 12px; color: var(--danger);" onclick="deleteProduct(${product.id}, '${product.nombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        const searchInput = document.getElementById('searchProducts');
        searchInput.oninput = (e) => {
            const search = e.target.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(search) ? '' : 'none';
            });
        };

        document.getElementById('addProductBtn').onclick = () => showProductModal();
    }

    async function showProductModal(productId = null) {
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        const title = document.getElementById('productModalTitle');
        
        form.reset();
        document.getElementById('productId').value = '';
        title.textContent = 'Agregar Producto';

        const categorySelect = document.getElementById('productCategory');
        categorySelect.innerHTML = '<option value="">Seleccionar...</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${cat.nombre}</option>`;
        });

        if (productId) {
            const product = products.find(p => p.id === productId);
            if (product) {
                title.textContent = 'Editar Producto';
                document.getElementById('productId').value = product.id;
                document.getElementById('productCode').value = product.codigo || '';
                document.getElementById('productName').value = product.nombre;
                document.getElementById('productCategory').value = product.categoria_id || '';
                document.getElementById('productPrice').value = product.precio;
                document.getElementById('productCost').value = product.costo || '';
                document.getElementById('productStock').value = product.stock;
                document.getElementById('productDescription').value = product.descripcion || '';
            }
        } else {
            const nextCode = await getNextProductCode();
            document.getElementById('productCode').value = nextCode;
        }

        modal.classList.remove('hidden');

        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => modal.classList.add('hidden');
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveProduct();
        };
    }

    async function getNextProductCode() {
        if (!supabase) return '1';

        try {
            const { data, error } = await supabase
                .from('productos')
                .select('codigo')
                .order('id', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) {
                return '1';
            }

            const lastCode = data[0].codigo;
            const codeNum = parseInt(lastCode) || 0;
            return String(codeNum + 1);
        } catch (error) {
            console.error('Error getting next code:', error);
            return '1';
        }
    }

    async function saveProduct() {
        if (!supabase) return;

        const productId = document.getElementById('productId').value;
        const productData = {
            codigo: document.getElementById('productCode').value,
            nombre: document.getElementById('productName').value,
            categoria_id: parseInt(document.getElementById('productCategory').value) || null,
            precio: parseFloat(document.getElementById('productPrice').value),
            costo: parseFloat(document.getElementById('productCost').value) || null,
            stock: parseInt(document.getElementById('productStock').value),
            descripcion: document.getElementById('productDescription').value || null,
            activo: true
        };

        try {
            let result;
            if (productId) {
                result = await supabase
                    .from('productos')
                    .update(productData)
                    .eq('id', productId);
            } else {
                result = await supabase
                    .from('productos')
                    .insert([productData]);
            }

            if (result.error) throw result.error;

            document.getElementById('productModal').classList.add('hidden');
            showNotification('Producto guardado', 'success');
            loadProductsSection();
        } catch (error) {
            console.error('Error saving product:', error);
            showNotification('Error al guardar producto', 'error');
        }
    }

    window.editProduct = (id) => showProductModal(id);

    async function deleteProduct(productId, productName) {
        if (!supabase) return;

        if (!confirm(`¿Está seguro de eliminar el producto "${productName}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('productos')
                .update({ activo: false })
                .eq('id', productId);

            if (error) throw error;

            showNotification('Producto eliminado', 'success');
            loadProductsSection();
        } catch (error) {
            console.error('Error deleting product:', error);
            showNotification('Error al eliminar producto', 'error');
        }
    }

    window.deleteProduct = deleteProduct;

    // ==================== CUSTOMERS ====================
    async function loadCustomers() {
        if (!supabase) return;
        
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('activo', true)
                .order('nombre');

            if (error) throw error;
            customers = data || [];
        } catch (error) {
            console.error('Error loading customers:', error);
            customers = [];
        }
    }

    async function loadCustomersSection() {
        await loadCustomers();
        
        const tbody = document.querySelector('#customersTable tbody');
        tbody.innerHTML = '';

        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay clientes</td></tr>';
            return;
        }

        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${customer.nombre}</td>
                <td>${customer.telefono || '-'}</td>
                <td>
                    <span class="status-badge ${customer.deuda_total > 0 ? 'status-warning' : 'status-active'}">
                        ${formatCurrency(customer.deuda_total || 0)}
                    </span>
                </td>
                <td><span class="status-badge status-active">Activo</span></td>
                <td>
                    <button class="btn-secondary" style="padding: 6px 12px; margin-right: 5px;" onclick="editCustomer(${customer.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-secondary" style="padding: 6px 12px; color: var(--danger);" onclick="deleteCustomer(${customer.id}, '${customer.nombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('searchCustomers').oninput = (e) => {
            const search = e.target.value.toLowerCase();
            tbody.querySelectorAll('tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
            });
        };

        document.getElementById('addCustomerBtn').onclick = () => showCustomerModal();
    }

    function showCustomerModal(customerId = null) {
        const modal = document.getElementById('customerModal');
        const form = document.getElementById('customerForm');
        const title = document.getElementById('customerModalTitle');
        
        form.reset();
        document.getElementById('customerId').value = '';
        title.textContent = 'Agregar Cliente';

        if (customerId) {
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                title.textContent = 'Editar Cliente';
                document.getElementById('customerId').value = customer.id;
                document.getElementById('customerName').value = customer.nombre;
                document.getElementById('customerPhone').value = customer.telefono || '';
                document.getElementById('customerEmail').value = customer.email || '';
                document.getElementById('customerAddress').value = customer.direccion || '';
            }
        }

        modal.classList.remove('hidden');

        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => modal.classList.add('hidden');
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveCustomer();
        };
    }

    async function saveCustomer() {
        if (!supabase) return;

        const customerId = document.getElementById('customerId').value;
        const customerData = {
            nombre: document.getElementById('customerName').value,
            telefono: document.getElementById('customerPhone').value || null,
            email: document.getElementById('customerEmail').value || null,
            direccion: document.getElementById('customerAddress').value || null,
            activo: true
        };

        try {
            let result;
            if (customerId) {
                result = await supabase
                    .from('clientes')
                    .update(customerData)
                    .eq('id', customerId);
            } else {
                result = await supabase
                    .from('clientes')
                    .insert([customerData]);
            }

            if (result.error) throw result.error;

            document.getElementById('customerModal').classList.add('hidden');
            showNotification('Cliente guardado', 'success');
            loadCustomersSection();
        } catch (error) {
            console.error('Error saving customer:', error);
            showNotification('Error al guardar cliente', 'error');
        }
    }

    window.editCustomer = (id) => showCustomerModal(id);

    async function deleteCustomer(customerId, customerName) {
        if (!supabase) return;

        if (!confirm(`¿Está seguro de eliminar el cliente "${customerName}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('clientes')
                .update({ activo: false })
                .eq('id', customerId);

            if (error) throw error;

            showNotification('Cliente eliminado', 'success');
            loadCustomersSection();
        } catch (error) {
            console.error('Error deleting customer:', error);
            showNotification('Error al eliminar cliente', 'error');
        }
    }

    window.deleteCustomer = deleteCustomer;

    // ==================== DEBTS ====================
    async function loadDebtsSection() {
        if (!supabase) return;

        try {
            const { data: debtors, error } = await supabase
                .from('clientes')
                .select(`
                    *,
                    ventas!ventas_cliente_id_fkey (
                        fecha,
                        total
                    )
                `)
                .gt('deuda_total', 0)
                .eq('activo', true)
                .order('deuda_total', { ascending: false });

            if (error) throw error;

            const totalDebt = debtors?.reduce((sum, d) => sum + parseFloat(d.deuda_total || 0), 0) || 0;
            document.getElementById('totalDebt').textContent = formatCurrency(totalDebt);
            document.getElementById('debtorsCount').textContent = debtors?.length || 0;

            const tbody = document.querySelector('#debtsTable tbody');
            tbody.innerHTML = '';

            if (!debtors || debtors.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay clientes con deuda</td></tr>';
                return;
            }

            debtors.forEach(debtor => {
                const lastSale = debtor.ventas && debtor.ventas.length > 0 
                    ? debtor.ventas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
                    : null;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${debtor.nombre}</td>
                    <td>${debtor.telefono || '-'}</td>
                    <td>
                        <span class="status-badge status-warning" style="font-weight: 700; font-size: 16px;">
                            ${formatCurrency(debtor.deuda_total)}
                        </span>
                    </td>
                    <td>${lastSale ? formatDate(lastSale.fecha) : 'N/A'}</td>
                    <td>
                        <button class="btn-primary" style="padding: 6px 12px; margin-right: 5px;" onclick="showPaymentModal(${debtor.id}, '${debtor.nombre.replace(/'/g, "\\'")}', ${debtor.deuda_total})">
                            <i class="fas fa-dollar-sign"></i> Pagar
                        </button>
                        <button class="btn-secondary" style="padding: 6px 12px;" onclick="viewDebtHistory(${debtor.id})">
                            <i class="fas fa-history"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('searchDebts').oninput = (e) => {
                const search = e.target.value.toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
                });
            };

        } catch (error) {
            console.error('Error loading debts:', error);
        }
    }

    function showPaymentModal(customerId, customerName, currentDebt) {
        const modal = document.getElementById('paymentModal');
        const form = document.getElementById('paymentForm');

        form.reset();
        document.getElementById('paymentCustomerId').value = customerId;
        document.getElementById('paymentCustomerName').value = customerName;
        document.getElementById('paymentCurrentDebt').value = formatCurrency(currentDebt);
        document.getElementById('paymentAmount').max = currentDebt;

        modal.classList.remove('hidden');

        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => modal.classList.add('hidden');
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            await registerPayment();
        };
    }

    async function registerPayment() {
        if (!supabase) return;

        const customerId = document.getElementById('paymentCustomerId').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const method = document.getElementById('paymentMethodType').value;
        const reference = document.getElementById('paymentReference').value;
        const notes = document.getElementById('paymentNotes').value;

        if (amount <= 0) {
            showNotification('El monto debe ser mayor a 0', 'error');
            return;
        }

        try {
            const { error: paymentError } = await supabase
                .from('pagos')
                .insert([{
                    cliente_id: customerId,
                    monto: amount,
                    fecha: new Date().toISOString(),
                    metodo_pago: method,
                    referencia: reference || null,
                    notas: notes || null
                }]);

            if (paymentError) throw paymentError;

            const { data: customer } = await supabase
                .from('clientes')
                .select('deuda_total')
                .eq('id', customerId)
                .single();

            const newDebt = Math.max(0, (customer.deuda_total || 0) - amount);

            const { error: updateError } = await supabase
                .from('clientes')
                .update({ deuda_total: newDebt })
                .eq('id', customerId);

            if (updateError) throw updateError;

            document.getElementById('paymentModal').classList.add('hidden');
            showNotification('Pago registrado exitosamente', 'success');
            
            await loadCustomers();
            loadDebtsSection();
            loadDashboard();

        } catch (error) {
            console.error('Error registering payment:', error);
            showNotification('Error al registrar el pago', 'error');
        }
    }

    async function viewDebtHistory(customerId) {
        if (!supabase) return;

        try {
            const { data: payments } = await supabase
                .from('pagos')
                .select('*')
                .eq('cliente_id', customerId)
                .order('fecha', { ascending: false })
                .limit(10);

            let message = 'Historial de Pagos:\n\n';
            
            if (!payments || payments.length === 0) {
                message += 'No hay pagos registrados';
            } else {
                payments.forEach(p => {
                    message += `${formatDate(p.fecha)} - ${formatCurrency(p.monto)} (${p.metodo_pago})\n`;
                });
            }

            alert(message);
        } catch (error) {
            console.error('Error loading payment history:', error);
            showNotification('Error al cargar historial', 'error');
        }
    }

    window.showPaymentModal = showPaymentModal;
    window.viewDebtHistory = viewDebtHistory;

    // ==================== DASHBOARD ====================
    async function loadDashboard() {
        if (!supabase) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: todaySales } = await supabase
                .from('ventas')
                .select('total')
                .gte('fecha', today)
                .eq('estado', 'completada');

            const totalToday = todaySales?.reduce((sum, sale) => sum + parseFloat(sale.total), 0) || 0;
            document.getElementById('todaySales').textContent = formatCurrency(totalToday);
            document.getElementById('totalProducts').textContent = products.length;

            const lowStock = products.filter(p => p.stock <= p.stock_minimo);
            document.getElementById('lowStockCount').textContent = lowStock.length;
            document.getElementById('totalCustomers').textContent = customers.length;

            const { data: recentSales } = await supabase
                .from('ventas')
                .select(`
                    codigo,
                    total,
                    fecha,
                    clientes (nombre)
                `)
                .order('fecha', { ascending: false })
                .limit(5);

            const recentSalesTable = document.querySelector('#recentSalesTable tbody');
            recentSalesTable.innerHTML = '';
            
            if (recentSales && recentSales.length > 0) {
                recentSales.forEach(sale => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${sale.codigo}</td>
                        <td>${sale.clientes?.nombre || 'Venta General'}</td>
                        <td>${formatCurrency(sale.total)}</td>
                        <td>${formatDate(sale.fecha)}</td>
                    `;
                    recentSalesTable.appendChild(row);
                });
            } else {
                recentSalesTable.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay ventas recientes</td></tr>';
            }

            const lowStockTable = document.querySelector('#lowStockTable tbody');
            lowStockTable.innerHTML = '';
            
            if (lowStock.length > 0) {
                lowStock.forEach(product => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${product.nombre}</td>
                        <td><span class="status-badge status-warning">${product.stock}</span></td>
                        <td>${product.stock_minimo}</td>
                    `;
                    lowStockTable.appendChild(row);
                });
            } else {
                lowStockTable.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay productos con stock bajo</td></tr>';
            }

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    // ==================== POS ====================
    function loadPOS() {
        renderProductGrid();
        updateCart();

        document.getElementById('productSearch').oninput = (e) => {
            renderProductGrid(e.target.value);
        };

        document.getElementById('clearCartBtn').onclick = () => {
            if (cart.length > 0 && confirm('¿Vaciar el carrito?')) {
                cart = [];
                updateCart();
            }
        };

        document.getElementById('discountInput').oninput = updateCart;
        document.getElementById('checkoutBtn').onclick = showCheckoutModal;
    }

    function renderProductGrid(search = '') {
        const grid = document.getElementById('productGrid');
        grid.innerHTML = '';

        const filtered = products.filter(p => 
            p.nombre.toLowerCase().includes(search.toLowerCase()) ||
            (p.codigo && p.codigo.toLowerCase().includes(search.toLowerCase()))
        );

        filtered.forEach(product => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <h4>${product.nombre}</h4>
                <div class="price">${formatCurrency(product.precio)}</div>
                <div class="stock">Stock: ${product.stock}</div>
            `;
            item.onclick = () => addToCart(product);
            grid.appendChild(item);
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron productos</p>';
        }
    }

    function addToCart(product) {
        if (product.stock <= 0) {
            showNotification('Producto sin stock', 'warning');
            return;
        }

        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            if (existing.quantity < product.stock) {
                existing.quantity++;
            } else {
                showNotification('Stock insuficiente', 'warning');
                return;
            }
        } else {
            cart.push({
                id: product.id,
                nombre: product.nombre,
                precio: product.precio,
                stock: product.stock,
                quantity: 1
            });
        }
        
        updateCart();
    }

    function updateCart() {
        const cartItems = document.getElementById('cartItems');
        const subtotalEl = document.getElementById('cartSubtotal');
        const totalEl = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('checkoutBtn');

        cartItems.innerHTML = '';

        if (cart.length === 0) {
            cartItems.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Carrito vacío</p>';
            subtotalEl.textContent = '$0.00';
            totalEl.textContent = '$0.00';
            checkoutBtn.disabled = true;
            return;
        }

        let subtotal = 0;

        cart.forEach(item => {
            const itemTotal = item.precio * item.quantity;
            subtotal += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.nombre}</h4>
                    <p>${formatCurrency(item.precio)} x ${item.quantity} = ${formatCurrency(itemTotal)}</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="changeQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="changeQuantity(${item.id}, 1)">+</button>
                    <button class="remove-btn" onclick="removeFromCart(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItems.appendChild(cartItem);
        });

        const discount = parseFloat(document.getElementById('discountInput').value) || 0;
        const total = Math.max(0, subtotal - discount);

        subtotalEl.textContent = formatCurrency(subtotal);
        totalEl.textContent = formatCurrency(total);
        checkoutBtn.disabled = false;
    }

    window.changeQuantity = (productId, delta) => {
        const item = cart.find(i => i.id === productId);
        if (!item) return;

        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            removeFromCart(productId);
        } else if (newQty <= item.stock) {
            item.quantity = newQty;
            updateCart();
        } else {
            showNotification('Stock insuficiente', 'warning');
        }
    };

    window.removeFromCart = (productId) => {
        cart = cart.filter(item => item.id !== productId);
        updateCart();
    };

    function showCheckoutModal() {
        const modal = document.getElementById('checkoutModal');
        const form = document.getElementById('checkoutForm');

        const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        const discount = parseFloat(document.getElementById('discountInput').value) || 0;
        const total = Math.max(0, subtotal - discount);

        document.getElementById('checkoutSubtotal').textContent = formatCurrency(subtotal);
        document.getElementById('checkoutDiscount').textContent = formatCurrency(discount);
        document.getElementById('checkoutTotal').textContent = formatCurrency(total);

        // Cargar clientes con opción de "Sin Cliente" (Venta General)
        const customerSelect = document.getElementById('saleCustomer');
        customerSelect.innerHTML = '<option value="">VENTA GENERAL (Sin Cliente)</option>';
        customers.forEach(c => {
            customerSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });

        const paymentType = document.getElementById('paymentType');
        const partialSection = document.getElementById('partialPaymentSection');
        const partialAmount = document.getElementById('partialAmount');
        const customerSelectField = document.getElementById('saleCustomer');

        paymentType.onchange = () => {
            const type = paymentType.value;
            
            if (type === 'mixto') {
                partialSection.classList.remove('hidden');
                partialAmount.required = true;
                partialAmount.max = total;
                // Para mixto, si no hay cliente seleccionado, mostrar mensaje
                if (!customerSelectField.value) {
                    showNotification('Para pago mixto debe seleccionar un cliente', 'warning');
                }
            } else if (type === 'credito') {
                partialSection.classList.add('hidden');
                partialAmount.required = false;
                // Para crédito, si no hay cliente seleccionado, mostrar mensaje
                if (!customerSelectField.value) {
                    showNotification('Para ventas a crédito debe seleccionar un cliente', 'warning');
                }
            } else {
                partialSection.classList.add('hidden');
                partialAmount.required = false;
                // Para pago completo, el cliente es opcional
            }
        };

        partialAmount.oninput = () => {
            const paid = parseFloat(partialAmount.value) || 0;
            const remaining = Math.max(0, total - paid);
            
            document.getElementById('paidAmount').textContent = formatCurrency(paid);
            document.getElementById('remainingDebt').textContent = formatCurrency(remaining);
        };

        modal.classList.remove('hidden');

        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => modal.classList.add('hidden');
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            await processSale();
        };
    }

    async function processSale() {
        if (!supabase || !currentUser) return;

        const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        const discount = parseFloat(document.getElementById('discountInput').value) || 0;
        const total = Math.max(0, subtotal - discount);
        const paymentType = document.getElementById('paymentType').value;
        const customerId = document.getElementById('saleCustomer').value;
        
        // Convertir a número solo si hay un valor (si está vacío, es null = Venta General)
        const finalCustomerId = customerId ? parseInt(customerId) : null;

        // Validaciones específicas según tipo de pago
        if (paymentType === 'credito' && !finalCustomerId) {
            showNotification('Para ventas a crédito debe seleccionar un cliente', 'error');
            return;
        }

        if (paymentType === 'mixto' && !finalCustomerId) {
            showNotification('Para pago mixto debe seleccionar un cliente', 'error');
            return;
        }

        let debtAmount = 0;
        let paidAmount = total;

        if (paymentType === 'credito') {
            debtAmount = total;
            paidAmount = 0;
        } else if (paymentType === 'mixto') {
            paidAmount = parseFloat(document.getElementById('partialAmount').value) || 0;
            debtAmount = total - paidAmount;
            
            if (paidAmount <= 0 || paidAmount > total) {
                showNotification('El monto pagado debe ser mayor a 0 y menor al total', 'error');
                return;
            }
        }

        const saleData = {
            codigo: 'V-' + Date.now(),
            fecha: new Date().toISOString(),
            cliente_id: finalCustomerId,
            vendedor_id: currentUser.id,
            subtotal: subtotal,
            descuento: discount,
            total: total,
            estado: 'completada',
            metodo_pago: paymentType,
            notas: document.getElementById('saleNotes').value || null
        };

        try {
            const { data: sale, error: saleError } = await supabase
                .from('ventas')
                .insert([saleData])
                .select()
                .single();

            if (saleError) throw saleError;

            const details = cart.map(item => ({
                venta_id: sale.id,
                producto_id: item.id,
                cantidad: item.quantity,
                precio_unitario: item.precio,
                subtotal: item.precio * item.quantity
            }));

            const { error: detailsError } = await supabase
                .from('venta_detalles')
                .insert(details);

            if (detailsError) throw detailsError;

            for (const item of cart) {
                const { error: stockError } = await supabase
                    .from('productos')
                    .update({ stock: item.stock - item.quantity })
                    .eq('id', item.id);

                if (stockError) throw stockError;
            }

            if (debtAmount > 0 && finalCustomerId) {
                const { data: customer } = await supabase
                    .from('clientes')
                    .select('deuda_total')
                    .eq('id', finalCustomerId)
                    .single();

                const newDebt = (customer.deuda_total || 0) + debtAmount;

                const { error: debtError } = await supabase
                    .from('clientes')
                    .update({ deuda_total: newDebt })
                    .eq('id', finalCustomerId);

                if (debtError) throw debtError;

                if (paymentType === 'mixto' && paidAmount > 0) {
                    await supabase.from('pagos').insert([{
                        cliente_id: finalCustomerId,
                        monto: paidAmount,
                        fecha: new Date().toISOString(),
                        metodo_pago: 'mixto',
                        referencia: `Pago parcial venta ${saleData.codigo}`,
                        notas: `Venta: ${formatCurrency(total)}, Pagado: ${formatCurrency(paidAmount)}, Deuda: ${formatCurrency(debtAmount)}`
                    }]);
                }
            }

            document.getElementById('checkoutModal').classList.add('hidden');
            
            let successMsg = `Venta completada: ${saleData.codigo}`;
            if (debtAmount > 0) {
                successMsg += ` - Deuda registrada: ${formatCurrency(debtAmount)}`;
            }
            if (!finalCustomerId) {
                successMsg += ` (Venta General - Sin Cliente)`;
            }
            showNotification(successMsg, 'success');
            
            cart = [];
            document.getElementById('discountInput').value = 0;
            updateCart();

            document.getElementById('checkoutForm').reset();
            document.getElementById('partialPaymentSection').classList.add('hidden');
            document.getElementById('paidAmount').textContent = '$0.00';
            document.getElementById('remainingDebt').textContent = '$0.00';

            await loadProducts();
            await loadCustomers();
            loadDashboard();
            
            // Actualizar gráficos si están visibles
            if (!document.getElementById('reportsSection').classList.contains('hidden')) {
                loadReports();
            }

        } catch (error) {
            console.error('Error processing sale:', error);
            showNotification('Error al procesar la venta', 'error');
        }
    }

    // ==================== SALES ====================
    async function loadSalesSection() {
        if (!supabase) return;

        try {
            const { data: sales, error } = await supabase
                .from('ventas')
                .select(`
                    *,
                    clientes (nombre),
                    usuarios (nombre)
                `)
                .order('fecha', { ascending: false })
                .limit(50);

            if (error) throw error;

            const tbody = document.querySelector('#salesTable tbody');
            tbody.innerHTML = '';

            if (!sales || sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay ventas</td></tr>';
                return;
            }

            sales.forEach(sale => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${sale.codigo}</td>
                    <td>${sale.clientes?.nombre || 'Venta General'}</td>
                    <td>${sale.usuarios?.nombre || '-'}</td>
                    <td>${formatCurrency(sale.total)}</td>
                    <td><span class="status-badge status-info">${sale.metodo_pago}</span></td>
                    <td>${formatDate(sale.fecha)}</td>
                    <td>
                        <button class="btn-secondary" style="padding: 6px 12px;" onclick="viewSaleDetails(${sale.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('searchSales').oninput = (e) => {
                const search = e.target.value.toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
                });
            };

        } catch (error) {
            console.error('Error loading sales:', error);
        }
    }

    window.viewSaleDetails = async (saleId) => {
        if (!supabase) return;

        try {
            const { data: details } = await supabase
                .from('venta_detalles')
                .select(`
                    *,
                    productos (nombre)
                `)
                .eq('venta_id', saleId);

            let message = 'Detalles de la venta:\n\n';
            details?.forEach(d => {
                message += `${d.productos.nombre} - ${d.cantidad} x ${formatCurrency(d.precio_unitario)} = ${formatCurrency(d.subtotal)}\n`;
            });

            alert(message);
        } catch (error) {
            console.error('Error loading sale details:', error);
        }
    };

    // ==================== REPORTS ====================
    async function loadReports() {
        if (!supabase) return;
        
        // Mostrar loading en los gráficos
        const salesChartCanvas = document.getElementById('salesChart');
        const topProductsCanvas = document.getElementById('topProductsCanvas');
        
        if (salesChartCanvas) {
            salesChartCanvas.style.opacity = '0.5';
        }
        if (topProductsCanvas) {
            topProductsCanvas.style.opacity = '0.5';
        }
        
        try {
            // Obtener ventas de los últimos 7 días
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                last7Days.push(date.toISOString().split('T')[0]);
            }
            
            const { data: salesData, error: salesError } = await supabase
                .from('ventas')
                .select('fecha, total')
                .gte('fecha', last7Days[0])
                .eq('estado', 'completada');
            
            if (salesError) throw salesError;
            
            // Agrupar ventas por día
            const salesByDay = {};
            last7Days.forEach(day => {
                salesByDay[day] = 0;
            });
            
            salesData?.forEach(sale => {
                const saleDate = sale.fecha.split('T')[0];
                if (salesByDay[saleDate] !== undefined) {
                    salesByDay[saleDate] += parseFloat(sale.total);
                }
            });
            
            // Formatear fechas para mostrar (Lun, Mar, etc.)
            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const chartLabels = last7Days.map(date => {
                const d = new Date(date);
                return dayNames[d.getDay()];
            });
            const chartData = last7Days.map(day => salesByDay[day]);
            
            // Obtener top 5 productos más vendidos
            const { data: topProducts, error: productsError } = await supabase
                .from('venta_detalles')
                .select(`
                    cantidad,
                    productos!inner (nombre)
                `);
            
            if (productsError) throw productsError;
            
            // Agrupar por producto
            const productSales = {};
            topProducts?.forEach(item => {
                const productName = item.productos?.nombre;
                if (productName) {
                    productSales[productName] = (productSales[productName] || 0) + item.cantidad;
                }
            });
            
            // Ordenar y tomar top 5
            const sortedProducts = Object.entries(productSales)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const topProductsLabels = sortedProducts.map(p => p[0]);
            const topProductsData = sortedProducts.map(p => p[1]);
            
            // Destruir gráficos anteriores si existen
            if (salesChart && typeof Chart !== 'undefined') {
                salesChart.destroy();
            }
            if (topProductsChart && typeof Chart !== 'undefined') {
                topProductsChart.destroy();
            }
            
            // Crear nuevo gráfico de ventas
            if (salesChartCanvas && typeof Chart !== 'undefined') {
                salesChart = new Chart(salesChartCanvas, {
                    type: 'line',
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            label: 'Ventas (USD)',
                            data: chartData,
                            borderColor: '#1a5f23',
                            backgroundColor: 'rgba(26, 95, 35, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return `$${context.raw.toFixed(2)}`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // Crear nuevo gráfico de productos más vendidos
            if (topProductsCanvas && typeof Chart !== 'undefined') {
                topProductsChart = new Chart(topProductsCanvas, {
                    type: 'bar',
                    data: {
                        labels: topProductsLabels,
                        datasets: [{
                            label: 'Unidades Vendidas',
                            data: topProductsData,
                            backgroundColor: '#1a5f23',
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return `${context.raw} unidades`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            salesChartCanvas.style.opacity = '1';
            if (topProductsCanvas) topProductsCanvas.style.opacity = '1';
            
        } catch (error) {
            console.error('Error loading reports:', error);
            showNotification('Error al cargar los reportes', 'error');
            if (salesChartCanvas) salesChartCanvas.style.opacity = '1';
            if (topProductsCanvas) topProductsCanvas.style.opacity = '1';
        }
    }

    // ==================== CONFIG ====================
    async function loadConfig() {
        if (!supabase) return;

        try {
            const { data: config } = await supabase
                .from('configuracion')
                .select('*');

            const configMap = {};
            config?.forEach(item => {
                configMap[item.clave] = item.valor;
            });

            document.getElementById('companyName').value = configMap.empresa_nombre || 'Montaña Importados';
            document.getElementById('companyPhone').value = configMap.empresa_telefono || '';
            document.getElementById('companyAddress').value = configMap.empresa_direccion || '';

            const { data: users } = await supabase
                .from('usuarios')
                .select('*')
                .order('nombre');

            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = '';

            users?.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.nombre}</td>
                    <td><span class="status-badge ${user.role === 'admin' ? 'status-active' : 'status-info'}">${user.role}</span></td>
                    <td><span class="status-badge ${user.activo ? 'status-active' : 'status-inactive'}">${user.activo ? 'Activo' : 'Inactivo'}</span></td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('companyForm').onsubmit = async (e) => {
                e.preventDefault();
                
                const updates = [
                    { clave: 'empresa_nombre', valor: document.getElementById('companyName').value },
                    { clave: 'empresa_telefono', valor: document.getElementById('companyPhone').value },
                    { clave: 'empresa_direccion', valor: document.getElementById('companyAddress').value }
                ];

                for (const update of updates) {
                    await supabase
                        .from('configuracion')
                        .update({ valor: update.valor })
                        .eq('clave', update.clave);
                }

                showNotification('Configuración guardada', 'success');
            };

        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    // ==================== EMPLOYEES ====================
    async function loadEmployeesSection() {
        if (!supabase) return;

        try {
            const { data: employees, error } = await supabase
                .from('usuarios')
                .select('*')
                .order('nombre');

            if (error) throw error;

            const tbody = document.querySelector('#employeesTable tbody');
            tbody.innerHTML = '';

            if (!employees || employees.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay empleados</td></tr>';
                return;
            }

            employees.forEach(employee => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${employee.username}</td>
                    <td>${employee.nombre}</td>
                    <td>${employee.email || '-'}</td>
                    <td><span class="status-badge ${employee.role === 'admin' ? 'status-active' : 'status-info'}">${employee.role === 'admin' ? 'Administrador' : 'Empleado'}</span></td>
                    <td><span class="status-badge ${employee.activo ? 'status-active' : 'status-inactive'}">${employee.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="btn-secondary" style="padding: 6px 12px;" onclick="editEmployee('${employee.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${employee.id !== currentUser.id ? `
                            <button class="btn-secondary" style="padding: 6px 12px; color: var(--danger);" onclick="toggleEmployeeStatus('${employee.id}', ${!employee.activo})">
                                <i class="fas fa-${employee.activo ? 'ban' : 'check'}"></i>
                            </button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('searchEmployees').oninput = (e) => {
                const search = e.target.value.toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
                });
            };

            document.getElementById('addEmployeeBtn').onclick = () => showEmployeeModal();

        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }

    function showEmployeeModal(employeeId = null) {
        const modal = document.getElementById('employeeModal');
        const form = document.getElementById('employeeForm');
        const title = document.getElementById('employeeModalTitle');
        const passwordGroup = document.getElementById('passwordGroup');
        
        form.reset();
        document.getElementById('employeeId').value = '';
        title.textContent = 'Agregar Empleado';
        
        document.getElementById('employeePassword').required = true;
        passwordGroup.querySelector('label').textContent = 'Contraseña *';

        if (employeeId) {
            supabase
                .from('usuarios')
                .select('*')
                .eq('id', employeeId)
                .single()
                .then(({ data: employee }) => {
                    if (employee) {
                        title.textContent = 'Editar Empleado';
                        document.getElementById('employeeId').value = employee.id;
                        document.getElementById('employeeName').value = employee.nombre;
                        document.getElementById('employeeUsername').value = employee.username;
                        document.getElementById('employeeEmail').value = employee.email || '';
                        document.getElementById('employeeRole').value = employee.role;
                        document.getElementById('employeeActive').value = employee.activo ? 'true' : 'false';
                        
                        document.getElementById('employeePassword').required = false;
                        passwordGroup.querySelector('label').textContent = 'Nueva Contraseña (opcional)';
                        passwordGroup.querySelector('small').textContent = 'Dejar vacío para mantener la contraseña actual';
                    }
                });
        }

        modal.classList.remove('hidden');

        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => modal.classList.add('hidden');
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveEmployee();
        };
    }

    async function saveEmployee() {
        if (!supabase) return;

        const employeeId = document.getElementById('employeeId').value;
        const password = document.getElementById('employeePassword').value;
        
        const employeeData = {
            nombre: document.getElementById('employeeName').value,
            username: document.getElementById('employeeUsername').value,
            email: document.getElementById('employeeEmail').value || null,
            role: document.getElementById('employeeRole').value,
            activo: document.getElementById('employeeActive').value === 'true'
        };

        if (password) {
            employeeData.password = password;
        }

        try {
            let result;
            if (employeeId) {
                result = await supabase
                    .from('usuarios')
                    .update(employeeData)
                    .eq('id', employeeId);
            } else {
                if (!password) {
                    showNotification('La contraseña es requerida', 'error');
                    return;
                }
                result = await supabase
                    .from('usuarios')
                    .insert([employeeData]);
            }

            if (result.error) throw result.error;

            document.getElementById('employeeModal').classList.add('hidden');
            showNotification('Empleado guardado', 'success');
            loadEmployeesSection();
        } catch (error) {
            console.error('Error saving employee:', error);
            if (error.code === '23505') {
                showNotification('El nombre de usuario ya existe', 'error');
            } else {
                showNotification('Error al guardar empleado', 'error');
            }
        }
    }

    async function toggleEmployeeStatus(employeeId, newStatus) {
        if (!supabase) return;

        const action = newStatus ? 'activar' : 'desactivar';
        if (!confirm(`¿Está seguro de ${action} este empleado?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ activo: newStatus })
                .eq('id', employeeId);

            if (error) throw error;

            showNotification(`Empleado ${action}do`, 'success');
            loadEmployeesSection();
        } catch (error) {
            console.error('Error toggling employee status:', error);
            showNotification('Error al actualizar estado', 'error');
        }
    }

    window.editEmployee = (id) => showEmployeeModal(id);
    window.toggleEmployeeStatus = toggleEmployeeStatus;

    // ==================== PROFILE ====================
    function loadProfileSection() {
        if (!currentUser) return;

        document.getElementById('profileUsername').value = currentUser.username;
        document.getElementById('profileName').value = currentUser.nombre;
        document.getElementById('profileEmail').value = currentUser.email || '';
        document.getElementById('profileRole').value = currentUser.role === 'admin' ? 'Administrador' : 'Empleado';

        document.getElementById('profileForm').onsubmit = async (e) => {
            e.preventDefault();
            await updateProfile();
        };

        document.getElementById('changePasswordForm').onsubmit = async (e) => {
            e.preventDefault();
            await changePassword();
        };
    }

    async function updateProfile() {
        if (!supabase || !currentUser) return;

        const profileData = {
            nombre: document.getElementById('profileName').value,
            email: document.getElementById('profileEmail').value || null
        };

        try {
            const { error } = await supabase
                .from('usuarios')
                .update(profileData)
                .eq('id', currentUser.id);

            if (error) throw error;

            currentUser.nombre = profileData.nombre;
            currentUser.email = profileData.email;

            document.getElementById('currentUser').textContent = currentUser.nombre;

            showNotification('Perfil actualizado', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification('Error al actualizar perfil', 'error');
        }
    }

    async function changePassword() {
        if (!supabase || !currentUser) return;

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        if (currentPassword !== currentUser.password) {
            showNotification('La contraseña actual es incorrecta', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ password: newPassword })
                .eq('id', currentUser.id);

            if (error) throw error;

            currentUser.password = newPassword;
            document.getElementById('changePasswordForm').reset();
            showNotification('Contraseña cambiada exitosamente', 'success');
        } catch (error) {
            console.error('Error changing password:', error);
            showNotification('Error al cambiar contraseña', 'error');
        }
    }
});