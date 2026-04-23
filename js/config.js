// Configuration file for Supabase connection
const SUPABASE_URL = 'https://ylijiiexxgvlqkmcfill.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaWppaWV4eGd2bHFrbWNmaWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NTk4NDQsImV4cCI6MjA4NTAzNTg0NH0.9-L81hasC9-N1f7hXNJ15ZnVwbfRWDwfmx3qHGdEqM0';

// EmailJS Configuration - REGISTRATE EN https://www.emailjs.com/
// PASOS PARA CONFIGURAR EMAILJS:
// 1. Crea una cuenta gratis en https://www.emailjs.com/
// 2. Ve a "Email Services" y crea un nuevo servicio (Gmail, Outlook, etc.)
// 3. Ve a "Email Templates" y crea una plantilla con las variables: {{to_email}}, {{to_name}}, {{reset_link}}
// 4. Ve a "Integration" y copia tu Public Key (User ID)
// 5. Reemplaza los valores de abajo con los tuyos
const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'ZI7DKnZbi_eAngHwA',  // Reemplazar con tu Public Key
    SERVICE_ID: 'service_jd6le2g',           // Reemplazar con tu Service ID
    TEMPLATE_ID: 'template_q5pky5m'          // Reemplazar con tu Template ID
};

// Initialize Supabase client
let supabaseClient;
try {
    if (typeof window !== 'undefined' && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase inicializado correctamente');
    } else {
        console.error('❌ Biblioteca de Supabase no cargada');
        supabaseClient = null;
    }
} catch (error) {
    console.error('❌ Error inicializando Supabase:', error);
    supabaseClient = null;
}

// Initialize EmailJS - with retry in case script hasn't loaded yet
let emailJSInitialized = false;
const initEmailJS = () => {
    return new Promise((resolve) => {
        const tryInit = (attempts = 0) => {
            if (window.emailjs && !emailJSInitialized) {
                try {
                    window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
                    emailJSInitialized = true;
                    console.log('✅ EmailJS inicializado correctamente');
                    resolve(true);
                } catch (error) {
                    console.error('❌ Error inicializando EmailJS:', error);
                    resolve(false);
                }
            } else if (emailJSInitialized) {
                resolve(true);
            } else if (attempts < 20) {
                // Retry every 200ms up to 4 seconds
                setTimeout(() => tryInit(attempts + 1), 200);
            } else {
                console.warn('⚠️ EmailJS no pudo cargarse tras varios intentos');
                resolve(false);
            }
        };
        tryInit();
    });
};

// Utility functions
const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
};

const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Fecha inválida';
    }
};

const formatDateShort = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return 'Fecha inválida';
    }
};

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Simple notification
const showNotification = (message, type = 'info') => {
    // Create a simple toast notification
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.textContent = message;
    
    // Add styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                z-index: 9999;
                animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                min-width: 200px;
                max-width: 300px;
            }
            .notification-info { background: #3498db; }
            .notification-success { background: #27ae60; }
            .notification-warning { background: #f39c12; }
            .notification-error { background: #e74c3c; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
};

// Export configuration
window.appConfig = {
    supabase: supabaseClient,
    emailjs: EMAILJS_CONFIG,
    initEmailJS: initEmailJS,
    showNotification,
    formatCurrency,
    formatDate,
    formatDateShort,
    debounce
};