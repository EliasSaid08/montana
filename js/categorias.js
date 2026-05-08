const Categorias = (() => {
    const { supabase, mostrarNotificacion } = window.appConfig;

    let lista = [];

    async function cargar() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase.from('categorias').select('*').order('nombre');
            if (error) throw error;
            lista = data || [];
        } catch { lista = []; }
    }

    async function cargarSeccion() {
        if (!supabase) return;

        try {
            const { data: cats, error } = await supabase.from('categorias').select('*').order('nombre');
            if (error) throw error;
            lista = cats || [];
        } catch { return; }

        let conteo = {};
        try {
            const { data: prods } = await supabase.from('productos').select('categoria_id').eq('activo', true);
            (prods || []).forEach(p => {
                if (p.categoria_id) conteo[p.categoria_id] = (conteo[p.categoria_id] || 0) + 1;
            });
        } catch { /* ignorar */ }

        renderizarTabla(lista, conteo);

        document.getElementById('searchCategories').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            const filtradas = lista.filter(c =>
                c.nombre.toLowerCase().includes(q) || (c.descripcion || '').toLowerCase().includes(q)
            );
            renderizarTabla(filtradas, conteo);
        };

        document.getElementById('addCategoryBtn').onclick = () => mostrarModal();
    }

    function renderizarTabla(cats, conteo = {}) {
        const tbody = document.querySelector('#categoriesTable tbody');
        tbody.innerHTML = '';

        if (cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">No se encontraron categorías</td></tr>';
            return;
        }

        cats.forEach((cat, idx) => {
            const cant = conteo[cat.id] || 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color:var(--text-muted);font-size:12px;">${idx + 1}</td>
                <td><strong>${cat.nombre}</strong></td>
                <td style="color:var(--text-muted);font-size:13px;">${cat.descripcion || '<em style="opacity:.5;">Sin descripción</em>'}</td>
                <td>
                    <span style="background:rgba(139,92,246,0.12);color:var(--primary-light);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">
                        ${cant} producto${cant !== 1 ? 's' : ''}
                    </span>
                </td>
                <td>${cat.activo ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-danger">Inactiva</span>'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="Categorias.mostrarModal(${cat.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-action ${cat.activo ? 'btn-warning' : 'btn-success'}" onclick="Categorias.cambiarEstado(${cat.id},${cat.activo})">
                            <i class="fas fa-${cat.activo ? 'toggle-off' : 'toggle-on'}"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="Categorias.eliminar(${cat.id},'${cat.nombre.replace(/'/g, "\\'")}',${cant})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async function mostrarModal(id = null) {
        const modal = document.getElementById('categoryModal');
        const form  = document.getElementById('categoryForm');

        form.reset();
        document.getElementById('categoryId').value = '';

        if (id) {
            try {
                const { data, error } = await supabase.from('categorias').select('*').eq('id', id).single();
                if (error) throw error;
                document.getElementById('categoryModalTitle').textContent = 'Editar Categoría';
                document.getElementById('categoryId').value          = data.id;
                document.getElementById('categoryName').value        = data.nombre;
                document.getElementById('categoryDescription').value = data.descripcion || '';
                document.getElementById('categoryActive').value      = String(data.activo);
            } catch { mostrarNotificacion('Error al cargar la categoría', 'error'); return; }
        } else {
            document.getElementById('categoryModalTitle').textContent = 'Nueva Categoría';
            document.getElementById('categoryActive').value = 'true';
        }

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await guardar(); };
    }

    async function guardar() {
        if (!supabase) return;
        const id = document.getElementById('categoryId').value;
        const datos = {
            nombre:      document.getElementById('categoryName').value.trim(),
            descripcion: document.getElementById('categoryDescription').value.trim() || null,
            activo:      document.getElementById('categoryActive').value === 'true'
        };

        if (!datos.nombre) { mostrarNotificacion('El nombre es obligatorio', 'error'); return; }

        try {
            const result = id
                ? await supabase.from('categorias').update(datos).eq('id', id)
                : await supabase.from('categorias').insert([datos]);
            if (result.error) throw result.error;

            mostrarNotificacion(id ? 'Categoría actualizada' : 'Categoría creada', 'success');
            document.getElementById('categoryModal').classList.add('hidden');
            await cargarSeccion();
            await cargar();
        } catch (err) {
            mostrarNotificacion(err.code === '23505' ? 'Ya existe una categoría con ese nombre' : 'Error al guardar: ' + err.message, 'error');
        }
    }

    async function cambiarEstado(id, estadoActual) {
        if (!confirm(`¿${estadoActual ? 'Desactivar' : 'Activar'} esta categoría?`)) return;
        try {
            const { error } = await supabase.from('categorias').update({ activo: !estadoActual }).eq('id', id);
            if (error) throw error;
            mostrarNotificacion(`Categoría ${estadoActual ? 'desactivada' : 'activada'}`, 'success');
            await cargarSeccion();
            await cargar();
        } catch (err) { mostrarNotificacion('Error: ' + err.message, 'error'); }
    }

    async function eliminar(id, nombre, cantProductos) {
        if (cantProductos > 0) {
            mostrarNotificacion(`No se puede eliminar "${nombre}": tiene ${cantProductos} producto${cantProductos > 1 ? 's' : ''} asociado${cantProductos > 1 ? 's' : ''}. Desactivala en su lugar.`, 'warning');
            return;
        }
        if (!confirm(`¿Eliminar la categoría "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            const { error } = await supabase.from('categorias').delete().eq('id', id);
            if (error) throw error;
            mostrarNotificacion(`Categoría "${nombre}" eliminada`, 'success');
            await cargarSeccion();
            await cargar();
        } catch (err) { mostrarNotificacion('Error al eliminar: ' + err.message, 'error'); }
    }

    return { cargar, cargarSeccion, mostrarModal, cambiarEstado, eliminar, getLista: () => lista };
})();

window.Categorias = Categorias;
