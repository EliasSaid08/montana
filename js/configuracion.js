const SUPABASE_URL = 'https://ylijiiexxgvlqkmcfill.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaWppaWV4eGd2bHFrbWNmaWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NTk4NDQsImV4cCI6MjA4NTAzNTg0NH0.9-L81hasC9-N1f7hXNJ15ZnVwbfRWDwfmx3qHGdEqM0';

const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'ZI7DKnZbi_eAngHwA',
    SERVICE_ID: 'service_jd6le2g',
    TEMPLATE_ID: 'template_q5pky5m'
};

let supabaseClient;
try {
    if (typeof window !== 'undefined' && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error('Biblioteca de Supabase no cargada');
        supabaseClient = null;
    }
} catch (error) {
    console.error('Error inicializando Supabase:', error);
    supabaseClient = null;
}

let emailJSInitializado = false;
const inicializarEmailJS = () => {
    return new Promise((resolve) => {
        const intentar = (intentos = 0) => {
            if (window.emailjs && !emailJSInitializado) {
                try {
                    window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
                    emailJSInitializado = true;
                    resolve(true);
                } catch (error) {
                    resolve(false);
                }
            } else if (emailJSInitializado) {
                resolve(true);
            } else if (intentos < 20) {
                setTimeout(() => intentar(intentos + 1), 200);
            } else {
                resolve(false);
            }
        };
        intentar();
    });
};

const formatearMoneda = (monto) => {
    if (!monto && monto !== 0) return '$0.00';
    const num = parseFloat(monto);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
};

const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'Fecha no disponible';
    try {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-ES', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return 'Fecha inválida';
    }
};

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return 'Fecha no disponible';
    try {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-ES', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    } catch {
        return 'Fecha inválida';
    }
};

const ahora = () => {
    const now = new Date();
    const str = now.toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
    return str.replace(' ', 'T') + '-03:00';
};

const debounce = (func, espera) => {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), espera);
    };
};

const mostrarNotificacion = (mensaje, tipo = 'info') => {
    const notif = document.createElement('div');
    notif.className = `notification-toast notification-${tipo}`;
    notif.textContent = mensaje;

    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification-toast {
                position: fixed; top: 20px; right: 20px;
                padding: 12px 20px; border-radius: 8px; color: white;
                z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                min-width: 200px; max-width: 300px;
                animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
            }
            .notification-info { background: #3498db; }
            .notification-success { background: #27ae60; }
            .notification-warning { background: #f39c12; }
            .notification-error { background: #e74c3c; }
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes fadeOut { to { opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notif);
    setTimeout(() => { if (notif.parentNode) notif.remove(); }, 3000);
};

window.appConfig = {
    supabase: supabaseClient,
    emailjs: EMAILJS_CONFIG,
    inicializarEmailJS,
    mostrarNotificacion,
    formatearMoneda,
    formatearFecha,
    formatearFechaCorta,
    ahora,
    debounce
};