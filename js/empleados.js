const Empleados = (() => {
    const { supabase, mostrarNotificacion } = window.appConfig;

    let usuarioActual = null;
    function setUsuario(usuario) { usuarioActual = usuario; }

    async function cargarSeccion() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase.from('usuarios').select('*').order('nombre');
            if (error) throw error;

            const tbody = document.querySelector('#employeesTable tbody');
            tbody.innerHTML = '';

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay empleados</td></tr>';
                return;
            }

            data.forEach(emp => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${emp.username}</td>
                    <td>${emp.nombre}</td>
                    <td>${emp.email || '-'}</td>
                    <td><span class="status-badge ${emp.role === 'admin' ? 'status-active' : 'status-info'}">${emp.role === 'admin' ? 'Administrador' : 'Empleado'}</span></td>
                    <td><span class="status-badge ${emp.activo ? 'status-active' : 'status-inactive'}">${emp.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="btn-secondary" style="padding:6px 12px;" onclick="Empleados.mostrarModal('${emp.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${emp.id !== usuarioActual?.id ? `
                            <button class="btn-secondary" style="padding:6px 12px;color:var(--danger);" onclick="Empleados.cambiarEstado('${emp.id}',${!emp.activo})">
                                <i class="fas fa-${emp.activo ? 'ban' : 'check'}"></i>
                            </button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('searchEmployees').oninput = (e) => {
                const q = e.target.value.toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            };
            document.getElementById('addEmployeeBtn').onclick = () => mostrarModal();
        } catch { console.error('Error al cargar empleados'); }
    }

    function mostrarModal(id = null) {
        const modal = document.getElementById('employeeModal');
        const form  = document.getElementById('employeeForm');
        const labelPass = document.getElementById('passwordGroup').querySelector('label');

        form.reset();
        document.getElementById('employeeId').value = '';
        document.getElementById('employeeModalTitle').textContent = 'Agregar Empleado';
        document.getElementById('employeePassword').required = true;
        labelPass.textContent = 'Contraseña *';

        if (id) {
            supabase.from('usuarios').select('*').eq('id', id).single()
                .then(({ data: emp }) => {
                    if (!emp) return;
                    document.getElementById('employeeModalTitle').textContent  = 'Editar Empleado';
                    document.getElementById('employeeId').value       = emp.id;
                    document.getElementById('employeeName').value     = emp.nombre;
                    document.getElementById('employeeUsername').value = emp.username;
                    document.getElementById('employeeEmail').value    = emp.email || '';
                    document.getElementById('employeeRole').value     = emp.role;
                    document.getElementById('employeeActive').value   = emp.activo ? 'true' : 'false';
                    document.getElementById('employeePassword').required = false;
                    labelPass.textContent = 'Nueva Contraseña (opcional)';
                    document.getElementById('passwordGroup').querySelector('small').textContent = 'Dejar vacío para mantener la actual';
                });
        }

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await guardar(); };
    }

    async function guardar() {
        if (!supabase) return;
        const id       = document.getElementById('employeeId').value;
        const password = document.getElementById('employeePassword').value;
        const datos = {
            nombre:   document.getElementById('employeeName').value,
            username: document.getElementById('employeeUsername').value,
            email:    document.getElementById('employeeEmail').value || null,
            role:     document.getElementById('employeeRole').value,
            activo:   document.getElementById('employeeActive').value === 'true'
        };
        if (password) datos.password = password;

        try {
            if (id) {
                const { error } = await supabase.from('usuarios').update(datos).eq('id', id);
                if (error) throw error;
            } else {
                if (!password) { mostrarNotificacion('La contraseña es requerida', 'error'); return; }
                const { error } = await supabase.from('usuarios').insert([datos]);
                if (error) throw error;
            }
            document.getElementById('employeeModal').classList.add('hidden');
            mostrarNotificacion('Empleado guardado', 'success');
            await cargarSeccion();
        } catch (err) {
            mostrarNotificacion(err.code === '23505' ? 'El nombre de usuario ya existe' : 'Error al guardar empleado', 'error');
        }
    }

    async function cambiarEstado(id, nuevoEstado) {
        if (!confirm(`¿${nuevoEstado ? 'Activar' : 'Desactivar'} este empleado?`)) return;
        try {
            const { error } = await supabase.from('usuarios').update({ activo: nuevoEstado }).eq('id', id);
            if (error) throw error;
            mostrarNotificacion(`Empleado ${nuevoEstado ? 'activado' : 'desactivado'}`, 'success');
            await cargarSeccion();
        } catch { mostrarNotificacion('Error al actualizar estado', 'error'); }
    }

    function cargarPerfil() {
        if (!usuarioActual) return;
        document.getElementById('profileUsername').value = usuarioActual.username;
        document.getElementById('profileName').value     = usuarioActual.nombre;
        document.getElementById('profileEmail').value    = usuarioActual.email || '';
        document.getElementById('profileRole').value     = usuarioActual.role === 'admin' ? 'Administrador' : 'Empleado';

        document.getElementById('profileForm').onsubmit = async (e) => { e.preventDefault(); await actualizarPerfil(); };
        document.getElementById('changePasswordForm').onsubmit = async (e) => { e.preventDefault(); await cambiarContrasena(); };
    }

    async function actualizarPerfil() {
        if (!supabase || !usuarioActual) return;
        const datos = {
            nombre: document.getElementById('profileName').value,
            email:  document.getElementById('profileEmail').value || null
        };
        try {
            const { error } = await supabase.from('usuarios').update(datos).eq('id', usuarioActual.id);
            if (error) throw error;
            usuarioActual.nombre = datos.nombre; usuarioActual.email = datos.email;
            document.getElementById('currentUser').textContent = usuarioActual.nombre;
            mostrarNotificacion('Perfil actualizado', 'success');
        } catch { mostrarNotificacion('Error al actualizar perfil', 'error'); }
    }

    async function cambiarContrasena() {
        if (!supabase || !usuarioActual) return;
        const actual    = document.getElementById('currentPassword').value;
        const nueva     = document.getElementById('newPassword').value;
        const confirmar = document.getElementById('confirmPassword').value;

        if (nueva !== confirmar) { mostrarNotificacion('Las contraseñas no coinciden', 'error'); return; }
        if (nueva.length < 6)    { mostrarNotificacion('Mínimo 6 caracteres', 'error'); return; }
        if (actual !== usuarioActual.password) { mostrarNotificacion('Contraseña actual incorrecta', 'error'); return; }

        try {
            const { error } = await supabase.from('usuarios').update({ password: nueva }).eq('id', usuarioActual.id);
            if (error) throw error;
            usuarioActual.password = nueva;
            document.getElementById('changePasswordForm').reset();
            mostrarNotificacion('Contraseña cambiada exitosamente', 'success');
        } catch { mostrarNotificacion('Error al cambiar contraseña', 'error'); }
    }

    return { setUsuario, cargarSeccion, mostrarModal, cambiarEstado, cargarPerfil };
})();

window.Empleados = Empleados;
