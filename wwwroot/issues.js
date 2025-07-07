class IssuesManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.issues = [];
        this.activeMarkers = new Map();
        this.activeIssues = new Set(); // Cambio: Set para múltiples incidencias activas
        this.markerUpdateInterval = null;
        
        this.init();
    }

    init() {
        this.loadSampleIssues();
        this.setupEventListeners();
    }

    loadSampleIssues() {
        this.issues = [
            {
                dbId: 3,
                tag: "#326441",
                name: "ACPPPIPE",
                color: "red",
                description: "Fuga detectada en la tubería principal. Requiere atención inmediata."
            },
            {
                dbId: 5,
                tag: "#643201",
                name: "VALVE_001",
                color: "orange",
                description: "Válvula con presión irregular. Revisar calibración."
            },
            {
                dbId: 7,
                tag: "#335464",
                name: "SENSOR_TEMP",
                color: "green",
                description: "Sensor funcionando correctamente. Última lectura: 21.5°C"
            },
            {
                dbId: 9,
                tag: "#666421",
                name: "PUMP_MAIN",
                color: "red",
                description: "Bomba principal con sobrecalentamiento. Parar inmediatamente."
            }
        ];

        this.renderIssues();
    }

    renderIssues() {
        const issuesList = document.getElementById('issuesList');
        issuesList.innerHTML = '';

        this.issues.forEach((issue, index) => {
            const issueElement = this.createIssueElement(issue, index);
            issuesList.appendChild(issueElement);
        });
    }

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

    handleIssueClick(issueItem) {
        const issueIndex = parseInt(issueItem.dataset.issueIndex);
        const issue = this.issues[issueIndex];

        // Alternar solo esta incidencia específica
        this.toggleIssueDetails(issueItem, issue);
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
        // Ya no limpiar todos los highlights, solo agregar el nuevo
        this.viewer.setThemingColor(dbId, new THREE.Vector4(1, 0.5, 0, 1));
        
        // Guardar timeout para poder cancelarlo si es necesario
        const timeoutId = setTimeout(() => {
            this.removeHighlight(dbId);
        }, 10000);
        
        // Guardar referencia del timeout por si necesitamos cancelarlo
        if (!this.highlightTimeouts) {
            this.highlightTimeouts = new Map();
        }
        this.highlightTimeouts.set(dbId, timeoutId);
    }

    removeHighlight(dbId) {
        // Remover highlight específico
        this.viewer.setThemingColor(dbId, null);
        
        // Limpiar timeout si existe
        if (this.highlightTimeouts && this.highlightTimeouts.has(dbId)) {
            clearTimeout(this.highlightTimeouts.get(dbId));
            this.highlightTimeouts.delete(dbId);
        }
    }

    async showIssueMarker(issue) {
        try {
            // Obtener la posición del objeto
            const bbox = await this.getObjectBoundingBox(issue.dbId);
            if (!bbox) return;

            // Calcular posición central del objeto
            const center = bbox.center();
            
            // Crear marcador con la posición del objeto
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
        // Remover marcador anterior si existe para este dbId específico
        this.removeMarker(issue.dbId);

        // Crear nuevo marcador
        const marker = document.createElement('div');
        marker.className = `issue-marker ${issue.color}`;
        marker.dataset.dbId = issue.dbId;

        // Guardar la posición del mundo 3D en el marcador
        marker.worldPosition = worldPosition;

        // Calcular posición inicial en pantalla
        const screenPoint = this.viewer.worldToClient(worldPosition);
        marker.style.left = `${screenPoint.x - 10}px`;
        marker.style.top = `${screenPoint.y - 10}px`;

        // Agregar al viewer
        this.viewer.container.appendChild(marker);
        
        // Guardar referencia
        this.activeMarkers.set(issue.dbId, marker);
    }

    // Método para actualizar las posiciones de los marcadores
    updateMarkersPosition() {
        this.activeMarkers.forEach((marker, dbId) => {
            if (marker.worldPosition) {
                const screenPoint = this.viewer.worldToClient(marker.worldPosition);
                
                // Verificar si el punto está visible en la pantalla
                const rect = this.viewer.container.getBoundingClientRect();
                if (screenPoint.x >= 0 && screenPoint.x <= rect.width && 
                    screenPoint.y >= 0 && screenPoint.y <= rect.height) {
                    marker.style.left = `${screenPoint.x - 10}px`;
                    marker.style.top = `${screenPoint.y - 10}px`;
                    marker.style.display = 'block';
                } else {
                    // Ocultar marcador si está fuera de vista
                    marker.style.display = 'none';
                }
            }
        });
    }

    // Iniciar actualizaciones periódicas de marcadores
    startMarkerUpdates() {
        if (this.markerUpdateInterval) return;
        
        this.markerUpdateInterval = setInterval(() => {
            this.updateMarkersPosition();
        }, 16); // ~60 FPS
    }

    // Parar actualizaciones de marcadores
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
        // Aislar el objeto temporalmente
        this.viewer.isolate([dbId]);
        
        // Fit to view
        this.viewer.fitToView([dbId]);
        
        // Restaurar vista completa después de 3 segundos
        setTimeout(() => {
            this.viewer.isolate();
        }, 3000);
    }

    onGeometryLoaded() {
        console.log('Geometría cargada - Issues Manager listo');
        // Aquí puedes agregar lógica adicional cuando el modelo esté cargado
    }

    // Método para agregar nuevas incidencias dinámicamente
    addIssue(issue) {
        this.issues.push(issue);
        this.renderIssues();
    }

    // Método para remover incidencias
    removeIssue(dbId) {
        this.issues = this.issues.filter(issue => issue.dbId !== dbId);
        this.removeMarker(dbId);
        this.removeHighlight(dbId);
        this.renderIssues();
    }

    // Método para actualizar incidencia
    updateIssue(dbId, updatedIssue) {
        const index = this.issues.findIndex(issue => issue.dbId === dbId);
        if (index !== -1) {
            this.issues[index] = { ...this.issues[index], ...updatedIssue };
            this.renderIssues();
        }
    }

    // Método para obtener incidencias por color
    getIssuesByColor(color) {
        return this.issues.filter(issue => issue.color === color);
    }

    // Método para limpiar todas las incidencias activas
    clearAllActiveIssues() {
        // Cerrar todas las incidencias activas
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
        
        // Limpiar todos los highlights
        this.viewer.clearThemingColors();
        if (this.highlightTimeouts) {
            this.highlightTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.highlightTimeouts.clear();
        }
    }

    // Método para limpiar todas las incidencias
    clearAllIssues() {
        this.issues = [];
        this.clearAllActiveIssues();
        this.renderIssues();
    }

    // Método para limpiar recursos al destruir la instancia
    destroy() {
        this.stopMarkerUpdates();
        this.removeActiveMarkers();
        this.clearAllActiveIssues();
        this.issues = [];
        
        // Limpiar timeouts de highlights
        if (this.highlightTimeouts) {
            this.highlightTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.highlightTimeouts.clear();
        }
    }
}

// Exportar para uso en otros módulos
window.IssuesManager = IssuesManager;