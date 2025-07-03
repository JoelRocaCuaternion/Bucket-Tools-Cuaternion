// main.js - Estilo Bucket Tools mejorado CON DEBUGGING Y SISTEMA DE NOTIFICACIONES
import { initViewer, loadModel } from './viewer.js';

let viewerInstance = null;
let isLoggedIn = false;
let selectedUrn = null;
let objetoEscalado = false;
let objetoEscaladoDbId = null;
let transformacionesOriginales = new Map();


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
        e.stopPropagation();
        selectFile(fileElement, file.urn);
        onModelSelected(viewerInstance, file.urn);
    });
    
    // Click derecho para menú contextual - CON DEBUGGING
    fileElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectFile(fileElement, file.urn);
        showContextMenu(e.pageX, e.pageY, file.urn);
    });
    
    return fileElement;
}

// Seleccionar archivo visualmente
function selectFile(element, urn) {
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
        e.preventDefault();
        e.stopPropagation();
        deleteModel(urn);
    });
    
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    // Cerrar al hacer click fuera - CON DELAY
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
    }, 100);
}

// Cerrar menú contextual
function closeContextMenu() {
    const menu = document.querySelector('.context-menu');
    if (menu) {
        menu.remove();
        document.removeEventListener('click', closeContextMenu);
    }
}

async function deleteModel(urn) {
   
    // Usar sistema de notificaciones en lugar de confirm
    const shouldDelete = await showConfirmDialog('¿Eliminar este modelo?', 'Esta acción no se puede deshacer.');
   
    if (!shouldDelete) {
        closeContextMenu();
        return;
    }
   
    closeContextMenu();
   
    // Mostrar mensaje de carga
    showMessage('⏳ Eliminando archivo...', 'info');
   
    try {
        // Hacer la petición DELETE
        const res = await fetch(`/api/models/${urn}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
       
        if (!res.ok) {
            const errorResponse = await res.json().catch(() => null);
            const errorMessage = errorResponse?.error || `Error HTTP ${res.status}`;
            console.error('🗑️ DELETE failed:', errorMessage);
            showMessage(`❌ Error eliminando archivo: ${errorMessage}`, 'error');
            return;
        }
       
        const response = await res.json();
       
        // Verificar que la respuesta sea exitosa
        if (response.success === false) {
            showMessage(`❌ Error eliminando archivo: ${response.error}`, 'error');
            return;
        }
       
        showMessage('✅ Archivo eliminado correctamente', 'success');
       
        // Actualizar la UI inmediatamente
        
        // Opción 1: Refrescar el árbol inmediatamente
        try {
            await setupModelTree(viewerInstance);

        } catch (refreshError) {
            console.error('🗑️ Error refreshing tree:', refreshError);
            // Si falla el refresh, intentar de nuevo después de un delay
            setTimeout(async () => {
                try {
                    await setupModelTree(viewerInstance);
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

// Extraer JSON - VERSIÓN OPTIMIZADA PARA PLANTAS INDUSTRIALES

async function exportarPropiedades() {
    
    // Verificar que hay un viewer activo y un modelo cargado
    if (!viewerInstance) {
        showMessage('❌ No hay un visor activo', 'error');
        return;
    }

    const model = viewerInstance.model;
    if (!model) {
        showMessage('❌ No hay un modelo cargado', 'error');
        return;
    }

    if (!selectedUrn) {
        showMessage('❌ No hay un modelo seleccionado', 'error');
        return;
    }

    showMessage('⏳ Extrayendo objetos del modelo (modo rápido)...', 'info');

    try {
        // Obtener el árbol de instancias del modelo
        const instanceTree = model.getInstanceTree();
        if (!instanceTree) {
            showMessage('❌ No se pudo acceder al árbol de instancias del modelo', 'error');
            return;
        }

        // Objeto principal que contendrá toda la información
        const modelData = {
            metadata: {
                urn: selectedUrn,
                exportDate: new Date().toISOString(),
                modelName: model.getData().name || 'Modelo sin nombre',
                totalObjects: 0,
                processedNodes: 0,
                startTime: Date.now()
            },
            objects: []
        };

        // Recopilar TODOS los dbIds de una vez (ultra rápido)
        const collectAllDbIds = (nodeId, dbIds = []) => {
            dbIds.push(nodeId);
            instanceTree.enumNodeChildren(nodeId, (childNodeId) => {
                collectAllDbIds(childNodeId, dbIds);
            });
            return dbIds;
        };

        const rootId = instanceTree.getRootId();
        const allDbIds = collectAllDbIds(rootId);

        // Configuración para procesamiento masivo
        const BATCH_SIZE = 100; // Procesar 100 objetos simultáneamente
        const processedDbIds = new Set();
        let processedCount = 0;
        let successfulObjects = 0;

        // Función optimizada para procesar múltiples objetos
        const processBatchFast = (dbIdsBatch) => {
            const promises = dbIdsBatch.map(dbId => {
                if (processedDbIds.has(dbId)) {
                    return Promise.resolve(null);
                }
                
                processedDbIds.add(dbId);
                
                return new Promise((resolve) => {
                    model.getProperties(dbId, (properties) => {
                        processedCount++;
                        
                        // Progreso cada 200 objetos
                        if (processedCount % 200 === 0) {
                            const progress = Math.round((processedCount / allDbIds.length) * 100);
                        }

                        // Solo objetos con propiedades reales
                        if (properties && properties.properties && properties.properties.length > 0) {
                            const objectName = instanceTree.getNodeName(dbId) || `Objeto_${dbId}`;
                            
                            const objectData = {
                                dbId: dbId,
                                name: objectName,
                                externalId: properties.externalId || null,
                                properties: {}
                            };

                            // Procesar propiedades de forma eficiente
                            properties.properties.forEach(prop => {
                                const category = prop.displayCategory || 'Item';
                                
                                if (!objectData.properties[category]) {
                                    objectData.properties[category] = {};
                                }
                                
                                objectData.properties[category][prop.displayName] = {
                                    value: prop.displayValue,
                                    units: prop.units || null
                                };
                            });

                            if (Object.keys(objectData.properties).length > 0) {
                                successfulObjects++;
                                resolve(objectData);
                                return;
                            }
                        }
                        
                        resolve(null);
                    }, () => {
                        processedCount++;
                        resolve(null);
                    });
                });
            });

            return Promise.all(promises);
        };

        // Procesar TODO en lotes grandes y paralelos       
        const startTime = Date.now();
        const allPromises = [];

        // Dividir en lotes grandes y procesarlos en paralelo
        for (let i = 0; i < allDbIds.length; i += BATCH_SIZE) {
            const batch = allDbIds.slice(i, i + BATCH_SIZE);
            allPromises.push(processBatchFast(batch));
        }

        // Esperar a que terminen TODOS los lotes
        const results = await Promise.all(allPromises);
        
        // Recopilar todos los resultados válidos
        results.forEach(batchResults => {
            batchResults.forEach(object => {
                if (object) {
                    modelData.objects.push(object);
                    modelData.metadata.totalObjects++;
                }
            });
        });

        const processingTime = Date.now() - startTime;
        modelData.metadata.processingTimeMs = processingTime;
        modelData.metadata.processedNodes = processedCount;
        
        if (modelData.objects.length === 0) {
            showMessage('⚠️ No se encontraron objetos con propiedades en el modelo', 'warning');
            return;
        }

        // Crear y descargar el archivo JSON de forma eficiente

        
        const jsonString = JSON.stringify(modelData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Nombre de archivo con información de rendimiento
        const modelName = modelData.metadata.modelName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `planta_industrial_${modelName}_${modelData.metadata.totalObjects}obj_${timestamp}.json`;
        
        // Descarga automática
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        URL.revokeObjectURL(url);
        
        const successRate = Math.round((modelData.metadata.totalObjects / allDbIds.length) * 100);
        showMessage(`🚀 EXPORTACIÓN COMPLETADA: ${modelData.metadata.totalObjects} objetos en ${(processingTime/1000).toFixed(1)}s (${successRate}% éxito)`, 'success');

    } catch (error) {
        console.error('❌ Error en procesamiento rápido:', error);
        showMessage('❌ Error en el procesamiento rápido. Revisa la consola.', 'error');
    }
}

window.exportarPropiedades = exportarPropiedades;

// Excel - VERSIÓN OPTIMIZADA PARA PLANTAS INDUSTRIALES

async function exportarPropiedadesExcel() {
    
    // Verificar que hay un viewer activo y un modelo cargado
    if (!viewerInstance) {
        showMessage('❌ No hay un visor activo', 'error');
        return;
    }

    const model = viewerInstance.model;
    if (!model) {
        showMessage('❌ No hay un modelo cargado', 'error');
        return;
    }

    if (!selectedUrn) {
        showMessage('❌ No hay un modelo seleccionado', 'error');
        return;
    }

    showMessage('⏳ Extrayendo objetos del modelo para Excel...', 'info');

    try {
        // Obtener el árbol de instancias del modelo
        const instanceTree = model.getInstanceTree();
        if (!instanceTree) {
            showMessage('❌ No se pudo acceder al árbol de instancias del modelo', 'error');
            return;
        }

        // Metadata del modelo
        const modelMetadata = {
            urn: selectedUrn,
            exportDate: new Date().toISOString(),
            modelName: model.getData().name || 'Modelo sin nombre',
            totalObjects: 0,
            processedNodes: 0,
            startTime: Date.now()
        };

        // Recopilar TODOS los dbIds de una vez
        const collectAllDbIds = (nodeId, dbIds = []) => {
            dbIds.push(nodeId);
            instanceTree.enumNodeChildren(nodeId, (childNodeId) => {
                collectAllDbIds(childNodeId, dbIds);
            });
            return dbIds;
        };

        const rootId = instanceTree.getRootId();
        const allDbIds = collectAllDbIds(rootId);

        // Arrays para almacenar los datos de Excel
        const excelData = [];
        const allProperties = new Set(); // Para recopilar todas las propiedades únicas

        // Configuración para procesamiento
        const BATCH_SIZE = 100;
        const processedDbIds = new Set();
        let processedCount = 0;

        // Función para procesar objetos para Excel
        const processBatchForExcel = (dbIdsBatch) => {
            const promises = dbIdsBatch.map(dbId => {
                if (processedDbIds.has(dbId)) {
                    return Promise.resolve(null);
                }
                
                processedDbIds.add(dbId);
                
                return new Promise((resolve) => {
                    model.getProperties(dbId, (properties) => {
                        processedCount++;
                        
                        if (processedCount % 200 === 0) {
                            const progress = Math.round((processedCount / allDbIds.length) * 100);
                        }

                        if (properties && properties.properties && properties.properties.length > 0) {
                            const objectName = instanceTree.getNodeName(dbId) || `Objeto_${dbId}`;
                            
                            // Crear fila para Excel
                            const rowData = {
                                'ID': dbId,
                                'Nombre': objectName,
                                'ID Externo': properties.externalId || '',
                                'Categoría Principal': ''
                            };

                            // Procesar propiedades y aplanarlas para Excel
                            let mainCategory = '';
                            properties.properties.forEach(prop => {
                                const category = prop.displayCategory || 'Item';
                                const propName = prop.displayName;
                                const propValue = prop.displayValue || '';
                                const propUnits = prop.units ? ` (${prop.units})` : '';
                                
                                // Crear columna única para cada propiedad
                                const columnName = `${category} - ${propName}${propUnits}`;
                                rowData[columnName] = propValue;
                                
                                // Guardar todas las propiedades para las columnas
                                allProperties.add(columnName);
                                
                                // Determinar categoría principal
                                if (!mainCategory && category !== 'Item') {
                                    mainCategory = category;
                                }
                            });

                            rowData['Categoría Principal'] = mainCategory || 'Sin categoría';
                            
                            if (Object.keys(rowData).length > 4) { // Más que las columnas básicas
                                modelMetadata.totalObjects++;
                                resolve(rowData);
                                return;
                            }
                        }
                        
                        resolve(null);
                    }, () => {
                        processedCount++;
                        resolve(null);
                    });
                });
            });

            return Promise.all(promises);
        };

        // Procesar todos los lotes
        const startTime = Date.now();
        const allPromises = [];

        for (let i = 0; i < allDbIds.length; i += BATCH_SIZE) {
            const batch = allDbIds.slice(i, i + BATCH_SIZE);
            allPromises.push(processBatchForExcel(batch));
        }

        const results = await Promise.all(allPromises);
        
        // Recopilar resultados
        results.forEach(batchResults => {
            batchResults.forEach(object => {
                if (object) {
                    excelData.push(object);
                }
            });
        });

        const processingTime = Date.now() - startTime;
        modelMetadata.processingTimeMs = processingTime;
        modelMetadata.processedNodes = processedCount;
        
        if (excelData.length === 0) {
            showMessage('⚠️ No se encontraron objetos con propiedades para Excel', 'warning');
            return;
        }

        // Crear el libro de Excel
        
        // Crear un nuevo libro de trabajo
        const workbook = XLSX.utils.book_new();

        // Hoja 1: Resumen/Metadata
        const summaryData = [
            ['📋 RESUMEN DE EXPORTACIÓN'],
            [''],
            ['Modelo:', modelMetadata.modelName],
            ['URN:', modelMetadata.urn],
            ['Fecha de exportación:', new Date(modelMetadata.exportDate).toLocaleString()],
            ['Total de objetos:', modelMetadata.totalObjects],
            ['Nodos procesados:', modelMetadata.processedNodes],
            ['Tiempo de procesamiento:', `${(processingTime/1000).toFixed(2)} segundos`],
            ['Velocidad:', `${Math.round(allDbIds.length / (processingTime/1000))} objetos/segundo`],
            [''],
            ['🔧 ESTADÍSTICAS'],
            ['Tasa de éxito:', `${Math.round((modelMetadata.totalObjects / allDbIds.length) * 100)}%`],
            ['Total de propiedades únicas:', allProperties.size],
            ['Objetos con propiedades:', excelData.length]
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Aplicar estilos básicos al resumen
        summarySheet['!cols'] = [
            { width: 25 },
            { width: 50 }
        ];

        XLSX.utils.book_append_sheet(workbook, summarySheet, '📋 Resumen');

        // Hoja 2: Datos principales
        if (excelData.length > 0) {
            // Ordenar las columnas: primero las básicas, luego las propiedades alfabéticamente
            const basicColumns = ['ID', 'Nombre', 'ID Externo', 'Categoría Principal'];
            const propertyColumns = Array.from(allProperties).sort();
            const orderedColumns = [...basicColumns, ...propertyColumns];

            // Crear datos ordenados
            const orderedData = excelData.map(row => {
                const orderedRow = {};
                orderedColumns.forEach(col => {
                    orderedRow[col] = row[col] || '';
                });
                return orderedRow;
            });

            const dataSheet = XLSX.utils.json_to_sheet(orderedData, { header: orderedColumns });
            
            // Configurar anchos de columna
            const colWidths = orderedColumns.map(col => {
                if (col === 'ID') return { width: 8 };
                if (col === 'Nombre') return { width: 30 };
                if (col === 'ID Externo') return { width: 20 };
                if (col === 'Categoría Principal') return { width: 20 };
                return { width: 25 };
            });
            
            dataSheet['!cols'] = colWidths;

            // Congelar la primera fila (encabezados)
            dataSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

            XLSX.utils.book_append_sheet(workbook, dataSheet, '🏭 Objetos del Modelo');
        }

        // Hoja 3: Resumen por categorías
        const categoryStats = {};
        excelData.forEach(obj => {
            const category = obj['Categoría Principal'] || 'Sin categoría';
            categoryStats[category] = (categoryStats[category] || 0) + 1;
        });

        const categoryData = [
            ['📊 OBJETOS POR CATEGORÍA'],
            [''],
            ['Categoría', 'Cantidad', 'Porcentaje']
        ];

        Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                const percentage = Math.round((count / excelData.length) * 100);
                categoryData.push([category, count, `${percentage}%`]);
            });

        const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
        categorySheet['!cols'] = [
            { width: 30 },
            { width: 15 },
            { width: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, categorySheet, '📊 Por Categorías');

        // Generar el archivo Excel
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Crear nombre de archivo
        const modelName = modelMetadata.modelName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `planta_industrial_${modelName}_${modelMetadata.totalObjects}obj_${timestamp}.xlsx`;
        
        // Descargar archivo
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        URL.revokeObjectURL(url);
        
        const successRate = Math.round((modelMetadata.totalObjects / allDbIds.length) * 100);
        showMessage(`📊 EXCEL GENERADO: ${modelMetadata.totalObjects} objetos en ${(processingTime/1000).toFixed(1)}s (${successRate}% éxito)`, 'success');

    } catch (error) {
        console.error('❌ Error en exportación a Excel:', error);
        showMessage('❌ Error en la exportación a Excel. Revisa la consola.', 'error');
    }
}

// Hacer la función disponible globalmente
window.exportarPropiedadesExcel = exportarPropiedadesExcel;

// Función principal para escalar/desescalar
function escalarObjeto() {
    if (!viewerInstance) {
        showMessage('❌ No hay un visor activo', 'error');
        return;
    }

    const model = viewerInstance.model;
    if (!model) {
        showMessage('❌ No hay un modelo cargado', 'error');
        return;
    }

    // Obtener la selección actual
    const selection = viewerInstance.getSelection();
    
    if (selection.length === 0) {
        showMessage('⚠️ Selecciona un objeto primero en el visor', 'warning');
        return;
    }

    const dbId = selection[0];
    
    if (!objetoEscalado) {
        // ESCALAR el objeto seleccionado
        aplicarEscala(dbId, 2.0);
        objetoEscalado = true;
        objetoEscaladoDbId = dbId;
        
        const objectName = getObjectName(dbId);
        showMessage(`🔍 Objeto escalado 2x: ${objectName}`, 'success');
    } else {
        // DESESCALAR - volver al tamaño original
        restaurarTamanoOriginal(objetoEscaladoDbId);
        objetoEscalado = false;
        objetoEscaladoDbId = null;
        
        showMessage('🔄 Objeto restaurado a tamaño original', 'info');
    }
}

// Función para aplicar escala correctamente
function aplicarEscala(dbId, factor) {
    const model = viewerInstance.model;
    const instanceTree = model.getInstanceTree();
    const fragList = model.getFragmentList();

    const fragIds = [];
    instanceTree.enumNodeFragments(dbId, (fragId) => {
        fragIds.push(fragId);
    });

    fragIds.forEach((fragId) => {
        const fragProxy = viewerInstance.impl.getFragmentProxy(model, fragId);
        fragProxy.getAnimTransform(); // importante para obtener datos actuales

        // Guardar transformación original solo una vez
        if (!transformacionesOriginales.has(fragId)) {
            transformacionesOriginales.set(fragId, {
                position: fragProxy.position.clone(),
                rotation: fragProxy.quaternion.clone(),
                scale: fragProxy.scale.clone()
            });
        }

        // Aplicar nueva escala
        fragProxy.scale.multiplyScalar(factor);
        fragProxy.updateAnimTransform();
    });

    viewerInstance.impl.sceneUpdated(true);
}

// Función para restaurar el tamaño original
function restaurarTamanoOriginal(dbId) {
    const model = viewerInstance.model;
    const instanceTree = model.getInstanceTree();

    const fragIds = [];
    instanceTree.enumNodeFragments(dbId, (fragId) => {
        fragIds.push(fragId);
    });

    fragIds.forEach((fragId) => {
        const transform = transformacionesOriginales.get(fragId);
        if (!transform) return;

        const fragProxy = viewerInstance.impl.getFragmentProxy(model, fragId);
        fragProxy.getAnimTransform();

        fragProxy.position.copy(transform.position);
        fragProxy.quaternion.copy(transform.rotation);
        fragProxy.scale.copy(transform.scale);

        fragProxy.updateAnimTransform();
    });

    viewerInstance.impl.sceneUpdated(true);
}

// Función para obtener el nombre del objeto
function getObjectName(dbId) {
    try {
        const model = viewerInstance.model;
        if (model && model.getInstanceTree) {
            const tree = model.getInstanceTree();
            return tree.getNodeName(dbId) || `Objeto_${dbId}`;
        }
        return `Objeto_${dbId}`;
    } catch (error) {
        return `Objeto_${dbId}`;
    }
}

window.escalarObjeto = escalarObjeto;