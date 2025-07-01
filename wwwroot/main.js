// main.js - Estilo Bucket Tools mejorado CON DEBUGGING Y SISTEMA DE NOTIFICACIONES
import { initViewer, loadModel } from './viewer.js';

let viewerInstance = null;
let isLoggedIn = false;
let selectedUrn = null;

// Verificar estado de login al cargar la página
checkLoginStatus();

// Configurar formulario de login
document.getElementById('login-form').addEventListener('submit', handleLogin);

async function checkLoginStatus() {
    try {
        const resp = await fetch('/api/auth/status');
        const status = await resp.json();

        if (status.isLoggedIn) {
            isLoggedIn = true;
            showLoggedInState(status.clientId);
            initializeApp();
        } else {
            showLoginForm();
        }
    } catch (err) {
        console.error('Error checking login status:', err);
        showLoginForm();
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const clientId = document.getElementById('client_id').value;
    const clientSecret = document.getElementById('client_secret').value;
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
        const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
        });

        const result = await resp.json();

        if (resp.ok) {
            isLoggedIn = true;
            showLoggedInState(clientId);
            initializeApp();
            showMessage('✅ Login exitoso', 'success');
        } else {
            showMessage(`❌ Error de login: ${result.error || 'Login failed'}`, 'error');
        }

    } catch (err) {
        showMessage('❌ Error de conexión. Verifica tus credenciales.', 'error');
        console.error('Login error:', err);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

function showLoginForm() {
    const form = document.getElementById('login-form');
    form.style.display = 'flex';
    document.getElementById('client_id').value = '';
    document.getElementById('client_secret').value = '';
}

function showLoggedInState(clientId) {
    const form = document.getElementById('login-form');
    form.innerHTML = `
        <span class="navbar-text me-2">Welcome: ${clientId}</span>
        <button class="btn btn-outline-danger" type="button" id="logoutBtn">Logout</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        isLoggedIn = false;
        location.reload();
    } catch (err) {
        console.error('Logout error:', err);
    }
}

async function initializeApp() {
    if (!isLoggedIn) {
        showMessage('⚠️ Debes iniciar sesión primero', 'warning');
        return;
    }

    initViewer(document.getElementById('preview')).then(viewer => {
        viewerInstance = viewer;
        const urn = window.location.hash?.substring(1);
        setupModelTree(viewer, urn);
    }).catch(err => {
        console.error('Error initializing viewer:', err);
        showMessage('❌ Error inicializando el visor. Verifica tus credenciales.', 'error');
    });
}

// Construye el árbol de modelos estilo Bucket Tools
async function setupModelTree(viewer, selectedUrn) {
    const tree = document.getElementById('tree-models');
    tree.innerHTML = '<div class="loading">Cargando modelos...</div>';

    // Cerrar cualquier menú contextual abierto
    closeContextMenu();

    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            if (resp.status === 401) {
                showMessage('⚠️ Sesión expirada. Inicia sesión nuevamente.', 'warning');
                location.reload();
                return;
            }
            throw new Error(await resp.text());
        }

        const models = await resp.json();
        tree.innerHTML = '';

        // Asegurarse que todos los modelos tengan bucketName
        for (const model of models) {
            if (!model.bucketName) {
                model.bucketName = `cuaternion-bucket-${randomString(5)}`;
            }
        }

        const folders = groupModelsByFolder(models);

        // Crear estructura de carpetas
        for (const folder of folders) {
            createFolderElement(tree, folder, selectedUrn);
        }

        if (folders.length === 0) {
            tree.innerHTML = '<div class="loading">No hay modelos disponibles</div>';
        }

    } catch (err) {
        tree.innerHTML = '<div class="loading">Error cargando modelos</div>';
        showMessage('❌ No se pudieron cargar los modelos. Revisa la consola para más detalles.', 'error');
        console.error(err);
    }

    // Configuración de upload
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    upload.onclick = () => input.click();
    input.onchange = () => window.uploadFile();
}

// Crear elemento de carpeta estilo Bucket Tools
function createFolderElement(container, folder, selectedUrn) {
    // Contenedor de la carpeta
    const folderContainer = document.createElement('div');
    
    // Header de la carpeta
    const folderHeader = document.createElement('div');
    folderHeader.className = 'tree-item folder';
    
    // Flecha de expandir/colapsar
    const expandArrow = document.createElement('div');
    expandArrow.className = 'expand-arrow expanded';
    
    // Icono de carpeta
    const folderIcon = document.createElement('div');
    folderIcon.className = 'tree-icon folder expanded';
    
    // Nombre de carpeta
    const folderName = document.createElement('span');
    folderName.textContent = folder.folder;
    
    folderHeader.appendChild(expandArrow);
    folderHeader.appendChild(folderIcon);
    folderHeader.appendChild(folderName);
    
    // Contenedor de archivos
    const filesContainer = document.createElement('div');
    filesContainer.className = 'folder-children';
    
    // Click en carpeta para expandir/colapsar
    folderHeader.addEventListener('click', () => {
        const isExpanded = !filesContainer.classList.contains('collapsed');
        
        if (isExpanded) {
            filesContainer.classList.add('collapsed');
            expandArrow.classList.remove('expanded');
            folderIcon.classList.remove('expanded');
        } else {
            filesContainer.classList.remove('collapsed');
            expandArrow.classList.add('expanded');
            folderIcon.classList.add('expanded');
        }
    });
    
    // Crear elementos de archivo
    for (const file of folder.files) {
        const fileElement = createFileElement(file, selectedUrn);
        filesContainer.appendChild(fileElement);
    }
    
    folderContainer.appendChild(folderHeader);
    folderContainer.appendChild(filesContainer);
    container.appendChild(folderContainer);
}

// Crear elemento de archivo - CON DEBUGGING MEJORADO
function createFileElement(file, selectedUrn) {
    console.log('🔧 Creating file element for:', file.name, 'URN:', file.urn);
    
    const fileElement = document.createElement('div');
    fileElement.className = 'tree-item file';
    
    if (file.urn === selectedUrn) {
        fileElement.classList.add('selected');
        selectedUrn = file.urn;
    }
    
    // Icono de archivo
    const fileIcon = document.createElement('div');
    fileIcon.className = 'tree-icon file';
    
    // Nombre de archivo
    const fileName = document.createElement('span');
    fileName.textContent = file.name;
    
    fileElement.appendChild(fileIcon);
    fileElement.appendChild(fileName);
    
    // Click para seleccionar y cargar modelo
    fileElement.addEventListener('click', (e) => {
        console.log('🖱️ File clicked:', file.name);
        e.stopPropagation();
        selectFile(fileElement, file.urn);
        onModelSelected(viewerInstance, file.urn);
    });
    
    // Click derecho para menú contextual - CON DEBUGGING
    fileElement.addEventListener('contextmenu', (e) => {
        console.log('🖱️ Right click detected on:', file.name, 'URN:', file.urn);
        e.preventDefault();
        e.stopPropagation();
        selectFile(fileElement, file.urn);
        showContextMenu(e.pageX, e.pageY, file.urn);
    });
    
    return fileElement;
}

// Seleccionar archivo visualmente
function selectFile(element, urn) {
    console.log('✅ Selecting file with URN:', urn);
    // Quitar selección previa
    const previousSelected = document.querySelector('.tree-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }
    
    // Seleccionar nuevo elemento
    element.classList.add('selected');
    selectedUrn = urn;
}

// Agrupar modelos por carpeta/bucket
function groupModelsByFolder(models) {
    const map = new Map();

    for (const model of models) {
        let folder = model.bucketName || 'Modelos';
        const filename = model.name.split('/').pop();

        if (!map.has(folder)) map.set(folder, []);
        map.get(folder).push({ name: filename, urn: model.urn });
    }

    return [...map.entries()].map(([folder, files]) => ({ folder, files }));
}

// Cuando se selecciona un modelo para cargar
async function onModelSelected(viewer, urn) {
    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    window.location.hash = urn;
    try {
        const resp = await fetch(`/api/models/${urn}/status`);
        if (!resp.ok) {
            if (resp.status === 401) {
                showMessage('⚠️ Sesión expirada. Inicia sesión nuevamente.', 'warning');
                location.reload();
                return;
            }
            throw new Error(await resp.text());
        }
        const status = await resp.json();

        switch (status.status) {
            case 'n/a':
                showMessage(`ℹ️ El modelo no ha sido traducido.`, 'info');
                break;
            case 'inprogress':
                showMessage(`⏳ Traduciendo modelo (${status.progress})...`, 'info');
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn);
                break;
            case 'failed':
                showMessage(`❌ Error en la traducción. Detalles: ${status.messages.map(msg => JSON.stringify(msg)).join(', ')}`, 'error');
                break;
            default:
                clearNotification();
                loadModel(viewer, urn);
                break;
        }
    } catch (err) {
        showMessage('❌ No se pudo cargar el modelo. Revisa la consola para más detalles.', 'error');
        console.error(err);
    }
}

// Mostrar menú contextual - CON DEBUGGING MEJORADO
function showContextMenu(x, y, urn) {
    console.log('📋 Showing context menu at:', x, y, 'for URN:', urn);
    
    closeContextMenu();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.position = 'fixed';
    menu.style.zIndex = '9999';
    
    // Opción eliminar
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item danger';
    deleteItem.textContent = 'Eliminar';
    
    // EVENTO DE CLICK CON DEBUGGING
    deleteItem.addEventListener('click', (e) => {
        console.log('🗑️ Delete button clicked! URN:', urn);
        e.preventDefault();
        e.stopPropagation();
        deleteModel(urn);
    });
    
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    console.log('📋 Context menu added to DOM:', menu);
    
    // Cerrar al hacer click fuera - CON DELAY
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
    }, 100);
}

// Cerrar menú contextual
function closeContextMenu() {
    console.log('❌ Closing context menu');
    const menu = document.querySelector('.context-menu');
    if (menu) {
        menu.remove();
        document.removeEventListener('click', closeContextMenu);
        console.log('❌ Context menu removed');
    }
}

async function deleteModel(urn) {
    console.log('🗑️ deleteModel called with URN:', urn);
   
    // Usar sistema de notificaciones en lugar de confirm
    const shouldDelete = await showConfirmDialog('¿Eliminar este modelo?', 'Esta acción no se puede deshacer.');
   
    if (!shouldDelete) {
        console.log('🗑️ Delete cancelled by user');
        closeContextMenu();
        return;
    }
   
    console.log('🗑️ User confirmed deletion, proceeding...');
    closeContextMenu();
   
    // Mostrar mensaje de carga
    showMessage('⏳ Eliminando archivo...', 'info');
   
    try {
        // Hacer la petición DELETE
        console.log('🗑️ Making DELETE request to:', `/api/models/${urn}`);
       
        const res = await fetch(`/api/models/${urn}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
       
        console.log('🗑️ DELETE response status:', res.status);
       
        if (!res.ok) {
            const errorResponse = await res.json().catch(() => null);
            const errorMessage = errorResponse?.error || `Error HTTP ${res.status}`;
            console.error('🗑️ DELETE failed:', errorMessage);
            showMessage(`❌ Error eliminando archivo: ${errorMessage}`, 'error');
            return;
        }
       
        const response = await res.json();
        console.log('🗑️ DELETE successful:', response);
       
        // Verificar que la respuesta sea exitosa
        if (response.success === false) {
            showMessage(`❌ Error eliminando archivo: ${response.error}`, 'error');
            return;
        }
       
        showMessage('✅ Archivo eliminado correctamente', 'success');
       
        // Actualizar la UI inmediatamente
        console.log('🗑️ Updating UI after successful deletion...');
        
        // Opción 1: Refrescar el árbol inmediatamente
        try {
            await setupModelTree(viewerInstance);
            console.log('🗑️ Tree refreshed successfully');
        } catch (refreshError) {
            console.error('🗑️ Error refreshing tree:', refreshError);
            // Si falla el refresh, intentar de nuevo después de un delay
            setTimeout(async () => {
                try {
                    await setupModelTree(viewerInstance);
                    console.log('🗑️ Tree refreshed on retry');
                } catch (retryError) {
                    console.error('🗑️ Error refreshing tree on retry:', retryError);
                    showMessage('⚠️ Archivo eliminado, pero la lista no se actualizó. Recarga la página.', 'warning');
                }
            }, 1500);
        }
       
        // Opción 2: También puedes eliminar el elemento directamente del DOM si tienes una referencia
        // removeModelFromUI(urn);
       
    } catch (err) {
        console.error('🗑️ Error in deleteModel:', err);
        showMessage('❌ Error de conexión eliminando archivo. Revisa la consola.', 'error');
    }
}

// Sistema de notificaciones mejorado
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

// Diálogo de confirmación usando el sistema de notificaciones
function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('overlay');
        overlay.innerHTML = `
            <div class="notification">
                <div class="alert alert-warning" role="dialog" style="min-width: 400px;">
                    <h5 style="margin-bottom: 15px;">${title}</h5>
                    <p style="margin-bottom: 20px;">${message}</p>
                    <div class="d-flex gap-2 justify-content-end">
                        <button id="cancelBtn" type="button" class="btn btn-secondary">Cancelar</button>
                        <button id="confirmBtn" type="button" class="btn btn-danger">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            clearNotification();
            resolve(false);
        });
        
        document.getElementById('confirmBtn').addEventListener('click', () => {
            clearNotification();
            resolve(true);
        });
    });
}

// Función legacy para compatibilidad
function showNotification(message) {
    showMessage(message, 'info');
}

// Limpiar notificación
function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
}

// Generar string aleatorio
function randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Event listener para cuando se sube un modelo
document.addEventListener('model-uploaded', (e) => {
    const urn = e.detail;
    setupModelTree(viewerInstance, urn);
});