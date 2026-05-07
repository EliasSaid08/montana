const Reportes = (() => {
    const { supabase, mostrarNotificacion, formatearMoneda, formatearFecha, formatearFechaCorta, ahora } = window.appConfig;

    let graficaVentas     = null;
    let graficaCategorias = null;
    let graficaTopBarras  = null;
    let periodoActual     = 'weekly';

    async function cargar() {
        if (!supabase) return;
        _configurarBotonesExportacion();
        _configurarSelectorPeriodo();
        await renderizarGraficaVentas();
        await renderizarGraficaCategorias();
        await renderizarTopProductos();

        const selector = document.getElementById('topProductsLimit');
        if (selector && !selector.dataset.bound) {
            selector.dataset.bound = '1';
            selector.onchange = () => renderizarTopProductos();
        }
    }

    function _configurarBotonesExportacion() {
        const seccion = document.getElementById('reportsSection');
        if (!seccion || document.getElementById('exportButtonsContainer')) return;

        const div = document.createElement('div');
        div.id = 'exportButtonsContainer';
        div.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
        div.innerHTML = `
            <button id="exportSalesBtn" class="btn-primary">
                <i class="fas fa-chart-line"></i> Exportar Ventas
            </button>
            <button id="exportLowStockBtn" class="btn-primary" style="background:linear-gradient(135deg,#9f1239,#f43f5e);">
                <i class="fas fa-boxes"></i> Stock Bajo
            </button>
        `;
        seccion.querySelector('.section-header').appendChild(div);
        document.getElementById('exportSalesBtn').onclick    = exportarVentas;
        document.getElementById('exportLowStockBtn').onclick = exportarStockBajo;
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
            const now = new Date();

            if (periodoActual === 'weekly') {
                const dias = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now); d.setDate(now.getDate() - i);
                    dias.push(d.toISOString().split('T')[0]);
                }
                desde = dias[0]; hasta = dias[dias.length - 1] + 'T23:59:59';
                const nombDias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                dias.forEach(d => { labels.push(nombDias[new Date(d).getDay()]); dataMap[d] = 0; });
                const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                data?.forEach(s => { const k = s.fecha.split('T')[0]; if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });

            } else if (periodoActual === 'monthly') {
                const meses = [], nombMeses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    meses.push(key); labels.push(nombMeses[d.getMonth()]); dataMap[key] = 0;
                }
                desde = meses[0] + '-01'; hasta = now.toISOString().split('T')[0] + 'T23:59:59';
                const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                data?.forEach(s => { const k = s.fecha.substring(0, 7); if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });

            } else if (periodoActual === 'yearly') {
                const anios = [];
                for (let i = 4; i >= 0; i--) { const y = String(now.getFullYear() - i); anios.push(y); labels.push(y); dataMap[y] = 0; }
                desde = anios[0] + '-01-01'; hasta = anios[anios.length - 1] + '-12-31T23:59:59';
                const { data } = await supabase.from('ventas').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'completada');
                data?.forEach(s => { const k = s.fecha.substring(0, 4); if (dataMap[k] !== undefined) dataMap[k] += parseFloat(s.total); });
            }

            if (graficaVentas) graficaVentas.destroy();
            graficaVentas = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets: [{ label: 'Ventas (USD)', data: Object.values(dataMap), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.12)', tension: 0.4, fill: true, pointBackgroundColor: '#8b5cf6', pointRadius: 4, pointHoverRadius: 7 }] },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
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
                options: { responsive: true, maintainAspectRatio: true, cutout: '55%', animation: { duration: 600 },
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
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
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

    function mostrarVistaPrevia(html, nombreArchivo) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'z-index:10000;background:rgba(0,0,0,0.8);';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:90%;width:900px;max-height:90vh;display:flex;flex-direction:column;">
                <div class="modal-header" style="flex-shrink:0;">
                    <h3><i class="fas fa-print"></i> Vista Previa del Reporte</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
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
                    <h3><i class="fas fa-calendar-alt"></i> Seleccionar Período</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
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

    return { cargar, renderizarGraficaVentas };
})();

window.Reportes = Reportes;