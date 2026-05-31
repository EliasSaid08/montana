const Reportes = (() => {
    const { supabase, mostrarNotificacion, formatearMoneda, formatearFecha, formatearFechaCorta, ahora } = window.appConfig;

    let graficaVentas     = null;
    let graficaCategorias = null;
    let graficaTopBarras  = null;
    let graficaMargen     = null;
    let periodoActual     = 'weekly';

    async function cargar() {
        if (!supabase) return;
        _configurarSelectorPeriodo();
        await renderizarGraficaVentas();
        await renderizarGraficaCategorias();
        await renderizarTopProductos();
        await renderizarMargenGanancia();
        await cargarMorosos();

        const selector = document.getElementById('topProductsLimit');
        if (selector && !selector.dataset.bound) {
            selector.dataset.bound = '1';
            selector.onchange = () => renderizarTopProductos();
        }
        const selectorMargen = document.getElementById('topMargenLimit');
        if (selectorMargen && !selectorMargen.dataset.bound) {
            selectorMargen.dataset.bound = '1';
            selectorMargen.onchange = () => renderizarMargenGanancia();
        }
    }

    function _configurarSelectorPeriodo() {
        document.querySelectorAll('.chart-period-btn').forEach(btn => {
            btn.onclick = async () => {
                document.querySelectorAll('.chart-period-btn').forEach(b => {
                    b.style.background = 'var(--bg-raised)'; b.style.color = 'var(--text-muted)';
                });
                btn.style.background = 'var(--primary)'; btn.style.color = 'white';
                periodoActual = btn.dataset.period;
                await renderizarGraficaVentas();
            };
        });
    }

    async function renderizarGraficaVentas() {
        if (!supabase || typeof Chart === 'undefined') return;
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;
        canvas.style.opacity = '0.4';

        try {
            let labels = [], dataMap = {}, desde, hasta;

            // Fecha actual en zona Argentina (evita el bug UTC que corre los días un día atrás)
            const ahoraStr = ahora(); // "2026-05-08T23:36:00-03:00"
            const hoyLocal = ahoraStr.substring(0, 10); // "2026-05-08"
            const [hoyY, hoyM, hoyD] = hoyLocal.split('-').map(Number);

            // Helper: sumar/restar días a una fecha local sin pasar por UTC
            const sumarDias = (yyyy, mm, dd, dias) => {
                const d = new Date(yyyy, mm - 1, dd + dias);
                return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
            };
            const pad = n => String(n).padStart(2, '0');
            const toKey = (yyyy, mm, dd) => `${yyyy}-${pad(mm)}-${pad(dd)}`;

            if (periodoActual === 'weekly') {
                const nombDias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                const dias = [];
                for (let i = 6; i >= 0; i--) {
                    const [y, m, d] = sumarDias(hoyY, hoyM, hoyD, -i);
                    const key = toKey(y, m, d);
                    const diaSemana = new Date(y, m - 1, d).getDay(); // local, no UTC
                    dias.push(key);
                    labels.push(nombDias[diaSemana]);
                    dataMap[key] = 0;
                }
                desde = dias[0]; hasta = dias[dias.length - 1] + 'T23:59:59';
                const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                data?.forEach(s => { const k = s.fecha.split('T')[0]; if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });

            } else if (periodoActual === 'monthly') {
                const nombMeses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                const meses = [];
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(hoyY, hoyM - 1 - i, 1); // local
                    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
                    meses.push(key); labels.push(nombMeses[d.getMonth()]); dataMap[key] = 0;
                }
                desde = meses[0] + '-01'; hasta = hoyLocal + 'T23:59:59';
                const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                data?.forEach(s => { const k = s.fecha.substring(0, 7); if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });

            } else if (periodoActual === 'yearly') {
                const anios = [];
                for (let i = 4; i >= 0; i--) { const y = String(hoyY - i); anios.push(y); labels.push(y); dataMap[y] = 0; }
                desde = anios[0] + '-01-01'; hasta = anios[anios.length - 1] + '-12-31T23:59:59';
                const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                data?.forEach(s => { const k = s.fecha.substring(0, 4); if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });
            }

            if (graficaVentas) graficaVentas.destroy();
            graficaVentas = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets: [{ label: 'Ventas (ARS)', data: Object.values(dataMap), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.12)', tension: 0.4, fill: true, pointBackgroundColor: '#8b5cf6', pointRadius: 4, pointHoverRadius: 7 }] },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { top: 8, bottom: 8 } },
                    plugins: { legend: { labels: { color: '#a0a0c0' } }, tooltip: { callbacks: { label: ctx => `$${ctx.raw.toFixed(2)}` } } },
                    scales: {
                        x: { ticks: { color: '#6b6b88' }, grid: { color: 'rgba(139,92,246,0.07)' } },
                        y: { ticks: { color: '#6b6b88', callback: v => `$${v}` }, grid: { color: 'rgba(139,92,246,0.07)' }, beginAtZero: true }
                    }
                }
            });
        } catch (err) { console.error('Error graficando ventas:', err); }
        finally { canvas.style.opacity = '1'; }
    }

    async function renderizarGraficaCategorias() {
        if (!supabase || typeof Chart === 'undefined') return;
        const canvas = document.getElementById('topProductsCanvas');
        if (!canvas) return;
        canvas.style.opacity = '0.4';

        try {
            const { data } = await supabase.from('venta_detalles').select('cantidad, productos!inner(nombre, categorias(nombre))');
            if (!data || data.length === 0) { canvas.parentElement.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0;">Sin datos de ventas aún</p>'; return; }

            const totales = {};
            data.forEach(i => { const cat = i.productos?.categorias?.nombre || 'Sin categoría'; totales[cat] = (totales[cat] || 0) + i.cantidad; });
            const ordenado = Object.entries(totales).sort((a, b) => b[1] - a[1]);
            const palette  = ['#8b5cf6','#a78bfa','#6d28d9','#c4b5fd','#7c3aed','#ddd6fe','#4c1d95','#ede9fe'];

            if (graficaCategorias) graficaCategorias.destroy();
            graficaCategorias = new Chart(canvas, {
                type: 'doughnut',
                data: { labels: ordenado.map(e => e[0]), datasets: [{ data: ordenado.map(e => e[1]), backgroundColor: palette.slice(0, ordenado.length), borderColor: '#16161f', borderWidth: 3, hoverOffset: 8 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '55%', animation: { duration: 600 },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#a0a0c0', padding: 14, font: { size: 12 }, boxWidth: 14 } },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} uds (${((ctx.raw / ordenado.reduce((a, b) => a + b[1], 0)) * 100).toFixed(1)}%)` } }
                    }
                }
            });
        } catch (err) { console.error('Error graficando categorías:', err); }
        finally { if (canvas) canvas.style.opacity = '1'; }
    }

    async function renderizarTopProductos() {
        if (!supabase || typeof Chart === 'undefined') return;
        const canvas = document.getElementById('topProductsBarCanvas');
        if (!canvas) return;
        canvas.style.opacity = '0.4';
        const limite = parseInt(document.getElementById('topProductsLimit')?.value || '5');

        try {
            const { data } = await supabase.from('venta_detalles').select('cantidad, productos!inner(nombre)');
            if (!data || data.length === 0) { canvas.parentElement.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0;">Sin datos de ventas aún</p>'; return; }

            const totales = {};
            data.forEach(i => { const n = i.productos?.nombre; if (n) totales[n] = (totales[n] || 0) + i.cantidad; });
            const ordenado = Object.entries(totales).sort((a, b) => b[1] - a[1]).slice(0, limite);

            const bgColors = ordenado.map((_, i) => `rgba(139,92,246,${1 - (i / ordenado.length) * 0.55})`);

            if (graficaTopBarras) graficaTopBarras.destroy();
            graficaTopBarras = new Chart(canvas, {
                type: 'bar',
                data: { labels: ordenado.map(e => e[0]), datasets: [{ label: 'Unidades vendidas', data: ordenado.map(e => e[1]), backgroundColor: bgColors, borderColor: 'rgba(139,92,246,0.9)', borderWidth: 1, borderRadius: 6, borderSkipped: false }] },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { top: 8, bottom: 8 } },
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} unidades` } } },
                    scales: {
                        x: { beginAtZero: true, ticks: { color: '#6b6b88', precision: 0 }, grid: { color: 'rgba(139,92,246,0.07)' } },
                        y: { ticks: { color: '#d0d0e8', font: { size: 12, weight: '500' } }, grid: { display: false } }
                    }
                }
            });
        } catch (err) { console.error('Error graficando top productos:', err); }
        finally { if (canvas) canvas.style.opacity = '1'; }
    }

    async function renderizarMargenGanancia() {
        if (!supabase || typeof Chart === 'undefined') return;
        const canvas = document.getElementById('margenCanvas');
        if (!canvas) return;
        canvas.style.opacity = '0.4';
        const limite = parseInt(document.getElementById('topMargenLimit')?.value || '5');

        try {
            const { data } = await supabase.from('productos').select('nombre, precio, costo').eq('activo', true).not('costo', 'is', null).gt('costo', 0);
            if (!data || data.length === 0) {
                canvas.parentElement.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0;">Sin datos de costo cargados</p>';
                return;
            }

            const conMargen = data
                .map(p => ({ nombre: p.nombre, margen: ((p.precio - p.costo) / p.costo) * 100 }))
                .filter(p => p.margen > 0)
                .sort((a, b) => b.margen - a.margen)
                .slice(0, limite);

            if (conMargen.length === 0) {
                canvas.parentElement.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0;">Sin productos con margen positivo</p>';
                return;
            }

            const palette = conMargen.map((_, i) => `rgba(16,185,129,${1 - (i / conMargen.length) * 0.55})`);

            if (graficaMargen) graficaMargen.destroy();
            graficaMargen = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: conMargen.map(p => p.nombre),
                    datasets: [{
                        label: 'Margen (%)',
                        data: conMargen.map(p => parseFloat(p.margen.toFixed(1))),
                        backgroundColor: palette,
                        borderColor: 'rgba(16,185,129,0.9)',
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { top: 8, bottom: 8 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% de margen` } }
                    },
                    scales: {
                        x: { beginAtZero: true, ticks: { color: '#6b6b88', precision: 0, callback: v => `${v}%` }, grid: { color: 'rgba(16,185,129,0.07)' } },
                        y: { ticks: { color: '#d0d0e8', font: { size: 12, weight: '500' } }, grid: { display: false } }
                    }
                }
            });
        } catch (err) { console.error('Error graficando margen:', err); }
        finally { if (canvas) canvas.style.opacity = '1'; }
    }

    function mostrarVistaPrevia(html, nombreArchivo) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'z-index:10000;background:rgba(0,0,0,0.8);';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:90%;width:900px;max-height:90vh;display:flex;flex-direction:column;">
                <div class="modal-header" style="flex-shrink:0;">
                    <h3><i class="fas fa-print" style="color:var(--primary-light);margin-right:8px;"></i> Vista Previa del Reporte</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div style="flex:1;overflow:auto;padding:20px;background:#ffffff;" id="previewContent"></div>
                <div class="modal-actions" style="flex-shrink:0;display:flex;gap:10px;justify-content:flex-end;padding:15px;">
                    <button id="btnImprimir" class="btn-secondary" style="background:#3498db;"><i class="fas fa-print"></i> Imprimir</button>
                    <button id="btnDescargarPDF" class="btn-primary" style="background:#27ae60;"><i class="fas fa-download"></i> Descargar PDF</button>
                    <button class="btn-secondary close-modal">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('previewContent').innerHTML = html;
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.remove());

        document.getElementById('btnImprimir').onclick = () => _imprimir(html, nombreArchivo);
        document.getElementById('btnDescargarPDF').onclick = async () => await _descargarPDF(html, nombreArchivo);
    }

    function _imprimir(html, titulo) {
        const ventana = window.open('', '_blank');
        ventana.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;margin:20px;}@media print{body{margin:0;padding:20px;}button{display:none;}}</style></head><body>${html}<script>window.onload=()=>{setTimeout(()=>{window.print();setTimeout(()=>window.close(),1000);},500);};<\/script></body></html>`);
        ventana.document.close();
    }

    async function _descargarPDF(html, nombreArchivo) {
        mostrarNotificacion('Generando PDF...', 'info');
        try {
            if (typeof html2canvas === 'undefined') throw new Error('html2canvas no disponible');
            const temp = document.createElement('div');
            temp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:800px;';
            temp.innerHTML = html;
            document.body.appendChild(temp);
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(temp, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
            document.body.removeChild(temp);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
            pdf.save(`${nombreArchivo}.pdf`);
            mostrarNotificacion('PDF descargado correctamente', 'success');
        } catch {
            mostrarNotificacion('No se pudo generar PDF. Abriendo para imprimir...', 'warning');
            _imprimir(html, nombreArchivo);
        }
    }

    function _selectorFechas(callback) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-calendar-alt" style="color:var(--primary-light);margin-right:8px;"></i> Seleccionar Período</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <form id="formFechas">
                    <div class="form-group"><label>Fecha Inicio</label><input type="date" id="fechaInicio" class="form-control" required></div>
                    <div class="form-group"><label>Fecha Fin</label><input type="date" id="fechaFin" class="form-control" required></div>
                    <div class="form-group">
                        <label>Vista Rápida</label>
                        <select id="rangoRapido" class="form-control">
                            <option value="">Seleccionar...</option>
                            <option value="hoy">Hoy</option><option value="ayer">Ayer</option>
                            <option value="semana">Última Semana</option><option value="mes">Último Mes</option>
                            <option value="trimestre">Último Trimestre</option>
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

        const toArgDate = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
        const hoy = new Date(), hace30 = new Date();
        hace30.setDate(hoy.getDate() - 30);
        document.getElementById('fechaInicio').value = toArgDate(hace30);
        document.getElementById('fechaFin').value    = toArgDate(hoy);

        document.getElementById('rangoRapido').onchange = (e) => {
            const now = new Date(); let inicio = new Date();
            const offsets = { hoy: 0, ayer: 1, semana: 7, mes: 30, trimestre: 90 };
            const offset = offsets[e.target.value];
            if (offset === undefined) return;
            inicio.setDate(now.getDate() - offset);
            document.getElementById('fechaInicio').value = toArgDate(inicio);
            document.getElementById('fechaFin').value    = toArgDate(now);
        };

        document.getElementById('formFechas').onsubmit = (e) => {
            e.preventDefault();
            const inicio = document.getElementById('fechaInicio').value;
            const fin    = document.getElementById('fechaFin').value;
            modal.remove();
            callback(inicio, fin);
        };
    }

    async function exportarVentas() {
        if (!supabase) return;
        _selectorFechas(async (inicio, fin) => {
            try {
                mostrarNotificacion('Generando reporte...', 'info');
                const { data, error } = await supabase.from('ventas')
                    .select('*, clientes (nombre), usuarios (nombre)')
                    .gte('fecha', inicio).lte('fecha', fin + 'T23:59:59')
                    .order('fecha', { ascending: false });
                if (error) throw error;

                const totales = { general: 0, efectivo: 0, tarjeta: 0, transferencia: 0, credito: 0 };
                data?.forEach(v => {
                    const t = parseFloat(v.total);
                    totales.general += t;
                    if (totales[v.metodo_pago] !== undefined) totales[v.metodo_pago] += t;
                });

                const html = _htmlReporteVentas(data, inicio, fin, totales);
                mostrarVistaPrevia(html, `reporte_ventas_${inicio}_a_${fin}`);
            } catch { mostrarNotificacion('Error al generar el reporte', 'error'); }
        });
    }

    async function exportarStockBajo() {
        if (!supabase) return;
        try {
            mostrarNotificacion('Generando reporte...', 'info');
            await Productos.cargar();
            const bajos = Productos.getLista().filter(p => p.stock <= (p.stock_minimo || 5));
            const html = _htmlReporteStockBajo(bajos);
            mostrarVistaPrevia(html, `reporte_stock_bajo_${new Date().toISOString().split('T')[0]}`);
        } catch { mostrarNotificacion('Error al generar el reporte', 'error'); }
    }

    function _estilosBase(acento) {
        return `
        *{margin:0;padding:0;box-sizing:border-box;}
        body,div,p,span,h1,h2,h3,h4,td,th,label,small{
            font-family:'Segoe UI',Arial,sans-serif;
            color:#1a1a2e !important;
            background:transparent;
        }
        body{padding:30px;background:#ffffff !important;}
        .header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid ${acento};}
        .header h1{color:${acento} !important;font-size:28px;margin-bottom:5px;}
        .header p{color:#555 !important;}
        table{width:100%;border-collapse:collapse;margin-top:20px;background:white;}
        thead tr{background:${acento} !important;}
        th{background:${acento} !important;color:#ffffff !important;padding:12px;text-align:left;font-weight:600;}
        td{padding:10px 12px;border-bottom:1px solid #dee2e6;color:#1a1a2e !important;background:white !important;}
        tr:nth-child(even) td{background:#f8f9fa !important;}
        tr:hover td{background:#eef2ff !important;}
        .footer{margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;text-align:center;font-size:12px;color:#999 !important;}
        @media print{body{padding:0;}tr{break-inside:avoid;}}`;
    }

    const _labelMetodo = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito' };

    function _htmlReporteVentas(ventas, inicio, fin, totales) {
        const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        const filas = (ventas && ventas.length > 0)
            ? ventas.map(v => {
                const metodo = v.metodo_pago ? (_labelMetodo[v.metodo_pago] || v.metodo_pago) : '-';
                return `<tr>
                    <td>${v.codigo || '-'}</td>
                    <td>${v.clientes?.nombre || 'Venta General'}</td>
                    <td>${v.usuarios?.nombre || '-'}</td>
                    <td style="font-weight:600;">${formatearMoneda(v.total)}</td>
                    <td>${metodo}</td>
                    <td>${formatearFechaCorta(v.fecha)}</td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="6" style="text-align:center;padding:20px;color:#666;">No hay ventas en este período</td></tr>';

        return `<style>${_estilosBase('#1a5f23')}
        .resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;margin-bottom:30px;}
        .tarjeta{background:linear-gradient(135deg,#f8f9fa,#e9ecef);padding:15px;border-radius:12px;text-align:center;border:1px solid #dee2e6;}
        .tarjeta h4{font-size:13px;color:#666;margin-bottom:8px;text-transform:uppercase;}
        .tarjeta .monto{font-size:24px;font-weight:bold;color:#1a5f23;}</style>
        <div class="header"><h1>Montana Importados</h1><p>Reporte de Ventas — ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}</p></div>
        <div class="resumen">
            <div class="tarjeta"><h4>💰 Total</h4><div class="monto">${formatearMoneda(totales.general)}</div></div>
            <div class="tarjeta"><h4>💵 Efectivo</h4><div class="monto">${formatearMoneda(totales.efectivo)}</div></div>
            <div class="tarjeta"><h4>💳 Tarjeta</h4><div class="monto">${formatearMoneda(totales.tarjeta)}</div></div>
            <div class="tarjeta"><h4>🏦 Transferencia</h4><div class="monto">${formatearMoneda(totales.transferencia)}</div></div>
        </div>
        <table><thead><tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Método</th><th>Fecha</th></tr></thead>
        <tbody>${filas}</tbody></table>
        <div class="footer"><p>Generado el ${fecha} — Montana Importados</p></div>`;
    }

    function _htmlReporteStockBajo(productos) {
        const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        const filas = productos.length > 0
            ? productos.map(p => `<tr class="${p.stock <= 3 ? 'critico' : ''}">
                <td>${p.codigo || '-'}</td><td>${p.nombre}</td><td>${p.categorias?.nombre || '-'}</td>
                <td><strong style="color:#e74c3c;">${p.stock}</strong></td><td>${p.stock_minimo || 5}</td>
                <td>${p.stock <= 3 ? '🔴 CRÍTICO' : '🟡 BAJO'}</td></tr>`).join('')
            : '<tr><td colspan="6" style="text-align:center;">✅ No hay productos con stock bajo</td></tr>';

        return `<style>${_estilosBase('#e74c3c')}.critico td{background:#fee2e2 !important;}.critico td strong{color:#b91c1c !important;}</style>
        <div class="header"><h1>⚠️ Montana Importados</h1><p>Reporte de Stock Bajo</p></div>
        <div style="background:#fff3cd;border:1px solid #ffc107;padding:15px;border-radius:8px;margin-bottom:25px;text-align:center;">
            <div style="font-size:32px;font-weight:bold;color:#856404;">${productos.length}</div>
            <p>Productos con stock crítico o bajo</p>
        </div>
        <table><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock Actual</th><th>Stock Mínimo</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table>
        <div class="footer"><p>Generado el ${fecha} — Se recomienda realizar un pedido de reposición.</p></div>`;
    }

    async function cargarMorosos() {
        if (!supabase) return;
        try {
            const { data: deudores, error } = await supabase
                .from('clientes')
                .select('*, ventas!ventas_cliente_id_fkey (fecha, total)')
                .gt('deuda_total', 0).eq('activo', true)
                .order('deuda_total', { ascending: false });
            if (error) throw error;

            const countEl = document.getElementById('morososCount');
            if (countEl) countEl.textContent = deudores?.length ? `${deudores.length} clientes` : '';

            const tbody = document.querySelector('#morososTable tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!deudores || deudores.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">✅ No hay clientes con deuda pendiente</td></tr>';
                return;
            }

            const hoy = new Date();
            deudores.forEach(d => {
                const ultimaVenta = d.ventas?.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
                const diasSinPagar = ultimaVenta
                    ? Math.floor((hoy - new Date(ultimaVenta.fecha)) / (1000 * 60 * 60 * 24))
                    : '—';
                const alerta = typeof diasSinPagar === 'number' && diasSinPagar > 30 ? 'status-inactive' : 'status-warning';
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${d.nombre}</strong></td>
                    <td>${d.telefono || '-'}</td>
                    <td><span class="status-badge status-warning" style="font-weight:700;">${formatearMoneda(d.deuda_total)}</span></td>
                    <td><span class="status-badge ${alerta}">${typeof diasSinPagar === 'number' ? diasSinPagar + ' días' : '—'}</span></td>
                    <td>${ultimaVenta ? formatearFechaCorta(ultimaVenta.fecha) : 'N/A'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-pay" title="Registrar pago" onclick="Clientes.mostrarModalPago(${d.id},'${d.nombre.replace(/'/g, "\\'")}',${d.deuda_total})">
                                <i class="fas fa-dollar-sign"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (err) { console.error('Error al cargar morosos:', err); }
    }

    async function exportarMorosos() {
        if (!supabase) return;
        try {
            mostrarNotificacion('Generando reporte de morosos...', 'info');
            const { data: deudores, error } = await supabase
                .from('clientes')
                .select('*, ventas!ventas_cliente_id_fkey (fecha, total)')
                .gt('deuda_total', 0).eq('activo', true)
                .order('deuda_total', { ascending: false });
            if (error) throw error;
            const html = _htmlReporteMorosos(deudores || []);
            mostrarVistaPrevia(html, `reporte_morosos_${new Date().toISOString().split('T')[0]}`);
        } catch { mostrarNotificacion('Error al generar reporte de morosos', 'error'); }
    }

    function _htmlReporteMorosos(deudores) {
        const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        const totalDeuda = deudores.reduce((s, d) => s + parseFloat(d.deuda_total || 0), 0);
        const hoy = new Date();

        const filas = deudores.length > 0
            ? deudores.map(d => {
                const ultimaVenta = d.ventas?.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
                const dias = ultimaVenta ? Math.floor((hoy - new Date(ultimaVenta.fecha)) / (1000 * 60 * 60 * 24)) : null;
                const critico = dias !== null && dias > 30;
                return `<tr class="${critico ? 'critico' : ''}">
                    <td><strong>${d.nombre}</strong></td>
                    <td>${d.telefono || '-'}</td>
                    <td>${d.email || '-'}</td>
                    <td style="font-weight:700;color:#b45309;">${formatearMoneda(d.deuda_total)}</td>
                    <td>${dias !== null ? dias + ' días' : '—'}</td>
                    <td>${ultimaVenta ? formatearFechaCorta(ultimaVenta.fecha) : 'N/A'}</td>
                    <td>${critico ? '🔴 VENCIDA' : '🟡 PENDIENTE'}</td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="7" style="text-align:center;">No hay clientes con deuda</td></tr>';

        return `<style>${_estilosBase('#b45309')}
        .critico td{background:#fff3cd !important;}
        .resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;margin-bottom:25px;}
        .tarjeta{background:#fff3cd;padding:15px;border-radius:10px;text-align:center;border:1px solid #f59e0b;}
        .tarjeta h4{font-size:12px;color:#92400e;margin-bottom:6px;text-transform:uppercase;}
        .tarjeta .monto{font-size:22px;font-weight:bold;color:#b45309;}</style>
        <div class="header"><h1>⚠️ Montana Importados</h1><p>Reporte de Clientes Morosos — ${fecha}</p></div>
        <div class="resumen">
            <div class="tarjeta"><h4>Total Adeudado</h4><div class="monto">${formatearMoneda(totalDeuda)}</div></div>
            <div class="tarjeta"><h4>Clientes con Deuda</h4><div class="monto">${deudores.length}</div></div>
            <div class="tarjeta"><h4>Vencidas (+30 días)</h4><div class="monto">${deudores.filter(d => { const uv = d.ventas?.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0]; return uv && Math.floor((hoy-new Date(uv.fecha))/(86400000)) > 30; }).length}</div></div>
        </div>
        <table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Email</th><th>Deuda</th><th>Días sin pagar</th><th>Última Venta</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table>
        <div class="footer"><p>Generado el ${fecha} — Montana Importados</p></div>`;
    }

    async function expandirGrafica(tipo) {
        const titulos = { ventas: 'Ventas', categorias: 'Ventas por Categoría', topProductos: 'Productos Más Vendidos', margen: 'Mayor Margen de Ganancia' };
        const iconos  = { ventas: 'fa-chart-line', categorias: 'fa-chart-pie', topProductos: 'fa-trophy', margen: 'fa-chart-bar' };

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'chartExpandModal';
        modal.style.cssText = 'z-index:10500;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:95vw;width:1100px;max-height:92vh;display:flex;flex-direction:column;">
                <div class="modal-header">
                    <h3><i class="fas ${iconos[tipo]}" style="color:var(--primary-light);margin-right:8px;"></i>${titulos[tipo]}</h3>
                    <button onclick="this.closest('.modal').remove()" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'"><i class="fas fa-times"></i></button>
                </div>
                <div style="flex:1;padding:24px;min-height:0;display:flex;flex-direction:column;gap:12px;">
                    ${tipo === 'ventas' ? `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="chart-period-btn-modal active" data-period="weekly">Semanal</button>
                        <button class="chart-period-btn-modal" data-period="monthly">Mensual</button>
                        <button class="chart-period-btn-modal" data-period="yearly">Anual</button>
                    </div>` : (tipo === 'topProductos' || tipo === 'margen') ? `
                    <div style="display:flex;align-items:center;gap:8px;">
                        <label style="font-size:12px;color:var(--text-muted);font-weight:500;">Top</label>
                        <select id="topLimitModal" style="padding:4px 8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;cursor:pointer;">
                            <option value="5">5</option><option value="10">10</option><option value="15">15</option>
                        </select>
                    </div>` : ''}
                    <div style="flex:1;min-height:420px;position:relative;">
                        <canvas id="chartModalCanvas"></canvas>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        let instanciaModal = null;

        const renderModal = async (periodo = 'weekly', limite = 5) => {
            if (instanciaModal) instanciaModal.destroy();
            const canvas = document.getElementById('chartModalCanvas');
            if (!canvas) return;

            if (tipo === 'ventas') {
                let labels = [], dataMap = {}, desde, hasta;
                const ahoraStr = ahora();
                const hoyLocal = ahoraStr.substring(0, 10);
                const [hoyY, hoyM, hoyD] = hoyLocal.split('-').map(Number);
                const pad = n => String(n).padStart(2, '0');
                const sumarDias = (yyyy, mm, dd, dias) => { const d = new Date(yyyy, mm - 1, dd + dias); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };
                const toKey = (yyyy, mm, dd) => `${yyyy}-${pad(mm)}-${pad(dd)}`;

                if (periodo === 'weekly') {
                    const nombDias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                    const dias = [];
                    for (let i = 6; i >= 0; i--) {
                        const [y, m, d] = sumarDias(hoyY, hoyM, hoyD, -i);
                        const key = toKey(y, m, d);
                        dias.push(key);
                        labels.push(nombDias[new Date(y, m - 1, d).getDay()]);
                        dataMap[key] = 0;
                    }
                    desde = dias[0]; hasta = dias[dias.length - 1] + 'T23:59:59';
                    const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                    data?.forEach(s => { const k = s.fecha.split('T')[0]; if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });
                } else if (periodo === 'monthly') {
                    const nombMeses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    const meses = [];
                    for (let i = 11; i >= 0; i--) { const d = new Date(hoyY, hoyM - 1 - i, 1); const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}`; meses.push(key); labels.push(nombMeses[d.getMonth()]); dataMap[key] = 0; }
                    desde = meses[0] + '-01'; hasta = hoyLocal + 'T23:59:59';
                    const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                    data?.forEach(s => { const k = s.fecha.substring(0,7); if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });
                } else {
                    const anios = [];
                    for (let i = 4; i >= 0; i--) { const y = String(hoyY - i); anios.push(y); labels.push(y); dataMap[y] = 0; }
                    desde = anios[0] + '-01-01'; hasta = anios[anios.length-1] + '-12-31T23:59:59';
                    const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                    data?.forEach(s => { const k = s.fecha.substring(0,4); if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });
                }
                instanciaModal = new Chart(canvas, {
                    type: 'line',
                    data: { labels, datasets: [{ label: 'Ventas (ARS)', data: Object.values(dataMap), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.12)', tension: 0.4, fill: true, pointBackgroundColor: '#8b5cf6', pointRadius: 5, pointHoverRadius: 9 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
                        plugins: { legend: { labels: { color: '#a0a0c0', font: { size: 13 } } }, tooltip: { callbacks: { label: ctx => `$${ctx.raw.toFixed(2)}` } } },
                        scales: { x: { ticks: { color: '#6b6b88', font: { size: 13 } }, grid: { color: 'rgba(139,92,246,0.07)' } }, y: { ticks: { color: '#6b6b88', font: { size: 13 }, callback: v => `$${v}` }, grid: { color: 'rgba(139,92,246,0.07)' }, beginAtZero: true } }
                    }
                });
            } else if (tipo === 'categorias') {
                const { data } = await supabase.from('venta_detalles').select('cantidad, productos!inner(nombre, categorias(nombre))');
                if (!data || data.length === 0) return;
                const totales = {};
                data.forEach(i => { const cat = i.productos?.categorias?.nombre || 'Sin categoría'; totales[cat] = (totales[cat] || 0) + i.cantidad; });
                const ordenado = Object.entries(totales).sort((a, b) => b[1] - a[1]);
                const palette = ['#8b5cf6','#a78bfa','#6d28d9','#c4b5fd','#7c3aed','#ddd6fe','#4c1d95','#ede9fe'];
                instanciaModal = new Chart(canvas, {
                    type: 'doughnut',
                    data: { labels: ordenado.map(e => e[0]), datasets: [{ data: ordenado.map(e => e[1]), backgroundColor: palette.slice(0, ordenado.length), borderColor: '#16161f', borderWidth: 3, hoverOffset: 12 }] },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '55%', animation: { duration: 600 },
                        plugins: { legend: { position: 'bottom', labels: { color: '#a0a0c0', padding: 18, font: { size: 14 }, boxWidth: 16 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} uds (${((ctx.raw / ordenado.reduce((a,b)=>a+b[1],0))*100).toFixed(1)}%)` } } }
                    }
                });
            } else if (tipo === 'topProductos') {
                const { data } = await supabase.from('venta_detalles').select('cantidad, productos!inner(nombre)');
                if (!data || data.length === 0) return;
                const totales = {};
                data.forEach(i => { const n = i.productos?.nombre; if (n) totales[n] = (totales[n] || 0) + i.cantidad; });
                const ordenado = Object.entries(totales).sort((a, b) => b[1] - a[1]).slice(0, limite);
                const bgColors = ordenado.map((_, i) => `rgba(139,92,246,${1 - (i / ordenado.length) * 0.55})`);
                instanciaModal = new Chart(canvas, {
                    type: 'bar',
                    data: { labels: ordenado.map(e => e[0]), datasets: [{ label: 'Unidades vendidas', data: ordenado.map(e => e[1]), backgroundColor: bgColors, borderColor: 'rgba(139,92,246,0.9)', borderWidth: 1, borderRadius: 6, borderSkipped: false }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} unidades` } } },
                        scales: { x: { beginAtZero: true, ticks: { color: '#6b6b88', font: { size: 13 }, precision: 0 }, grid: { color: 'rgba(139,92,246,0.07)' } }, y: { ticks: { color: '#d0d0e8', font: { size: 13, weight: '500' } }, grid: { display: false } } }
                    }
                });
            } else if (tipo === 'margen') {
                const { data } = await supabase.from('productos').select('nombre, precio, costo').eq('activo', true).not('costo', 'is', null).gt('costo', 0);
                if (!data || data.length === 0) return;
                const conMargen = data
                    .map(p => ({ nombre: p.nombre, margen: ((p.precio - p.costo) / p.costo) * 100 }))
                    .filter(p => p.margen > 0)
                    .sort((a, b) => b.margen - a.margen)
                    .slice(0, limite);
                if (conMargen.length === 0) return;
                const palette = conMargen.map((_, i) => `rgba(16,185,129,${1 - (i / conMargen.length) * 0.55})`);
                instanciaModal = new Chart(canvas, {
                    type: 'bar',
                    data: { labels: conMargen.map(p => p.nombre), datasets: [{ label: 'Margen (%)', data: conMargen.map(p => parseFloat(p.margen.toFixed(1))), backgroundColor: palette, borderColor: 'rgba(16,185,129,0.9)', borderWidth: 1, borderRadius: 6, borderSkipped: false }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% de margen` } } },
                        scales: { x: { beginAtZero: true, ticks: { color: '#6b6b88', font: { size: 13 }, precision: 0, callback: v => `${v}%` }, grid: { color: 'rgba(16,185,129,0.07)' } }, y: { ticks: { color: '#d0d0e8', font: { size: 13, weight: '500' } }, grid: { display: false } } }
                    }
                });
            }
        };

        await renderModal(periodoActual, parseInt(document.getElementById('topProductsLimit')?.value || '5'));

        // Vincular controles del modal
        modal.querySelectorAll('.chart-period-btn-modal').forEach(btn => {
            btn.addEventListener('click', async () => {
                modal.querySelectorAll('.chart-period-btn-modal').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await renderModal(btn.dataset.period);
            });
        });
        document.getElementById('topLimitModal')?.addEventListener('change', async (e) => {
            await renderModal('weekly', parseInt(e.target.value));
        });
    }

    return { cargar, renderizarGraficaVentas, renderizarMargenGanancia, exportarVentas, exportarStockBajo, exportarMorosos, cargarMorosos, expandirGrafica };
})();

window.Reportes = Reportes;