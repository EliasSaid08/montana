const Autenticacion = (() => {
    const { supabase, mostrarNotificacion, ahora } = window.appConfig;

    let tokensReset = {};

    function configurarRecuperacion() {
        const form = document.querySelector('.login-card form');
        if (!form || document.querySelector('.forgot-password-link')) return;

        const enlace = document.createElement('div');
        enlace.className = 'forgot-password-link';
        enlace.style.cssText = 'text-align:right; margin-top:-10px; margin-bottom:15px;';
        enlace.innerHTML = '<a href="#" id="btnOlvideContrasena" style="color:var(--primary);font-size:12px;text-decoration:none;">¿Olvidaste tu contraseña?</a>';
        form.insertBefore(enlace, form.querySelector('button'));

        document.getElementById('btnOlvideContrasena').addEventListener('click', (e) => {
            e.preventDefault();
            mostrarModalRecuperar();
        });
    }

    function verificarTokenURL() {
        const hash = window.location.hash;
        if (hash && hash.includes('reset?token=')) {
            const token = hash.split('token=')[1];
            if (token) mostrarModalNuevaContrasena(token);
        }
    }

    function mostrarModalRecuperar() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalRecuperar';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-key" style="color:var(--primary-light);margin-right:8px;"></i> Recuperar Contraseña</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <form id="formRecuperar">
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" id="emailReset" class="form-control" placeholder="tu@email.com" required>
                        <small style="color:var(--text-muted);">Ingresa el correo asociado a tu cuenta</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary">Enviar Instrucciones</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('formRecuperar').onsubmit = async (e) => {
            e.preventDefault();
            await enviarEmailRecuperacion();
        };
    }

    async function enviarEmailRecuperacion() {
        const email = document.getElementById('emailReset').value.trim();
        if (!email || !supabase) { mostrarNotificacion('Error de conexión', 'error'); return; }

        const btn = document.querySelector('#formRecuperar button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

        try {
            const { data: usuarios } = await supabase
                .from('usuarios').select('id, email, nombre').eq('email', email);

            if (!usuarios || usuarios.length === 0) {
                mostrarNotificacion('No se encontró una cuenta con este correo', 'error');
                return;
            }

            const usuario = usuarios[0];
            const tokenArray = new Uint8Array(20);
            window.crypto.getRandomValues(tokenArray);
            const token = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
            const expira = new Date();
            expira.setHours(expira.getHours() + 1);

            const { error: tokenError } = await supabase
                .from('password_reset_tokens')
                .insert([{ user_id: usuario.id, token, expires_at: expira.toISOString(), used: false }]);

            if (tokenError) {
                tokensReset[token] = { userId: usuario.id, email: usuario.email, expiresAt: expira.getTime() };
            }

            const baseUrl = window.location.origin;
            const enlaceReset = `${baseUrl}${window.location.pathname}#reset?token=${token}`;
            const emailListo = await window.appConfig.inicializarEmailJS();

            if (emailListo && window.emailjs) {
                try {
                    await window.emailjs.send(
                        window.appConfig.emailjs.SERVICE_ID,
                        window.appConfig.emailjs.TEMPLATE_ID,
                        { to_email: usuario.email, to_name: usuario.nombre || usuario.email, reset_link: enlaceReset, company_name: 'Montana Importados' }
                    );
                    mostrarNotificacion('Se han enviado instrucciones a tu correo', 'success');
                    document.getElementById('modalRecuperar')?.remove();
                } catch {
                    mostrarModalEnlaceManual(enlaceReset);
                }
            } else {
                mostrarModalEnlaceManual(enlaceReset);
            }
        } catch (error) {
            mostrarNotificacion('Error al procesar la solicitud', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Enviar Instrucciones'; }
        }
    }

    function mostrarModalEnlaceManual(enlace) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-link" style="color:var(--primary-light);margin-right:8px;"></i> Link de Recuperación</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div class="card-body">
                    <p>Usá el siguiente enlace para recuperar tu contraseña:</p>
                    <div style="background:var(--bg-light);padding:15px;border-radius:8px;margin:15px 0;word-break:break-all;">
                        <code>${enlace}</code>
                    </div>
                    <button class="btn-primary" onclick="navigator.clipboard.writeText('${enlace}');mostrarNotificacion('Link copiado','success')">
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

    async function obtenerDatosToken(token) {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('password_reset_tokens')
                    .select('user_id, expires_at, used')
                    .eq('token', token).single();
                if (!error && data && !data.used && new Date(data.expires_at).getTime() > Date.now()) {
                    return { userId: data.user_id, desdeBD: true };
                }
            } catch { /* tabla no existe */ }
        }
        if (tokensReset[token] && tokensReset[token].expiresAt > Date.now()) {
            return { userId: tokensReset[token].userId, desdeBD: false };
        }
        return null;
    }

    async function mostrarModalNuevaContrasena(token) {
        const datos = await obtenerDatosToken(token);
        if (!datos) {
            mostrarNotificacion('El enlace ha expirado o es inválido', 'error');
            window.location.hash = '';
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalNuevaContrasena';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-lock" style="color:var(--primary-light);margin-right:8px;"></i> Restablecer Contraseña</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <form id="formNuevaContrasena">
                    <div class="form-group">
                        <label>Nueva Contraseña</label>
                        <input type="password" id="nuevaContrasenaReset" class="form-control" required minlength="6">
                        <small>Mínimo 6 caracteres</small>
                    </div>
                    <div class="form-group">
                        <label>Confirmar Contraseña</label>
                        <input type="password" id="confirmarContrasenaReset" class="form-control" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary">Actualizar Contraseña</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('formNuevaContrasena').onsubmit = async (e) => {
            e.preventDefault();
            await actualizarContrasenaConToken(token, datos);
        };
    }

    async function actualizarContrasenaConToken(token, datos) {
        const nueva = document.getElementById('nuevaContrasenaReset').value;
        const confirmar = document.getElementById('confirmarContrasenaReset').value;

        if (nueva !== confirmar) { mostrarNotificacion('Las contraseñas no coinciden', 'error'); return; }
        if (nueva.length < 6) { mostrarNotificacion('Mínimo 6 caracteres', 'error'); return; }
        if (!supabase) return;

        try {
            const { error } = await supabase.from('usuarios').update({ password: nueva }).eq('id', datos.userId);
            if (error) throw error;

            try {
                await supabase.from('password_reset_tokens').update({ used: true }).eq('token', token);
            } catch { /* ignorar */ }
            delete tokensReset[token];

            mostrarNotificacion('Contraseña actualizada correctamente', 'success');
            document.getElementById('modalNuevaContrasena')?.remove();
            window.location.hash = '';
        } catch {
            mostrarNotificacion('Error al actualizar la contraseña', 'error');
        }
    }

    async function iniciarSesion(username, password) {
        if (!supabase) { mostrarNotificacion('Error de conexión', 'error'); return null; }

        const { data, error } = await supabase
            .from('usuarios').select('*').eq('username', username).eq('activo', true);

        if (error || !data || data.length === 0) {
            mostrarNotificacion('Usuario no encontrado', 'error');
            return null;
        }

        const usuario = data[0];
        if (usuario.password !== password) {
            mostrarNotificacion('Contraseña incorrecta', 'error');
            return null;
        }
        return usuario;
    }

    return { configurarRecuperacion, verificarTokenURL, iniciarSesion };
})();