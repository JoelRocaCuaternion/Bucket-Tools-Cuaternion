class IssuesManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.issues = [];
        this.filteredIssues = []; // Nueva propiedad para issues filtrados
        this.activeMarkers = new Map();
        this.activeIssues = new Set();
        this.markerUpdateInterval = null;
        
        // Nuevas propiedades para filtros
        this.filters = {
            search: '',
            severity: ['high', 'medium', 'low'],
            status: ['open', 'in-progress', 'resolved']
        };
        
        this.init();
    }

    init() {
        this.loadSampleIssues();
        this.setupEventListeners();
        this.setupFilterListeners(); // Nuevo método para filtros
        this.applyFilters(); // Aplicar filtros iniciales
    }

    loadSampleIssues() {
        // Actualizar datos de ejemplo con más campos para filtros
        this.issues = [
            {
                dbId: 3,
                tag: "#326441",
                name: "ACPPPIPE",
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
                dbId: 5,
                tag: "#643201",
                name: "VALVE_001",
                color: "orange",
                severity: "medium",
                status: "in-progress",
                type: "Mecánico",
                location: "Sala de Máquinas",
                assignee: "María García",
                date: "2024-01-14",
                description: "Válvula con presión irregular. Revisar calibración."
            },
            {
                dbId: 7,
                tag: "#335464",
                name: "SENSOR_TEMP",
                color: "green",
                severity: "low",
                status: "resolved",
                type: "Instrumentación",
                location: "Planta 2 - Sensor Ambiente",
                assignee: "Carlos López",
                date: "2024-01-13",
                description: "Sensor funcionando correctamente. Última lectura: 21.5°C"
            },
            {
                dbId: 9,
                tag: "#666421",
                name: "PUMP_MAIN",
                color: "red",
                severity: "high",
                status: "open",
                type: "Mecánico",
                location: "Cuarto de Bombas",
                assignee: "Ana Martín",
                date: "2024-01-12",
                description: "Bomba principal con sobrecalentamiento. Parar inmediatamente."
            }
        ];

        this.applyFilters();
    }

    // Nuevo método para aplicar filtros
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

    // método para configurar listeners de filtros
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

    // Método actualizado para renderizar issues filtrados
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

    // Método actualizado para crear elementos de issue con más información
    createIssueElement(issue, index) {
        const issueDiv = document.createElement('div');
        issueDiv.className = 'issue-item';
        issueDiv.dataset.issueIndex = index;
        issueDiv.dataset.dbId = issue.dbId;

        issueDiv.innerHTML = `
            <div class="issue-header">
                <div class="issue-color ${issue.color}"></div>
                <div class="issue-tag">${issue.tag}</div>
            </div>
            <div class="issue-details">
                <div class="issue-detail-row">
                    <div class="issue-detail-label">DbID:</div>
                    <div class="issue-detail-value">${issue.dbId}</div>
                </div>
                <div class="issue-detail-row">
                    <div class="issue-detail-label">Objeto:</div>
                    <div class="issue-detail-value">${issue.name}</div>
                </div>
                <div class="issue-description">
                    ${issue.description}
                </div>
            </div>
        `;

        return issueDiv;
    }

    // Nuevos métodos de utilidad
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

    // Método actualizado para manejar clicks (usar filteredIssues)
    handleIssueClick(issueItem) {
        const issueIndex = parseInt(issueItem.dataset.issueIndex);
        const issue = this.filteredIssues[issueIndex]; // Usar filteredIssues

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

    toggleIssueDetails(issueItem, issue) {
        const details = issueItem.querySelector('.issue-details');
        const isActive = issueItem.classList.contains('active');
        const issueIndex = parseInt(issueItem.dataset.issueIndex);

        if (isActive) {
            // Cerrar esta incidencia específica
            issueItem.classList.remove('active');
            details.classList.remove('show');
            this.activeIssues.delete(issueIndex);
            
            // Remover solo el marcador de esta incidencia
            this.removeMarker(issue.dbId);
            
            // Remover highlight de este objeto específico
            this.removeHighlight(issue.dbId);
            
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
            this.highlightObject(issue.dbId);
            
            // Crear marcador 3D
            this.showIssueMarker(issue);
            
            // Enfocar cámara en el objeto
            this.focusOnObject(issue.dbId);
            
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
        }, 0);
        
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

    async showIssueMarker(issue) {
        try {
            const bbox = await this.getObjectBoundingBox(issue.dbId);
            if (!bbox) return;

            const center = bbox.center();
            this.createMarker(center, issue);

        } catch (error) {
            console.error('Error al mostrar marcador:', error);
        }
    }

    async getObjectBoundingBox(dbId) {
        return new Promise((resolve) => {
            this.viewer.getObjectTree((tree) => {
                const bbox = new THREE.Box3();
                tree.enumNodeFragments(dbId, (fragId) => {
                    const fragProxy = this.viewer.impl.getFragmentProxy(this.viewer.model, fragId);
                    fragProxy.getAnimTransform();
                    
                    const fragBBox = new THREE.Box3();
                    fragProxy.getWorldBounds(fragBBox);
                    bbox.union(fragBBox);
                });
                resolve(bbox.isEmpty() ? null : bbox);
            });
        });
    }

    createMarker(worldPosition, issue) {
        this.removeMarker(issue.dbId);

        const marker = document.createElement('div');
        marker.className = `issue-marker ${issue.color}`;
        marker.dataset.dbId = issue.dbId;

        marker.worldPosition = worldPosition;

        const screenPoint = this.viewer.worldToClient(worldPosition);
        marker.style.left = `${screenPoint.x - 10}px`;
        marker.style.top = `${screenPoint.y - 10}px`;

        this.viewer.container.appendChild(marker);
        this.activeMarkers.set(issue.dbId, marker);
    }

    updateMarkersPosition() {
        this.activeMarkers.forEach((marker, dbId) => {
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

    removeMarker(dbId) {
        const marker = this.activeMarkers.get(dbId);
        if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
            this.activeMarkers.delete(dbId);
        }
    }

    removeActiveMarkers() {
        this.activeMarkers.forEach((marker, dbId) => {
            this.removeMarker(dbId);
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
        console.log('Geometría cargada - Issues Manager listo');
    }

    // Métodos actualizados para trabajar con filtros
    addIssue(issue) {
        this.issues.push(issue);
        this.applyFilters(); // Aplicar filtros después de agregar
    }

    removeIssue(dbId) {
        this.issues = this.issues.filter(issue => issue.dbId !== dbId);
        this.removeMarker(dbId);
        this.removeHighlight(dbId);
        this.applyFilters(); // Aplicar filtros después de remover
    }

    updateIssue(dbId, updatedIssue) {
        const index = this.issues.findIndex(issue => issue.dbId === dbId);
        if (index !== -1) {
            this.issues[index] = { ...this.issues[index], ...updatedIssue };
            this.applyFilters(); // Aplicar filtros después de actualizar
        }
    }

    // Nuevos métodos para gestión de filtros
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
        
        if (this.highlightTimeouts) {
            this.highlightTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.highlightTimeouts.clear();
        }
    }
}

// Exportar para uso en otros módulos
window.IssuesManager = IssuesManager;