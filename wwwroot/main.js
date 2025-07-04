// main.js - Estilo Bucket Tools mejorado CON DEBUGGING Y SISTEMA DE NOTIFICACIONES
import { initViewer, loadModel } from './viewer.js';

let viewerInstance = null;
let isLoggedIn = false;
let selectedUrn = null;
let objetoEscalado = false;
let objetoEscaladoDbId = null;
let transformacionesOriginales = new Map();
let objetosEscalados = new Map();


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

// Extraer JSON
async function exportarPropiedades() {
    if (!viewerInstance || !viewerInstance.model || !selectedUrn) {
        showMessage('❌ No hay un modelo válido', 'error');
        return;
    }

    const model = viewerInstance.model;
    const instanceTree = model.getInstanceTree();
    
    if (!instanceTree) {
        showMessage('❌ No se pudo acceder al árbol de instancias', 'error');
        return;
    }

    // Configuración optimizada
    const CONFIG = {
        BATCH_SIZE: 50,           // Procesar en lotes de 50
        PROGRESS_UPDATE: 100,     // Actualizar progreso cada 100 objetos
        PAUSE_DURATION: 10,       // Pausa entre lotes para memoria
        PAUSE_EVERY_BATCHES: 10   // Pausa cada 10 lotes
    };

    let currentMessage = showMessage('⏳ Iniciando exportación JSON...', 'info');
    let startTime = Date.now();

    try {
        // Recolectar todos los dbIds
        const rootId = instanceTree.getRootId();
        const allDbIds = [];
        
        instanceTree.enumNodeChildren(rootId, function collectIds(dbId) {
            allDbIds.push(dbId);
            instanceTree.enumNodeChildren(dbId, collectIds);
        });

        console.log(`📊 Total de objetos a procesar: ${allDbIds.length}`);

        const modelData = {
            metadata: {
                urn: selectedUrn,
                exportDate: new Date().toISOString(),
                modelName: model.getData().name || 'sin_nombre',
                totalNodes: allDbIds.length,
                totalObjects: 0,
                processedNodes: 0,
                validObjects: 0,
                startTime: startTime,
                version: '2.0_optimizado'
            },
            objects: []
        };

        // Función para actualizar progreso
        const updateProgress = (current, total, validCount) => {
            const percent = Math.round((current / total) * 100);
            const elapsed = Date.now() - startTime;
            const speed = Math.round(current / (elapsed / 1000));
            const eta = current > 0 ? Math.round((total - current) / speed) : 0;
            
            const message = `📊 Procesando JSON: ${percent}% (${current}/${total}) - ${validCount} válidos - ${speed} obj/seg - ETA: ${eta}s`;
            
            if (currentMessage && currentMessage.remove) {
                currentMessage.remove();
            }
            currentMessage = showMessage(message, 'info');
        };

        // Función para procesar un lote
        const processBatch = async (dbIdBatch) => {
            const batchResults = [];
            
            for (const dbId of dbIdBatch) {
                try {
                    const result = await new Promise((resolve) => {
                        model.getProperties(dbId, (properties) => {
                            modelData.metadata.processedNodes++;
                            
                            if (!properties?.properties?.length) {
                                resolve(null);
                                return;
                            }

                            const objectName = instanceTree.getNodeName(dbId) || `Objeto_${dbId}`;
                            
                            const obj = {
                                dbId: dbId,
                                name: objectName,
                                externalId: properties.externalId || null,
                                properties: {}
                            };
                            
                            // Procesar propiedades de forma eficiente
                            for (const prop of properties.properties) {
                                const category = prop.displayCategory || 'General';
                                const propName = prop.displayName;
                                const propValue = prop.displayValue;
                                
                                if (propValue && propValue !== 'null') {
                                    if (!obj.properties[category]) {
                                        obj.properties[category] = {};
                                    }
                                    obj.properties[category][propName] = propValue;
                                }
                            }
                            
                            // Solo agregar si tiene propiedades válidas
                            if (Object.keys(obj.properties).length > 0) {
                                modelData.metadata.validObjects++;
                                resolve(obj);
                            } else {
                                resolve(null);
                            }
                            
                        }, () => {
                            modelData.metadata.processedNodes++;
                            resolve(null);
                        });
                    });

                    if (result) {
                        batchResults.push(result);
                    }

                } catch (error) {
                    console.warn(`Error procesando objeto ${dbId}:`, error);
                    modelData.metadata.processedNodes++;
                }
            }

            return batchResults;
        };

        // Procesar todos los objetos en lotes
        let batchCount = 0;
        
        for (let i = 0; i < allDbIds.length; i += CONFIG.BATCH_SIZE) {
            const batch = allDbIds.slice(i, i + CONFIG.BATCH_SIZE);
            const batchResults = await processBatch(batch);
            
            // Agregar resultados al array principal
            modelData.objects.push(...batchResults);
            modelData.metadata.totalObjects += batchResults.length;
            
            batchCount++;
            
            // Actualizar progreso
            if (modelData.metadata.processedNodes % CONFIG.PROGRESS_UPDATE === 0) {
                updateProgress(
                    modelData.metadata.processedNodes, 
                    allDbIds.length, 
                    modelData.metadata.validObjects
                );
            }
            
            // Pausa estratégica para memoria
            if (batchCount % CONFIG.PAUSE_EVERY_BATCHES === 0) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.PAUSE_DURATION));
            }
        }

        // Actualizar metadata final
        const processingTime = Date.now() - startTime;
        modelData.metadata.processingTimeMs = processingTime;
        modelData.metadata.processingTimeSeconds = Math.round(processingTime / 1000);
        modelData.metadata.averageSpeed = Math.round(modelData.metadata.processedNodes / (processingTime / 1000));
        modelData.metadata.successRate = Math.round((modelData.metadata.validObjects / modelData.metadata.processedNodes) * 100);

        // Mostrar progreso final antes de generar archivo
        if (currentMessage && currentMessage.remove) {
            currentMessage.remove();
        }
        currentMessage = showMessage('💾 Generando archivo JSON...', 'info');

        // Generar y descargar archivo
        const json = JSON.stringify(modelData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const modelName = modelData.metadata.modelName.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `${modelName}_${modelData.metadata.validObjects}obj_${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        // Mensaje de éxito final
        if (currentMessage && currentMessage.remove) {
            currentMessage.remove();
        }
        
        const timeStr = (processingTime / 1000).toFixed(1);
        const speed = Math.round(modelData.metadata.processedNodes / (processingTime / 1000));
        const successRate = modelData.metadata.successRate;
        
        showMessage(
            `✅ JSON GENERADO: ${filename} - ${modelData.metadata.validObjects} objetos en ${timeStr}s - ${speed} obj/seg (${successRate}% éxito)`,
            'success'
        );

        console.log('📊 Exportación JSON completada:', {
            archivo: filename,
            objetosValidos: modelData.metadata.validObjects,
            nodosProcessados: modelData.metadata.processedNodes,
            tiempo: `${timeStr}s`,
            velocidad: `${speed} obj/seg`,
            tasaExito: `${successRate}%`
        });

    } catch (error) {
        console.error('❌ Error en exportación JSON:', error);
        
        if (currentMessage && currentMessage.remove) {
            currentMessage.remove();
        }
        
        showMessage(`❌ Error al exportar JSON: ${error.message}`, 'error');
    }
}

window.exportarPropiedades = exportarPropiedades;

// Excel

async function exportarPropiedadesExcel() {
    if (!viewerInstance?.model || !selectedUrn) {
        showMessage('❌ No hay un modelo válido cargado', 'error');
        return;
    }

    const model = viewerInstance.model;
    const instanceTree = model.getInstanceTree();
    
    if (!instanceTree) {
        showMessage('❌ No se pudo acceder al árbol de instancias', 'error');
        return;
    }

    const loadingMessage = showMessage('⏳ Exportación MÍNIMA para archivos ultra-pesados...', 'info');

    try {
        // Configuración ultra-minimalista
        const CONFIG = {
            BATCH_SIZE: 50,
            WRITE_EVERY: 500,
            MAX_PROPERTIES: 5,  // Solo 5 propiedades más importantes
            PROGRESS_UPDATE: 200
        };

        // Recolectar dbIds
        const allDbIds = [];
        const rootId = instanceTree.getRootId();
        
        instanceTree.enumNodeChildren(rootId, function collectIds(dbId) {
            allDbIds.push(dbId);
            instanceTree.enumNodeChildren(dbId, collectIds);
        });

        const workbook = XLSX.utils.book_new();
        let worksheet = null;
        let currentRow = 1;
        let isFirstBatch = true;
        let validObjects = 0;

        // Headers fijos y mínimos
        const headers = ['ID', 'Nombre', 'ID_Externo', 'Categoria', 'Tipo', 'Material', 'Dimensiones', 'Codigo', 'Descripcion'];

        const processBatchMinimo = async (dbIdBatch) => {
            const results = [];
            
            for (const dbId of dbIdBatch) {
                try {
                    const result = await new Promise((resolve) => {
                        model.getProperties(dbId, (properties) => {
                            if (!properties?.properties?.length) {
                                resolve(null);
                                return;
                            }

                            const objectName = instanceTree.getNodeName(dbId) || `Objeto_${dbId}`;
                            const rowData = {
                                ID: dbId,
                                Nombre: objectName,
                                ID_Externo: properties.externalId || '',
                                Categoria: '',
                                Tipo: '',
                                Material: '',
                                Dimensiones: '',
                                Codigo: '',
                                Descripcion: ''
                            };

                            // Buscar solo propiedades clave
                            let propCount = 0;
                            for (const prop of properties.properties) {
                                if (propCount >= CONFIG.MAX_PROPERTIES) break;
                                
                                const name = prop.displayName?.toLowerCase() || '';
                                const value = prop.displayValue;
                                
                                if (value && value !== 'null') {
                                    if (name.includes('category') || name.includes('categoria')) {
                                        rowData.Categoria = value;
                                    } else if (name.includes('type') || name.includes('tipo')) {
                                        rowData.Tipo = value;
                                    } else if (name.includes('material')) {
                                        rowData.Material = value;
                                    } else if (name.includes('size') || name.includes('dimension')) {
                                        rowData.Dimensiones = value;
                                    } else if (name.includes('code') || name.includes('codigo')) {
                                        rowData.Codigo = value;
                                    } else if (name.includes('description') || name.includes('descripcion')) {
                                        rowData.Descripcion = value;
                                    }
                                    propCount++;
                                }
                            }

                            resolve(rowData);
                        }, () => resolve(null));
                    });

                    if (result) {
                        results.push(result);
                        validObjects++;
                    }

                } catch (error) {
                    console.warn(`Error procesando objeto ${dbId}:`, error);
                }
            }

            return results;
        };

        // Procesar en lotes
        let accumulatedData = [];
        let totalProcessed = 0;

        for (let i = 0; i < allDbIds.length; i += CONFIG.BATCH_SIZE) {
            const batch = allDbIds.slice(i, i + CONFIG.BATCH_SIZE);
            const batchData = await processBatchMinimo(batch);
            
            accumulatedData.push(...batchData);
            totalProcessed += batch.length;

            // Actualizar progreso
            if (totalProcessed % CONFIG.PROGRESS_UPDATE === 0) {
                const percent = Math.round((totalProcessed / allDbIds.length) * 100);
                showMessage(`📊 Procesando MÍNIMO: ${percent}% - ${validObjects} objetos`, 'info');
            }

            // Escribir datos
            if (accumulatedData.length >= CONFIG.WRITE_EVERY || i + CONFIG.BATCH_SIZE >= allDbIds.length) {
                if (isFirstBatch) {
                    worksheet = XLSX.utils.json_to_sheet(accumulatedData, { header: headers });
                    worksheet['!cols'] = headers.map(h => ({ width: h === 'Nombre' ? 30 : 20 }));
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Objetos_Minimo');
                    isFirstBatch = false;
                } else {
                    XLSX.utils.sheet_add_json(worksheet, accumulatedData, { 
                        skipHeader: true, 
                        origin: currentRow 
                    });
                }
                
                currentRow += accumulatedData.length;
                accumulatedData = [];
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Generar archivo
        const modelName = model.getData().name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Modelo_NWD';
        const filename = `${modelName}_MINIMO_${validObjects}obj.xlsx`;
        
        XLSX.writeFile(workbook, filename);

        if (loadingMessage && loadingMessage.remove) {
            loadingMessage.remove();
        }

        showMessage(`✅ EXCEL MÍNIMO: ${filename} - ${validObjects} objetos exportados`, 'success');

    } catch (error) {
        console.error('❌ Error en exportación mínima:', error);
        
        if (loadingMessage && loadingMessage.remove) {
            loadingMessage.remove();
        }
        
        showMessage(`❌ Error: ${error.message}`, 'error');
    }
}

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

// Función para aplicar escala 
function aplicarEscala(dbId, factor) {
    const model = viewerInstance.model;
    const instanceTree = model.getInstanceTree();
    const fragList = model.getFragmentList();

    const fragIds = [];
    instanceTree.enumNodeFragments(dbId, (fragId) => {
        fragIds.push(fragId);
    });

    // Calcular bounding box total del dbId (todos los fragmentos juntos).
    const bboxTotal = new THREE.Box3();
    fragIds.forEach(fragId => {
        const fragBbox = new THREE.Box3();
        fragList.getWorldBounds(fragId, fragBbox);
        bboxTotal.union(fragBbox);
    });
    const center = bboxTotal.getCenter(new THREE.Vector3());

    fragIds.forEach((fragId) => {
        const fragProxy = viewerInstance.impl.getFragmentProxy(model, fragId);
        fragProxy.getAnimTransform();

        if (!transformacionesOriginales.has(fragId)) {
            transformacionesOriginales.set(fragId, {
                position: fragProxy.position.clone(),
                rotation: fragProxy.quaternion.clone(),
                scale: fragProxy.scale.clone()
            });
        }

        // Compensar la posición para escalar desde el centro común del objeto
        const offset = new THREE.Vector3().subVectors(fragProxy.position, center);
        const nuevaPos = new THREE.Vector3().addVectors(center, offset.multiplyScalar(factor));

        fragProxy.scale.multiplyScalar(factor);
        fragProxy.position.copy(nuevaPos);

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