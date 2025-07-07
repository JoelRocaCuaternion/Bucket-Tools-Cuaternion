class IssuesManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.issues = [];
        this.activeMarkers = new Map();
        this.activeIssue = null;
        
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
    }

    handleIssueClick(issueItem) {
        const issueIndex = parseInt(issueItem.dataset.issueIndex);
        const issue = this.issues[issueIndex];

        // Alternar detalles de la incidencia
        this.toggleIssueDetails(issueItem);

        // Highlight del objeto en el viewer
        this.highlightObject(issue.dbId);

        // Crear/actualizar marcador 3D
        this.showIssueMarker(issue);

        // Enfocar cámara en el objeto
        this.focusOnObject(issue.dbId);
    }

    toggleIssueDetails(issueItem) {
        // Cerrar otras incidencias abiertas
        document.querySelectorAll('.issue-item').forEach(item => {
            if (item !== issueItem) {
                item.classList.remove('active');
                const details = item.querySelector('.issue-details');
                details.classList.remove('show');
            }
        });

        // Alternar la incidencia actual
        const details = issueItem.querySelector('.issue-details');
        const isActive = issueItem.classList.contains('active');

        if (isActive) {
            issueItem.classList.remove('active');
            details.classList.remove('show');
            this.activeIssue = null;
        } else {
            issueItem.classList.add('active');
            details.classList.add('show');
            this.activeIssue = issueItem;
        }
    }

    highlightObject(dbId) {
        // Limpiar highlights anteriores
        this.viewer.clearThemingColors();
        
        // Highlight del objeto actual
        this.viewer.setThemingColor(dbId, new THREE.Vector4(1, 0.5, 0, 1));
        
        // Auto-limpiar después de 3 segundos
        setTimeout(() => {
            this.viewer.clearThemingColors();
        }, 10000);
    }

    async showIssueMarker(issue) {
        try {
            // Obtener la posición del objeto
            const bbox = await this.getObjectBoundingBox(issue.dbId);
            if (!bbox) return;

            // Calcular posición central del objeto
            const center = bbox.center();
            
            // Proyectar coordenadas 3D a 2D
            const screenPoint = this.viewer.worldToClient(center);
            
            // Crear marcador
            this.createMarker(screenPoint, issue);

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

    createMarker(screenPoint, issue) {
        // Remover marcador anterior si existe
        this.removeActiveMarkers();

        // Crear nuevo marcador
        const marker = document.createElement('div');
        marker.className = `issue-marker ${issue.color}`;
        marker.style.left = `${screenPoint.x - 10}px`;
        marker.style.top = `${screenPoint.y - 10}px`;
        marker.dataset.dbId = issue.dbId;

        // Agregar al viewer
        this.viewer.container.appendChild(marker);
        
        // Guardar referencia
        this.activeMarkers.set(issue.dbId, marker);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            this.removeMarker(issue.dbId);
        }, 5000);
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

    // Método para limpiar todas las incidencias
    clearAllIssues() {
        this.issues = [];
        this.removeActiveMarkers();
        this.renderIssues();
    }
}

// Exportar para uso en otros módulos
window.IssuesManager = IssuesManager;