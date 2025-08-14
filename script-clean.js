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
    }
    
    updateParameterPanels() {
        // Update algorithm parameter displays
        Object.keys(this.algorithmParams).forEach(alg => {
            const panel = document.getElementById(`${alg}Params`);
            if (panel) {
                const params = this.algorithmParams[alg];
                panel.innerHTML = Object.entries(params)
                    .map(([key, value]) => `
                        <div class="param-row">
                            <label>${key}</label>
                            <input type="number" value="${value}" data-param="${key}" data-algorithm="${alg}">
                        </div>
                    `).join('');
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
        
        this.nodes.push({ x, y, id: this.nodes.length });
        this.clearResults();
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
            this.obstacles.push([...this.currentObstacle]);
            this.currentObstacle = [];
            this.drawingObstacle = false;
            this.clearResults();
            this.render();
        }
    }
    
    clearObstacles() {
        this.obstacles = [];
        this.currentObstacle = [];
        this.drawingObstacle = false;
        this.clearResults();
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
        
        this.algorithmResults = results;
        this.updateResultsDisplay();
        this.render();
        
        this.showMessage('Algorithms completed!', 'success');
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
            
            // Simulate network evolution
            let prevBestLength = Infinity;
            let stagnationCount = 0;
            
            for (let iter = 0; iter < params.iterations; iter++) {
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
                
                if (length < bestLength) {
                    bestLength = length;
                    bestTour = [...tour];
                }
                
                prevBestLength = length;
            }
        }
        
        return {
            path: bestTour,
            totalLength: bestLength,
            algorithm: 'TPSMA',
            details: { 
                seeds: params.seeds, 
                iterations: params.iterations,
                bioinspired: true,
                obstacleAware: true
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
        
        let bestIndividual = null;
        let bestFitness = Infinity;
        let generation = 0;
        let stagnationCount = 0;
        
        while (generation < params.generations && stagnationCount < 50) {
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
            details: { 
                generations: generation,
                population: params.populationSize,
                finalStagnation: stagnationCount,
                obstacleAware: true
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
            details: { 
                mstEdges: mst.length,
                oddVertices: oddVertices.length,
                matchingEdges: matching.length,
                approximationRatio: 1.5,
                obstacleAware: true
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
    // DISTANCE AND PATH CALCULATIONS
    // =============================================================================
    
    computeObstacleAwareDistanceMatrix(nodes) {
        const n = nodes.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const distance = this.calculateObstacleAwareDistance(nodes[i], nodes[j]);
                matrix[i][j] = matrix[j][i] = distance;
            }
        }
        
        return matrix;
    }
    
    calculateObstacleAwareDistance(node1, node2) {
        // Check if direct path intersects any obstacles
        const directDistance = this.euclideanDistance(node1, node2);
        
        if (this.obstacles.length === 0) {
            return directDistance;
        }
        
        // Check for intersection with obstacles
        for (const obstacle of this.obstacles) {
            if (this.lineIntersectsPolygon(node1, node2, obstacle)) {
                // If blocked, find path around obstacle (simplified)
                return directDistance * 1.5; // Penalty for going around
            }
        }
        
        return directDistance;
    }
    
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
    
    lineIntersectsPolygon(point1, point2, polygon) {
        if (polygon.length < 3) return false;
        
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            if (this.lineSegmentsIntersect(point1, point2, polygon[i], polygon[j])) {
                return true;
            }
        }
        
        return false;
    }
    
    lineSegmentsIntersect(p1, p2, p3, p4) {
        const d1 = this.direction(p3, p4, p1);
        const d2 = this.direction(p3, p4, p2);
        const d3 = this.direction(p1, p2, p3);
        const d4 = this.direction(p1, p2, p4);
        
        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && 
               ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    }
    
    direction(a, b, c) {
        return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
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
            resultsPanel.innerHTML = '<p class="no-results">No results yet. Run algorithms to see comparison.</p>';
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
                            <div class="stat">
                                <label>Path Length:</label>
                                <span>${result.totalLength.toFixed(1)} px</span>
                            </div>
                            <div class="stat">
                                <label>Runtime:</label>
                                <span>${result.time.toFixed(2)} ms</span>
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
        const scenario = {
            nodes: this.nodes,
            obstacles: this.obstacles,
            parameters: this.algorithmParams,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(scenario, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logistics-scenario-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showMessage('Scenario exported successfully!', 'success');
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
        
        // Draw nodes
        this.drawNodes();
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
        
        this.ctx.beginPath();
        
        for (let i = 0; i < path.length - 1; i++) {
            const from = this.nodes[path[i]];
            const to = this.nodes[path[i + 1]];
            
            if (!from || !to) continue;
            
            if (i === 0) {
                this.ctx.moveTo(from.x, from.y);
            }
            this.ctx.lineTo(to.x, to.y);
        }
        
        // Close the tour
        if (path.length > 2) {
            const last = this.nodes[path[path.length - 1]];
            const first = this.nodes[path[0]];
            if (last && first) {
                this.ctx.lineTo(first.x, first.y);
            }
        }
        
        this.ctx.stroke();
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
            const value = parseFloat(e.target.value) || 0;
            
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
            simulation.render();
        },
        'toggleSnap': () => {
            simulation.snapToGrid = !simulation.snapToGrid;
        }
    };
    
    Object.entries(actions).forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', action);
        }
    });
}
