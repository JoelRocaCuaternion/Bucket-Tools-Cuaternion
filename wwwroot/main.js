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

// Crear elemento de archivo
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

    showMessage('⏳ Extrayendo objetos del modelo...', 'info');

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
        
        showMessage(`🚀 Encontrados ${allDbIds.length} nodos. Procesando....`, 'info');

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
                            showMessage(`⚡ Progreso: ${progress}% (${processedCount}/${allDbIds.length})`, 'info');
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


// EXPORTACIÓN EXCEL INTELIGENTE - MÁXIMO RENDIMIENTO PARA CUALQUIER TAMAÑO

async function exportarPropiedadesExcel() {
    
    // Validaciones iniciales
    if (!viewerInstance?.model || !selectedUrn) {
        showMessage('❌ Viewer, modelo o URN no disponible', 'error');
        return;
    }

    const model = viewerInstance.model;
    const instanceTree = model.getInstanceTree();
    
    if (!instanceTree) {
        showMessage('❌ No se pudo acceder al árbol de instancias', 'error');
        return;
    }

    showMessage('🔍 Analizando modelo para optimizar exportación...', 'info');

    try {
        const startTime = Date.now();
        
        // ===== FASE 1: ANÁLISIS INTELIGENTE DEL MODELO =====
        const collectAllDbIds = (nodeId, dbIds = []) => {
            dbIds.push(nodeId);
            instanceTree.enumNodeChildren(nodeId, (childNodeId) => {
                collectAllDbIds(childNodeId, dbIds);
            });
            return dbIds;
        };

        const rootId = instanceTree.getRootId();
        const allDbIds = collectAllDbIds(rootId);
        const totalNodes = allDbIds.length;

        // Determinar estrategia automáticamente
        let strategy;
        if (totalNodes < 1000) {
            strategy = 'PEQUEÑO';
        } else if (totalNodes < 5000) {
            strategy = 'MEDIANO';
        } else if (totalNodes < 20000) {
            strategy = 'GRANDE';
        } else {
            strategy = 'ULTRA_GRANDE';
        }

        showMessage(`🎯 Modelo ${strategy.toLowerCase()}: ${totalNodes.toLocaleString()} objetos`, 'info');

        // Configuración dinámica según tamaño
        const getConfig = (strategy) => {
            const configs = {
                PEQUEÑO: {
                    BATCH_SIZE: 200,
                    MAX_COLUMNS: 100,
                    MAX_ROWS_PER_SHEET: 100000,
                    SAMPLE_PERCENTAGE: 0.5,
                    PARALLEL_BATCHES: 4,
                    MEMORY_CLEANUP_INTERVAL: 2000
                },
                MEDIANO: {
                    BATCH_SIZE: 100,
                    MAX_COLUMNS: 75,
                    MAX_ROWS_PER_SHEET: 65000,
                    SAMPLE_PERCENTAGE: 0.3,
                    PARALLEL_BATCHES: 3,
                    MEMORY_CLEANUP_INTERVAL: 1000
                },
                GRANDE: {
                    BATCH_SIZE: 50,
                    MAX_COLUMNS: 50,
                    MAX_ROWS_PER_SHEET: 40000,
                    SAMPLE_PERCENTAGE: 0.2,
                    PARALLEL_BATCHES: 2,
                    MEMORY_CLEANUP_INTERVAL: 500
                },
                ULTRA_GRANDE: {
                    BATCH_SIZE: 25,
                    MAX_COLUMNS: 30,
                    MAX_ROWS_PER_SHEET: 25000,
                    SAMPLE_PERCENTAGE: 0.1,
                    PARALLEL_BATCHES: 1,
                    MEMORY_CLEANUP_INTERVAL: 250
                }
            };
            return configs[strategy];
        };

        const CONFIG = getConfig(strategy);

        // ===== FASE 2: ANÁLISIS INTELIGENTE DE PROPIEDADES =====
        const sampleSize = Math.min(
            Math.max(100, Math.floor(totalNodes * CONFIG.SAMPLE_PERCENTAGE)), 
            1000
        );
        const sampleDbIds = [];
        
        // Muestreo inteligente: tomar objetos distribuidos uniformemente
        const step = Math.floor(totalNodes / sampleSize);
        for (let i = 0; i < totalNodes && sampleDbIds.length < sampleSize; i += step) {
            sampleDbIds.push(allDbIds[i]);
        }
        
        showMessage(`🔬 Analizando propiedades (${sampleDbIds.length} objetos)...`, 'info');

        const propertyFrequency = new Map();
        const categoryFrequency = new Map();
        let sampleProcessed = 0;

        // Análisis paralelo de la muestra
        const analyzeSample = async () => {
            const promises = sampleDbIds.map(dbId => 
                new Promise(resolve => {
                    model.getProperties(dbId, (properties) => {
                        if (properties?.properties) {
                            properties.properties.forEach(prop => {
                                const category = prop.displayCategory || 'General';
                                const propName = prop.displayName;
                                const fullKey = `${category}::${propName}`;
                                
                                propertyFrequency.set(fullKey, (propertyFrequency.get(fullKey) || 0) + 1);
                                categoryFrequency.set(category, (categoryFrequency.get(category) || 0) + 1);
                            });
                        }
                        
                        sampleProcessed++;
                        resolve();

                    }, resolve);
                })
            );

            await Promise.all(promises);
        };

        await analyzeSample();

        // Seleccionar las propiedades más relevantes
        const selectedProperties = Array.from(propertyFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, CONFIG.MAX_COLUMNS)
            .map(([key]) => key);

        const topCategories = Array.from(categoryFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([cat]) => cat);

        // ===== FASE 3: PROCESAMIENTO ULTRA-OPTIMIZADO =====
        showMessage(`⚡ Procesando ${totalNodes.toLocaleString()} objetos con estrategia ${strategy}...`, 'info');

        const workbook = XLSX.utils.book_new();
        let totalObjectsExported = 0;
        let currentSheetIndex = 1;
        let currentSheetData = [];
        let processedCount = 0;

        const processChunkOptimized = async (dbIdChunk) => {
            const chunkPromises = dbIdChunk.map(dbId => 
                new Promise(resolve => {
                    model.getProperties(dbId, (properties) => {
                        processedCount++;
                        
                        if (properties?.properties?.length > 0) {
                            const objectName = instanceTree.getNodeName(dbId) || `Obj_${dbId}`;
                            
                            const rowData = {
                                ID: dbId,
                                Nombre: objectName.substring(0, 255), // Límite Excel
                                ID_Externo: (properties.externalId || '').substring(0, 255),
                                Categoria_Principal: ''
                            };

                            let primaryCategory = '';
                            const propMap = new Map();

                            // Mapear propiedades eficientemente
                            properties.properties.forEach(prop => {
                                const category = prop.displayCategory || 'General';
                                const fullKey = `${category}::${prop.displayName}`;
                                
                                if (selectedProperties.includes(fullKey)) {
                                    const columnName = `${category}_${prop.displayName}`.replace(/[^\w]/g, '_');
                                    propMap.set(columnName, (prop.displayValue || '').toString().substring(0, 255));
                                }
                                
                                if (!primaryCategory && topCategories.includes(category)) {
                                    primaryCategory = category;
                                }
                            });

                            rowData.Categoria_Principal = primaryCategory || 'General';
                            
                            // Agregar propiedades al objeto
                            propMap.forEach((value, key) => {
                                rowData[key] = value;
                            });

                            if (propMap.size > 0) {
                                totalObjectsExported++;
                                resolve(rowData);
                                return;
                            }
                        }
                        
                        resolve(null);
                    }, () => resolve(null));
                })
            );

            const results = await Promise.all(chunkPromises);
            return results.filter(result => result !== null);
        };

        // Procesamiento por chunks con gestión inteligente de memoria
        for (let i = 0; i < totalNodes; i += CONFIG.BATCH_SIZE) {
            const chunk = allDbIds.slice(i, i + CONFIG.BATCH_SIZE);
            const chunkData = await processChunkOptimized(chunk);
            
            currentSheetData.push(...chunkData);
            
            // Progreso actualizado más frecuentemente
            if (processedCount % Math.max(100, Math.floor(totalNodes / 100)) === 0) {
                const progress = Math.round((processedCount / totalNodes) * 100);
            
                showMessage(`⚡ Procesando: ${progress}% (${totalObjectsExported.toLocaleString()} objetos válidos)`, 'info');
            }

            // Gestión inteligente de hojas
            if (currentSheetData.length >= CONFIG.MAX_ROWS_PER_SHEET) {
                await createOptimizedSheet(workbook, currentSheetData, `Datos_${currentSheetIndex}`);
                
                currentSheetData = []; // Liberación inmediata de memoria
                currentSheetIndex++;
                
                // Forzar garbage collection si está disponible
                if (typeof window !== 'undefined' && window.gc) {
                    window.gc();
                }
            }

            // Limpieza de memoria periódica
            if (processedCount % CONFIG.MEMORY_CLEANUP_INTERVAL === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        // Crear hoja final si hay datos restantes
        if (currentSheetData.length > 0) {
            await createOptimizedSheet(workbook, currentSheetData, `Datos_${currentSheetIndex}`);
        }

        // ===== FASE 4: HOJA DE RESUMEN INTELIGENTE =====
        const processingTime = (Date.now() - startTime) / 1000;
        const successRate = Math.round((totalObjectsExported / totalNodes) * 100);
        
        const summaryData = [
            ['🏭 RESUMEN EXPORTACIÓN INTELIGENTE'],
            [''],
            ['📊 ESTADÍSTICAS GENERALES'],
            ['Modelo:', model.getData()?.name || 'Sin nombre'],
            ['Estrategia aplicada:', strategy],
            ['Objetos totales:', totalNodes.toLocaleString()],
            ['Objetos exportados:', totalObjectsExported.toLocaleString()],
            ['Tasa de éxito:', `${successRate}%`],
            ['Tiempo procesamiento:', `${processingTime.toFixed(1)} segundos`],
            ['Velocidad:', `${Math.round(totalNodes / processingTime).toLocaleString()} obj/seg`],
            [''],
            ['📋 ESTRUCTURA ARCHIVO'],
            ['Total de hojas:', currentSheetIndex],
            ['Máx. filas por hoja:', CONFIG.MAX_ROWS_PER_SHEET.toLocaleString()],
            ['Propiedades incluidas:', selectedProperties.length],
            ['Categorías principales:', topCategories.length],
            [''],
            ['⚙️ CONFIGURACIÓN APLICADA'],
            ['Tamaño de lote:', CONFIG.BATCH_SIZE],
            ['Muestra analizada:', `${sampleDbIds.length} objetos (${(CONFIG.SAMPLE_PERCENTAGE * 100)}%)`],
            ['Columnas máximas:', CONFIG.MAX_COLUMNS]
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [{ width: 30 }, { width: 40 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, '📊_Resumen', 0);

        // ===== FASE 5: GENERACIÓN Y DESCARGA OPTIMIZADA =====
        showMessage('💾 Generando archivo Excel...', 'info');

        const wbout = XLSX.write(workbook, { 
            bookType: 'xlsx', 
            type: 'array',
            compression: true,
            Props: {
                Title: `Exportación ${strategy}`,
                Author: 'Sistema Inteligente',
                CreatedDate: new Date()
            }
        });
        
        const fileSizeMB = Math.round(wbout.length / 1024 / 1024 * 100) / 100;
        
        const blob = new Blob([wbout], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        // Nombre de archivo inteligente
        const modelName = (model.getData()?.name || 'modelo')
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase()
            .substring(0, 30);
        
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '');
        const filename = `${modelName}_${strategy.toLowerCase()}_${totalObjectsExported}obj_${currentSheetIndex}hojas_${timestamp}.xlsx`;
        
        // Descarga
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        // Mensaje final optimizado
        const finalMessage = `🎉 EXCEL ${strategy}: ${totalObjectsExported.toLocaleString()} objetos en ${currentSheetIndex} hojas (${processingTime.toFixed(1)}s, ${fileSizeMB}MB)`;
        showMessage(finalMessage, 'success');

    } catch (error) {
        console.error('❌ Error en exportación inteligente:', error);
        showMessage(`❌ Error: ${error.message}. Ver consola para detalles.`, 'error');
    }
}

// Función auxiliar para crear hojas optimizadas
async function createOptimizedSheet(workbook, data, sheetName) {
    if (!data || data.length === 0) return;
    
    try {
        // Obtener todas las columnas únicas de los datos
        const allColumns = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(col => allColumns.add(col));
        });
        
        // Ordenar columnas: básicas primero, luego alfabéticamente
        const basicColumns = ['ID', 'Nombre', 'ID_Externo', 'Categoria_Principal'];
        const otherColumns = Array.from(allColumns)
            .filter(col => !basicColumns.includes(col))
            .sort();
        
        const orderedColumns = [...basicColumns, ...otherColumns];
        
        // Crear hoja con datos ordenados
        const worksheet = XLSX.utils.json_to_sheet(data, { 
            header: orderedColumns,
            skipHeader: false 
        });
        
        // Configurar anchos de columna inteligentes
        const colWidths = orderedColumns.map(col => {
            if (col === 'ID') return { width: 12 };
            if (col === 'Nombre') return { width: 35 };
            if (col === 'ID_Externo') return { width: 20 };
            if (col === 'Categoria_Principal') return { width: 25 };
            return { width: 22 };
        });
        
        worksheet['!cols'] = colWidths;
        worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        // Aplicar formato básico al encabezado
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (worksheet[cellAddress]) {
                worksheet[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "CCCCCC" } }
                };
            }
        }
        
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        
        // Pequeña pausa para permitir procesamiento
        await new Promise(resolve => setTimeout(resolve, 1));
        
    } catch (error) {
        console.error(`Error creando hoja ${sheetName}:`, error);
    }
}

// Mantener compatibilidad con función anterior
window.exportarPropiedadesExcel = exportarPropiedadesExcel;