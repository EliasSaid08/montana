// Main Application
document.addEventListener('DOMContentLoaded', () => {
    const config = window.appConfig || {};
    const supabase = config.supabase;
    const showNotification = config.showNotification || console.log;
    const formatCurrency = config.formatCurrency || (amount => `$${amount}`);
    const formatDate = config.formatDate || (date => date);
    const formatDateShort = config.formatDateShort || (date => date);
    
    // Inicializar EmailJS
    if (config.initEmailJS) {
        config.initEmailJS();
    }

    // Global State
    let currentUser = null;
    let cart = [];
    let products = [];
    let customers = [];
    let categories = [];
    let passwordResetTokens = {};
    
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

        // Setup forgot password link
        setupForgotPassword();
        
        // Verificar token de recuperación
        checkResetToken();
    }

    // ==================== PASSWORD RECOVERY ====================
    function setupForgotPassword() {
        // Add forgot password link to login form
        const loginFormContainer = document.querySelector('.login-card form');
        if (loginFormContainer && !document.querySelector('.forgot-password-link')) {
            const forgotLink = document.createElement('div');
            forgotLink.className = 'forgot-password-link';
            forgotLink.style.textAlign = 'right';
            forgotLink.style.marginTop = '-10px';
            forgotLink.style.marginBottom = '15px';
            forgotLink.innerHTML = '<a href="#" id="forgotPasswordBtn" style="color: var(--primary); font-size: 12px; text-decoration: none;">¿Olvidaste tu contraseña?</a>';
            loginFormContainer.insertBefore(forgotLink, loginFormContainer.querySelector('button'));
            
            document.getElementById('forgotPasswordBtn').addEventListener('click', (e) => {
                e.preventDefault();
                showForgotPasswordModal();
            });
        }
    }

    function showForgotPasswordModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'forgotPasswordModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-key"></i> Recuperar Contraseña</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="forgotPasswordForm">
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" id="resetEmail" class="form-control" placeholder="tu@email.com" required>
                        <small style="color: var(--text-muted);">Ingresa el correo asociado a tu cuenta</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary">Enviar Instrucciones</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const form = document.getElementById('forgotPasswordForm');
        form.onsubmit = async (e) => {
            e.preventDefault();
            await sendPasswordResetEmail();
        };
    }

    async function sendPasswordResetEmail() {
        const email = document.getElementById('resetEmail').value.trim();
        
        if (!email) {
            showNotification('Ingresa un correo electrónico', 'error');
            return;
        }

        if (!supabase) {
            showNotification('Error de conexión', 'error');
            return;
        }

        const submitBtn = document.querySelector('#forgotPasswordForm button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

        try {
            // Buscar usuario por email
            const { data: users, error } = await supabase
                .from('usuarios')
                .select('id, email, nombre')
                .eq('email', email);

            if (error) throw error;

            if (!users || users.length === 0) {
                showNotification('No se encontró una cuenta con este correo', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar Instrucciones'; }
                return;
            }

            const user = users[0];
            
            // Generar token único usando crypto si está disponible
            const tokenArray = new Uint8Array(20);
            window.crypto.getRandomValues(tokenArray);
            const token = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
            
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1); // Token válido por 1 hora
            
            // ✅ CORRECCIÓN PRINCIPAL: Guardar token en Supabase (no en memoria)
            // Requiere tabla: password_reset_tokens(id, user_id, token, expires_at, used)
            const { error: tokenError } = await supabase
                .from('password_reset_tokens')
                .insert([{
                    user_id: user.id,
                    token: token,
                    expires_at: expiresAt.toISOString(),
                    used: false
                }]);

            if (tokenError) {
                // Si la tabla no existe, fallback a memoria (modo legacy)
                console.warn('⚠️ Tabla password_reset_tokens no encontrada, usando memoria (token no sobrevive recargas):', tokenError.message);
                passwordResetTokens[token] = {
                    userId: user.id,
                    email: user.email,
                    expiresAt: expiresAt.getTime()
                };
            }
            
            // Crear link de reset
            const baseUrl = (window.appConfig && window.appConfig.baseUrl) || window.location.origin;
            const resetLink = `${baseUrl}${window.location.pathname}#reset?token=${token}`;
            
            // ✅ CORRECCIÓN: Asegurarse que EmailJS esté inicializado antes de enviar
            const emailjsReady = await window.appConfig.initEmailJS();
            
            if (emailjsReady && window.emailjs) {
                try {
                    await window.emailjs.send(
                        window.appConfig.emailjs.SERVICE_ID,
                        window.appConfig.emailjs.TEMPLATE_ID,
                        {
                            to_email: user.email,
                            to_name: user.nombre || user.email,
                            reset_link: resetLink,
                            company_name: 'Montana Importados'
                        }
                    );
                    showNotification('✅ Se han enviado instrucciones a tu correo', 'success');
                    document.getElementById('forgotPasswordModal')?.remove();
                } catch (emailError) {
                    const status = emailError?.status || emailError?.statusCode || 'desconocido';
                    const text = emailError?.text || emailError?.message || JSON.stringify(emailError);
                    console.error('EmailJS error ' + status + ':', text);
                    if (status === 422) {
                        console.error('Error 422: En tu template de EmailJS verifica que el campo To sea {{to_email}} y que todas las variables coincidan.');
                    } else if (status === 401) {
                        console.error('Error 401: Public Key invalida. Verifica EMAILJS_CONFIG.PUBLIC_KEY en config.js');
                    }
                    showNotification('No se pudo enviar el email. Copia el link manual.', 'warning');
                    showResetLinkModal(resetLink);
                }
            } else {
                // Modo sin EmailJS configurado
                console.log('=== RESET PASSWORD LINK ===');
                console.log(resetLink);
                console.log('===========================');
                showResetLinkModal(resetLink);
            }
            
        } catch (error) {
            console.error('Error en recuperación de contraseña:', error);
            showNotification('Error al procesar la solicitud', 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar Instrucciones'; }
        }
    }

    function showResetLinkModal(resetLink) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-link"></i> Link de Recuperación</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="card-body">
                    <p>Para recuperar tu contraseña, usa el siguiente enlace:</p>
                    <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin: 15px 0; word-break: break-all;">
                        <code>${resetLink}</code>
                    </div>
                    <button class="btn-primary" onclick="navigator.clipboard.writeText('${resetLink}'); showNotification('Link copiado', 'success')">
                        <i class="fas fa-copy"></i> Copiar Link
                    </button>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function checkResetToken() {
        const hash = window.location.hash;
        if (hash && hash.includes('reset?token=')) {
            const token = hash.split('token=')[1];
            if (token) {
                showResetPasswordModal(token);
            }
        }
    }

    async function showResetPasswordModal(token) {
        // ✅ CORRECCIÓN: Buscar token en Supabase primero, luego en memoria como fallback
        let resetData = null;

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('password_reset_tokens')
                    .select('user_id, expires_at, used')
                    .eq('token', token)
                    .single();

                if (!error && data && !data.used) {
                    const expiresAt = new Date(data.expires_at).getTime();
                    if (expiresAt > Date.now()) {
                        resetData = { userId: data.user_id, fromDB: true };
                    }
                }
            } catch (e) {
                // Tabla no existe, intentar con memoria
            }
        }

        // Fallback a tokens en memoria (legacy)
        if (!resetData && passwordResetTokens[token]) {
            const mem = passwordResetTokens[token];
            if (mem.expiresAt > Date.now()) {
                resetData = { userId: mem.userId, fromDB: false };
            }
        }
        
        if (!resetData) {
            showNotification('El enlace ha expirado o es inválido', 'error');
            window.location.hash = '';
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'resetPasswordModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-lock"></i> Restablecer Contraseña</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="resetPasswordForm">
                    <div class="form-group">
                        <label>Nueva Contraseña</label>
                        <input type="password" id="newPasswordReset" class="form-control" required minlength="6">
                        <small>Mínimo 6 caracteres</small>
                    </div>
                    <div class="form-group">
                        <label>Confirmar Contraseña</label>
                        <input type="password" id="confirmPasswordReset" class="form-control" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary">Actualizar Contraseña</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const form = document.getElementById('resetPasswordForm');
        form.onsubmit = async (e) => {
            e.preventDefault();
            await updatePasswordWithToken(token);
        };
    }

    async function updatePasswordWithToken(token) {
        // Buscar en Supabase primero, luego en memoria
        let resetData = null;

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('password_reset_tokens')
                    .select('user_id, expires_at, used')
                    .eq('token', token)
                    .single();

                if (!error && data && !data.used && new Date(data.expires_at).getTime() > Date.now()) {
                    resetData = { userId: data.user_id, fromDB: true };
                }
            } catch (e) { /* tabla no existe */ }
        }

        if (!resetData && passwordResetTokens[token]) {
            const mem = passwordResetTokens[token];
            if (mem.expiresAt > Date.now()) {
                resetData = { userId: mem.userId, fromDB: false };
            }
        }
        
        if (!resetData) {
            showNotification('El enlace ha expirado', 'error');
            document.getElementById('resetPasswordModal')?.remove();
            return;
        }
        
        const newPassword = document.getElementById('newPasswordReset').value;
        const confirmPassword = document.getElementById('confirmPasswordReset').value;
        
        if (newPassword !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        if (!supabase) return;
        
        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ password: newPassword })
                .eq('id', resetData.userId);
                
            if (error) throw error;
            
            // ✅ Marcar token como usado en Supabase y eliminar de memoria
            if (supabase) {
                try {
                    await supabase
                        .from('password_reset_tokens')
                        .update({ used: true })
                        .eq('token', token);
                } catch (e) { /* ignorar si tabla no existe */ }
            }
            delete passwordResetTokens[token];
            
            showNotification('Contraseña actualizada correctamente', 'success');
            document.getElementById('resetPasswordModal')?.remove();
            window.location.hash = '';
            
        } catch (error) {
            console.error('Error updating password:', error);
            showNotification('Error al actualizar la contraseña', 'error');
        }
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
                if (!customerSelectField.value) {
                    showNotification('Para pago mixto debe seleccionar un cliente', 'warning');
                }
            } else if (type === 'credito') {
                partialSection.classList.add('hidden');
                partialAmount.required = false;
                if (!customerSelectField.value) {
                    showNotification('Para ventas a crédito debe seleccionar un cliente', 'warning');
                }
            } else {
                partialSection.classList.add('hidden');
                partialAmount.required = false;
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
        
        const finalCustomerId = customerId ? parseInt(customerId) : null;

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

    // ==================== EXPORT FUNCTIONS ====================
// ==================== EXPORT FUNCTIONS WITH PREVIEW ====================

// Función para mostrar vista previa antes de exportar
function showReportPreview(htmlContent, filename, type = 'sales') {
    // Crear modal de vista previa
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '10000';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3><i class="fas fa-print"></i> Vista Previa del Reporte</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="flex: 1; overflow: auto; padding: 20px; background: #f5f5f5;" id="previewContent">
                <!-- El contenido del reporte se cargará aquí -->
            </div>
            <div class="modal-actions" style="flex-shrink: 0; display: flex; gap: 10px; justify-content: flex-end; padding: 15px;">
                <button id="printPreviewBtn" class="btn-secondary" style="background: #3498db;">
                    <i class="fas fa-print"></i> Imprimir
                </button>
                <button id="downloadPreviewBtn" class="btn-primary" style="background: #27ae60;">
                    <i class="fas fa-download"></i> Descargar PDF
                </button>
                <button class="btn-secondary close-modal">Cerrar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cargar contenido en el preview
    const previewContainer = document.getElementById('previewContent');
    previewContainer.innerHTML = htmlContent;
    
    // Función para imprimir
    document.getElementById('printPreviewBtn').onclick = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${filename}</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    @media print {
                        body { margin: 0; padding: 20px; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => window.close(), 1000);
                        }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };
    
    // Función para descargar PDF
    document.getElementById('downloadPreviewBtn').onclick = async () => {
        showNotification('Generando PDF...', 'info');
        
        try {
            // Verificar que html2canvas esté disponible
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas no está cargado');
            }
            
            // Crear un elemento temporal para renderizar
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '-9999px';
            tempDiv.style.width = '800px';
            tempDiv.innerHTML = htmlContent;
            document.body.appendChild(tempDiv);
            
            // Esperar a que se renderice
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Convertir a canvas
            const canvas = await html2canvas(tempDiv, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });
            
            // Eliminar elemento temporal
            document.body.removeChild(tempDiv);
            
            // Crear PDF
            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${filename}.pdf`);
            
            showNotification('PDF descargado correctamente', 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            showNotification('Error al generar PDF. Usando método alternativo...', 'warning');
            
            // Método alternativo: abrir en nueva ventana para imprimir
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${filename}</title>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        @media print {
                            body { margin: 0; padding: 20px; }
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };
    
    // Manejar cierre del modal
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => modal.remove();
    });
}

async function exportSalesReport() {
    if (!supabase) return;
    
    showDateRangePicker(async (startDate, endDate) => {
        try {
            showNotification('Generando reporte de ventas...', 'info');
            
            const { data: sales, error } = await supabase
                .from('ventas')
                .select(`
                    *,
                    clientes (nombre),
                    usuarios (nombre)
                `)
                .gte('fecha', startDate)
                .lte('fecha', endDate)
                .order('fecha', { ascending: false });
                
            if (error) throw error;
            
            let totalVentas = 0;
            let totalEfectivo = 0;
            let totalTarjeta = 0;
            let totalTransferencia = 0;
            let totalCredito = 0;
            
            sales?.forEach(sale => {
                totalVentas += parseFloat(sale.total);
                switch(sale.metodo_pago) {
                    case 'efectivo': totalEfectivo += parseFloat(sale.total); break;
                    case 'tarjeta': totalTarjeta += parseFloat(sale.total); break;
                    case 'transferencia': totalTransferencia += parseFloat(sale.total); break;
                    case 'credito': totalCredito += parseFloat(sale.total); break;
                }
            });
            
            const html = generateSalesReportHTML(sales, startDate, endDate, {
                totalVentas,
                totalEfectivo,
                totalTarjeta,
                totalTransferencia,
                totalCredito
            });
            
            const filename = `reporte_ventas_${formatDateShort(startDate)}_a_${formatDateShort(endDate)}`;
            showReportPreview(html, filename, 'sales');
            showNotification('Reporte listo para vista previa', 'success');
            
        } catch (error) {
            console.error('Error generating sales report:', error);
            showNotification('Error al generar el reporte', 'error');
        }
    });
}

async function exportLowStockReport() {
    if (!supabase) return;
    
    try {
        showNotification('Generando reporte de stock bajo...', 'info');
        
        // Cargar productos actualizados
        await loadProducts();
        
        const lowStockProducts = products.filter(p => p.stock <= (p.stock_minimo || 5));
        
        const html = generateLowStockReportHTML(lowStockProducts);
        const filename = `reporte_stock_bajo_${formatDateShort(new Date())}`;
        showReportPreview(html, filename, 'stock');
        showNotification('Reporte listo para vista previa', 'success');
        
    } catch (error) {
        console.error('Error generating low stock report:', error);
        showNotification('Error al generar el reporte', 'error');
    }
}

async function exportDebtorsReport() {
    if (!supabase) return;
    
    showDateRangePicker(async (startDate, endDate) => {
        try {
            showNotification('Generando reporte de morosos...', 'info');
            
            const { data: debtors, error } = await supabase
                .from('clientes')
                .select(`
                    *,
                    ventas!ventas_cliente_id_fkey (
                        fecha,
                        total,
                        codigo
                    )
                `)
                .gt('deuda_total', 0)
                .eq('activo', true)
                .order('deuda_total', { ascending: false });
                
            if (error) throw error;
            
            const totalDebt = debtors?.reduce((sum, d) => sum + parseFloat(d.deuda_total || 0), 0) || 0;
            
            const html = generateDebtorsReportHTML(debtors, startDate, endDate, totalDebt);
            const filename = `reporte_morosos_${formatDateShort(startDate)}_a_${formatDateShort(endDate)}`;
            showReportPreview(html, filename, 'debtors');
            showNotification('Reporte listo para vista previa', 'success');
            
        } catch (error) {
            console.error('Error generating debtors report:', error);
            showNotification('Error al generar el reporte', 'error');
        }
    });
}

function showDateRangePicker(callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-calendar-alt"></i> Seleccionar Período</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <form id="dateRangeForm">
                <div class="form-group">
                    <label>Fecha Inicio</label>
                    <input type="date" id="startDate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Fecha Fin</label>
                    <input type="date" id="endDate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Vista Rápida</label>
                    <select id="quickDateRange" class="form-control">
                        <option value="">Seleccionar...</option>
                        <option value="today">Hoy</option>
                        <option value="yesterday">Ayer</option>
                        <option value="week">Última Semana</option>
                        <option value="month">Último Mes</option>
                        <option value="quarter">Último Trimestre</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button type="submit" class="btn-primary">Generar Reporte</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('startDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
    
    // Función para fechas rápidas
    const quickSelect = document.getElementById('quickDateRange');
    quickSelect.onchange = () => {
        const now = new Date();
        let start = new Date();
        
        switch(quickSelect.value) {
            case 'today':
                start = now;
                break;
            case 'yesterday':
                start = new Date(now);
                start.setDate(now.getDate() - 1);
                break;
            case 'week':
                start = new Date(now);
                start.setDate(now.getDate() - 7);
                break;
            case 'month':
                start = new Date(now);
                start.setDate(now.getDate() - 30);
                break;
            case 'quarter':
                start = new Date(now);
                start.setDate(now.getDate() - 90);
                break;
            default:
                return;
        }
        
        document.getElementById('startDate').value = start.toISOString().split('T')[0];
        document.getElementById('endDate').value = now.toISOString().split('T')[0];
    };
    
    const form = document.getElementById('dateRangeForm');
    form.onsubmit = (e) => {
        e.preventDefault();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        modal.remove();
        callback(startDate, endDate);
    };
}

// Funciones de generación de HTML (mejoradas)
function generateSalesReportHTML(sales, startDate, endDate, totals) {
    const fechaGeneracion = new Date().toLocaleString('es-ES');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Ventas - Montana Importados</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 30px;
                    background: white;
                }
                .report-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #1a5f23;
                }
                .header h1 {
                    color: #1a5f23;
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                .header p {
                    color: #666;
                    font-size: 14px;
                }
                .period {
                    text-align: center;
                    background: #f0fdf4;
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    font-weight: 500;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .summary-card {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 15px;
                    border-radius: 12px;
                    text-align: center;
                    border: 1px solid #dee2e6;
                }
                .summary-card h4 {
                    font-size: 13px;
                    color: #666;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                }
                .summary-card .amount {
                    font-size: 24px;
                    font-weight: bold;
                    color: #1a5f23;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th {
                    background: #1a5f23;
                    color: white;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                }
                td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #dee2e6;
                }
                tr:hover {
                    background: #f8f9fa;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                    .summary-card { break-inside: avoid; }
                    tr { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <h1> Montana Importados</h1>
                    <p>Sistema de Gestión de Ventas - Tecnología de Importación</p>
                </div>
                
                <div class="period">
                    📅 Período: ${formatDateShort(startDate)} - ${formatDateShort(endDate)}
                </div>
                
                <div class="summary-grid">
                    <div class="summary-card">
                        <h4>💰 Total Ventas</h4>
                        <div class="amount">${formatCurrency(totals.totalVentas)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>💵 Efectivo</h4>
                        <div class="amount">${formatCurrency(totals.totalEfectivo)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>💳 Tarjeta</h4>
                        <div class="amount">${formatCurrency(totals.totalTarjeta)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>🏦 Transferencia</h4>
                        <div class="amount">${formatCurrency(totals.totalTransferencia)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>📝 A Crédito</h4>
                        <div class="amount">${formatCurrency(totals.totalCredito)}</div>
                    </div>
                </div>
                
                <h3 style="margin: 20px 0 10px;">📋 Detalle de Ventas</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Cliente</th>
                            <th>Vendedor</th>
                            <th>Total</th>
                            <th>Método Pago</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales && sales.length > 0 ? sales.map(sale => `
                            <tr>
                                <td>${sale.codigo}</td>
                                <td>${sale.clientes?.nombre || 'Venta General'}</td>
                                <td>${sale.usuarios?.nombre || '-'}</td>
                                <td>${formatCurrency(sale.total)}</td>
                                <td>${sale.metodo_pago === 'efectivo' ? '💵 Efectivo' : sale.metodo_pago === 'tarjeta' ? '💳 Tarjeta' : sale.metodo_pago === 'transferencia' ? '🏦 Transferencia' : '📝 Crédito'}</td>
                                <td>${formatDateShort(sale.fecha)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" style="text-align: center;">No hay ventas en este período</td></tr>'}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Reporte generado el ${fechaGeneracion}</p>
                    <p>Montana Importados</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function generateLowStockReportHTML(products) {
    const fechaGeneracion = new Date().toLocaleString('es-ES');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Stock Bajo - Montana Importados</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 30px;
                    background: white;
                }
                .report-container {
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #e74c3c;
                }
                .header h1 {
                    color: #e74c3c;
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                .header p {
                    color: #666;
                    font-size: 14px;
                }
                .alert-banner {
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    text-align: center;
                }
                .alert-banner .count {
                    font-size: 32px;
                    font-weight: bold;
                    color: #856404;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th {
                    background: #e74c3c;
                    color: white;
                    padding: 12px;
                    text-align: left;
                }
                td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #dee2e6;
                }
                .critical {
                    color: #e74c3c;
                    font-weight: bold;
                    background: #fee;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <h1>⚠️ Montana Importados</h1>
                    <p>Reporte de Productos con Stock Bajo</p>
                </div>
                
                <div class="alert-banner">
                    <div class="count">${products.length}</div>
                    <p>Productos con stock crítico o bajo</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th>Stock Actual</th>
                            <th>Stock Mínimo</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.length > 0 ? products.map(product => `
                            <tr class="${product.stock <= 3 ? 'critical' : ''}">
                                <td>${product.codigo || '-'}</td>
                                <td>${product.nombre}</td>
                                <td>${product.categorias?.nombre || '-'}</td>
                                <td><strong style="color: #e74c3c;">${product.stock}</strong></td>
                                <td>${product.stock_minimo || 5}</td>
                                <td>${product.stock <= 3 ? '🔴 CRÍTICO' : '🟡 BAJO'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" style="text-align: center;">✅ No hay productos con stock bajo</td></tr>'}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Reporte generado el ${fechaGeneracion}</p>
                    <p>Se recomienda realizar un pedido de reposición para estos productos.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function generateDebtorsReportHTML(debtors, startDate, endDate, totalDebt) {
    const fechaGeneracion = new Date().toLocaleString('es-ES');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Clientes Morosos - Montana Importados</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 30px;
                    background: white;
                }
                .report-container {
                    max-width: 1100px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #f39c12;
                }
                .header h1 {
                    color: #f39c12;
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                .period {
                    text-align: center;
                    background: #fff3e0;
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .debt-summary {
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    padding: 20px;
                    border-radius: 12px;
                    text-align: center;
                    margin-bottom: 25px;
                }
                .debt-summary .total {
                    font-size: 36px;
                    font-weight: bold;
                    color: #e74c3c;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th {
                    background: #f39c12;
                    color: white;
                    padding: 12px;
                    text-align: left;
                }
                td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #dee2e6;
                }
                .debt-amount {
                    color: #e74c3c;
                    font-weight: bold;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <h1>📋 Montana Importados</h1>
                    <p>Reporte de Clientes con Deuda (Morosos)</p>
                </div>
                
                <div class="period">
                    📅 Período de análisis: ${formatDateShort(startDate)} - ${formatDateShort(endDate)}
                </div>
                
                <div class="debt-summary">
                    <p style="margin-bottom: 10px;">💰 Total Deuda General</p>
                    <div class="total">${formatCurrency(totalDebt)}</div>
                    <p style="margin-top: 10px;">👥 Clientes con deuda: ${debtors?.length || 0}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Deuda Total</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${debtors && debtors.length > 0 ? debtors.map(debtor => `
                            <tr>
                                <td>${debtor.nombre}</td>
                                <td>${debtor.telefono || '-'}</td>
                                <td>${debtor.email || '-'}</td>
                                <td><span class="debt-amount">${formatCurrency(debtor.deuda_total)}</span></td>
                                <td>🔴 Pendiente de pago</td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align: center;">✅ No hay clientes con deuda</td></tr>'}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Reporte generado el ${fechaGeneracion}</p>
                    <p>Se recomienda contactar a los clientes para gestionar los pagos pendientes.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

    // ==================== REPORTS ====================
    async function loadReports() {
        if (!supabase) return;
        
        const salesChartCanvas = document.getElementById('salesChart');
        const topProductsCanvas = document.getElementById('topProductsCanvas');
        
        if (salesChartCanvas) {
            salesChartCanvas.style.opacity = '0.5';
        }
        if (topProductsCanvas) {
            topProductsCanvas.style.opacity = '0.5';
        }
        
        const reportsSection = document.getElementById('reportsSection');
        const sectionHeader = reportsSection?.querySelector('.section-header');
        
        if (sectionHeader && !document.getElementById('exportButtonsContainer')) {
            const exportDiv = document.createElement('div');
            exportDiv.id = 'exportButtonsContainer';
            exportDiv.style.display = 'flex';
            exportDiv.style.gap = '10px';
            exportDiv.innerHTML = `
                <button id="exportSalesBtn" class="btn-primary" style="background: #27ae60;">
                    <i class="fas fa-chart-line"></i> Exportar Ventas
                </button>
                <button id="exportLowStockBtn" class="btn-primary" style="background: #e74c3c;">
                    <i class="fas fa-boxes"></i> Stock Bajo
                </button>
                <button id="exportDebtorsBtn" class="btn-primary" style="background: #f39c12;">
                    <i class="fas fa-file-invoice-dollar"></i> Morosos
                </button>
            `;
            sectionHeader.appendChild(exportDiv);
            
            document.getElementById('exportSalesBtn').onclick = exportSalesReport;
            document.getElementById('exportLowStockBtn').onclick = exportLowStockReport;
            document.getElementById('exportDebtorsBtn').onclick = exportDebtorsReport;
        }
        
        try {
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
            
            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const chartLabels = last7Days.map(date => {
                const d = new Date(date);
                return dayNames[d.getDay()];
            });
            const chartData = last7Days.map(day => salesByDay[day]);
            
            const { data: topProducts, error: productsError } = await supabase
                .from('venta_detalles')
                .select(`
                    cantidad,
                    productos!inner (nombre)
                `);
            
            if (productsError) throw productsError;
            
            const productSales = {};
            topProducts?.forEach(item => {
                const productName = item.productos?.nombre;
                if (productName) {
                    productSales[productName] = (productSales[productName] || 0) + item.cantidad;
                }
            });
            
            const sortedProducts = Object.entries(productSales)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const topProductsLabels = sortedProducts.map(p => p[0]);
            const topProductsData = sortedProducts.map(p => p[1]);
            
            if (salesChart && typeof Chart !== 'undefined') {
                salesChart.destroy();
            }
            if (topProductsChart && typeof Chart !== 'undefined') {
                topProductsChart.destroy();
            }
            
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

            document.getElementById('companyName').value = configMap.empresa_nombre || 'Montana Importados';
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