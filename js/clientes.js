const Clientes = (() => {
    const { supabase, mostrarNotificacion, formatearMoneda, formatearFecha, ahora } = window.appConfig;

    let lista = [];

    async function cargar() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase.from('clientes').select('*').eq('activo', true).order('nombre');
            if (error) throw error;
            lista = data || [];
        } catch { lista = []; }
    }

    async function cargarSeccion() {
        await cargar();
        const tbody = document.querySelector('#customersTable tbody');
        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes</td></tr>';
            return;
        }

        lista.forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${c.nombre}</td>
                <td>${c.telefono || '-'}</td>
                <td>
                    <span class="status-badge ${c.deuda_total > 0 ? 'status-warning' : 'status-active'}">
                        ${formatearMoneda(c.deuda_total || 0)}
                    </span>
                </td>
                <td><span class="status-badge status-active">Activo</span></td>
                <td>
                    <button class="btn-secondary" style="padding:6px 12px;margin-right:5px;" onclick="Clientes.mostrarModal(${c.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-secondary" style="padding:6px 12px;color:var(--danger);" onclick="Clientes.eliminar(${c.id},'${c.nombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('searchCustomers').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            tbody.querySelectorAll('tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        };
        document.getElementById('addCustomerBtn').onclick = () => mostrarModal();
    }

    function mostrarModal(id = null) {
        const modal = document.getElementById('customerModal');
        const form  = document.getElementById('customerForm');

        form.reset();
        document.getElementById('customerId').value = '';
        document.getElementById('customerModalTitle').textContent = 'Agregar Cliente';

        if (id) {
            const cliente = lista.find(c => c.id === id);
            if (cliente) {
                document.getElementById('customerModalTitle').textContent = 'Editar Cliente';
                document.getElementById('customerId').value    = cliente.id;
                document.getElementById('customerName').value  = cliente.nombre;
                document.getElementById('customerPhone').value = cliente.telefono || '';
                document.getElementById('customerEmail').value = cliente.email || '';
                document.getElementById('customerAddress').value = cliente.direccion || '';
            }
        }

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await guardar(); };
    }

    async function guardar() {
        if (!supabase) return;
        const id = document.getElementById('customerId').value;
        const datos = {
            nombre:    document.getElementById('customerName').value,
            telefono:  document.getElementById('customerPhone').value || null,
            email:     document.getElementById('customerEmail').value || null,
            direccion: document.getElementById('customerAddress').value || null,
            activo:    true
        };

        try {
            const result = id
                ? await supabase.from('clientes').update(datos).eq('id', id)
                : await supabase.from('clientes').insert([datos]);
            if (result.error) throw result.error;
            document.getElementById('customerModal').classList.add('hidden');
            mostrarNotificacion('Cliente guardado', 'success');
            await cargarSeccion();
        } catch { mostrarNotificacion('Error al guardar cliente', 'error'); }
    }

    async function eliminar(id, nombre) {
        if (!supabase || !confirm(`¿Eliminar el cliente "${nombre}"?`)) return;
        try {
            const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id);
            if (error) throw error;
            mostrarNotificacion('Cliente eliminado', 'success');
            await cargarSeccion();
        } catch { mostrarNotificacion('Error al eliminar cliente', 'error'); }
    }

    async function cargarDeudas() {
        if (!supabase) return;
        try {
            const { data: deudores, error } = await supabase
                .from('clientes')
                .select('*, ventas!ventas_cliente_id_fkey (fecha, total)')
                .gt('deuda_total', 0).eq('activo', true)
                .order('deuda_total', { ascending: false });
            if (error) throw error;

            document.getElementById('totalDebt').textContent    = formatearMoneda(deudores?.reduce((s, d) => s + parseFloat(d.deuda_total || 0), 0) || 0);
            document.getElementById('debtorsCount').textContent = deudores?.length || 0;

            const tbody = document.querySelector('#debtsTable tbody');
            tbody.innerHTML = '';

            if (!deudores || deudores.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes con deuda</td></tr>';
                return;
            }

            deudores.forEach(d => {
                const ultimaVenta = d.ventas?.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${d.nombre}</td>
                    <td>${d.telefono || '-'}</td>
                    <td><span class="status-badge status-warning" style="font-weight:700;font-size:16px;">${formatearMoneda(d.deuda_total)}</span></td>
                    <td>${ultimaVenta ? formatearFecha(ultimaVenta.fecha) : 'N/A'}</td>
                    <td>
                        <button class="btn-primary" style="padding:6px 12px;margin-right:5px;" onclick="Clientes.mostrarModalPago(${d.id},'${d.nombre.replace(/'/g, "\\'")}',${d.deuda_total})">
                            <i class="fas fa-dollar-sign"></i> Pagar
                        </button>
                        <button class="btn-secondary" style="padding:6px 12px;" onclick="Clientes.verHistorialDeuda(${d.id})">
                            <i class="fas fa-history"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('searchDebts').oninput = (e) => {
                const q = e.target.value.toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            };
        } catch (err) { console.error('Error al cargar deudas:', err); }
    }

    function mostrarModalPago(idCliente, nombre, deudaActual) {
        const modal = document.getElementById('paymentModal');
        const form  = document.getElementById('paymentForm');

        form.reset();
        document.getElementById('paymentCustomerId').value      = idCliente;
        document.getElementById('paymentCustomerName').value    = nombre;
        document.getElementById('paymentCurrentDebt').value     = formatearMoneda(deudaActual);
        document.getElementById('paymentAmount').max            = deudaActual;

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await registrarPago(); };
    }

    async function registrarPago() {
        if (!supabase) return;
        const idCliente = document.getElementById('paymentCustomerId').value;
        const monto     = parseFloat(document.getElementById('paymentAmount').value);
        const metodo    = document.getElementById('paymentMethodType').value;
        const referencia = document.getElementById('paymentReference').value;
        const notas      = document.getElementById('paymentNotes').value;

        if (monto <= 0) { mostrarNotificacion('El monto debe ser mayor a 0', 'error'); return; }

        try {
            const { error: errPago } = await supabase.from('pagos').insert([{
                cliente_id: idCliente, monto, fecha: ahora(),
                metodo_pago: metodo,
                referencia: referencia || null,
                notas: notas || null
            }]);
            if (errPago) throw errPago;

            const { data: cliente } = await supabase.from('clientes').select('deuda_total').eq('id', idCliente).single();
            const nuevaDeuda = Math.max(0, (cliente.deuda_total || 0) - monto);
            const { error: errUpdate } = await supabase.from('clientes').update({ deuda_total: nuevaDeuda }).eq('id', idCliente);
            if (errUpdate) throw errUpdate;

            document.getElementById('paymentModal').classList.add('hidden');
            mostrarNotificacion('Pago registrado exitosamente', 'success');
            await cargar();
            await cargarDeudas();
        } catch { mostrarNotificacion('Error al registrar el pago', 'error'); }
    }

    async function verHistorialDeuda(idCliente) {
        if (!supabase) return;
        try {
            const { data: pagos } = await supabase.from('pagos').select('*').eq('cliente_id', idCliente).order('fecha', { ascending: false }).limit(10);
            let msg = 'Historial de Pagos:\n\n';
            if (!pagos || pagos.length === 0) { msg += 'No hay pagos registrados'; }
            else { pagos.forEach(p => { msg += `${formatearFecha(p.fecha)} - ${formatearMoneda(p.monto)} (${p.metodo_pago})\n`; }); }
            alert(msg);
        } catch { mostrarNotificacion('Error al cargar historial', 'error'); }
    }

    return { cargar, cargarSeccion, mostrarModal, eliminar, cargarDeudas, mostrarModalPago, verHistorialDeuda, getLista: () => lista };
})();

window.Clientes = Clientes;
