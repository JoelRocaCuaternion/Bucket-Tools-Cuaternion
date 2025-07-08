// Funciona Zoom y Marcador usando TAG a DBID con fallback a coordenadas XYZ

class IssuesManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.issues = [];
        this.filteredIssues = [];
        this.activeMarkers = new Map();
        this.activeIssues = new Set();
        this.markerUpdateInterval = null;
        
        // Mapa para convertir TAGs a DBIDs y datos del objeto
        this.tagToDbIdMap = new Map();
        this.objectDataMap = new Map(); // Para almacenar datos del objeto incluyendo posición XYZ
        
        // Propiedades para filtros
        this.filters = {
            search: '',
            severity: ['high', 'medium', 'low'],
            status: ['open', 'in-progress', 'resolved']
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFilterListeners();
        
        // Construir el mapa de TAG a DBID cuando el modelo esté cargado
        if (this.viewer.model) {
            this.buildTagToDbIdMap().then(() => {
                this.loadSampleIssues();
                this.applyFilters();
            });
        }
    }

    // Función para construir el mapa de TAG a DBID y datos del objeto
    buildTagToDbIdMap() {
        return new Promise((resolve) => {
            if (!this.viewer.model) {
                resolve();
                return;
            }

            this.viewer.model.getObjectTree((tree) => {
                const allDbIds = [];
                tree.enumNodeChildren(tree.getRootId(), (dbId) => {
                    allDbIds.push(dbId);
                }, true); // recursivo

                // Obtener propiedades relevantes incluyendo posición
                const propertiesToGet = [
                    'Tag', 'TAG', 'Position X', 'Position Y', 'Position Z',
                    'name', 'Name', 'TYPE', 'Type'
                ];

                this.viewer.model.getBulkProperties(allDbIds, propertiesToGet, (results) => {
                    results.forEach((item) => {
                        // Buscar la propiedad Tag
                        const tagProp = item.properties.find((p) => {
                            return p.displayName === 'Tag' || p.displayName === 'TAG';
                        });

                        if (tagProp && tagProp.displayValue) {
                            const tag = tagProp.displayValue;
                            this.tagToDbIdMap.set(tag, item.dbId);
                            
                            // Obtener coordenadas XYZ si están disponibles
                            const posXProp = item.properties.find(p => p.displayName === 'Position X');
                            const posYProp = item.properties.find(p => p.displayName === 'Position Y');
                            const posZProp = item.properties.find(p => p.displayName === 'Position Z');
                            
                            const objectData = {
                                dbId: item.dbId,
                                tag: tag,
                                name: item.name || 'Sin nombre'
                            };
                            
                            // Si tiene coordenadas XYZ, las añadimos
                            if (posXProp && posYProp && posZProp) {
                                // Convertir a números y manejar posibles comas decimales
                                const posX = parseFloat(posXProp.displayValue.replace(',', '.'));
                                const posY = parseFloat(posYProp.displayValue.replace(',', '.'));
                                const posZ = parseFloat(posZProp.displayValue.replace(',', '.'));
                                
                                if (!isNaN(posX) && !isNaN(posY) && !isNaN(posZ)) {
                                    objectData.position = new THREE.Vector3(posX, posY, posZ);
                                }
                            }
                            
                            this.objectDataMap.set(tag, objectData);
                        }
                    });
                    
                    console.log('Mapa TAG a DBID construido:', this.tagToDbIdMap);
                    console.log('Datos de objetos:', this.objectDataMap);
                    resolve();
                });
            });
        });
    }

    // Función para obtener DBID a partir del TAG
    getDbIdFromTag(tag) {
        return this.tagToDbIdMap.get(tag);
    }

    // Función para obtener datos del objeto a partir del TAG
    getObjectDataFromTag(tag) {
        return this.objectDataMap.get(tag);
    }

    loadSampleIssues() {
        // Datos de ejemplo con TAGs reales
        this.issues = [
            {
                tag: "R-C2/T1",
                name: "ACPPEQUIPMENT",
                color: "red",
                severity: "high",
                status: "open",
                type: "Fontanería",
                location: "Sótano - Tubería Principal",
                assignee: "Juan Pérez",
                date: "2024-01-15",
                description: "Fuga detectada en la tubería principal. Requiere atención inmediata."
            },
            {
                tag: "SC-T-2",
                name: "EQUIPMENT_001",
                color: "orange",
                severity: "medium",
                status: "in-progress",
                type: "Mecánico",
                location: "Sala de Máquinas",
                assignee: "María García",
                date: "2024-01-14",
                description: "Equipo con presión irregular. Revisar calibración."
            },
            {
                tag: "R-C2",
                name: "CONTROL_SYSTEM",
                color: "green",
                severity: "low",
                status: "resolved",
                type: "Instrumentación",
                location: "Planta 2 - Sistema de Control",
                assignee: "Carlos López",
                date: "2024-01-13",
                description: "Sistema funcionando correctamente. Última verificación OK."
            },
            {
                tag: "R-E2",
                name: "EQUIPMENT_002",
                color: "red",
                severity: "high",
                status: "open",
                type: "Mecánico",
                location: "Cuarto de Equipos",
                assignee: "Ana Martín",
                date: "2024-01-12",
                description: "Equipo con sobrecalentamiento. Parar inmediatamente."
            }
        ];

        this.applyFilters();
    }

    applyFilters() {
        this.filteredIssues = this.issues.filter(issue => {
            // Filtro de búsqueda
            if (this.filters.search) {
                const searchMatch = 
                    issue.tag.toLowerCase().includes(this.filters.search) ||
                    issue.name.toLowerCase().includes(this.filters.search) ||
                    issue.type.toLowerCase().includes(this.filters.search) ||
                    issue.location.toLowerCase().includes(this.filters.search) ||
                    issue.description.toLowerCase().includes(this.filters.search);
                
                if (!searchMatch) return false;
            }

            // Filtro de severidad
            if (!this.filters.severity.includes(issue.severity)) return false;

            // Filtro de estado
            if (!this.filters.status.includes(issue.status)) return false;

            return true;
        });

        this.renderIssues();
        this.updateResultsCount();
    }

    setupFilterListeners() {
        // Evento de búsqueda
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Eventos de filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                const value = e.target.dataset.value;
                
                e.target.classList.toggle('active');
                
                if (e.target.classList.contains('active')) {
                    if (!this.filters[filter].includes(value)) {
                        this.filters[filter].push(value);
                    }
                } else {
                    this.filters[filter] = this.filters[filter].filter(v => v !== value);
                }
                
                this.applyFilters();
            });
        });
    }

    renderIssues() {
        const issuesList = document.getElementById('issuesList');
        if (!issuesList) return;

        issuesList.innerHTML = '';

        if (this.filteredIssues.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No se encontraron incidencias que coincidan con los filtros seleccionados';
            issuesList.appendChild(noResults);
            return;
        }

        this.filteredIssues.forEach((issue, index) => {
            const issueElement = this.createIssueElement(issue, index);
            issuesList.appendChild(issueElement);
        });
    }

    createIssueElement(issue, index) {
        const issueDiv = document.createElement('div');
        issueDiv.className = 'issue-item';
        issueDiv.dataset.issueIndex = index;
        issueDiv.dataset.tag = issue.tag;

        // Obtener datos del objeto
        const objectData = this.getObjectDataFromTag(issue.tag);
        const dbId = objectData ? objectData.dbId : null;
        const objectName = objectData ? objectData.name : issue.name;

        issueDiv.innerHTML = `
            <div class="issue-header">
                <div class="issue-color ${issue.color}"></div>
                <div class="issue-tag">${issue.tag}</div>
            </div>
            <div class="issue-details">
                <div class="issue-detail-row">
                    <div class="issue-detail-label">Tag:</div>
                    <div class="issue-detail-value">${issue.tag}</div>
                </div>
                <div class="issue-detail-row">
                    <div class="issue-detail-label">DbID:</div>
                    <div class="issue-detail-value">${dbId || 'No encontrado'}</div>
                </div>
                <div class="issue-detail-row">
                    <div class="issue-detail-label">Objeto:</div>
                    <div class="issue-detail-value">${objectName}</div>
                </div>
                <div class="issue-description">
                    ${issue.description}
                </div>
            </div>
        `;

        return issueDiv;
    }

    getStatusText(status) {
        switch (status) {
            case 'open': return 'Abierto';
            case 'in-progress': return 'En progreso';
            case 'resolved': return 'Resuelto';
            default: return status;
        }
    }

    updateResultsCount() {
        const countElement = document.getElementById('resultsCount');
        if (countElement) {
            const total = this.issues.length;
            const filtered = this.filteredIssues.length;
            countElement.textContent = `Mostrando ${filtered} de ${total} incidencias`;
        }
    }

    handleIssueClick(issueItem) {
        const issueIndex = parseInt(issueItem.dataset.issueIndex);
        const issue = this.filteredIssues[issueIndex];

        this.toggleIssueDetails(issueItem, issue);
    }

    setupEventListeners() {
        // Event listener para clicks en las incidencias
        document.getElementById('issuesList').addEventListener('click', (e) => {
            const issueItem = e.target.closest('.issue-item');
            if (issueItem) {
                this.handleIssueClick(issueItem);
            }
        });

        // Event listener para cuando el viewer esté listo
        this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
            this.onGeometryLoaded();
        });

        // Event listener para cambios de cámara
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
            this.updateMarkersPosition();
        });
    }

    async toggleIssueDetails(issueItem, issue) {
        const details = issueItem.querySelector('.issue-details');
        const isActive = issueItem.classList.contains('active');
        const issueIndex = parseInt(issueItem.dataset.issueIndex);
        
        // Obtener datos del objeto
        const objectData = this.getObjectDataFromTag(issue.tag);
        const dbId = objectData ? objectData.dbId : null;
        
        if (!dbId) {
            console.warn(`No se encontró DBID para el TAG: ${issue.tag}`);
            return;
        }

        if (isActive) {
            // Cerrar esta incidencia específica
            issueItem.classList.remove('active');
            details.classList.remove('show');
            this.activeIssues.delete(issueIndex);
            
            // Remover solo el marcador de esta incidencia
            this.removeMarker(issue.tag);
            
            // Remover highlight de este objeto específico
            this.removeHighlight(dbId);
            
            // Si no hay más incidencias activas, parar las actualizaciones
            if (this.activeIssues.size === 0) {
                this.stopMarkerUpdates();
            }
        } else {
            // Abrir esta incidencia específica
            issueItem.classList.add('active');
            details.classList.add('show');
            this.activeIssues.add(issueIndex);
            
            // Highlight del objeto en el viewer
            this.highlightObject(dbId);
            
            // Enfocar cámara en el objeto
            this.focusOnObject(dbId);
            
            // Crear marcador 3D después de un pequeño delay
            setTimeout(async () => {
                await this.showIssueMarker(issue, dbId, objectData);
            }, 500);
            
            // Iniciar actualizaciones de marcadores si es la primera incidencia
            if (this.activeIssues.size === 1) {
                this.startMarkerUpdates();
            }
        }
    }

    highlightObject(dbId) {
        this.viewer.setThemingColor(dbId, new THREE.Vector4(1, 0.5, 0, 1));
        
        const timeoutId = setTimeout(() => {
            this.removeHighlight(dbId);
        }, 5000); // Aumentado a 5 segundos para mejor visibilidad
        
        if (!this.highlightTimeouts) {
            this.highlightTimeouts = new Map();
        }
        this.highlightTimeouts.set(dbId, timeoutId);
    }

    removeHighlight(dbId) {
        this.viewer.setThemingColor(dbId, null);
        
        if (this.highlightTimeouts && this.highlightTimeouts.has(dbId)) {
            clearTimeout(this.highlightTimeouts.get(dbId));
            this.highlightTimeouts.delete(dbId);
        }
    }

    async showIssueMarker(issue, dbId, objectData) {
        try {
            let markerPosition = null;
            
            // Primero intentar obtener el bounding box de los fragmentos
            const bbox = await this.getObjectBoundingBox(dbId);
            if (bbox) {
                markerPosition = bbox.center();
                console.log(`Marcador para TAG: ${issue.tag} usando bounding box, Posición:`, markerPosition);
            } 
            // Si no hay bounding box, usar coordenadas XYZ del objeto
            else if (objectData && objectData.position) {
                markerPosition = objectData.position.clone();
                console.log(`Marcador para TAG: ${issue.tag} usando coordenadas XYZ, Posición:`, markerPosition);
            }
            
            if (markerPosition) {
                // Pequeño delay para asegurar que el viewer está listo
                setTimeout(() => {
                    this.createMarker(markerPosition, issue);
                }, 100);
            } else {
                console.warn(`No se pudo determinar la posición para el marcador del TAG: ${issue.tag}`);
            }

        } catch (error) {
            console.error('Error al mostrar marcador:', error);
        }
    }

    async getObjectBoundingBox(dbId) {
        return new Promise((resolve) => {
            this.viewer.getObjectTree((tree) => {
                const bbox = new THREE.Box3();
                let hasFragments = false;
                
                tree.enumNodeFragments(dbId, (fragId) => {
                    hasFragments = true;
                    const fragProxy = this.viewer.impl.getFragmentProxy(this.viewer.model, fragId);
                    fragProxy.getAnimTransform();
                    
                    const fragBBox = new THREE.Box3();
                    fragProxy.getWorldBounds(fragBBox);
                    bbox.union(fragBBox);
                });
                
                if (!hasFragments) {
                    console.log(`No se encontraron fragmentos para DBID: ${dbId}, usando coordenadas XYZ`);
                    resolve(null);
                    return;
                }
                
                if (bbox.isEmpty()) {
                    console.warn(`Bounding box vacío para DBID: ${dbId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Bounding box obtenido para DBID ${dbId}:`, bbox);
                resolve(bbox);
            });
        });
    }

    createMarker(worldPosition, issue) {
        // Remover marcador previo si existe
        this.removeMarker(issue.tag);

        const marker = document.createElement('div');
        marker.className = `issue-marker ${issue.color}`;
        marker.dataset.tag = issue.tag;
        marker.innerHTML = '●'; // Añadir un punto

        // Estilos del marcador
        marker.style.cssText = `
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            font-weight: bold;
            cursor: pointer;
            z-index: 1000;
            pointer-events: auto;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            border: 2px solid white;
        `;

        // Aplicar color según el tipo de incidencia
        switch (issue.color) {
            case 'red':
                marker.style.backgroundColor = '#ff4444';
                break;
            case 'orange':
                marker.style.backgroundColor = '#ff8800';
                break;
            case 'green':
                marker.style.backgroundColor = '#44ff44';
                break;
            default:
                marker.style.backgroundColor = '#666666';
        }

        // Guardar la posición mundial
        marker.worldPosition = worldPosition;

        // Convertir posición mundial a coordenadas de pantalla
        const screenPoint = this.viewer.worldToClient(worldPosition);
        
        console.log(`Marcador para ${issue.tag} - Posición mundial:`, worldPosition);
        console.log(`Marcador para ${issue.tag} - Posición pantalla:`, screenPoint);
        
        // Posicionar el marcador
        marker.style.left = `${screenPoint.x - 10}px`;
        marker.style.top = `${screenPoint.y - 10}px`;

        // Añadir al contenedor del viewer
        this.viewer.container.appendChild(marker);
        this.activeMarkers.set(issue.tag, marker);
        
        console.log(`Marcador creado para ${issue.tag} en posición:`, screenPoint);
    }

    updateMarkersPosition() {
        this.activeMarkers.forEach((marker, tag) => {
            if (marker.worldPosition) {
                const screenPoint = this.viewer.worldToClient(marker.worldPosition);
                
                const rect = this.viewer.container.getBoundingClientRect();
                if (screenPoint.x >= 0 && screenPoint.x <= rect.width && 
                    screenPoint.y >= 0 && screenPoint.y <= rect.height) {
                    marker.style.left = `${screenPoint.x - 10}px`;
                    marker.style.top = `${screenPoint.y - 10}px`;
                    marker.style.display = 'block';
                } else {
                    marker.style.display = 'none';
                }
            }
        });
    }

    startMarkerUpdates() {
        if (this.markerUpdateInterval) return;
        
        this.markerUpdateInterval = setInterval(() => {
            this.updateMarkersPosition();
        }, 16);
    }

    stopMarkerUpdates() {
        if (this.markerUpdateInterval) {
            clearInterval(this.markerUpdateInterval);
            this.markerUpdateInterval = null;
        }
    }

    removeMarker(tag) {
        const marker = this.activeMarkers.get(tag);
        if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
            this.activeMarkers.delete(tag);
        }
    }

    removeActiveMarkers() {
        this.activeMarkers.forEach((marker, tag) => {
            this.removeMarker(tag);
        });
        this.stopMarkerUpdates();
    }

    focusOnObject(dbId) {
        this.viewer.isolate([dbId]);
        this.viewer.fitToView([dbId]);
        
        setTimeout(() => {
            this.viewer.isolate();
        }, 3000);
    }

    onGeometryLoaded() {
        console.log('Geometría cargada - Construyendo mapa TAG a DBID');
        this.buildTagToDbIdMap().then(() => {
            console.log('Mapa TAG a DBID construido - Issues Manager listo');
            this.loadSampleIssues();
            this.applyFilters();
        });
    }

    // Métodos actualizados para trabajar con TAGs
    addIssue(issue) {
        this.issues.push(issue);
        this.applyFilters();
    }

    removeIssue(tag) {
        const dbId = this.getDbIdFromTag(tag);
        this.issues = this.issues.filter(issue => issue.tag !== tag);
        this.removeMarker(tag);
        if (dbId) {
            this.removeHighlight(dbId);
        }
        this.applyFilters();
    }

    updateIssue(tag, updatedIssue) {
        const index = this.issues.findIndex(issue => issue.tag === tag);
        if (index !== -1) {
            this.issues[index] = { ...this.issues[index], ...updatedIssue };
            this.applyFilters();
        }
    }

    // Métodos para gestión de filtros
    setSearchFilter(searchTerm) {
        this.filters.search = searchTerm.toLowerCase();
        this.applyFilters();
    }

    setSeverityFilter(severities) {
        this.filters.severity = Array.isArray(severities) ? severities : [severities];
        this.applyFilters();
    }

    setStatusFilter(statuses) {
        this.filters.status = Array.isArray(statuses) ? statuses : [statuses];
        this.applyFilters();
    }

    resetFilters() {
        this.filters = {
            search: '',
            severity: ['high', 'medium', 'low'],
            status: ['open', 'in-progress', 'resolved']
        };
        
        // Resetear UI de filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.add('active');
        });
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.applyFilters();
    }

    getIssuesByColor(color) {
        return this.filteredIssues.filter(issue => issue.color === color);
    }

    clearAllActiveIssues() {
        this.activeIssues.forEach(issueIndex => {
            const issueItem = document.querySelector(`[data-issue-index="${issueIndex}"]`);
            if (issueItem) {
                issueItem.classList.remove('active');
                const details = issueItem.querySelector('.issue-details');
                details.classList.remove('show');
            }
        });
        
        this.activeIssues.clear();
        this.removeActiveMarkers();
        
        this.viewer.clearThemingColors();
        if (this.highlightTimeouts) {
            this.highlightTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.highlightTimeouts.clear();
        }
    }

    clearAllIssues() {
        this.issues = [];
        this.filteredIssues = [];
        this.clearAllActiveIssues();
        this.renderIssues();
        this.updateResultsCount();
    }

    destroy() {
        this.stopMarkerUpdates();
        this.removeActiveMarkers();
        this.clearAllActiveIssues();
        this.issues = [];
        this.filteredIssues = [];
        this.tagToDbIdMap.clear();
        this.objectDataMap.clear();
        
        if (this.highlightTimeouts) {
            this.highlightTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.highlightTimeouts.clear();
        }
    }
}

// Exportar para uso en otros módulos
window.IssuesManager = IssuesManager;