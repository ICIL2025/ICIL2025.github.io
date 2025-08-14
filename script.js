// =============================================================================
// ICIL 2025 - In-Plant Logistics Simulation with Path Optimization
// =============================================================================

class LogisticsSimulation {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.nodes = [];
        this.obstacles = [];
        this.backgroundImage = null;
        this.currentTool = 'node';
        this.algorithmResults = {};
        this.selectedNode = null;
        this.dragging = false;
        this.drawingObstacle = false;
        this.currentObstacle = [];
        
        // UI State
        this.showGrid = true;
        this.snapToGrid = false;
        this.gridSize = 20;
        this.showBlockedConnections = false; // Debug mode
        
        // Cache for performance optimization
        this.distanceMatrixCache = null;
        this.obstacleGeometryVersion = 0; // Increment when obstacles change
        
        // Algorithm parameters
        this.algorithmParams = {
            tpsma: { iterations: 100, seeds: 3, convergenceThreshold: 0.001 },
            ga: { populationSize: 50, generations: 200, mutationRate: 0.05, eliteSize: 2 },
            christofides: { useExactMatching: true }
        };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUI();
        this.render();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Tool selection
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentTool = e.target.dataset.tool;
                this.updateToolButtons();
            });
        });
        
        // Algorithm selection
        document.getElementById('algorithmSelect').addEventListener('change', (e) => {
            this.runSingleAlgorithm(e.target.value);
        });
    }
    
    setupUI() {
        // Initialize UI elements
        this.updateToolButtons();
        this.updateParameterPanels();
    }
    
    updateToolButtons() {
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
        
        // Update cursor
        const cursors = {
            node: 'crosshair',
            obstacle: 'copy',
            select: 'default'
        };
        this.canvas.style.cursor = cursors[this.currentTool] || 'default';
        
        // Update tool indicator
        const indicators = {
            node: '📍 Click to add nodes',
            select: '👆 Click to select and drag nodes',
            obstacle: '🚧 Click to draw polygon obstacles (Enter to finish)'
        };
        
        const indicator = document.getElementById('toolIndicator');
        if (indicator) {
            indicator.textContent = indicators[this.currentTool] || 'Select a tool';
        }
        
        // Update status text
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = `${this.currentTool.charAt(0).toUpperCase() + this.currentTool.slice(1)} mode active - ${indicators[this.currentTool] || 'Ready'}`;
        }
    }
    
    updateParameterPanels() {
        // Update algorithm parameter displays
        Object.keys(this.algorithmParams).forEach(alg => {
            const panel = document.getElementById(`${alg}Params`);
            if (panel) {
                const params = this.algorithmParams[alg];
                panel.innerHTML = Object.entries(params)
                    .map(([key, value]) => {
                        const inputType = typeof value === 'boolean' ? 'checkbox' : 'number';
                        const inputValue = typeof value === 'boolean' ? (value ? 'checked' : '') : `value="${value}"`;
                        return `
                        <div class="param-row">
                            <label>${key}</label>
                            <input type="${inputType}" ${inputValue} data-param="${key}" data-algorithm="${alg}">
                        </div>
                    `}).join('');
            }
        });
    }
    
    // =============================================================================
    // EVENT HANDLERS
    // =============================================================================
    
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        switch (this.currentTool) {
            case 'node':
                if (e.button === 0) { // Left click
                    this.addNode(x, y);
                }
                break;
                
            case 'select':
                const node = this.getNodeAt(x, y);
                if (node) {
                    this.selectedNode = node;
                    this.dragging = true;
                } else {
                    this.selectedNode = null;
                }
                break;
                
            case 'obstacle':
                if (e.button === 0) {
                    if (!this.drawingObstacle) {
                        this.drawingObstacle = true;
                        this.currentObstacle = [{x, y}];
                    } else {
                        this.currentObstacle.push({x, y});
                    }
                }
                break;
        }
        
        this.render();
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.dragging && this.selectedNode) {
            this.selectedNode.x = x;
            this.selectedNode.y = y;
            this.render();
        }
        
        if (this.drawingObstacle && this.currentObstacle.length > 0) {
            // Show preview of current obstacle
            this.render();
            this.drawObstaclePreview(x, y);
        }
    }
    
    onMouseUp(e) {
        this.dragging = false;
    }
    
    onKeyDown(e) {
        switch (e.key) {
            case 'Delete':
                if (this.selectedNode) {
                    this.deleteNode(this.selectedNode);
                    this.selectedNode = null;
                    this.render();
                }
                break;
                
            case 'Escape':
                if (this.drawingObstacle) {
                    this.drawingObstacle = false;
                    this.currentObstacle = [];
                    this.render();
                }
                break;
                
            case 'Enter':
                if (this.drawingObstacle && this.currentObstacle.length >= 3) {
                    this.finishObstacle();
                }
                break;
                
            case '1':
                this.currentTool = 'node';
                this.updateToolButtons();
                break;
            case '2':
                this.currentTool = 'select';
                this.updateToolButtons();
                break;
            case '3':
                this.currentTool = 'obstacle';
                this.updateToolButtons();
                break;
                
            case 'r':
                this.runAllAlgorithms();
                break;
                
            case 'c':
                this.clearAll();
                break;
        }
    }
    
    // =============================================================================
    // NODE MANAGEMENT
    // =============================================================================
    
    addNode(x, y) {
        if (this.snapToGrid) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            y = Math.round(y / this.gridSize) * this.gridSize;
        }
        
        // Check if the new node would be inside any obstacle
        const newNode = { x, y };
        if (this.isPointInAnyObstacle(newNode)) {
            this.showMessage('Cannot place node inside an obstacle!', 'error');
            return;
        }
        
        this.nodes.push({ x, y, id: this.nodes.length });
        this.clearResults();
        this.showMessage(`Node ${this.nodes.length - 1} added`, 'success');
    }
    
    deleteNode(node) {
        const index = this.nodes.indexOf(node);
        if (index > -1) {
            this.nodes.splice(index, 1);
            // Update IDs
            this.nodes.forEach((n, i) => n.id = i);
            this.clearResults();
        }
    }
    
    getNodeAt(x, y, radius = 15) {
        return this.nodes.find(node => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
    }
    
    clearNodes() {
        this.nodes = [];
        this.selectedNode = null;
        this.clearResults();
    }
    
    // =============================================================================
    // OBSTACLE MANAGEMENT
    // =============================================================================
    
    finishObstacle() {
        if (this.currentObstacle.length >= 3) {
            // Validate and clean up the polygon
            const cleanedObstacle = this.validateAndCleanPolygon(this.currentObstacle);
            
            if (cleanedObstacle.length >= 3) {
                this.obstacles.push(cleanedObstacle);
                this.currentObstacle = [];
                this.drawingObstacle = false;
                this.invalidateGeometryCache();
                this.clearResults();
                this.render();
                this.showMessage(`Obstacle added with ${cleanedObstacle.length} vertices!`, 'success');
            } else {
                this.showMessage('Invalid obstacle: needs at least 3 distinct points', 'error');
            }
        } else {
            this.showMessage('Obstacle needs at least 3 points. Continue clicking or press Escape to cancel.', 'warning');
        }
    }
    
    validateAndCleanPolygon(polygon) {
        if (polygon.length < 3) return [];
        
        const cleaned = [];
        const epsilon = 2; // Minimum distance between points
        
        // Remove duplicate and very close points
        for (let i = 0; i < polygon.length; i++) {
            const current = polygon[i];
            let isDuplicate = false;
            
            for (const existing of cleaned) {
                const dist = Math.sqrt(
                    (current.x - existing.x) ** 2 + (current.y - existing.y) ** 2
                );
                if (dist < epsilon) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                cleaned.push({ x: current.x, y: current.y });
            }
        }
        
        // Ensure polygon is closed (first and last points should be different)
        if (cleaned.length >= 3) {
            const first = cleaned[0];
            const last = cleaned[cleaned.length - 1];
            const dist = Math.sqrt(
                (first.x - last.x) ** 2 + (first.y - last.y) ** 2
            );
            
            // If last point is very close to first, remove it (polygon will auto-close)
            if (dist < epsilon) {
                cleaned.pop();
            }
        }
        
        return cleaned;
    }
    
    clearObstacles() {
        this.obstacles = [];
        this.currentObstacle = [];
        this.drawingObstacle = false;
        this.invalidateGeometryCache();
        this.clearResults();
    }
    
    // Invalidate any cached geometry/distance calculations
    invalidateGeometryCache() {
        this.distanceMatrixCache = null;
        this.obstacleGeometryVersion++;
    }
    
    // =============================================================================
    // BACKGROUND IMAGE MANAGEMENT
    // =============================================================================
    
    loadBackgroundImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.backgroundImage = img;
                this.render();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    clearBackground() {
        this.backgroundImage = null;
        this.render();
    }
    
    // =============================================================================
    // ALGORITHM IMPLEMENTATIONS
    // =============================================================================
    
    runAllAlgorithms() {
        if (this.nodes.length < 3) {
            this.showMessage('Need at least 3 nodes to run algorithms', 'warning');
            return;
        }
        
        this.clearResults();
        this.showMessage('Running algorithms...', 'info');
        
        // Run each algorithm
        const algorithms = ['tpsma', 'ga', 'christofides'];
        const results = {};
        
        algorithms.forEach(alg => {
            try {
                const startTime = performance.now();
                const result = this.runAlgorithm(alg, this.nodes);
                result.time = performance.now() - startTime;
                results[alg] = result;
            } catch (error) {
                console.error(`Error running ${alg}:`, error);
                results[alg] = { error: error.message };
            }
        });
        
        // Enhance results with comparative metrics
        this.algorithmResults = this.enhanceAlgorithmResults(results, this.nodes);
        
        // Calculate improvement rates for iterative algorithms
        this.calculateImprovementRates();
        
        this.updateResultsDisplay();
        this.render();
        
        this.showMessage('Algorithms completed with enhanced metrics!', 'success');
    }
    
    calculateImprovementRates() {
        Object.keys(this.algorithmResults).forEach(algorithmName => {
            const result = this.algorithmResults[algorithmName];
            if (result.error) return;
            
            if (result.initialPathLength && result.totalLength) {
                result.improvementRatePercent = this.calculateImprovementRatePercent(
                    result.initialPathLength,
                    result.totalLength
                );
            } else {
                result.improvementRatePercent = null; // For Christofides
            }
        });
    }
    
    runSingleAlgorithm(algorithmName) {
        if (this.nodes.length < 3) return;
        
        try {
            const startTime = performance.now();
            const result = this.runAlgorithm(algorithmName, this.nodes);
            result.time = performance.now() - startTime;
            
            this.algorithmResults = { [algorithmName]: result };
            this.updateResultsDisplay();
            this.render();
        } catch (error) {
            console.error(`Error running ${algorithmName}:`, error);
            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }
    
    runAlgorithm(algorithmName, nodeData) {
        switch (algorithmName.toLowerCase()) {
            case 'tpsma':
                return this.solveTPSMA(nodeData);
            case 'ga':
                return this.solveGA(nodeData);
            case 'christofides':
                return this.solveChristofides(nodeData);
            default:
                throw new Error(`Unknown algorithm: ${algorithmName}`);
        }
    }
    
    // =============================================================================
    // TPSMA ALGORITHM (Two-Way Parallel Slime Mold Algorithm)
    // =============================================================================
    
    solveTPSMA(nodes) {
        const n = nodes.length;
        if (n < 2) return { path: [0], totalLength: 0, details: {} };
        
        const params = this.algorithmParams.tpsma;
        const distMatrix = this.computeObstacleAwareDistanceMatrix(nodes);
        
        let bestTour = null;
        let bestLength = Infinity;
        let totalIterations = 0;
        let initialLength = null;
        
        // Multiple seeds for exploration
        for (let seed = 0; seed < params.seeds; seed++) {
            const rng = new SeededRandom(12345 + seed);
            
            // Initialize network conductance matrix
            const conductance = Array(n).fill().map(() => Array(n).fill(0));
            
            // Set initial conductances based on inverse distance
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const initialConductance = 1 / (1 + distMatrix[i][j] * 0.01);
                    conductance[i][j] = conductance[j][i] = initialConductance;
                }
            }
            
            // Generate initial solution for this seed
            const initialTour = this.generateInitialRandomTour(nodes, rng);
            const seedInitialLength = this.calculateObstacleAwareTourLength(initialTour, nodes);
            
            if (initialLength === null) {
                initialLength = seedInitialLength; // Use first seed's initial solution
            }
            
            let seedBestTour = [...initialTour];
            let seedBestLength = seedInitialLength;
            
            // Simulate network evolution
            let prevBestLength = Infinity;
            let stagnationCount = 0;
            let seedIterations = 0;
            
            for (let iter = 0; iter < params.iterations; iter++) {
                seedIterations++;
                
                // Update conductances based on flow
                this.updateSlimeMoldConductance(conductance, distMatrix, n);
                
                // Extract tour from current network
                const tour = this.extractNetworkTour(conductance, distMatrix, n, rng);
                const length = this.calculateObstacleAwareTourLength(tour, nodes);
                
                // Check for convergence
                if (Math.abs(prevBestLength - length) < params.convergenceThreshold) {
                    stagnationCount++;
                    if (stagnationCount > 20) break;
                } else {
                    stagnationCount = 0;
                }
                
                if (length < seedBestLength) {
                    seedBestLength = length;
                    seedBestTour = [...tour];
                }
                
                prevBestLength = length;
            }
            
            totalIterations += seedIterations;
            
            if (seedBestLength < bestLength) {
                bestLength = seedBestLength;
                bestTour = [...seedBestTour];
            }
        }
        
        return {
            path: bestTour,
            totalLength: bestLength,
            algorithm: 'TPSMA',
            iterationCount: Math.round(totalIterations / params.seeds), // Average iterations per seed
            initialPathLength: initialLength,
            details: { 
                seeds: params.seeds, 
                iterations: params.iterations,
                bioinspired: true,
                obstacleAware: true,
                averageIterations: Math.round(totalIterations / params.seeds),
                totalIterations: totalIterations
            }
        };
    }
    
    updateSlimeMoldConductance(conductance, distMatrix, n) {
        const decay = 0.95;
        const reinforcement = 0.1;
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                // Decay existing conductance
                conductance[i][j] *= decay;
                
                // Reinforce based on utility (inverse distance)
                const utility = 1 / (1 + distMatrix[i][j] * 0.01);
                conductance[i][j] += utility * reinforcement;
                
                // Symmetry
                conductance[j][i] = conductance[i][j];
            }
        }
    }
    
    extractNetworkTour(conductance, distMatrix, n, rng) {
        // Start from random node
        const start = Math.floor(rng.next() * n);
        const tour = [start];
        const visited = new Set([start]);
        let current = start;
        
        while (visited.size < n) {
            let best = -1;
            let bestScore = -Infinity;
            
            for (let j = 0; j < n; j++) {
                if (!visited.has(j)) {
                    // Score based on conductance and distance
                    const score = conductance[current][j] * (1 / (1 + distMatrix[current][j]));
                    if (score > bestScore) {
                        bestScore = score;
                        best = j;
                    }
                }
            }
            
            if (best !== -1) {
                tour.push(best);
                visited.add(best);
                current = best;
            }
        }
        
        return tour;
    }
    
    // =============================================================================
    // GENETIC ALGORITHM
    // =============================================================================
    
    solveGA(nodes) {
        const n = nodes.length;
        if (n < 3) return { path: [0], totalLength: 0, details: {} };
        
        const params = this.algorithmParams.ga;
        const rng = new SeededRandom(54321);
        
        // Initialize population
        let population = [];
        for (let i = 0; i < params.populationSize; i++) {
            const individual = Array.from({length: n}, (_, j) => j);
            this.shuffleArray(individual, rng);
            population.push(individual);
        }
        
        // Track initial solution
        const initialSolution = [...population[0]];
        const initialLength = this.calculateObstacleAwareTourLength(initialSolution, nodes);
        
        let bestIndividual = null;
        let bestFitness = Infinity;
        let generation = 0;
        let stagnationCount = 0;
        let actualIterations = 0;
        
        while (generation < params.generations && stagnationCount < 50) {
            actualIterations++;
            
            // Evaluate fitness
            const fitness = population.map(ind => this.calculateObstacleAwareTourLength(ind, nodes));
            
            // Track best
            const minIndex = fitness.indexOf(Math.min(...fitness));
            if (fitness[minIndex] < bestFitness) {
                bestFitness = fitness[minIndex];
                bestIndividual = [...population[minIndex]];
                stagnationCount = 0;
            } else {
                stagnationCount++;
            }
            
            // Selection and reproduction
            const newPop = [];
            
            // Elitism
            const elite = fitness.map((fit, idx) => ({fitness: fit, individual: population[idx]}))
                .sort((a, b) => a.fitness - b.fitness)
                .slice(0, params.eliteSize);
            
            elite.forEach(e => newPop.push([...e.individual]));
            
            // Generate offspring
            while (newPop.length < params.populationSize) {
                const parent1 = this.tournamentSelection(population, fitness, rng);
                const parent2 = this.tournamentSelection(population, fitness, rng);
                const child = this.orderCrossover(parent1, parent2, rng);
                
                if (rng.next() < params.mutationRate) {
                    this.swapMutation(child, rng);
                }
                
                newPop.push(child);
            }
            
            population = newPop;
            generation++;
        }
        
        return {
            path: bestIndividual,
            totalLength: bestFitness,
            algorithm: 'GA',
            iterationCount: actualIterations,
            initialPathLength: initialLength,
            details: { 
                generations: generation,
                population: params.populationSize,
                finalStagnation: stagnationCount,
                obstacleAware: true,
                actualGenerations: actualIterations
            }
        };
    }
    
    tournamentSelection(population, fitness, rng, tournamentSize = 3) {
        let best = Math.floor(rng.next() * population.length);
        
        for (let i = 1; i < tournamentSize; i++) {
            const candidate = Math.floor(rng.next() * population.length);
            if (fitness[candidate] < fitness[best]) {
                best = candidate;
            }
        }
        
        return [...population[best]];
    }
    
    orderCrossover(parent1, parent2, rng) {
        const n = parent1.length;
        const start = Math.floor(rng.next() * n);
        const end = Math.floor(rng.next() * n);
        const [a, b] = start < end ? [start, end] : [end, start];
        
        const child = Array(n).fill(-1);
        
        // Copy segment from parent1
        for (let i = a; i <= b; i++) {
            child[i] = parent1[i];
        }
        
        // Fill remaining from parent2
        let pos = (b + 1) % n;
        const used = new Set(child.filter(x => x !== -1));
        
        for (let i = 0; i < n; i++) {
            const city = parent2[(b + 1 + i) % n];
            if (!used.has(city)) {
                while (child[pos] !== -1) {
                    pos = (pos + 1) % n;
                }
                child[pos] = city;
            }
        }
        
        return child;
    }
    
    swapMutation(individual, rng) {
        const n = individual.length;
        const i = Math.floor(rng.next() * n);
        const j = Math.floor(rng.next() * n);
        [individual[i], individual[j]] = [individual[j], individual[i]];
    }
    
    // =============================================================================
    // CHRISTOFIDES ALGORITHM
    // =============================================================================
    
    solveChristofides(nodes) {
        const n = nodes.length;
        if (n < 3) return { path: [0], totalLength: 0, details: {} };
        
        const distMatrix = this.computeObstacleAwareDistanceMatrix(nodes);
        
        // Step 1: Minimum Spanning Tree
        const mst = this.primMST(distMatrix);
        
        // Step 2: Find vertices with odd degree
        const degree = Array(n).fill(0);
        mst.forEach(edge => {
            degree[edge.from]++;
            degree[edge.to]++;
        });
        
        const oddVertices = [];
        for (let i = 0; i < n; i++) {
            if (degree[i] % 2 === 1) {
                oddVertices.push(i);
            }
        }
        
        // Step 3: Minimum weight perfect matching on odd vertices
        const matching = this.minimumWeightMatching(oddVertices, distMatrix);
        
        // Step 4: Combine MST and matching to form multigraph
        const multigraph = [...mst, ...matching];
        
        // Step 5: Find Eulerian circuit
        const eulerianCircuit = this.findEulerianCircuit(multigraph, n);
        
        // Step 6: Convert to Hamiltonian by removing repeated vertices
        const hamiltonian = [];
        const visited = new Set();
        
        for (const vertex of eulerianCircuit) {
            if (!visited.has(vertex)) {
                hamiltonian.push(vertex);
                visited.add(vertex);
            }
        }
        
        const totalLength = this.calculateObstacleAwareTourLength(hamiltonian, nodes);
        
        return {
            path: hamiltonian,
            totalLength: totalLength,
            algorithm: 'Christofides',
            iterationCount: null, // Non-iterative algorithm
            initialPathLength: null, // Deterministic algorithm
            details: { 
                mstEdges: mst.length,
                oddVertices: oddVertices.length,
                matchingEdges: matching.length,
                approximationRatio: 1.5,
                obstacleAware: true,
                deterministic: true
            }
        };
    }
    
    primMST(distMatrix) {
        const n = distMatrix.length;
        const mst = [];
        const visited = Array(n).fill(false);
        const key = Array(n).fill(Infinity);
        const parent = Array(n).fill(-1);
        
        key[0] = 0;
        
        for (let count = 0; count < n - 1; count++) {
            // Find minimum key vertex
            let u = -1;
            for (let v = 0; v < n; v++) {
                if (!visited[v] && (u === -1 || key[v] < key[u])) {
                    u = v;
                }
            }
            
            visited[u] = true;
            
            if (parent[u] !== -1) {
                mst.push({
                    from: parent[u], 
                    to: u, 
                    weight: distMatrix[parent[u]][u]
                });
            }
            
            // Update key values
            for (let v = 0; v < n; v++) {
                if (!visited[v] && distMatrix[u][v] < key[v]) {
                    key[v] = distMatrix[u][v];
                    parent[v] = u;
                }
            }
        }
        
        return mst;
    }
    
    minimumWeightMatching(oddVertices, distMatrix) {
        const matching = [];
        const used = Array(oddVertices.length).fill(false);
        
        // Greedy matching (not optimal but reasonable approximation)
        for (let i = 0; i < oddVertices.length; i++) {
            if (used[i]) continue;
            
            let bestJ = -1;
            let minWeight = Infinity;
            
            for (let j = i + 1; j < oddVertices.length; j++) {
                if (!used[j] && distMatrix[oddVertices[i]][oddVertices[j]] < minWeight) {
                    minWeight = distMatrix[oddVertices[i]][oddVertices[j]];
                    bestJ = j;
                }
            }
            
            if (bestJ !== -1) {
                matching.push({
                    from: oddVertices[i], 
                    to: oddVertices[bestJ], 
                    weight: minWeight
                });
                used[i] = used[bestJ] = true;
            }
        }
        
        return matching;
    }
    
    findEulerianCircuit(edges, n) {
        // Build adjacency list
        const adj = Array(n).fill().map(() => []);
        edges.forEach(edge => {
            adj[edge.from].push(edge.to);
            adj[edge.to].push(edge.from);
        });
        
        // Hierholzer's algorithm
        const circuit = [];
        const stack = [0];
        
        while (stack.length > 0) {
            const v = stack[stack.length - 1];
            
            if (adj[v].length > 0) {
                const u = adj[v].pop();
                // Remove reverse edge
                const idx = adj[u].indexOf(v);
                if (idx !== -1) adj[u].splice(idx, 1);
                stack.push(u);
            } else {
                circuit.push(stack.pop());
            }
        }
        
        return circuit.reverse();
    }
    
    // =============================================================================
    // ROBUST OBSTACLE-AWARE DISTANCE CALCULATIONS
    // =============================================================================
    
    computeObstacleAwareDistanceMatrix(nodes) {
        // Use cache if available and geometry hasn't changed
        const cacheKey = `${nodes.length}_${this.obstacleGeometryVersion}`;
        if (this.distanceMatrixCache && this.distanceMatrixCache.key === cacheKey) {
            return this.distanceMatrixCache.matrix;
        }
        
        const n = nodes.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        
        // Validate all nodes are not inside obstacles
        for (let i = 0; i < n; i++) {
            if (this.isPointInAnyObstacle(nodes[i])) {
                console.warn(`Node ${i} is inside an obstacle! This may cause issues.`);
                this.showMessage(`Warning: Node ${i} is inside an obstacle`, 'warning');
            }
        }
        
        // Calculate distances
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const distance = this.calculateObstacleAwareDistance(nodes[i], nodes[j]);
                matrix[i][j] = matrix[j][i] = distance;
            }
        }
        
        // Cache the result
        this.distanceMatrixCache = {
            key: cacheKey,
            matrix: matrix
        };
        
        return matrix;
    }
    
    calculateObstacleAwareDistance(node1, node2) {
        // Check if direct path is blocked by obstacles
        const directDistance = this.euclideanDistance(node1, node2);
        
        if (this.obstacles.length === 0) {
            return directDistance;
        }
        
        // Check if either node is inside an obstacle (invalid)
        if (this.isPointInAnyObstacle(node1) || this.isPointInAnyObstacle(node2)) {
            return Infinity; // Nodes inside obstacles are invalid
        }
        
        // Check if direct path intersects any obstacles
        if (this.isPathBlocked(node1, node2)) {
            // Find shortest path around obstacles using A* or simplified approach
            const pathAroundDistance = this.findPathAroundObstacles(node1, node2);
            return pathAroundDistance;
        }
        
        return directDistance;
    }
    
    isPointInAnyObstacle(point) {
        return this.obstacles.some(obstacle => this.isPointInPolygon(point, obstacle));
    }
    
    isPathBlocked(point1, point2) {
        return this.obstacles.some(obstacle => this.lineIntersectsOrTouchesPolygon(point1, point2, obstacle));
    }
    
    findPathAroundObstacles(node1, node2) {
        // Simplified obstacle avoidance: use visibility graph approach
        // For now, use a penalty-based approach with better pathfinding
        const directDistance = this.euclideanDistance(node1, node2);
        
        // Find the most blocking obstacle and estimate detour
        let maxPenalty = 1.5; // Base penalty
        
        for (const obstacle of this.obstacles) {
            if (this.lineIntersectsOrTouchesPolygon(node1, node2, obstacle)) {
                // Calculate penalty based on how much the obstacle blocks the path
                const obstacleSize = this.getPolygonBoundingBoxSize(obstacle);
                const detourPenalty = 1.2 + (obstacleSize / directDistance) * 0.5;
                maxPenalty = Math.max(maxPenalty, detourPenalty);
            }
        }
        
        return directDistance * Math.min(maxPenalty, 3.0); // Cap at 3x penalty
    }
    
    getPolygonBoundingBoxSize(polygon) {
        if (polygon.length === 0) return 0;
        
        let minX = polygon[0].x, maxX = polygon[0].x;
        let minY = polygon[0].y, maxY = polygon[0].y;
        
        for (let i = 1; i < polygon.length; i++) {
            minX = Math.min(minX, polygon[i].x);
            maxX = Math.max(maxX, polygon[i].x);
            minY = Math.min(minY, polygon[i].y);
            maxY = Math.max(maxY, polygon[i].y);
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        return Math.sqrt(width * width + height * height);
    }
    
    // =============================================================================
    // ENHANCED METRICS CALCULATION
    // =============================================================================
    
    calculatePathOptimalityPercent(algorithmLength, shortestLength) {
        if (shortestLength <= 0) return 100;
        return Math.round((shortestLength / algorithmLength) * 100 * 100) / 100;
    }
    
    calculateComputationSpeed(pathLength, runtime) {
        if (runtime <= 0) return 0;
        return Math.round((pathLength / runtime) * 100) / 100;
    }
    
    calculateImprovementRatePercent(initialLength, finalLength) {
        if (initialLength <= 0) return 0;
        return Math.round(((initialLength - finalLength) / initialLength) * 100 * 100) / 100;
    }
    
    calculatePathSmoothnessTurns(path, nodes) {
        if (path.length < 3) return 0;
        
        let turns = 0;
        const angleThreshold = 10; // Degrees - angles smaller than this are considered straight
        
        // Include the closing segment for tour calculations
        const fullPath = [...path, path[0]];
        
        for (let i = 1; i < fullPath.length - 1; i++) {
            const prevNode = nodes[fullPath[i - 1]];
            const currentNode = nodes[fullPath[i]];
            const nextNode = nodes[fullPath[i + 1]];
            
            if (!prevNode || !currentNode || !nextNode) continue;
            
            const angle = this.calculateAngleBetweenPoints(prevNode, currentNode, nextNode);
            const angleDegrees = Math.abs(angle * 180 / Math.PI);
            
            // Count as turn if angle is significantly different from 0° or 180°
            if (angleDegrees > angleThreshold && angleDegrees < (180 - angleThreshold)) {
                turns++;
            }
        }
        
        return turns;
    }
    
    calculateAngleBetweenPoints(p1, p2, p3) {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        
        const dotProduct = v1.x * v2.x + v1.y * v2.y;
        const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (magnitude1 === 0 || magnitude2 === 0) return 0;
        
        const cosAngle = dotProduct / (magnitude1 * magnitude2);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to [-1, 1] for safety
    }
    
    generateInitialRandomTour(nodes, rng) {
        const tour = Array.from({length: nodes.length}, (_, i) => i);
        this.shuffleArray(tour, rng);
        return tour;
    }
    
    enhanceAlgorithmResults(results, nodes) {
        // Calculate shortest path length for optimality comparison
        const lengths = Object.values(results)
            .filter(r => r.totalLength && !r.error)
            .map(r => r.totalLength);
        
        const shortestLength = Math.min(...lengths);
        
        // Enhance each algorithm's results
        Object.keys(results).forEach(algorithmName => {
            const result = results[algorithmName];
            if (result.error) return;
            
            // Add enhanced metrics
            result.pathOptimalityPercent = this.calculatePathOptimalityPercent(
                result.totalLength, 
                shortestLength
            );
            
            result.computationSpeedPxPerMs = this.calculateComputationSpeed(
                result.totalLength, 
                result.time
            );
            
            result.pathSmoothnessTurns = this.calculatePathSmoothnessTurns(
                result.path, 
                nodes
            );
            
            // Rename for consistency
            result.pathLength = result.totalLength;
            result.runtime = result.time;
        });
        
        return results;
    }
    
    // =============================================================================
    // COORDINATE SYSTEM VALIDATION
    // =============================================================================
    
    validateCoordinates(point) {
        // Ensure coordinates are in valid canvas space
        return {
            x: Math.max(0, Math.min(this.canvas.width, point.x || 0)),
            y: Math.max(0, Math.min(this.canvas.height, point.y || 0))
        };
    }
    
    validatePolygon(polygon) {
        if (!Array.isArray(polygon) || polygon.length < 3) {
            return [];
        }
        
        return polygon.map(point => this.validateCoordinates(point));
    }
    
    // =============================================================================
    // ROBUST GEOMETRIC COLLISION DETECTION
    // =============================================================================
    
    isPointInPolygon(point, polygon) {
        if (polygon.length < 3) return false;
        
        // Validate coordinates are in same coordinate system
        const validatedPoint = this.validateCoordinates(point);
        const validatedPolygon = this.validatePolygon(polygon);
        
        if (validatedPolygon.length < 3) return false;
        
        let inside = false;
        const x = validatedPoint.x, y = validatedPoint.y;
        
        for (let i = 0, j = validatedPolygon.length - 1; i < validatedPolygon.length; j = i++) {
            const xi = validatedPolygon[i].x, yi = validatedPolygon[i].y;
            const xj = validatedPolygon[j].x, yj = validatedPolygon[j].y;
            
            if (((yi > y) !== (yj > y)) && 
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    lineIntersectsOrTouchesPolygon(point1, point2, polygon) {
        if (polygon.length < 3) return false;
        
        // Validate all coordinates
        const validatedP1 = this.validateCoordinates(point1);
        const validatedP2 = this.validateCoordinates(point2);
        const validatedPolygon = this.validatePolygon(polygon);
        
        if (validatedPolygon.length < 3) return false;
        
        // Check if either endpoint is inside the polygon
        if (this.isPointInPolygon(validatedP1, validatedPolygon) || 
            this.isPointInPolygon(validatedP2, validatedPolygon)) {
            return true;
        }
        
        // Check if line segment intersects any edge of the polygon
        for (let i = 0; i < validatedPolygon.length; i++) {
            const j = (i + 1) % validatedPolygon.length;
            const edgeStart = validatedPolygon[i];
            const edgeEnd = validatedPolygon[j];
            
            if (this.robustLineSegmentIntersection(validatedP1, validatedP2, edgeStart, edgeEnd)) {
                return true;
            }
        }
        
        // Check if the entire line segment is inside the polygon
        const midPoint = {
            x: (validatedP1.x + validatedP2.x) / 2,
            y: (validatedP1.y + validatedP2.y) / 2
        };
        
        if (this.isPointInPolygon(midPoint, validatedPolygon)) {
            return true;
        }
        
        return false;
    }
    
    robustLineSegmentIntersection(p1, p2, p3, p4) {
        const epsilon = 1e-10; // Tolerance for floating-point comparisons
        
        // Calculate direction vectors
        const d1 = this.robustDirection(p3, p4, p1);
        const d2 = this.robustDirection(p3, p4, p2);
        const d3 = this.robustDirection(p1, p2, p3);
        const d4 = this.robustDirection(p1, p2, p4);
        
        // Check for proper intersection (segments cross)
        if (((d1 > epsilon && d2 < -epsilon) || (d1 < -epsilon && d2 > epsilon)) && 
            ((d3 > epsilon && d4 < -epsilon) || (d3 < -epsilon && d4 > epsilon))) {
            return true;
        }
        
        // Check for collinear cases (segments touch or overlap)
        if (Math.abs(d1) <= epsilon && this.pointOnSegment(p3, p1, p4)) return true;
        if (Math.abs(d2) <= epsilon && this.pointOnSegment(p3, p2, p4)) return true;
        if (Math.abs(d3) <= epsilon && this.pointOnSegment(p1, p3, p2)) return true;
        if (Math.abs(d4) <= epsilon && this.pointOnSegment(p1, p4, p2)) return true;
        
        return false;
    }
    
    robustDirection(a, b, c) {
        // Use higher precision calculation for orientation test
        const val = (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
        return val;
    }
    
    pointOnSegment(p, q, r) {
        // Check if point q lies on segment pr
        const epsilon = 1e-10;
        
        return (q.x <= Math.max(p.x, r.x) + epsilon && q.x >= Math.min(p.x, r.x) - epsilon &&
                q.y <= Math.max(p.y, r.y) + epsilon && q.y >= Math.min(p.y, r.y) - epsilon);
    }
    
    // =============================================================================
    // LEGACY FUNCTIONS (DEPRECATED BUT KEPT FOR COMPATIBILITY)
    // =============================================================================
    
    euclideanDistance(node1, node2) {
        const dx = node1.x - node2.x;
        const dy = node1.y - node2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    calculateObstacleAwareTourLength(tour, nodes) {
        if (tour.length < 2) return 0;
        
        let totalLength = 0;
        
        for (let i = 0; i < tour.length - 1; i++) {
            totalLength += this.calculateObstacleAwareDistance(nodes[tour[i]], nodes[tour[i + 1]]);
        }
        
        // Close the tour
        if (tour.length > 2) {
            totalLength += this.calculateObstacleAwareDistance(nodes[tour[tour.length - 1]], nodes[tour[0]]);
        }
        
        return totalLength;
    }
    
    // Legacy functions - kept for compatibility but use robust versions internally
    lineIntersectsPolygon(point1, point2, polygon) {
        return this.lineIntersectsOrTouchesPolygon(point1, point2, polygon);
    }
    
    lineSegmentsIntersect(p1, p2, p3, p4) {
        return this.robustLineSegmentIntersection(p1, p2, p3, p4);
    }
    
    direction(a, b, c) {
        return this.robustDirection(a, b, c);
    }
    
    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================
    
    shuffleArray(array, rng) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    clearResults() {
        this.algorithmResults = {};
        this.updateResultsDisplay();
    }
    
    clearAll() {
        this.clearNodes();
        this.clearObstacles();
        this.clearBackground();
        this.clearResults();
        this.render();
    }
    
    // =============================================================================
    // UI MANAGEMENT
    // =============================================================================
    
    updateResultsDisplay() {
        const resultsPanel = document.getElementById('resultsPanel');
        if (!resultsPanel) return;
        
        if (Object.keys(this.algorithmResults).length === 0) {
            resultsPanel.innerHTML = '<p class="no-results">No results yet. Run algorithms to see enhanced metrics comparison.</p>';
            return;
        }
        
        const algorithms = ['tpsma', 'ga', 'christofides'];
        const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d'];
        const names = ['TPSMA', 'Genetic Algorithm', 'Christofides'];
        
        let html = '<div class="results-grid">';
        
        algorithms.forEach((alg, index) => {
            const result = this.algorithmResults[alg];
            if (!result) return;
            
            html += `
                <div class="result-card" style="border-left: 4px solid ${colors[index]}">
                    <h4>${names[index]}</h4>
                    ${result.error ? 
                        `<p class="error">Error: ${result.error}</p>` :
                        `
                        <div class="result-stats">
                            <div class="stat-section">
                                <h5>Path Metrics</h5>
                                <div class="stat">
                                    <label>Path Length:</label>
                                    <span>${(result.totalLength || 0).toFixed(1)} px</span>
                                </div>
                                <div class="stat">
                                    <label>Optimality:</label>
                                    <span>${(result.pathOptimalityPercent !== undefined && result.pathOptimalityPercent !== null) ? result.pathOptimalityPercent.toFixed(1) + '%' : 'N/A'}</span>
                                </div>
                                <div class="stat">
                                    <label>Smoothness (Turns):</label>
                                    <span>${(result.pathSmoothnessTurns !== undefined && result.pathSmoothnessTurns !== null) ? result.pathSmoothnessTurns : 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div class="stat-section">
                                <h5>Performance Metrics</h5>
                                <div class="stat">
                                    <label>Runtime:</label>
                                    <span>${(result.time || 0).toFixed(2)} ms</span>
                                </div>
                                <div class="stat">
                                    <label>Speed:</label>
                                    <span>${(result.computationSpeedPxPerMs !== undefined && result.computationSpeedPxPerMs !== null) ? result.computationSpeedPxPerMs.toFixed(2) + ' px/ms' : 'N/A'}</span>
                                </div>
                                <div class="stat">
                                    <label>Iterations:</label>
                                    <span>${(result.iterationCount !== undefined && result.iterationCount !== null) ? result.iterationCount : 'N/A'}</span>
                                </div>
                                <div class="stat">
                                    <label>Improvement:</label>
                                    <span>${(result.improvementRatePercent !== undefined && result.improvementRatePercent !== null) ? result.improvementRatePercent.toFixed(1) + '%' : 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div class="stat">
                                <label>Path:</label>
                                <span class="path-display">[${result.path.join(' → ')}]</span>
                            </div>
                        </div>
                        `
                    }
                </div>
            `;
        });
        
        html += '</div>';
        resultsPanel.innerHTML = html;
    }
    
    showMessage(message, type = 'info') {
        // Create or update status message
        let statusDiv = document.getElementById('statusMessage');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'statusMessage';
            statusDiv.className = 'status-message';
            document.body.appendChild(statusDiv);
        }
        
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
    
    // =============================================================================
    // IMPORT/EXPORT FUNCTIONS
    // =============================================================================
    
    exportScenario() {
        // Create enhanced export data
        const scenario = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '2.0',
                nodeCount: this.nodes.length,
                obstacleCount: this.obstacles.length,
                hasResults: Object.keys(this.algorithmResults).length > 0
            },
            scenario: {
                nodes: this.nodes,
                obstacles: this.obstacles,
                parameters: this.algorithmParams
            },
            results: this.prepareResultsForExport()
        };
        
        const blob = new Blob([JSON.stringify(scenario, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logistics-enhanced-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showMessage('Enhanced scenario with metrics exported successfully!', 'success');
    }
    
    prepareResultsForExport() {
        if (Object.keys(this.algorithmResults).length === 0) {
            return null;
        }
        
        const exportResults = {};
        
        Object.keys(this.algorithmResults).forEach(algorithmName => {
            const result = this.algorithmResults[algorithmName];
            if (result.error) {
                exportResults[algorithmName] = { error: result.error };
                return;
            }
            
            exportResults[algorithmName] = {
                // Primary metrics
                pathLength: result.pathLength || result.totalLength,
                runtime: result.runtime || result.time,
                path: result.path,
                
                // Enhanced metrics
                pathOptimalityPercent: result.pathOptimalityPercent,
                iterationCount: result.iterationCount,
                computationSpeedPxPerMs: result.computationSpeedPxPerMs,
                improvementRatePercent: result.improvementRatePercent,
                pathSmoothnessTurns: result.pathSmoothnessTurns,
                
                // Algorithm details
                algorithm: result.algorithm,
                details: result.details
            };
        });
        
        return exportResults;
    }
    
    importScenario(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const scenario = JSON.parse(e.target.result);
                
                // Validate scenario structure
                if (!scenario.nodes || !Array.isArray(scenario.nodes)) {
                    throw new Error('Invalid scenario format: missing nodes');
                }
                
                this.nodes = scenario.nodes;
                this.obstacles = scenario.obstacles || [];
                this.algorithmParams = { ...this.algorithmParams, ...scenario.parameters };
                
                this.clearResults();
                this.updateParameterPanels();
                this.render();
                
                this.showMessage('Scenario imported successfully!', 'success');
                
            } catch (error) {
                console.error('Import error:', error);
                this.showMessage(`Import failed: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }
    
    // =============================================================================
    // RENDERING
    // =============================================================================
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background image if loaded
        if (this.backgroundImage) {
            this.ctx.globalAlpha = 0.7;
            this.ctx.drawImage(
                this.backgroundImage, 
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw grid if enabled
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // Draw obstacles
        this.drawObstacles();
        
        // Draw current obstacle being drawn
        if (this.drawingObstacle && this.currentObstacle.length > 0) {
            this.drawCurrentObstacle();
        }
        
        // Draw algorithm paths
        this.drawAlgorithmPaths();
        
        // Draw blocked connections in debug mode
        if (this.showBlockedConnections) {
            this.drawBlockedConnections();
        }
        
        // Draw nodes
        this.drawNodes();
        
        // Update UI counters
        this.updateUICounters();
    }
    
    drawBlockedConnections() {
        // Show all blocked node-to-node connections in red
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        this.ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                if (this.isPathBlocked(this.nodes[i], this.nodes[j])) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
                    this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        // Reset drawing state
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
    }
    
    updateUICounters() {
        // Update node and obstacle counts
        const nodeCountEl = document.getElementById('nodeCount');
        const obstacleCountEl = document.getElementById('obstacleCount');
        
        if (nodeCountEl) nodeCountEl.textContent = this.nodes.length;
        if (obstacleCountEl) obstacleCountEl.textContent = this.obstacles.length;
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 0.5;
        this.ctx.setLineDash([1, 1]);
        
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
    }
    
    drawObstacles() {
        this.obstacles.forEach(obstacle => {
            if (obstacle.length < 3) return;
            
            this.ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
            this.ctx.strokeStyle = '#ff6464';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(obstacle[0].x, obstacle[0].y);
            
            for (let i = 1; i < obstacle.length; i++) {
                this.ctx.lineTo(obstacle[i].x, obstacle[i].y);
            }
            
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        });
    }
    
    drawCurrentObstacle() {
        if (this.currentObstacle.length < 2) return;
        
        this.ctx.strokeStyle = '#ff6464';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentObstacle[0].x, this.currentObstacle[0].y);
        
        for (let i = 1; i < this.currentObstacle.length; i++) {
            this.ctx.lineTo(this.currentObstacle[i].x, this.currentObstacle[i].y);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawObstaclePreview(mouseX, mouseY) {
        if (this.currentObstacle.length === 0) return;
        
        const last = this.currentObstacle[this.currentObstacle.length - 1];
        
        this.ctx.strokeStyle = '#ff6464';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(last.x, last.y);
        this.ctx.lineTo(mouseX, mouseY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawAlgorithmPaths() {
        const algorithms = ['tpsma', 'ga', 'christofides'];
        const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d'];
        const lineWidths = [3, 2, 2];
        
        algorithms.forEach((alg, index) => {
            const result = this.algorithmResults[alg];
            if (result && result.path && result.path.length > 1) {
                this.drawPath(result.path, colors[index], lineWidths[index]);
            }
        });
    }
    
    drawPath(path, color, lineWidth = 2) {
        if (path.length < 2) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Draw segments with different styles for blocked vs unblocked
        for (let i = 0; i < path.length - 1; i++) {
            const from = this.nodes[path[i]];
            const to = this.nodes[path[i + 1]];
            
            if (!from || !to) continue;
            
            // Check if this segment is blocked
            const isBlocked = this.isPathBlocked(from, to);
            
            if (isBlocked) {
                // Draw blocked segments with dashed line
                this.ctx.setLineDash([8, 4]);
                this.ctx.globalAlpha = 0.7;
            } else {
                // Draw clear segments with solid line
                this.ctx.setLineDash([]);
                this.ctx.globalAlpha = 1.0;
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(from.x, from.y);
            this.ctx.lineTo(to.x, to.y);
            this.ctx.stroke();
        }
        
        // Close the tour
        if (path.length > 2) {
            const last = this.nodes[path[path.length - 1]];
            const first = this.nodes[path[0]];
            if (last && first) {
                const isBlocked = this.isPathBlocked(last, first);
                
                if (isBlocked) {
                    this.ctx.setLineDash([8, 4]);
                    this.ctx.globalAlpha = 0.7;
                } else {
                    this.ctx.setLineDash([]);
                    this.ctx.globalAlpha = 1.0;
                }
                
                this.ctx.beginPath();
                this.ctx.moveTo(last.x, last.y);
                this.ctx.lineTo(first.x, first.y);
                this.ctx.stroke();
            }
        }
        
        // Reset drawing state
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
    }
    
    drawNodes() {
        this.nodes.forEach((node, index) => {
            // Node circle
            const isSelected = node === this.selectedNode;
            this.ctx.fillStyle = isSelected ? '#ffeb3b' : '#ffffff';
            this.ctx.strokeStyle = isSelected ? '#ff9800' : '#333';
            this.ctx.lineWidth = isSelected ? 3 : 2;
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Node label
            this.ctx.fillStyle = '#000000';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(index.toString(), node.x, node.y + 4);
        });
    }
}

// =============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// =============================================================================

class SeededRandom {
    constructor(seed = 12345) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

let simulation;

document.addEventListener('DOMContentLoaded', () => {
    simulation = new LogisticsSimulation();
    
    // Setup additional event listeners
    setupFileHandlers();
    setupParameterHandlers();
    setupActionButtons();
});

function setupFileHandlers() {
    // Background image upload
    const bgUpload = document.getElementById('backgroundUpload');
    if (bgUpload) {
        bgUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                simulation.loadBackgroundImage(e.target.files[0]);
            }
        });
    }
    
    // Scenario import
    const importUpload = document.getElementById('importUpload');
    if (importUpload) {
        importUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                simulation.importScenario(e.target.files[0]);
            }
        });
    }
}

function setupParameterHandlers() {
    // Algorithm parameter changes
    document.addEventListener('change', (e) => {
        if (e.target.dataset.param && e.target.dataset.algorithm) {
            const algorithm = e.target.dataset.algorithm;
            const param = e.target.dataset.param;
            let value;
            
            if (e.target.type === 'checkbox') {
                value = e.target.checked;
            } else {
                value = parseFloat(e.target.value) || 0;
            }
            
            simulation.algorithmParams[algorithm][param] = value;
            simulation.clearResults();
        }
    });
}

function setupActionButtons() {
    // Action buttons
    const actions = {
        'runAll': () => simulation.runAllAlgorithms(),
        'clearAll': () => simulation.clearAll(),
        'clearNodes': () => simulation.clearNodes(),
        'clearObstacles': () => simulation.clearObstacles(),
        'clearBackground': () => simulation.clearBackground(),
        'exportScenario': () => simulation.exportScenario(),
        'toggleGrid': () => {
            simulation.showGrid = !simulation.showGrid;
            document.getElementById('toggleGrid').classList.toggle('active', simulation.showGrid);
            simulation.render();
        },
        'toggleSnap': () => {
            simulation.snapToGrid = !simulation.snapToGrid;
            document.getElementById('toggleSnap').classList.toggle('active', simulation.snapToGrid);
        },
        'toggleBlockedConnections': () => {
            simulation.showBlockedConnections = !simulation.showBlockedConnections;
            document.getElementById('toggleBlockedConnections').classList.toggle('active', simulation.showBlockedConnections);
            simulation.render();
        }
    };
    
    Object.entries(actions).forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', action);
        }
    });
}
