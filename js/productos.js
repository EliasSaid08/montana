const Productos = (() => {
    const { supabase, mostrarNotificacion, formatearMoneda } = window.appConfig;

    let lista = [];
    let categorias = [];

    async function cargar() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('*, categorias (nombre)')
                .eq('activo', true)
                .order('nombre');
            if (error) throw error;
            lista = data || [];
        } catch { lista = []; }
    }

    async function cargarTodos() {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('*, categorias (nombre)')
                .order('nombre');
            if (error) throw error;
            return data || [];
        } catch { return []; }
    }

    let todosProductos = [];

    async function cargarSeccion(cats) {
        categorias = cats;
        await cargar();
        todosProductos = await cargarTodos();
        // Ordenar por stock ascendente (menos stock primero)
        todosProductos.sort((a, b) => a.stock - b.stock);

        _construirFiltrosCategorias();
        _aplicarFiltros();

        document.getElementById('searchProducts').oninput = _aplicarFiltros;
        document.getElementById('addProductBtn').onclick = () => mostrarModal();
    }

    function _construirFiltrosCategorias() {
        document.getElementById('productCategoryFilterBar')?.remove();

        const barra = document.createElement('div');
        barra.id = 'productCategoryFilterBar';
        barra.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;';

        barra.innerHTML = '<button class="cat-filter-btn active" data-cat="" data-estado=""><i class="fas fa-th"></i> Todos</button>';

        categorias.filter(c => c.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'cat-filter-btn';
            btn.setAttribute('data-cat', c.id);
            btn.setAttribute('data-estado', '');
            btn.innerHTML = `<i class="fas fa-tag"></i> ${c.nombre}`;
            barra.appendChild(btn);
        });

        // Separador visual
        const sep = document.createElement('span');
        sep.style.cssText = 'width:1px;height:24px;background:var(--border);margin:0 4px;';
        barra.appendChild(sep);

        // Botón inactivos
        const btnInactivos = document.createElement('button');
        btnInactivos.className = 'cat-filter-btn';
        btnInactivos.setAttribute('data-cat', '');
        btnInactivos.setAttribute('data-estado', 'inactivo');
        btnInactivos.innerHTML = '<i class="fas fa-ban"></i> Inactivos';
        btnInactivos.style.cssText = 'border-color:var(--danger);';
        barra.appendChild(btnInactivos);

        barra.addEventListener('click', (e) => {
            const btn = e.target.closest('.cat-filter-btn');
            if (!btn) return;
            barra.querySelectorAll('.cat-filter-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = b.getAttribute('data-estado') === 'inactivo' ? 'var(--danger)' : '';
            });
            btn.classList.add('active');
            if (btn.getAttribute('data-estado') === 'inactivo') {
                btn.style.borderColor = 'var(--danger)';
                btn.style.background  = 'rgba(244,63,94,0.15)';
                btn.style.color       = 'var(--danger)';
            }
            _aplicarFiltros();
        });

        const searchBox = document.querySelector('#productsSection .search-box');
        searchBox.insertAdjacentElement('afterend', barra);
    }

    function _aplicarFiltros() {
        const q       = document.getElementById('searchProducts').value.toLowerCase();
        const activo  = document.querySelector('#productCategoryFilterBar .cat-filter-btn.active');
        const catId   = activo?.getAttribute('data-cat')   || '';
        const estado  = activo?.getAttribute('data-estado') || '';

        const filtrados = todosProductos.filter(p => {
            const matchTexto  = p.nombre.toLowerCase().includes(q) ||
                                (p.codigo || '').toLowerCase().includes(q) ||
                                (p.categorias?.nombre || '').toLowerCase().includes(q);
            const matchCat    = !catId  || String(p.categoria_id) === String(catId);
            const matchEstado = estado === 'inactivo' ? !p.activo : p.activo;
            return matchTexto && matchCat && matchEstado;
        });

        renderizarTabla(filtrados);
    }

    function renderizarTabla(productos) {
        const tbody = document.querySelector('#productsTable tbody');
        tbody.innerHTML = '';

        if (productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No se encontraron productos</td></tr>';
            return;
        }

        productos.forEach(p => {
            const activo   = p.activo;
            const minimo   = p.stock_minimo || 5;
            const critico  = p.stock <= 3;
            const bajo     = p.stock <= minimo && !critico;
            const stockClass = critico ? 'status-inactive' : bajo ? 'status-warning' : 'status-active';
            const stockLabel = critico ? `⚠ ${p.stock}` : p.stock;

            const row = document.createElement('tr');
            row.style.opacity = activo ? '1' : '0.6';
            row.innerHTML = `
                <td>${p.codigo || '-'}</td>
                <td>${p.nombre}</td>
                <td>${p.categorias?.nombre || '-'}</td>
                <td>${formatearMoneda(p.precio)}</td>
                <td>
                    <span class="status-badge ${stockClass}" style="font-weight:700;min-width:48px;text-align:center;">${stockLabel}</span>
                </td>
                <td>
                    <span class="status-badge ${activo ? 'status-active' : 'status-inactive'}">${activo ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn-secondary" style="padding:6px 12px;" onclick="Productos.mostrarModal('${p.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-secondary" style="padding:6px 12px;color:${activo ? 'var(--warning)' : 'var(--success,#27ae60)'};"
                        onclick="Productos.cambiarEstado('${p.id}','${p.nombre.replace(/'/g, "\\'")}',${activo})">
                        <i class="fas fa-${activo ? 'ban' : 'check-circle'}"></i>
                    </button>
                    <button class="btn-secondary" style="padding:6px 12px;color:var(--danger);" onclick="Productos.eliminar('${p.id}','${p.nombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async function mostrarModal(productoId = null) {
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');

        if (productoId !== null) productoId = parseInt(productoId);
        form.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productModalTitle').textContent = 'Agregar Producto';

        _resetImageUploader();

        const select = document.getElementById('productCategory');
        select.innerHTML = '<option value="">Seleccionar...</option>';
        categorias.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });

        if (productoId) {
            let producto = lista.find(p => p.id === productoId);
            if (!producto) {
                const todos = await cargarTodos();
                producto = todos.find(p => p.id === productoId);
            }
            if (producto) {
                document.getElementById('productModalTitle').textContent = 'Editar Producto';
                document.getElementById('productId').value = producto.id;
                document.getElementById('productCode').value = producto.codigo || '';
                document.getElementById('productName').value = producto.nombre;
                document.getElementById('productCategory').value = producto.categoria_id || '';
                document.getElementById('productPrice').value = producto.precio;
                document.getElementById('productCost').value = producto.costo || '';
                document.getElementById('productStock').value = producto.stock;
                document.getElementById('productDescription').value = producto.descripcion || '';
                document.getElementById('productImage').value = producto.imagen_url || '';

                if (producto.imagen_url) {
                    document.getElementById('imagePreview').src = producto.imagen_url;
                    document.getElementById('imageUploadPreview').style.display = 'flex';
                    document.getElementById('imageUploadPlaceholder').style.display = 'none';
                    const st = document.getElementById('imageUploadStatus');
                    if (st) { st.textContent = '✓ Imagen guardada'; st.className = 'image-upload-status success'; }
                }
            }
        } else {
            document.getElementById('productCode').value = await _proximoCodigo();
        }

        _configurarUploader();
        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await guardar(); };
    }

    function _resetImageUploader() {
        document.getElementById('imagePreview').src = '';
        document.getElementById('imageUploadPreview').style.display = 'none';
        document.getElementById('imageUploadPlaceholder').style.display = 'flex';
        const st = document.getElementById('imageUploadStatus');
        if (st) { st.textContent = ''; st.className = 'image-upload-status'; }
        document.getElementById('productImage').value = '';
        document.getElementById('productImageFile').value = '';
    }

    function _configurarUploader() {
        const area        = document.getElementById('imageUploadArea');
        const fileInput   = document.getElementById('productImageFile');
        const placeholder = document.getElementById('imageUploadPlaceholder');
        const previewBox  = document.getElementById('imageUploadPreview');
        const previewImg  = document.getElementById('imagePreview');
        const removeBtn   = document.getElementById('removeImageBtn');
        const status      = document.getElementById('imageUploadStatus');
        const hiddenUrl   = document.getElementById('productImage');

        if (!area) return;

        area.onclick = (e) => { if (!removeBtn.contains(e.target)) fileInput.click(); };
        area.ondragover = (e) => { e.preventDefault(); area.classList.add('drag-over'); };
        area.ondragleave = () => area.classList.remove('drag-over');
        area.ondrop = (e) => { e.preventDefault(); area.classList.remove('drag-over'); if (e.dataTransfer.files[0]) _procesarImagen(e.dataTransfer.files[0], { previewImg, previewBox, placeholder, hiddenUrl, status }); };
        fileInput.onchange = () => { if (fileInput.files[0]) _procesarImagen(fileInput.files[0], { previewImg, previewBox, placeholder, hiddenUrl, status }); };
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            previewImg.src = ''; hiddenUrl.value = '';
            previewBox.style.display = 'none'; placeholder.style.display = 'flex';
            fileInput.value = ''; status.textContent = ''; status.className = 'image-upload-status';
        };
    }

    async function _procesarImagen(archivo, { previewImg, previewBox, placeholder, hiddenUrl, status }) {
        if (!archivo.type.startsWith('image/')) { mostrarNotificacion('El archivo debe ser una imagen', 'error'); return; }
        if (archivo.size > 2 * 1024 * 1024) { mostrarNotificacion('La imagen no puede superar 2MB', 'error'); return; }

        previewImg.src = URL.createObjectURL(archivo);
        placeholder.style.display = 'none'; previewBox.style.display = 'flex';
        status.textContent = 'Subiendo…'; status.className = 'image-upload-status uploading';

        const urlPublica = await _subirImagen(archivo);
        if (urlPublica) {
            hiddenUrl.value = urlPublica; previewImg.src = urlPublica;
            status.textContent = '✓ Imagen subida correctamente'; status.className = 'image-upload-status success';
        } else {
            hiddenUrl.value = '';
            status.textContent = '✗ Error al subir'; status.className = 'image-upload-status error';
        }
    }

    async function _subirImagen(archivo) {
        if (!supabase) return null;
        try {
            const ext = archivo.name.split('.').pop().toLowerCase();
            const path = `productos/producto_${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('imagenes').upload(path, archivo, { upsert: true, contentType: archivo.type });
            if (error) { mostrarNotificacion('Error al subir la imagen: ' + error.message, 'error'); return null; }
            const { data } = supabase.storage.from('imagenes').getPublicUrl(path);
            return data?.publicUrl || null;
        } catch { return null; }
    }

    async function _proximoCodigo() {
        if (!supabase) return '1';
        try {
            const { data } = await supabase.from('productos').select('codigo').order('id', { ascending: false }).limit(1);
            if (!data || data.length === 0) return '1';
            return String((parseInt(data[0].codigo) || 0) + 1);
        } catch { return '1'; }
    }

    async function guardar() {
        if (!supabase) return;
        const id = document.getElementById('productId').value;
        const datos = {
            codigo: document.getElementById('productCode').value,
            nombre: document.getElementById('productName').value,
            categoria_id: parseInt(document.getElementById('productCategory').value) || null,
            precio: parseFloat(document.getElementById('productPrice').value),
            costo: parseFloat(document.getElementById('productCost').value) || null,
            stock: parseInt(document.getElementById('productStock').value),
            descripcion: document.getElementById('productDescription').value || null,
            imagen_url: document.getElementById('productImage')?.value.trim() || null,
            activo: true
        };

        try {
            const result = id
                ? await supabase.from('productos').update(datos).eq('id', id)
                : await supabase.from('productos').insert([datos]);
            if (result.error) throw result.error;
            document.getElementById('productModal').classList.add('hidden');
            mostrarNotificacion('Producto guardado', 'success');
            await cargarSeccion(categorias);
        } catch {
            mostrarNotificacion('Error al guardar producto', 'error');
        }
    }

    async function cambiarEstado(id, nombre, estadoActual) {
        if (!supabase || !confirm(`¿${estadoActual ? 'Inhabilitar' : 'Activar'} el producto "${nombre}"?`)) return;
        try {
            const { error } = await supabase.from('productos').update({ activo: !estadoActual }).eq('id', id);
            if (error) throw error;
            mostrarNotificacion(`Producto ${!estadoActual ? 'activado' : 'inhabilitado'}`, 'success');
            await cargarSeccion(categorias);
        } catch { mostrarNotificacion('Error al cambiar estado', 'error'); }
    }

    async function eliminar(id, nombre) {
        if (!supabase || !confirm(`¿Eliminar permanentemente el producto "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            const { error } = await supabase.from('productos').delete().eq('id', id);
            if (error) throw error;
            mostrarNotificacion('Producto eliminado', 'success');
            await cargarSeccion(categorias);
        } catch { mostrarNotificacion('Error al eliminar producto. Puede tener ventas asociadas.', 'error'); }
    }

    return { cargar, cargarSeccion, mostrarModal, cambiarEstado, eliminar, getLista: () => lista };
})();

window.Productos = Productos;