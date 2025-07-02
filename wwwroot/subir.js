// subir.js

window.uploadFile = async function () {
    const input = document.getElementById('input');
    const file = input.files[0];
    if (!file) {
        showMessage('⚠️ Por favor selecciona un archivo.', 'warning');
        return;
    }

    // Verificar si está logueado
    try {
        const loginStatus = await fetch('/api/auth/status');
        const status = await loginStatus.json();
        if (!status.isLoggedIn) {
            showMessage('⚠️ Debes iniciar sesión primero.', 'warning');
            return;
        }
    } catch (err) {
        showMessage('❌ No se pudo verificar el estado de login.', 'error');
        console.error('Error al comprobar login:', err);
        return;
    }

    const upload = document.querySelector('button[onclick="uploadFile()"]');
    upload.disabled = true;
    showMessage(`🔄 Subiendo modelo <em>${file.name}</em>. No recargues la página.`);

    try {
        const objectKey = file.name;

        const data = new FormData();
        const renamedFile = new File([file], objectKey);
        data.append('model-file', renamedFile);

        if (file.name.endsWith('.zip')) {
            const entrypoint = window.prompt('Por favor indica el archivo principal dentro del ZIP.');
            data.append('model-zip-entrypoint', entrypoint);
        }

        const resp = await fetch('/api/models', {
            method: 'POST',
            body: data
        });
        if (!resp.ok) throw new Error(await resp.text());

        const model = await resp.json();
        window.location.hash = model.urn;

        const event = new CustomEvent('model-uploaded', { detail: model.urn });
        document.dispatchEvent(event);

    } catch (err) {
        showMessage('❌ No se pudo subir el modelo. Consulta la consola.', 'error');
        console.error(err);
    } finally {
        clearNotification();
        upload.disabled = false;
        input.value = '';
    }
};


function showMessage(message, type = 'info', duration = 5000) {
    const overlay = document.getElementById('overlay');
    const typeClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';

    overlay.innerHTML = `
        <div class="notification">
            <div class="alert ${typeClass}" role="alert">
                <button id="closeOverlay" type="button" class="btn-close" aria-label="Cerrar" 
                        style="position: absolute; top: 10px; right: 15px; border: none; background: none; font-size: 1.5em; cursor: pointer;">×</button>
                <div id="notificationContent" style="padding-right: 30px;">${message}</div>
            </div>
        </div>
    `;
    overlay.style.display = 'flex';
    
    document.getElementById('closeOverlay').addEventListener('click', clearNotification);
    
    // Auto-cerrar después del tiempo especificado (excepto para errores)
    if (duration > 0 && type !== 'error') {
        setTimeout(clearNotification, duration);
    }
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.innerHTML = '';
        overlay.style.display = 'none';
    }
}

window.uploadFile = uploadFile;
