let simulationQuality = 0;
let convergenceRate = 0;
let networkMetrics = { connectivity: 0, efficiency: 0, robustness: 0 };
let optimalSpeed = 1.2;
let agentEfficiency = 0;

let obstacles = [];
let mask = null;
let grid = null;
let distCache = new Map();
let drawingPolygon = false;
let currentPolygon = null;

// Context menu state
let contextMenuVisible = false;
let selectedNodeIndex = -1;
let contextMenuElement = null;
let editModalElement = null;
let startNodeIndex = -1;
let goalNodeIndex = -1;
let touchTimer = null;

const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const controlPanel = document.getElementById('editorPanel');
const resizer = document.getElementById('resizer');
const controls = { 
    numAgents: document.getElementById('numAgents'), 
    agentSpeed: document.getElementById('agentSpeed'), 
    sensorDist: document.getElementById('sensorDist'), 
    sensorAngle: document.getElementById('sensorAngle'), 
    turnAngle: document.getElementById('turnAngle'), 
    trailDeposit: document.getElementById('trailDeposit'), 
    decayFactor: document.getElementById('decayFactor'), 
    diffusionFactor: document.getElementById('diffusionFactor'), 
    foodStrength: document.getElementById('foodStrength'), 
    foodAttractionRadius: document.getElementById('foodAttractionRadius'), 
    drawAgents: document.getElementById('drawAgents'), 
    numAgentsValue: document.getElementById('numAgentsValue'), 
    agentSpeedValue: document.getElementById('agentSpeedValue'), 
    sensorDistValue: document.getElementById('sensorDistValue'), 
    sensorAngleValue: document.getElementById('sensorAngleValue'), 
    turnAngleValue: document.getElementById('turnAngleValue'), 
    trailDepositValue: document.getElementById('trailDepositValue'), 
    decayFactorValue: document.getElementById('decayFactorValue'), 
    diffusionFactorValue: document.getElementById('diffusionFactorValue'), 
    foodStrengthValue: document.getElementById('foodStrengthValue'), 
    foodAttractionRadiusValue: document.getElementById('foodAttractionRadiusValue'), 
    showBackground: document.getElementById('showBackground'), 
    importBgButton: document.getElementById('importBgButton'), 
    importBgFile: document.getElementById('importBgFile'), 
    bgOpacitySlider: document.getElementById('bgOpacitySlider'), 
    bgOpacityValue: document.getElementById('bgOpacityValue'),
    solver: document.getElementById('solver') 
};

const runButton = document.getElementById('runButton');
const pauseButton = document.getElementById('pauseButton');
const resetSimButton = document.getElementById('resetSimButton');
const clearAllButton = document.getElementById('clearAllButton');
const saveButton = document.getElementById('saveButton');
const importButton = document.getElementById('importButton');
const importFile = document.getElementById('importFile');
const optimizeButton = document.getElementById('optimizeButton');
const generationCounter = document.getElementById('generationCounter');

let PARAMS = {};
let canvasWidth = 800; 
let canvasHeight = 600;
let agents = []; 
let foodSources = []; 
let trailMap; 
let tempTrailMap;
let gridWidth, gridHeight;
const trailResolution = 4;
let animationFrameId = null; 
let simulationRunning = false; 
let simulationPaused = false; 
let generationCount = 0;
let backgroundImage = null; 
let showBackground = false; 
let backgroundOpacity = 1.0;
let isOptimizedViewActive = false; 
let lastOptimizedPathPoints = null;
let trailHistory = [];
let timelinePosition = 0;
let timelineAnimationId = null;
let isTimelinePlaying = false;
let bgZoom = 1;
let scenarios = {};
let draggingIdx = null, dragOffset = {x:0, y:0};

function resize(e) {
    const newWidth = e.clientX - controlPanel.getBoundingClientRect().left;
    controlPanel.style.width = `${newWidth}px`;
}

resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', () => {
        document.removeEventListener('mousemove', resize);
    });
});

function degreesToRadians(degrees) { 
    return degrees * Math.PI / 180; 
}

function radiansToDegrees(radians) { 
    return radians * 180 / Math.PI; 
}

function distanceSq(p1, p2) { 
    const dx = p1.x - p2.x; 
    const dy = p1.y - p2.y; 
    return dx * dx + dy * dy; 
}

function loadObstacleMask(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = new Uint8Array(img.width * img.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        data[i / 4] = r < 128 ? 1 : 0;
    }
    return { width: img.width, height: img.height, data };
}

function isBlocked(x, y) {
    if (PARAMS.obstacleSource === 'mask' && mask) {
        const mx = Math.floor(x * mask.width / canvasWidth);
        const my = Math.floor(y * mask.height / canvasHeight);
        if (mx >= 0 && mx < mask.width && my >= 0 && my < mask.height) {
            return mask.data[my * mask.width + mx] === 1;
        }
    }
    if (PARAMS.obstacleSource === 'polygons') {
        return obstacles.some(poly => pointInPolygon({x, y}, poly.points));
    }
    return false;
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
            (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
            inside = !inside;
        }
    }
    return inside;
}

function segmentIntersectsObstacles(p1, p2) {
    if (PARAMS.obstacleSource === 'mask' && mask) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        for (let i = 0; i <= steps; i++) {
            const x = p1.x + (dx * i / steps);
            const y = p1.y + (dy * i / steps);
            if (isBlocked(x, y)) return true;
        }
    }
    if (PARAMS.obstacleSource === 'polygons') {
        return obstacles.some(poly => segmentIntersectsPolygon(p1, p2, poly.points));
    }
    return false;
}

function segmentIntersectsPolygon(p1, p2, polygon) {
    for (let i = 0; i < polygon.length; i++) {
        const p3 = polygon[i];
        const p4 = polygon[(i + 1) % polygon.length];
        if (segmentsIntersect(p1, p2, p3, p4)) return true;
    }
    return false;
}

function segmentsIntersect(p1, p2, p3, p4) {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(a, b, c) {
    return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

function buildGrid(maskData, cellSize) {
    const cols = Math.ceil(canvasWidth / cellSize);
    const rows = Math.ceil(canvasHeight / cellSize);
    const blocked = Array(rows).fill().map(() => Array(cols).fill(false));
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * cellSize + cellSize / 2;
            const y = r * cellSize + cellSize / 2;
            blocked[r][c] = isBlocked(x, y);
        }
    }
    
    return { cols, rows, cellSize, blocked };
}

function aStar(grid, start, goal) {
    const startCell = { x: Math.floor(start.x / grid.cellSize), y: Math.floor(start.y / grid.cellSize) };
    const goalCell = { x: Math.floor(goal.x / grid.cellSize), y: Math.floor(goal.y / grid.cellSize) };
    
    const openSet = [{ ...startCell, g: 0, h: Math.abs(startCell.x - goalCell.x) + Math.abs(startCell.y - goalCell.y), f: 0 }];
    const closedSet = new Set();
    const cameFrom = new Map();
    
    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const key = `${current.x},${current.y}`;
        
        if (current.x === goalCell.x && current.y === goalCell.y) {
            const path = [];
            let node = current;
            while (node) {
                path.unshift({ x: node.x * grid.cellSize + grid.cellSize / 2, y: node.y * grid.cellSize + grid.cellSize / 2 });
                node = cameFrom.get(`${node.x},${node.y}`);
            }
            return path;
        }
        
        closedSet.add(key);
        
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
            const neighbor = { x: current.x + dx, y: current.y + dy };
            const nKey = `${neighbor.x},${neighbor.y}`;
            
            if (neighbor.x < 0 || neighbor.x >= grid.cols || neighbor.y < 0 || neighbor.y >= grid.rows) continue;
            if (grid.blocked[neighbor.y][neighbor.x] || closedSet.has(nKey)) continue;
            
            const tentativeG = current.g + Math.sqrt(dx * dx + dy * dy);
            const existingInOpen = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
            
            if (!existingInOpen || tentativeG < existingInOpen.g) {
                const h = Math.abs(neighbor.x - goalCell.x) + Math.abs(neighbor.y - goalCell.y);
                const newNode = { ...neighbor, g: tentativeG, h, f: tentativeG + h };
                
                if (!existingInOpen) {
                    openSet.push(newNode);
                } else {
                    Object.assign(existingInOpen, newNode);
                }
                cameFrom.set(nKey, current);
            }
        }
    }
    
    return [start, goal];
}

// --- Update Parameters from Controls ---
function updateParams() { 
    PARAMS = { 
        numAgents: parseInt(controls.numAgents.value), 
        agentSpeed: parseFloat(controls.agentSpeed.value), 
        sensorDist: parseFloat(controls.sensorDist?.value || 10), 
        sensorAngleRad: degreesToRadians(parseFloat(controls.sensorAngle?.value || 45)), 
        turnAngleRad: degreesToRadians(parseFloat(controls.turnAngle?.value || 30)), 
        trailDeposit: parseFloat(controls.trailDeposit?.value || 1), 
        decayFactor: parseFloat(controls.decayFactor?.value || 0.97), 
        diffusionFactor: parseFloat(controls.diffusionFactor?.value || 0.25), 
        foodStrength: parseFloat(controls.foodStrength?.value || 10), 
        foodAttractionRadius: parseFloat(controls.foodAttractionRadius?.value || 30), 
        drawAgents: controls.drawAgents?.checked || true,
        cellSize: parseFloat(controls.cellSize?.value || 6),
        obstacleSource: controls.obstacleSource?.value || 'mask',
        epsilon: parseFloat(controls.epsilon?.value || 10),
        dt: parseFloat(controls.dt?.value || 0.25),
        delta: parseFloat(controls.delta?.value || 0.001),
        iterations: parseInt(controls.iterations?.value || 250),
        solver: controls.solver?.value || 'BFS'
    };
    
    if (controls.numAgentsValue) controls.numAgentsValue.textContent = PARAMS.numAgents; 
    if (controls.agentSpeedValue) controls.agentSpeedValue.textContent = PARAMS.agentSpeed.toFixed(1); 
    if (controls.sensorDistValue) controls.sensorDistValue.textContent = PARAMS.sensorDist.toFixed(0); 
    if (controls.sensorAngleValue) controls.sensorAngleValue.textContent = controls.sensorAngle?.value || 45; 
    if (controls.turnAngleValue) controls.turnAngleValue.textContent = controls.turnAngle?.value || 30; 
    if (controls.trailDepositValue) controls.trailDepositValue.textContent = PARAMS.trailDeposit.toFixed(1); 
    if (controls.decayFactorValue) controls.decayFactorValue.textContent = PARAMS.decayFactor.toFixed(3); 
    if (controls.diffusionFactorValue) controls.diffusionFactorValue.textContent = PARAMS.diffusionFactor.toFixed(2); 
    if (controls.foodStrengthValue) controls.foodStrengthValue.textContent = PARAMS.foodStrength.toFixed(0); 
    if (controls.foodAttractionRadiusValue) controls.foodAttractionRadiusValue.textContent = PARAMS.foodAttractionRadius.toFixed(0); 
    
    showBackground = controls.showBackground?.checked || false; 
    backgroundOpacity = parseFloat(controls.bgOpacitySlider?.value || 1); 
    if (controls.bgOpacityValue) controls.bgOpacityValue.textContent = backgroundOpacity.toFixed(2);
    
    if (grid && (grid.cellSize !== PARAMS.cellSize)) {
        grid = buildGrid(mask, PARAMS.cellSize);
        distCache.clear();
    }
}

function obstacleAwareDistance(p1, p2) {
    const key = `${p1.x.toFixed(1)},${p1.y.toFixed(1)}-${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    if (distCache.has(key)) return distCache.get(key);
    
    let distance;
    if (segmentIntersectsObstacles(p1, p2)) {
        if (!grid) grid = buildGrid(mask, PARAMS.cellSize);
        const path = aStar(grid, p1, p2);
        distance = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i-1].x;
            const dy = path[i].y - path[i-1].y;
            distance += Math.sqrt(dx * dx + dy * dy);
        }
    } else {
        distance = Math.sqrt(distanceSq(p1, p2));
    }
    
    if (distCache.size > 10000) {
        const keys = Array.from(distCache.keys());
        for (let i = 0; i < 1000; i++) {
            distCache.delete(keys[i]);
        }
    }
    
    distCache.set(key, distance);
    return distance;
}

function updateControlsFromParams() { 
    controls.numAgents.value = PARAMS.numAgents; 
    controls.agentSpeed.value = PARAMS.agentSpeed; 
    controls.sensorDist.value = PARAMS.sensorDist; 
    controls.sensorAngle.value = radiansToDegrees(PARAMS.sensorAngleRad).toFixed(0); 
    controls.turnAngle.value = radiansToDegrees(PARAMS.turnAngleRad).toFixed(0); 
    controls.trailDeposit.value = PARAMS.trailDeposit; 
    controls.decayFactor.value = PARAMS.decayFactor; 
    controls.diffusionFactor.value = PARAMS.diffusionFactor; 
    controls.foodStrength.value = PARAMS.foodStrength; 
    controls.foodAttractionRadius.value = PARAMS.foodAttractionRadius; 
    controls.drawAgents.checked = PARAMS.drawAgents; 
    updateParams(); 
}

// --- Button State Management ---
function updateButtonStates() { 
    runButton.disabled = simulationRunning; 
    pauseButton.disabled = !simulationRunning; 
}

// --- Initialization and Reset ---
function setupCanvas() {
    // Set reasonable default dimensions
    const minWidth = 800;
    const minHeight = 600;
    
    // Get the main content container
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) {
        console.warn('mainContent element not found, using default size');
        canvas.width = minWidth;
        canvas.height = minHeight;
        canvasWidth = minWidth;
        canvasHeight = minHeight;
        console.log(`Canvas set to default: ${minWidth} x ${minHeight}`);
        drawStaticElements();
        return;
    }
    
    // Calculate available space more reliably
    const mainContentRect = mainContent.getBoundingClientRect();
    const controlPanel = document.getElementById('editorPanel');
    const controlPanelWidth = controlPanel ? controlPanel.offsetWidth : 300;
    
    // Use larger default size and better calculation
    const availableWidth = Math.max(minWidth, window.innerWidth - controlPanelWidth - 60);
    const availableHeight = Math.max(minHeight, window.innerHeight - 100);

    const aspectRatio = 4/3; // 800/600 aspect ratio
    
    let newWidth = Math.min(availableWidth, availableHeight * aspectRatio);
    let newHeight = newWidth / aspectRatio;

    // Ensure minimum size is always respected
    if (newWidth < minWidth || newHeight < minHeight) {
        newWidth = minWidth;
        newHeight = minHeight;
    }
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
    canvasWidth = newWidth;
    canvasHeight = newHeight;
    
    console.log(`Canvas set to: ${newWidth} x ${newHeight}`);
    console.log(`Available space: ${availableWidth} x ${availableHeight}`);
    console.log(`Window size: ${window.innerWidth} x ${window.innerHeight}`);

    drawStaticElements(); 
}

function resetSimulationDataState(clearFood = false) { 
    if (animationFrameId) { 
        cancelAnimationFrame(animationFrameId); 
        animationFrameId = null; 
    } 
    simulationRunning = false; 
    simulationPaused = false; 
    isOptimizedViewActive = false; 
    lastOptimizedPathPoints = null; 
    agents = []; 
    generationCount = 0; 
    generationCounter.textContent = `Generation: ${generationCount}`; 
    gridWidth = Math.ceil(canvasWidth / trailResolution); 
    gridHeight = Math.ceil(canvasHeight / trailResolution); 
    trailMap = new Array(gridWidth).fill(0).map(() => new Array(gridHeight).fill(0)); 
    tempTrailMap = new Array(gridWidth).fill(0).map(() => new Array(gridHeight).fill(0)); 
    if (clearFood) { 
        foodSources = []; 
        renderPointsList(); 
    }
    
    // Clear all analysis data
    trailHistory = [];
    timelinePosition = 0;
    simulationQuality = 0;
    convergenceRate = 0;
    networkMetrics = { connectivity: 0, efficiency: 0, robustness: 0 };
    
    // Reset UI elements
    const slider = document.getElementById('generationSlider');
    if (slider) {
        slider.value = 0;
        slider.max = 100;
    }
    const timelineValue = document.getElementById('timelineValue');
    if (timelineValue) {
        timelineValue.textContent = '0';
    }
}

function resetSimulationState(clearFood = false) { 
    console.log(`Resetting simulation state. Clear food: ${clearFood}`); 
    resetSimulationDataState(clearFood); 
    updateButtonStates(); 
    drawStaticElements(); 
}

function handleRunClick() { 
    if (simulationPaused) { 
        console.log("Resuming simulation."); 
        simulationRunning = true; 
        simulationPaused = false; 
        updateButtonStates(); 
        animate(); 
    } else if (!simulationRunning) { 
        console.log("Starting new simulation."); 
        updateParams(); 
        resetSimulationDataState(false); 
        
        // Auto-optimize if we have points but no optimized path
        if (foodSources.length >= 2 && !lastOptimizedPathPoints) {
            lastOptimizedPathPoints = getFoodSourceOrder();
            console.log("Auto-generated optimized path");
        }
        
        isOptimizedViewActive = false; 
        simulationRunning = true; 
        simulationPaused = false; 
        spawnAgents(PARAMS.numAgents); 
        updateButtonStates(); 
        animate(); 
    } 
}

function handlePauseClick() { 
    if (simulationRunning) { 
        console.log("Pausing simulation."); 
        simulationRunning = false; 
        simulationPaused = true; 
        cancelAnimationFrame(animationFrameId); 
        animationFrameId = null; 
        updateButtonStates(); 
    } 
}

function handleResetClick() { 
    console.log("Resetting simulation (keeping food)."); 
    resetSimulationState(false); 
}

function handleClearAllClick() { 
    console.log("Clearing all food and resetting simulation."); 
    resetSimulationDataState(true);
    lastOptimizedPathPoints = null;
    isOptimizedViewActive = false;
    trailHistory = [];
    timelinePosition = 0;
    updateButtonStates();
    drawStaticElements();
}

function spawnAgents(count) { 
    agents = []; 
    for (let i = 0; i < count; i++) { 
        agents.push({ x: Math.random() * canvasWidth, y: Math.random() * canvasHeight, angle: Math.random() * 2 * Math.PI }); 
    } 
    console.log(`Spawned ${agents.length} agents.`); 
}

// --- Save State Logic ---
function handleSaveClick() { 
    console.log("Saving simulation state..."); 
    if (simulationRunning) { 
        handlePauseClick(); 
    } 
    try { 
        const saveData = { timestamp: new Date().toISOString(), foodSources: foodSources, trailMap: trailMap, params: PARAMS, generation: generationCount }; 
        const jsonString = JSON.stringify(saveData, null, 2); 
        const blob = new Blob([jsonString], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); 
        a.download = `slime_simulation_${dateStr}.json`; 
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a); 
        URL.revokeObjectURL(url); 
        console.log("State saved successfully."); 
    } catch (error) { 
        console.error("Error saving state:", error); 
        alert("Error saving simulation state. See console for details."); 
    } 
}

// --- Import State Logic ---
function handleImportFileSelect(event) { 
    if (event.target.files.length === 0) { 
        console.log("No file selected."); 
        return; 
    } 
    const file = event.target.files[0]; 
    console.log(`Attempting to import file: ${file.name}`); 
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        try { 
            const fileContent = e.target.result; 
            const loadedData = JSON.parse(fileContent); 
            if (!loadedData || typeof loadedData !== 'object') { 
                throw new Error("Invalid JSON structure: Root is not an object."); 
            } 
            if (!Array.isArray(loadedData.foodSources)) { 
                throw new Error("Invalid JSON structure: 'foodSources' is missing or not an array."); 
            } 
            if (!Array.isArray(loadedData.trailMap) || !Array.isArray(loadedData.trailMap[0])) { 
                throw new Error("Invalid JSON structure: 'trailMap' is missing or not a 2D array."); 
            } 
            console.log("JSON parsed successfully. Restoring state..."); 
            resetSimulationDataState(true); 
            foodSources = loadedData.foodSources; 
            trailMap = loadedData.trailMap; 
            generationCount = loadedData.generation || 0; 
            PARAMS = loadedData.params || PARAMS; 
            if (trailMap.length !== gridWidth || (trailMap[0] && trailMap[0].length !== gridHeight)) { 
                console.warn("Warning: Imported trailMap dimensions mismatch. Resetting trailMap."); 
                trailMap = new Array(gridWidth).fill(0).map(() => new Array(gridHeight).fill(0)); 
            } 
            updateControlsFromParams(); 
            generationCounter.textContent = `Generation: ${generationCount}`; 
            console.log("State restored from file."); 
            drawStaticElements(); 
        } catch (error) { 
            console.error("Error processing imported file:", error); 
            alert(`Error importing file: ${error.message}\n\nEnsure the file is a valid JSON saved from this simulation.`); 
        } finally { 
            event.target.value = null; 
        } 
    }; 
    reader.onerror = (e) => { 
        console.error("Error reading file:", e); 
        alert("Error reading the selected file."); 
        event.target.value = null; 
    }; 
    reader.readAsText(file); 
}

// --- Import Background Image Logic ---
function handleImportBgFileSelect(event) { 
    if (event.target.files.length === 0) { 
        console.log("No background image file selected."); 
        return; 
    } 
    const file = event.target.files[0]; 
    console.log(`Attempting to import background image: ${file.name}`); 
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        const img = new Image(); 
        img.onload = () => { 
            console.log("Background image loaded successfully."); 
            backgroundImage = img; 
            controls.showBackground.checked = true; 
            showBackground = true; 
            updateParams(); 
            drawStaticElements(); 
        }; 
        img.onerror = () => { 
            console.error("Error loading image data."); 
            alert("Could not load the selected image file."); 
            backgroundImage = null; 
            controls.showBackground.checked = false; 
            showBackground = false; 
            updateParams(); 
            drawStaticElements(); 
        }; 
        img.src = e.target.result; 
    }; 
    reader.onerror = (e) => { 
        console.error("Error reading background file:", e); 
        alert("Error reading the selected background file."); 
    }; 
    reader.readAsDataURL(file); 
    event.target.value = null; 
}

// --- Toggle Background Visibility Logic ---
function handleShowBackgroundToggle() { 
    showBackground = controls.showBackground.checked; 
    console.log(`Show background toggled: ${showBackground}`); 
    drawStaticElements(); 
}

// --- Optimize Path Logic (Single Curve) ---
function handleOptimizeClick() {
    if (simulationRunning) { handlePauseClick(); }
    if (foodSources.length < 2) {
        alert("Need at least two food sources to optimize path.");
        return;
    }
    
    console.log("Optimizing path...");
    lastOptimizedPathPoints = getFoodSourceOrder();
    
    // Add null check to prevent error
    if (!lastOptimizedPathPoints || lastOptimizedPathPoints.length === 0) {
        console.warn("Failed to generate optimized path");
        alert("Failed to generate optimized path. Please try again.");
        return;
    }
    
    console.log("Optimized path created with", lastOptimizedPathPoints.length, "points");
    
    resetSimulationDataState(false);
    isOptimizedViewActive = true;
    drawOptimizedSingleCurve(lastOptimizedPathPoints);
    updateButtonStates();
    runButton.disabled = false;
    pauseButton.disabled = true;
    
    // Calculate and display path length with null check
    let totalLength = 0;
    if (lastOptimizedPathPoints && lastOptimizedPathPoints.length > 1) {
        for (let i = 1; i < lastOptimizedPathPoints.length; i++) {
            const dx = lastOptimizedPathPoints[i].x - lastOptimizedPathPoints[i-1].x;
            const dy = lastOptimizedPathPoints[i].y - lastOptimizedPathPoints[i-1].y;
            totalLength += Math.sqrt(dx*dx + dy*dy);
        }
        console.log("Total path length:", totalLength.toFixed(1), "pixels");
    }
}

// Get food source order (nearest neighbor heuristic)
function getFoodSourceOrder() {
    if (foodSources.length === 0) return [];
    if (foodSources.length === 1) return [foodSources[0]];
    if (foodSources.length === 2) return [...foodSources];
    
    switch (PARAMS.solver) {
        case 'TPSMA': return solveTPSMA();
        case 'GA': return solveGA();
        case 'Christofides': return solveChristofides();
        default: return solveBFS();
    }
}

function solveBFS() {
    const remaining = new Set(foodSources.map((_, index) => index));
    const tour = [];
    let currentIndex = 0;
    tour.push(currentIndex);
    remaining.delete(currentIndex);
    
    while (remaining.size > 0) {
        let nearestIndex = -1;
        let minDist = Infinity;
        const currentPoint = foodSources[currentIndex];
        
        for (const index of remaining) {
            const dist = obstacleAwareDistance(currentPoint, foodSources[index]);
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = index;
            }
        }
        
        if (nearestIndex === -1) break;
        currentIndex = nearestIndex;
        tour.push(currentIndex);
        remaining.delete(currentIndex);
    }
    
    return optimizeWith2Opt(tour.map(index => foodSources[index]));
}

function solveTPSMA() {
    const n = foodSources.length;
    const D = Array(n).fill().map(() => Array(n).fill(1));
    const L = Array(n).fill().map(i => Array(n).fill().map(j => obstacleAwareDistance(foodSources[i], foodSources[j])));
    
    for (let iter = 0; iter < PARAMS.iterations; iter++) {
        const P = solvePressure(D, L);
        const Q = computeFlow(D, P, L);
        
        let maxDelta = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const newD = D[i][j] + ((Math.abs(Q[i][j]) / (1 + Math.abs(Q[i][j]))) - D[i][j]) * PARAMS.dt;
                    maxDelta = Math.max(maxDelta, Math.abs(newD - D[i][j]));
                    D[i][j] = newD;
                }
            }
        }
        
        if (maxDelta < PARAMS.delta) break;
    }
    
    const tour = constructTourFromD(D, L);
    return optimizeWith2Opt(tour);
}

function solvePressure(D, L) {
    const n = D.length;
    const P = Array(n).fill(0);
    const A = Array(n).fill().map(() => Array(n).fill(0));
    const b = Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {
                const conductance = D[i][j] / L[i][j];
                A[i][i] += conductance;
                A[i][j] -= conductance;
            }
        }
    }
    
    A[0][0] = 1;
    for (let j = 1; j < n; j++) A[0][j] = 0;
    b[0] = 0;
    
    return gaussianElimination(A, b);
}

function gaussianElimination(A, b) {
    const n = A.length;
    const x = [...b];
    
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
                maxRow = k;
            }
        }
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        [x[i], x[maxRow]] = [x[maxRow], x[i]];
        
        for (let k = i + 1; k < n; k++) {
            const factor = A[k][i] / A[i][i];
            for (let j = i; j < n; j++) {
                A[k][j] -= factor * A[i][j];
            }
            x[k] -= factor * x[i];
        }
    }
    
    for (let i = n - 1; i >= 0; i--) {
        for (let j = i + 1; j < n; j++) {
            x[i] -= A[i][j] * x[j];
        }
        x[i] /= A[i][i];
    }
    
    return x;
}

function computeFlow(D, P, L) {
    const n = D.length;
    const Q = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {
                Q[i][j] = D[i][j] * (P[i] - P[j]) / L[i][j];
            }
        }
    }
    
    return Q;
}

function constructTourFromD(D, L) {
    const n = D.length;
    const tour = [0];
    const visited = new Set([0]);
    
    for (let step = 0; step < n - 1; step++) {
        const current = tour[tour.length - 1];
        const candidates = [];
        
        for (let j = 0; j < n; j++) {
            if (!visited.has(j)) {
                candidates.push({ node: j, q: Math.abs(D[current][j]), l: L[current][j] });
            }
        }
        
        if (candidates.length === 0) break;
        
        candidates.sort((a, b) => b.q - a.q);
        const best = candidates[0];
        
        if (candidates.length > 1) {
            const second = candidates[1];
            if ((best.l * best.q - second.l * second.q) > PARAMS.epsilon) {
                const next = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].node;
                tour.push(next);
                visited.add(next);
            } else {
                tour.push(best.node);
                visited.add(best.node);
            }
        } else {
            tour.push(best.node);
            visited.add(best.node);
        }
    }
    
    return tour.map(index => foodSources[index]);
}

function optimizeWith2Opt(points) {
    const tour = [...points];
    let improved = true;
    
    while (improved) {
        improved = false;
        for (let i = 1; i < tour.length - 2; i++) {
            for (let j = i + 1; j < tour.length; j++) {
                if (j - i === 1) continue;
                
                const currentDist = obstacleAwareDistance(tour[i-1], tour[i]) + obstacleAwareDistance(tour[j-1], tour[j]);
                const newDist = obstacleAwareDistance(tour[i-1], tour[j-1]) + obstacleAwareDistance(tour[i], tour[j]);
                
                if (newDist < currentDist) {
                    tour.splice(i, j - i, ...tour.slice(i, j).reverse());
                    improved = true;
                }
            }
        }
    }
    
    return tour;
}

function solveGA() {
    return solveBFS();
}

function solveChristofides() {
    return solveBFS();
}

// --- Agent Logic ---
function updateAgents() { 
    for (let i = agents.length - 1; i >= 0; i--) { 
        const agent = agents[i]; 
        const senseData = sense(agent); 
        steer(agent, senseData); 
        move(agent); 
        depositTrail(agent); 
    } 
}

function sense(agent) {
    const angle = agent.angle;
    const sensorCount = 3;
    const sensors = [];
    
    for (let i = 0; i < sensorCount; i++) {
        const sensorAngle = angle + (i - 1) * PARAMS.sensorAngleRad;
        const sensorX = agent.x + Math.cos(sensorAngle) * PARAMS.sensorDist;
        const sensorY = agent.y + Math.sin(sensorAngle) * PARAMS.sensorDist;
        
        let sensorValue = 0;
        
        if (!isBlocked(sensorX, sensorY)) {
            const trailIntensity = getTrailIntensity(sensorX, sensorY);
            const foodAttraction = getFoodAttraction(sensorX, sensorY);
            const pathGuidance = getPathGuidanceWithObstacles(sensorX, sensorY, agent);
            sensorValue = trailIntensity + foodAttraction + pathGuidance;
        } else {
            sensorValue = -50;
        }
        
        sensors.push(sensorValue);
    }
    
    return sensors;
}

function getPathGuidanceWithObstacles(x, y, agent) {
    if (!lastOptimizedPathPoints || lastOptimizedPathPoints.length < 2) return 0;
    
    let minDistToPath = Infinity;
    let pathVisible = false;
    
    for (let i = 0; i < lastOptimizedPathPoints.length - 1; i++) {
        const p1 = lastOptimizedPathPoints[i];
        const p2 = lastOptimizedPathPoints[i + 1];
        
        const A = x - p1.x;
        const B = y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue;
        
        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));
        
        const xx = p1.x + param * C;
        const yy = p1.y + param * D;
        
        const dx = x - xx;
        const dy = y - yy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDistToPath && !segmentIntersectsObstacles({x: agent.x, y: agent.y}, {x: xx, y: yy})) {
            minDistToPath = dist;
            pathVisible = true;
        }
    }
    
    if (pathVisible && minDistToPath < 40) {
        return (40 - minDistToPath) * 8;
    }
    
    return 0;
}

function getPathGuidance(x, y) {
    if (!lastOptimizedPathPoints || lastOptimizedPathPoints.length < 2) return 0;
    
    let minDistToPath = Infinity;
    
    // Find distance to the optimized path
    for (let i = 0; i < lastOptimizedPathPoints.length - 1; i++) {
        const p1 = lastOptimizedPathPoints[i];
        const p2 = lastOptimizedPathPoints[i + 1];
        
        // Calculate distance from point to line segment
        const A = x - p1.x;
        const B = y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue;
        
        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));
        
        const xx = p1.x + param * C;
        const yy = p1.y + param * D;
        
        const dx = x - xx;
        const dy = y - yy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        minDistToPath = Math.min(minDistToPath, dist);
    }
    
    // Stronger attraction to the path
    if (minDistToPath < 30) {
        return (30 - minDistToPath) * 5;
    }
    
    return 0;
}

function steer(agent, senseData) {
    const [left, center, right] = senseData;
    
    // Simple but effective steering
    if (center > left && center > right) {
        // Continue straight
        return;
    } else if (right > left) {
        // Turn right
        agent.angle += PARAMS.turnAngleRad * 0.5;
    } else {
        // Turn left
        agent.angle -= PARAMS.turnAngleRad * 0.5;
    }
    
    // Add some randomness for exploration
    agent.angle += (Math.random() - 0.5) * 0.1;
}

// --- NEW: Obstacle Detection ---
function getObstacleRepulsion(x, y) {
    // Simple boundary repulsion
    const margin = 50;
    let repulsion = 0;
    
    if (x < margin) repulsion += (margin - x) / margin * 50;
    if (x > canvasWidth - margin) repulsion += (x - (canvasWidth - margin)) / margin * 50;
    if (y < margin) repulsion += (margin - y) / margin * 50;
    if (y > canvasHeight - margin) repulsion += (y - (canvasHeight - margin)) / margin * 50;
    
    return repulsion;
}

// --- ENHANCED TRAIL PROCESSING ---
function updateTrailMap() {
    const decay = PARAMS.decayFactor;
    const diffusion = PARAMS.diffusionFactor;
    
    if (diffusion > 0) {
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                tempTrailMap[x][y] = trailMap[x][y];
            }
        }
        
        for (let pass = 0; pass < 2; pass++) {
            for (let x = 1; x < gridWidth - 1; x++) {
                for (let y = 1; y < gridHeight - 1; y++) {
                    let sum = 0;
                    let count = 0;
                    
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            sum += tempTrailMap[x + dx][y + dy];
                            count++;
                        }
                    }
                    
                    const blurred = sum / count;
                    trailMap[x][y] = tempTrailMap[x][y] * (1 - diffusion) + blurred * diffusion;
                }
            }
            
            for (let x = 0; x < gridWidth; x++) {
                for (let y = 0; y < gridHeight; y++) {
                    tempTrailMap[x][y] = trailMap[x][y];
                }
            }
        }
    }
    
    let maxTrail = 0;
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            trailMap[x][y] = Math.max(0, trailMap[x][y] * decay);
            maxTrail = Math.max(maxTrail, trailMap[x][y]);
        }
    }
    
    if (maxTrail > 100) {
        const scale = 100 / maxTrail;
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                trailMap[x][y] *= scale;
            }
        }
    }
}

// --- NEW: Quality Assessment ---
function assessSimulationQuality() {
    // Calculate path efficiency
    let totalTrailValue = 0;
    let activeTrailCells = 0;
    let maxTrailValue = 0;
    
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            const trailValue = trailMap[x][y];
            if (trailValue > 0.1) { // Lower threshold for detecting trails
                totalTrailValue += trailValue;
                activeTrailCells++;
                maxTrailValue = Math.max(maxTrailValue, trailValue);
            }
        }
    }
    
    // Calculate metrics with better scaling
    const totalCells = gridWidth * gridHeight;
    const trailDensity = activeTrailCells / totalCells;
    const avgTrailStrength = activeTrailCells > 0 ? totalTrailValue / activeTrailCells : 0;
    
    // Improved quality calculation
    let qualityScore = 0;
    
    if (activeTrailCells > 0) {
        // Trail coverage component (0-40 points)
        const coverageScore = Math.min(40, trailDensity * 400);
        
        // Trail strength component (0-30 points)
        const strengthScore = Math.min(30, (avgTrailStrength / 10) * 30);
        
        // Path connectivity component (0-30 points)
        let connectivityScore = 0;
        if (lastOptimizedPathPoints && lastOptimizedPathPoints.length > 1) {
            connectivityScore = Math.min(30, (lastOptimizedPathPoints.length / foodSources.length) * 30);
        }
        
        qualityScore = coverageScore + strengthScore + connectivityScore;
    }
    
    simulationQuality = Math.min(100, qualityScore);
    convergenceRate = Math.min(100, (generationCount / 500) * 100);
    
    // Debug logging
    if (generationCount % 100 === 0) {
        console.log(`Quality Assessment - Generation ${generationCount}:`);
        console.log(`  Active trail cells: ${activeTrailCells} / ${totalCells}`);
        console.log(`  Trail density: ${(trailDensity * 100).toFixed(2)}%`);
        console.log(`  Average trail strength: ${avgTrailStrength.toFixed(2)}`);
        console.log(`  Max trail value: ${maxTrailValue.toFixed(2)}`);
        console.log(`  Quality score: ${simulationQuality.toFixed(1)}%`);
    }
    
    // Update UI
    updateQualityIndicators();
}

function updateQualityIndicators() {
    const qualityDot = document.getElementById('qualityDot');
    const qualityText = document.getElementById('qualityText');
    const convergenceProgress = document.getElementById('convergenceProgress');
    const convergenceText = document.getElementById('convergenceText');
    
    // Quality indicator
    if (qualityDot && qualityText) {
        if (simulationQuality > 70) {
            qualityDot.className = 'quality-dot excellent';
            qualityText.textContent = 'Excellent';
        } else if (simulationQuality > 40) {
            qualityDot.className = 'quality-dot good';
            qualityText.textContent = 'Good';
        } else {
            qualityDot.className = 'quality-dot poor';
            qualityText.textContent = 'Poor';
        }
    }
    
    // Convergence progress
    if (convergenceProgress) {
        convergenceProgress.style.width = convergenceRate + '%';
    }
    if (convergenceText) {
        convergenceText.textContent = `Convergence: ${convergenceRate.toFixed(1)}%`;
    }
}

// --- AUTO-OPTIMIZATION ---
const autoOptimizeSpeedBtn = document.getElementById('autoOptimizeSpeed');
if (autoOptimizeSpeedBtn) {
    autoOptimizeSpeedBtn.onclick = () => {
        // Calculate optimal speed based on current conditions
        const agentDensity = agents.length / (canvasWidth * canvasHeight);
        const foodDensity = foodSources.length / (canvasWidth * canvasHeight);
        
        optimalSpeed = Math.max(0.5, Math.min(2.5, 1.0 + foodDensity * 1000 - agentDensity * 100000));
        
        controls.agentSpeed.value = optimalSpeed;
        updateParams();
        
        const speedOptimal = document.getElementById('speedOptimal');
        if (speedOptimal) {
            speedOptimal.textContent = `(Optimal: ${optimalSpeed.toFixed(1)})`;
        }
    };
}

// --- ENHANCED ANALYSIS ---
function calculateNetworkMetrics() {
    if (lastOptimizedPathPoints && lastOptimizedPathPoints.length > 1) {
        // Connectivity: how well points are connected
        let totalDistance = 0;
        let directDistance = 0;
        
        for (let i = 1; i < lastOptimizedPathPoints.length; i++) {
            const dx = lastOptimizedPathPoints[i].x - lastOptimizedPathPoints[i-1].x;
            const dy = lastOptimizedPathPoints[i].y - lastOptimizedPathPoints[i-1].y;
            totalDistance += Math.sqrt(dx*dx + dy*dy);
        }
        
        // Direct distance from first to last point
        const firstPoint = lastOptimizedPathPoints[0];
        const lastPoint = lastOptimizedPathPoints[lastOptimizedPathPoints.length - 1];
        directDistance = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) + 
            Math.pow(lastPoint.y - firstPoint.y, 2)
        );
        
        networkMetrics.efficiency = Math.min(100, (directDistance / totalDistance) * 100);
        networkMetrics.connectivity = Math.min(100, (lastOptimizedPathPoints.length / foodSources.length) * 100);
        networkMetrics.robustness = Math.min(100, simulationQuality);
        
        // Update UI
        const connectivityScore = document.getElementById('connectivityScore');
        const efficiencyScore = document.getElementById('efficiencyScore');
        const robustnessScore = document.getElementById('robustnessScore');
        
        if (connectivityScore) connectivityScore.textContent = networkMetrics.connectivity.toFixed(1) + '%';
        if (efficiencyScore) efficiencyScore.textContent = networkMetrics.efficiency.toFixed(1) + '%';
        if (robustnessScore) robustnessScore.textContent = networkMetrics.robustness.toFixed(1) + '%';
    }
}

// --- EXPORT FUNCTIONALITY ---
const exportAnalysisBtn = document.getElementById('exportAnalysisBtn');
if (exportAnalysisBtn) {
    exportAnalysisBtn.onclick = () => {
        const analysisData = {
            timestamp: new Date().toISOString(),
            simulationQuality,
            convergenceRate,
            networkMetrics,
            foodSources: foodSources.length,
            generations: generationCount,
            parameters: PARAMS
        };
        
        const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network_analysis_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

// --- MODIFIED ANIMATION LOOP ---
function animate() {
    if (!simulationRunning) {
        animationFrameId = null;
        return;
    }
    
    generationCount++;
    generationCounter.textContent = `Generation: ${generationCount}`;
    
    switch (PARAMS.solver) {
        case 'tpsma':
            if (foodSources.length >= 2) {
                const solution = solveTPSMA();
                if (solution && solution.path) {
                    lastOptimizedPathPoints = solution.path;
                }
            }
            break;
            
        case 'astar':
            if (foodSources.length >= 2 && grid) {
                const start = { 
                    x: Math.floor(foodSources[0].x / PARAMS.cellSize), 
                    y: Math.floor(foodSources[0].y / PARAMS.cellSize) 
                };
                const end = { 
                    x: Math.floor(foodSources[1].x / PARAMS.cellSize), 
                    y: Math.floor(foodSources[1].y / PARAMS.cellSize) 
                };
                const solution = aStar(grid, start, end);
                if (solution) {
                    lastOptimizedPathPoints = solution.map(node => ({
                        x: node.x * PARAMS.cellSize + PARAMS.cellSize / 2,
                        y: node.y * PARAMS.cellSize + PARAMS.cellSize / 2
                    }));
                }
            }
            break;
            
        default: // 'slime'
            updateAgents();
            updateTrailMap();
            break;
    }
    
    drawSimulation();
    
    // Quality assessment every 20 generations
    if (generationCount % 20 === 0) {
        assessSimulationQuality();
        calculateNetworkMetrics();
        saveTrailSnapshot();
    }
    
    animationFrameId = requestAnimationFrame(animate);
}

// --- ENHANCED DRAWING WITH BETTER VISUALS ---
function drawSimulation() {
    if (isOptimizedViewActive) return;
    
    clearAndDrawBackground();
    drawObstacles();
    
    switch (PARAMS.solver) {
        case 'tpsma':
        case 'astar':
            if (lastOptimizedPathPoints && lastOptimizedPathPoints.length > 1) {
                drawPathSpline(lastOptimizedPathPoints);
            }
            break;
            
        default: // 'slime'
            drawHeatmap();
            if (controls.drawAgents && controls.drawAgents.checked) {
                drawAgents();
            }
            break;
    }
    
    drawFoodSources();
    
    if (currentPolygon) {
        drawCurrentPolygon();
    }
}

function drawHeatmap() {
    for (let gridX = 0; gridX < gridWidth; gridX++) {
        for (let gridY = 0; gridY < gridHeight; gridY++) {
            const trailValue = trailMap[gridX][gridY];
            if (trailValue > 0.3) {
                const intensity = Math.min(1, trailValue / 30);
                const alpha = Math.min(0.7, intensity);
                
                ctx.fillStyle = `rgba(30, 144, 255, ${alpha})`;
                ctx.fillRect(gridX * trailResolution, gridY * trailResolution, trailResolution, trailResolution);
            }
        }
    }
}

function drawAgents() {
    if (!agents || agents.length === 0) return;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.strokeStyle = 'rgba(200, 200, 200, 1)';
    ctx.lineWidth = 1;
    
    agents.forEach(agent => {
        // Draw agent as a small circle
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw direction indicator
        const dirX = agent.x + Math.cos(agent.angle) * 6;
        const dirY = agent.y + Math.sin(agent.angle) * 6;
        
        ctx.beginPath();
        ctx.moveTo(agent.x, agent.y);
        ctx.lineTo(dirX, dirY);
        ctx.stroke();
    });
}

function drawPathSpline(points, style) {
    if (!points || points.length < 2) return;
    
    const { color = 'rgba(0, 255, 0, 0.8)', width = 4, dashed = false } = style;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    if (dashed) {
        ctx.setLineDash([8, 4]);
    } else {
        ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
    } else {
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            for (let t = 0; t <= 1; t += 0.1) {
                const x = catmullRomSpline(p0.x, p1.x, p2.x, p3.x, t);
                const y = catmullRomSpline(p0.y, p1.y, p2.y, p3.y, t);
                
                if (t === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
}

function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

function drawObstacles() {
    if (PARAMS.obstacleSource === 'polygons') {
        ctx.fillStyle = 'rgba(255, 59, 48, 0.3)';
        ctx.strokeStyle = 'rgba(255, 59, 48, 0.8)';
        ctx.lineWidth = 2;
        
        obstacles.forEach(poly => {
            if (poly.points.length > 2) {
                ctx.beginPath();
                ctx.moveTo(poly.points[0].x, poly.points[0].y);
                for (let i = 1; i < poly.points.length; i++) {
                    ctx.lineTo(poly.points[i].x, poly.points[i].y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        });
    }
    
    if (drawingPolygon && currentPolygon && currentPolygon.points.length > 0) {
        ctx.strokeStyle = 'rgba(255, 59, 48, 1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(currentPolygon.points[0].x, currentPolygon.points[0].y);
        for (let i = 1; i < currentPolygon.points.length; i++) {
            ctx.lineTo(currentPolygon.points[i].x, currentPolygon.points[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// --- User Interaction ---
function addFoodSource(x, y) { 
    if (simulationRunning || simulationPaused) { 
        console.log("Please Reset or Pause the simulation before adding more food."); 
        return; 
    } 
    const minDistSq = 20 * 20; 
    for (const food of foodSources) { 
        const dx = food.x - x; 
        const dy = food.y - y; 
        if (dx*dx + dy*dy < minDistSq) return; 
    } 
    foodSources.push({ x: x, y: y, label: `Point ${foodSources.length + 1}` }); 
    console.log(`Added food source #${foodSources.length} at (${x.toFixed(1)}, ${y.toFixed(1)})`); 
    renderPointsList();
    drawStaticElements(); 
}

function updateAgentCount(value) {
    PARAMS.agentCount = parseInt(value);
    agents.length = 0;
    initializeAgents();
}

function updateCellSize(value) {
    PARAMS.cellSize = parseInt(value);
    if (grid) grid = buildGrid(mask, PARAMS.cellSize);
}

function updateSolver(value) {
    PARAMS.solver = value;
}

function clearObstacles() {
    obstacles.length = 0;
    currentPolygon = null;
    drawingPolygon = false;
    distCache.clear();
    if (grid) grid = buildGrid(mask, PARAMS.cellSize);
    drawStaticElements();
    
    const toggleBtn = document.getElementById('togglePolygonDraw');
    if (toggleBtn) {
        toggleBtn.textContent = 'Draw Polygon';
        toggleBtn.classList.remove('active');
    }
}

function clearSimulation() {
    resetSimulationDataState(true);
    lastOptimizedPathPoints = null;
    isOptimizedViewActive = false;
    updateButtonStates();
    drawStaticElements();
}

function loadScenario(scenario) {
    if (!scenario) return;
    
    clearSimulation();
    clearObstacles();
    
    const scenarioData = {
        lab_small: {
            foodSources: [
                { x: 100, y: 100 },
                { x: 700, y: 500 }
            ],
            obstacles: [
                { id: 1, points: [
                    { x: 300, y: 200 },
                    { x: 500, y: 200 },
                    { x: 500, y: 400 },
                    { x: 300, y: 400 }
                ]}
            ]
        },
        lab_medium: {
            foodSources: [
                { x: 50, y: 50 },
                { x: 750, y: 50 },
                { x: 400, y: 550 }
            ],
            obstacles: [
                { id: 1, points: [
                    { x: 200, y: 150 },
                    { x: 600, y: 150 },
                    { x: 600, y: 250 },
                    { x: 200, y: 250 }
                ]},
                { id: 2, points: [
                    { x: 350, y: 300 },
                    { x: 450, y: 300 },
                    { x: 450, y: 450 },
                    { x: 350, y: 450 }
                ]}
            ]
        },
        lab_complex: {
            foodSources: [
                { x: 50, y: 50 },
                { x: 750, y: 50 },
                { x: 50, y: 550 },
                { x: 750, y: 550 },
                { x: 400, y: 300 }
            ],
            obstacles: [
                { id: 1, points: [
                    { x: 150, y: 150 },
                    { x: 300, y: 150 },
                    { x: 300, y: 200 },
                    { x: 150, y: 200 }
                ]},
                { id: 2, points: [
                    { x: 500, y: 150 },
                    { x: 650, y: 150 },
                    { x: 650, y: 200 },
                    { x: 500, y: 200 }
                ]},
                { id: 3, points: [
                    { x: 150, y: 400 },
                    { x: 300, y: 400 },
                    { x: 300, y: 450 },
                    { x: 150, y: 450 }
                ]},
                { id: 4, points: [
                    { x: 500, y: 400 },
                    { x: 650, y: 400 },
                    { x: 650, y: 450 },
                    { x: 500, y: 450 }
                ]},
                { id: 5, points: [
                    { x: 350, y: 250 },
                    { x: 450, y: 250 },
                    { x: 450, y: 350 },
                    { x: 350, y: 350 }
                ]}
            ]
        }
    };
    
    const data = scenarioData[scenario];
    if (data) {
        foodSources.length = 0;
        data.foodSources.forEach(food => addFoodSource(food.x, food.y));
        
        obstacles.length = 0;
        obstacles.push(...data.obstacles);
        
        distCache.clear();
        if (grid) grid = buildGrid(mask, PARAMS.cellSize);
        
        drawStaticElements();
    }
}

function exportData() {
    const data = {
        params: PARAMS,
        foodSources: foodSources,
        obstacles: obstacles,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportImage() {
    const link = document.createElement('a');
    link.download = `simulation_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

canvas.addEventListener('click', (event) => { 
    if (contextMenuVisible) {
        hideContextMenu();
        return;
    }
    
    const rect = canvas.getBoundingClientRect(); 
    const scaleX = canvas.width / rect.width; 
    const scaleY = canvas.height / rect.height; 
    const x = (event.clientX - rect.left) * scaleX; 
    const y = (event.clientY - rect.top) * scaleY; 
    
    if (x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight) {
        if (drawingPolygon) {
            if (!currentPolygon) {
                currentPolygon = { id: Date.now(), points: [] };
            }
            currentPolygon.points.push({ x, y });
            drawStaticElements();
        } else {
            addFoodSource(x, y);
        }
    } 
});

canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    
    // Check if right-click is on a food source (node)
    const nodeIndex = findNodeAtPosition(canvasX, canvasY);
    if (nodeIndex !== -1) {
        selectedNodeIndex = nodeIndex;
        showContextMenu(event.clientX, event.clientY);
    } else {
        hideContextMenu();
    }
});

// Touch events for mobile support
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (touch.clientX - rect.left) * scaleX;
        const canvasY = (touch.clientY - rect.top) * scaleY;
        
        const nodeIndex = findNodeAtPosition(canvasX, canvasY);
        if (nodeIndex !== -1) {
            touchTimer = setTimeout(() => {
                selectedNodeIndex = nodeIndex;
                showContextMenu(touch.clientX, touch.clientY);
            }, 500); // 500ms long press
        }
    }
});

canvas.addEventListener('touchend', (event) => {
    if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
    }
});

canvas.addEventListener('touchmove', (event) => {
    if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
    }
});

canvas.addEventListener('dblclick', (event) => {
    if (drawingPolygon && currentPolygon && currentPolygon.points.length > 2) {
        obstacles.push(currentPolygon);
        currentPolygon = null;
        drawingPolygon = false;
        distCache.clear();
        if (grid) grid = buildGrid(mask, PARAMS.cellSize);
        drawStaticElements();
        
        const toggleBtn = document.getElementById('togglePolygonDraw');
        if (toggleBtn) {
            toggleBtn.textContent = 'Draw Polygon';
            toggleBtn.classList.remove('active');
        }
    }
});

function togglePolygonDrawing() {
    drawingPolygon = !drawingPolygon;
    currentPolygon = null;
    
    const toggleBtn = document.getElementById('togglePolygonDraw');
    if (toggleBtn) {
        toggleBtn.textContent = drawingPolygon ? 'Stop Drawing' : 'Draw Polygon';
        toggleBtn.classList.toggle('active', drawingPolygon);
    }
}

// Context Menu Functions
function findNodeAtPosition(x, y) {
    const threshold = 15; // 15 pixel radius for detection
    for (let i = 0; i < foodSources.length; i++) {
        const node = foodSources[i];
        const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
        if (distance <= threshold) {
            return i;
        }
    }
    return -1;
}

function showContextMenu(clientX, clientY) {
    hideContextMenu(); // Hide any existing menu
    
    contextMenuElement = document.getElementById('nodeContextMenu');
    if (!contextMenuElement) return;
    
    contextMenuVisible = true;
    contextMenuElement.style.display = 'block';
    
    // Position the menu near the cursor
    const menuRect = contextMenuElement.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = clientX;
    let top = clientY;
    
    // Adjust position to keep menu in viewport
    if (left + menuRect.width > windowWidth) {
        left = clientX - menuRect.width;
    }
    if (top + menuRect.height > windowHeight) {
        top = clientY - menuRect.height;
    }
    
    contextMenuElement.style.left = left + 'px';
    contextMenuElement.style.top = top + 'px';
}

function hideContextMenu() {
    if (contextMenuElement) {
        contextMenuElement.style.display = 'none';
    }
    contextMenuVisible = false;
    selectedNodeIndex = -1;
}

function showEditNodeModal() {
    if (selectedNodeIndex === -1 || selectedNodeIndex >= foodSources.length) return;
    
    const node = foodSources[selectedNodeIndex];
    editModalElement = document.getElementById('editNodeModal');
    
    if (!editModalElement) return;
    
    // Populate form with current node data
    document.getElementById('nodeLabel').value = node.label || '';
    document.getElementById('nodeX').value = node.x.toFixed(1);
    document.getElementById('nodeY').value = node.y.toFixed(1);
    
    editModalElement.style.display = 'flex';
}

function hideEditNodeModal() {
    if (editModalElement) {
        editModalElement.style.display = 'none';
    }
}

function saveNodeEdit() {
    if (selectedNodeIndex === -1 || selectedNodeIndex >= foodSources.length) return;
    
    const label = document.getElementById('nodeLabel').value.trim();
    const x = parseFloat(document.getElementById('nodeX').value);
    const y = parseFloat(document.getElementById('nodeY').value);
    
    // Validate coordinates
    if (isNaN(x) || isNaN(y) || x < 0 || x > canvasWidth || y < 0 || y > canvasHeight) {
        alert('Invalid coordinates. Please enter values within the canvas bounds.');
        return;
    }
    
    // Update the node
    foodSources[selectedNodeIndex].label = label || `Point ${selectedNodeIndex + 1}`;
    foodSources[selectedNodeIndex].x = x;
    foodSources[selectedNodeIndex].y = y;
    
    // Update UI and redraw
    renderPointsList();
    drawStaticElements();
    hideEditNodeModal();
    hideContextMenu();
}

function deleteSelectedNode() {
    if (selectedNodeIndex === -1 || selectedNodeIndex >= foodSources.length) return;
    
    // Adjust start/goal indices if they're affected by the deletion
    if (startNodeIndex === selectedNodeIndex) {
        startNodeIndex = -1;
    } else if (startNodeIndex > selectedNodeIndex) {
        startNodeIndex--;
    }
    
    if (goalNodeIndex === selectedNodeIndex) {
        goalNodeIndex = -1;
    } else if (goalNodeIndex > selectedNodeIndex) {
        goalNodeIndex--;
    }
    
    // Remove the node
    foodSources.splice(selectedNodeIndex, 1);
    
    // Update UI and redraw
    renderPointsList();
    drawStaticElements();
    hideContextMenu();
}

function setAsStart() {
    if (selectedNodeIndex === -1 || selectedNodeIndex >= foodSources.length) return;
    
    startNodeIndex = selectedNodeIndex;
    hideContextMenu();
    drawStaticElements();
    console.log(`Node ${selectedNodeIndex} set as start point`);
}

function setAsGoal() {
    if (selectedNodeIndex === -1 || selectedNodeIndex >= foodSources.length) return;
    
    goalNodeIndex = selectedNodeIndex;
    hideContextMenu();
    drawStaticElements();
    console.log(`Node ${selectedNodeIndex} set as goal point`);
}

// --- Control Panel Event Listeners ---
Object.keys(controls).forEach(key => { 
    const element = controls[key]; 
    if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT')) { 
        element.addEventListener('input', updateParams); 
    } 
});

runButton.addEventListener('click', handleRunClick);
pauseButton.addEventListener('click', handlePauseClick);
resetSimButton.addEventListener('click', handleResetClick);
clearAllButton.addEventListener('click', handleClearAllClick);
saveButton.addEventListener('click', handleSaveClick);
importButton.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', handleImportFileSelect);
optimizeButton.addEventListener('click', handleOptimizeClick);
controls.importBgButton.addEventListener('click', () => controls.importBgFile.click());
controls.importBgFile.addEventListener('change', handleImportBgFileSelect);
controls.showBackground.addEventListener('change', handleShowBackgroundToggle);
controls.bgOpacitySlider.addEventListener('input', () => { updateParams(); drawStaticElements(); });

// Polygon Drawing Event Listener
const togglePolygonBtn = document.getElementById('togglePolygonDraw');
if (togglePolygonBtn) {
    togglePolygonBtn.addEventListener('click', togglePolygonDrawing);
}

// Solver Selection Event Listener
if (controls.solver) {
    controls.solver.addEventListener('change', () => {
        updateParams();
        console.log(`Algorithm changed to: ${PARAMS.solver}`);
    });
}

// Context Menu Event Listeners
document.addEventListener('click', (event) => {
    if (contextMenuVisible && !event.target.closest('#nodeContextMenu')) {
        hideContextMenu();
    }
    if (editModalElement && editModalElement.style.display === 'flex' && !event.target.closest('.modal-content')) {
        hideEditNodeModal();
    }
});

// --- Panel Tabs Logic ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(tc => tc.style.display = 'none');
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'block';
}));
// Set default tab
document.querySelector('.tab-btn.active').click();

// Initialize context menu elements after DOM is ready
function initializeContextMenu() {
    contextMenuElement = document.getElementById('nodeContextMenu');
    editModalElement = document.getElementById('editNodeModal');
    
    // Context menu item clicks
    if (contextMenuElement) {
        contextMenuElement.addEventListener('click', (event) => {
            const action = event.target.closest('.context-menu-item')?.dataset.action;
            if (!action) return;
            
            switch (action) {
                case 'edit':
                    showEditNodeModal();
                    break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this node?')) {
                        deleteSelectedNode();
                    } else {
                        hideContextMenu();
                    }
                    break;
                case 'setStart':
                    setAsStart();
                    break;
                case 'setGoal':
                    setAsGoal();
                    break;
            }
        });
    }
    
    // Modal button event listeners
    const saveBtn = document.getElementById('saveNodeBtn');
    const cancelBtn = document.getElementById('cancelNodeBtn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveNodeEdit);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideEditNodeModal();
            hideContextMenu();
        });
    }
    
    // Allow Enter key to save in modal
    const nodeInputs = ['nodeLabel', 'nodeX', 'nodeY'];
    nodeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    saveNodeEdit();
                }
            });
        }
    });
}

// Call initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContextMenu);
} else {
    initializeContextMenu();
}

// --- Points Editor ---
function renderPointsList() {
    const ul = document.getElementById('pointsList');
    ul.innerHTML = '';
    foodSources.forEach((pt, idx) => {
        let statusBadge = '';
        if (idx === startNodeIndex) {
            statusBadge = '<span class="node-status start">START</span>';
        } else if (idx === goalNodeIndex) {
            statusBadge = '<span class="node-status goal">GOAL</span>';
        }
        
        const li = document.createElement('li');
        li.innerHTML = `
            ${statusBadge}
            <input class="point-label-input" type="text" value="${pt.label || ''}" placeholder="Name" data-idx="${idx}">
            <input class="point-coord-input" type="number" value="${pt.x.toFixed(0)}" data-idx="${idx}" data-coord="x">
            <input class="point-coord-input" type="number" value="${pt.y.toFixed(0)}" data-idx="${idx}" data-coord="y">
            <button class="delete-point-btn" data-idx="${idx}">&times;</button>
        `;
        ul.appendChild(li);
    });
}

const addPointBtn = document.getElementById('addPointBtn');
if (addPointBtn) {
    addPointBtn.onclick = () => {
        const randomX = Math.random() * canvasWidth;
        const randomY = Math.random() * canvasHeight;
        foodSources.push({ x: randomX, y: randomY, label: `Point ${foodSources.length + 1}` });
        renderPointsList();
        drawStaticElements();
    };
}

document.getElementById('pointsList').addEventListener('input', e => {
    const idx = +e.target.dataset.idx;
    if (e.target.classList.contains('point-label-input')) {
        foodSources[idx].label = e.target.value;
    } else if (e.target.classList.contains('point-coord-input')) {
        const coord = e.target.dataset.coord;
        foodSources[idx][coord] = parseFloat(e.target.value);
    }
    drawStaticElements();
});

document.getElementById('pointsList').addEventListener('click', e => {
    if (e.target.classList.contains('delete-point-btn')) {
        const idx = +e.target.dataset.idx;
        foodSources.splice(idx, 1);
        renderPointsList();
        drawStaticElements();
    }
});

// --- Tooltip & Drag for Food Sources ---
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    let found = false;
    foodSources.forEach((pt, idx) => {
        if ((pt.x-x)**2 + (pt.y-y)**2 < 64) {
            canvas.title = pt.label ? pt.label : `Point ${idx+1}`;
            found = true;
        }
    });
    if (!found) canvas.title = '';
    // Dragging
    if (draggingIdx !== null) {
        foodSources[draggingIdx].x = x - dragOffset.x;
        foodSources[draggingIdx].y = y - dragOffset.y;
        renderPointsList();
        drawStaticElements();
    }
});

canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    foodSources.forEach((pt, idx) => {
        if ((pt.x-x)**2 + (pt.y-y)**2 < 64) {
            draggingIdx = idx;
            dragOffset.x = x - pt.x;
            dragOffset.y = y - pt.y;
        }
    });
});

canvas.addEventListener('mouseup', () => { draggingIdx = null; });
canvas.addEventListener('mouseleave', () => { draggingIdx = null; });
// --- Analysis ---
let offscreenCanvas, offscreenCtx;
if (typeof OffscreenCanvas !== 'undefined') {
    offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    offscreenCtx = offscreenCanvas.getContext('2d');
} else {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    offscreenCtx = offscreenCanvas.getContext('2d');
}

let lastAnalysisTime = 0;
const analysisInterval = 1000;

function analyzeNetwork() {
    let length = 0, avg = 0, efficiency = 0;
    if (lastOptimizedPathPoints && lastOptimizedPathPoints.length > 1) {
        for (let i=1; i<lastOptimizedPathPoints.length; ++i) {
            const dx = lastOptimizedPathPoints[i].x - lastOptimizedPathPoints[i-1].x;
            const dy = lastOptimizedPathPoints[i].y - lastOptimizedPathPoints[i-1].y;
            length += Math.sqrt(dx*dx + dy*dy);
        }
        avg = length/(lastOptimizedPathPoints.length-1);
        
        // Calculate efficiency (shorter is better)
        const directDistance = Math.sqrt(
            Math.pow(lastOptimizedPathPoints[lastOptimizedPathPoints.length-1].x - lastOptimizedPathPoints[0].x, 2) +
            Math.pow(lastOptimizedPathPoints[lastOptimizedPathPoints.length-1].y - lastOptimizedPathPoints[0].y, 2)
        );
        efficiency = directDistance / length;
    }
    
    const analysisElement = document.getElementById('analysisStats');
    if (analysisElement) {
        analysisElement.innerHTML =
            `Path length: ${length.toFixed(1)} px<br>
            Number of points: ${foodSources.length}<br>
            Average distance: ${avg.toFixed(1)} px<br>
            Generation: ${generationCount}`;
    }
        
    const efficiencyElement = document.getElementById('efficiencyStats');
    if (efficiencyElement) {
        efficiencyElement.innerHTML =
            `Efficiency ratio: ${(efficiency * 100).toFixed(1)}%<br>
            Trail snapshots: ${trailHistory.length}<br>
            Active agents: ${agents.length}`;
    }
}

// --- NEW: Save Trail Snapshot for Timeline ---
function saveTrailSnapshot() {
    if (trailHistory.length > 1000) {
        trailHistory.shift(); // Keep only last 1000 snapshots
    }
    trailHistory.push({
        generation: generationCount,
        trails: JSON.parse(JSON.stringify(trailMap)),
        agentCount: agents.length
    });
    
    // Update slider max
    const slider = document.getElementById('generationSlider');
    slider.max = Math.max(generationCount, 100);
}

const generationSlider = document.getElementById('generationSlider');
if (generationSlider) {
    generationSlider.addEventListener('input', (e) => {
        timelinePosition = parseInt(e.target.value);
        const timelineValue = document.getElementById('timelineValue');
        if (timelineValue) {
            timelineValue.textContent = timelinePosition;
        }
        
        // Find closest snapshot
        const snapshot = trailHistory.find(s => s.generation >= timelinePosition) || trailHistory[trailHistory.length - 1];
        if (snapshot && !simulationRunning) {
            // Temporarily display this snapshot
            trailMap = JSON.parse(JSON.stringify(snapshot.trails));
            drawSimulation();
        }
    });
}

const playTimelineBtn = document.getElementById('playTimelineBtn');
if (playTimelineBtn) {
    playTimelineBtn.onclick = () => {
        if (isTimelinePlaying) return;
        isTimelinePlaying = true;
        playTimeline();
    };
}

const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
if (pauseTimelineBtn) {
    pauseTimelineBtn.onclick = () => {
        isTimelinePlaying = false;
        if (timelineAnimationId) {
            clearTimeout(timelineAnimationId);
            timelineAnimationId = null;
        }
    };
}

const resetTimelineBtn = document.getElementById('resetTimelineBtn');
if (resetTimelineBtn) {
    resetTimelineBtn.onclick = () => {
        isTimelinePlaying = false;
        timelinePosition = 0;
        const generationSlider = document.getElementById('generationSlider');
        if (generationSlider) {
            generationSlider.value = 0;
        }
        const timelineValue = document.getElementById('timelineValue');
        if (timelineValue) {
            timelineValue.textContent = '0';
        }
        if (timelineAnimationId) {
            clearTimeout(timelineAnimationId);
            timelineAnimationId = null;
        }
    };
}

function playTimeline() {
    if (!isTimelinePlaying || timelinePosition >= trailHistory.length - 1) {
        isTimelinePlaying = false;
        return;
    }
    
    timelinePosition += 1;
    const generationSlider = document.getElementById('generationSlider');
    const timelineValue = document.getElementById('timelineValue');
    
    if (generationSlider) {
        generationSlider.value = trailHistory[timelinePosition]?.generation || timelinePosition;
    }
    if (timelineValue) {
        timelineValue.textContent = trailHistory[timelinePosition]?.generation || timelinePosition;
    }
    
    if (trailHistory[timelinePosition]) {
        trailMap = JSON.parse(JSON.stringify(trailHistory[timelinePosition].trails));
        drawSimulation();
    }
    
    timelineAnimationId = setTimeout(playTimeline, 100);
}

// --- Scenarios (FIXED loading) ---
function updateScenarioDropdown() {
    const dd = document.getElementById('scenarioDropdown');
    if (!dd) {
        console.warn('scenarioDropdown element not found');
        return;
    }
    dd.innerHTML = '<option value="">Select scenario...</option>';
    Object.keys(scenarios).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        dd.appendChild(opt);
    });
}

const saveScenarioBtn = document.getElementById('saveScenarioBtn');
if (saveScenarioBtn) {
    saveScenarioBtn.onclick = () => {
        const name = prompt('Scenario name?');
        if (!name) return;
        scenarios[name] = {
            foodSources: JSON.parse(JSON.stringify(foodSources)),
            params: {...PARAMS}
        };
        updateScenarioDropdown();
        localStorage.setItem('slime_scenarios', JSON.stringify(scenarios));
    };
}

const loadScenarioBtn = document.getElementById('loadScenarioBtn');
if (loadScenarioBtn) {
    loadScenarioBtn.onclick = () => {
        const name = document.getElementById('scenarioDropdown').value;
        if (!scenarios[name]) {
            alert('Please select a scenario first');
            return;
        }
        foodSources = JSON.parse(JSON.stringify(scenarios[name].foodSources));
        PARAMS = {...scenarios[name].params};
        updateControlsFromParams();
        renderPointsList();
        drawStaticElements();
    };
}

// --- Preset Maps (FIXED) ---
const presetMaps = {
    tokyo: {
        points: [{x:100,y:100,label:"Shinjuku"},{x:300,y:200,label:"Ueno"},{x:500,y:400,label:"Shibuya"}],
        background: './background/Tokyo.png'
    },
    zagreb: {
        points: [{x:150,y:150,label:"Trg"},{x:350,y:350,label:"Jarun"},{x:250,y:400,label:"Maksimir"}],
        background: './background/Zagreb.png'
    }
};

// Helper function to load background image
function loadBackgroundImage(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`Background image loaded successfully: ${imagePath}`);
            backgroundImage = img;
            controls.showBackground.checked = true;
            showBackground = true;
            updateParams();
            resolve(img);
        };
        img.onerror = () => {
            console.warn(`Could not load background image: ${imagePath}`);
            backgroundImage = null;
            controls.showBackground.checked = false;
            showBackground = false;
            updateParams();
            reject(new Error(`Failed to load ${imagePath}`));
        };
        img.src = imagePath;
    });
}

document.querySelectorAll('.map-btn').forEach(btn => {
    btn.onclick = async () => {
        const mapKey = btn.dataset.map;
        const mapData = presetMaps[mapKey];
        
        if (mapData) {
            // Adjust coordinates to current canvas size
            const scaleX = canvasWidth / 600;
            const scaleY = canvasHeight / 500;
            
            // Load points
            foodSources = mapData.points.map(point => ({
                x: point.x * scaleX,
                y: point.y * scaleY,
                label: point.label
            }));
            
            // Load background image if available
            if (mapData.background) {
                try {
                    await loadBackgroundImage(mapData.background);
                    console.log(`Loaded preset: ${mapKey} with background`);
                } catch (error) {
                    console.warn(`Loaded preset: ${mapKey} without background (${error.message})`);
                }
            } else {
                // Clear background if no background specified
                backgroundImage = null;
                controls.showBackground.checked = false;
                showBackground = false;
                updateParams();
            }
            
            renderPointsList();
            drawStaticElements();
            
            // Clear any existing optimized path since we have new points
            lastOptimizedPathPoints = null;
            isOptimizedViewActive = false;
        }
    };
});

// --- Load scenario from localStorage ---
function loadSavedScenarios() {
    const saved = localStorage.getItem('slime_scenarios');
    if (saved) {
        try {
            scenarios = JSON.parse(saved);
            updateScenarioDropdown();
        } catch (e) {
            console.warn('Could not load saved scenarios:', e);
        }
    }
}

// --- DOMContentLoaded modifications ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        updateParams(); 
        setupCanvas();
        resetSimulationState(true);
        renderPointsList();
        updateScenarioDropdown();
        loadSavedScenarios();
        analyzeNetwork();
        addAlgorithmInfoButton(); // Add the algorithm info button
        
        assessSimulationQuality();
        updateQualityIndicators();
        
        console.log("Simulation ready. Add food sources, import state/background, or press Run.");
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

// Add missing utility functions after the existing utility functions
function getTrailIntensity(x, y) {
    const gridX = Math.floor(x / trailResolution);
    const gridY = Math.floor(y / trailResolution);
    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        return trailMap[gridX][gridY];
    }
    return 0;
}

function getFoodAttraction(x, y) {
    let attraction = 0;
    for (const food of foodSources) {
        const distSq = distanceSq({x, y}, food);
        if (distSq < PARAMS.foodAttractionRadius * PARAMS.foodAttractionRadius) {
            const dist = Math.sqrt(distSq);
            attraction += PARAMS.foodStrength * (1 - dist / PARAMS.foodAttractionRadius);
        }
    }
    return attraction;
}

function move(agent) {
    agent.x += Math.cos(agent.angle) * PARAMS.agentSpeed;
    agent.y += Math.sin(agent.angle) * PARAMS.agentSpeed;
    
    // Wrap around boundaries
    if (agent.x < 0) agent.x = canvasWidth;
    if (agent.x > canvasWidth) agent.x = 0;
    if (agent.y < 0) agent.y = canvasHeight;
    if (agent.y > canvasHeight) agent.y = 0;
}

function depositTrail(agent) {
    const gridX = Math.floor(agent.x / trailResolution);
    const gridY = Math.floor(agent.y / trailResolution);
    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        trailMap[gridX][gridY] += PARAMS.trailDeposit;
    }
}

function clearAndDrawBackground() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    if (showBackground && backgroundImage) {
        ctx.globalAlpha = backgroundOpacity;
        const scale = Math.min(canvasWidth / backgroundImage.width, canvasHeight / backgroundImage.height) * bgZoom;
        const x = (canvasWidth - backgroundImage.width * scale) / 2;
        const y = (canvasHeight - backgroundImage.height * scale) / 2;
        ctx.drawImage(backgroundImage, x, y, backgroundImage.width * scale, backgroundImage.height * scale);
        ctx.globalAlpha = 1.0;
    }
}

function drawCurrentPolygon() {
    if (!currentPolygon || !currentPolygon.points || currentPolygon.points.length === 0) return;
    
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(currentPolygon.points[0].x, currentPolygon.points[0].y);
    
    for (let i = 1; i < currentPolygon.points.length; i++) {
        ctx.lineTo(currentPolygon.points[i].x, currentPolygon.points[i].y);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw points
    ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
    for (const point of currentPolygon.points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawOptimizedSingleCurve(pathPoints) {
    if (!pathPoints || pathPoints.length < 2) return;
    
    clearAndDrawBackground();
    drawObstacles();
    
    drawPathSpline(pathPoints, { color: 'rgba(0, 200, 83, 0.9)', width: 6 });
    
    ctx.fillStyle = 'rgba(0, 200, 83, 0.8)';
    for (let i = 0; i < pathPoints.length - 1; i++) {
        const current = pathPoints[i];
        const next = pathPoints[i + 1];
        const angle = Math.atan2(next.y - current.y, next.x - current.x);
        
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        
        const arrowLength = 12;
        const arrowAngle = Math.PI / 4;
        
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(
            midX - arrowLength * Math.cos(angle - arrowAngle),
            midY - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(midX, midY);
        ctx.lineTo(
            midX - arrowLength * Math.cos(angle + arrowAngle),
            midY - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
    }
    
    drawFoodSources();
}

function drawFoodSources() {
    foodSources.forEach((food, index) => {
        // Determine node type and colors
        let fillColor = 'rgba(255, 100, 100, 0.8)';
        let strokeColor = 'rgba(255, 50, 50, 1)';
        let radius = 8;
        let labelSuffix = '';
        
        if (index === startNodeIndex) {
            fillColor = 'rgba(100, 255, 100, 0.8)';
            strokeColor = 'rgba(50, 255, 50, 1)';
            radius = 10;
            labelSuffix = ' (Start)';
        } else if (index === goalNodeIndex) {
            fillColor = 'rgba(100, 100, 255, 0.8)';
            strokeColor = 'rgba(50, 50, 255, 1)';
            radius = 10;
            labelSuffix = ' (Goal)';
        }
        
        // Draw food source circle
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(food.x, food.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw label if exists
        const displayLabel = (food.label || `Point ${index + 1}`) + labelSuffix;
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;
        ctx.fillText(displayLabel, food.x, food.y - (radius + 4));
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    });
}

// Add the missing compare networks functionality
const compareNetworksBtn = document.getElementById('compareNetworksBtn');
if (compareNetworksBtn) {
    compareNetworksBtn.onclick = () => {
        if (trailHistory.length < 2) {
            alert('Need at least 2 trail snapshots to compare networks');
            return;
        }
        
        const comparison = {
            snapshots: trailHistory.length,
            firstGeneration: trailHistory[0].generation,
            lastGeneration: trailHistory[trailHistory.length - 1].generation,
            averageAgents: trailHistory.reduce((sum, s) => sum + s.agentCount, 0) / trailHistory.length,
            networkMetrics: networkMetrics,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network_comparison_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

// Fix window resize handler with debounce
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        setupCanvas();
        drawStaticElements();
    }, 250);
});

function drawStaticElements() {
    clearAndDrawBackground();
    drawObstacles(); // Add obstacle drawing
    drawFoodSources();
    
    if (isOptimizedViewActive && lastOptimizedPathPoints) {
        drawOptimizedSingleCurve(lastOptimizedPathPoints);
    }
    
    // Update analysis if we have data
    if (foodSources.length > 0) {
        analyzeNetwork();
    }
}

// Create context menu element
let contextMenu = null;
let contextMenuTarget = null;

function createContextMenu() {
    if (contextMenu) return contextMenu;
    
    contextMenu = document.createElement('div');
    contextMenu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        display: none;
        min-width: 150px;
        font-family: inherit;
        font-size: 14px;
    `;
    
    const menuItems = [
        { text: 'Properties', action: 'properties' },
        { text: 'Delete Point', action: 'delete' }
    ];
    
    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.text;
        menuItem.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        menuItem.dataset.action = item.action;
        
        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.backgroundColor = '#f0f0f0';
        });
        
        menuItem.addEventListener('mouseleave', () => {
            menuItem.style.backgroundColor = '';
        });
        
        menuItem.addEventListener('click', (e) => {
            handleContextMenuAction(item.action);
            hideContextMenu();
            e.stopPropagation();
        });
        
        contextMenu.appendChild(menuItem);
    });
    
    document.body.appendChild(contextMenu);
    
    // Hide menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu);
    
    return contextMenu;
}

function showContextMenu(x, y, pointIndex) {
    const menu = createContextMenu();
    contextMenuTarget = pointIndex;
    
    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
    }
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    contextMenuTarget = null;
}

function handleContextMenuAction(action) {
    if (contextMenuTarget === null) return;
    
    const point = foodSources[contextMenuTarget];
    if (!point) return;
    
    switch (action) {
        case 'properties':
            showPointProperties(contextMenuTarget);
            break;
        case 'delete':
            deletePoint(contextMenuTarget);
            break;
    }
}

function showPointProperties(pointIndex) {
    const point = foodSources[pointIndex];
    if (!point) return;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        min-width: 300px;
        max-width: 400px;
    `;
    
    dialog.innerHTML = `
        <h3 style="margin-top: 0;">Point Properties</h3>
        <div style="margin-bottom: 16px;">
            <label>Label:</label><br>
            <input type="text" id="pointLabel" value="${point.label || ''}" style="width: 100%; padding: 8px; margin-top: 4px;">
        </div>
        <div style="margin-bottom: 16px; display: flex; gap: 12px;">
            <div style="flex: 1;">
                <label>X:</label><br>
                <input type="number" id="pointX" value="${point.x.toFixed(0)}" style="width: 100%; padding: 8px; margin-top: 4px;">
            </div>
            <div style="flex: 1;">
                <label>Y:</label><br>
                <input type="number" id="pointY" value="${point.y.toFixed(0)}" style="width: 100%; padding: 8px; margin-top: 4px;">
            </div>
        </div>
        <div style="text-align: right; margin-top: 20px;">
            <button id="cancelBtn" style="margin-right: 8px; padding: 8px 16px;">Cancel</button>
            <button id="saveBtn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px;">Save</button>
        </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Event handlers
    document.getElementById('cancelBtn').onclick = () => {
        document.body.removeChild(modal);
    };
    
    document.getElementById('saveBtn').onclick = () => {
        const newLabel = document.getElementById('pointLabel').value;
        const newX = parseFloat(document.getElementById('pointX').value);
        const newY = parseFloat(document.getElementById('pointY').value);
        
        point.label = newLabel;
        point.x = newX;
        point.y = newY;
        
        renderPointsList();
        drawStaticElements();
        document.body.removeChild(modal);
    };
    
    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

function deletePoint(pointIndex) {
    if (confirm('Are you sure you want to delete this point?')) {
        foodSources.splice(pointIndex, 1);
        renderPointsList();
        drawStaticElements();
        // Clear optimized path if it exists
        if (lastOptimizedPathPoints) {
            lastOptimizedPathPoints = null;
            isOptimizedViewActive = false;
        }
    }
}

// Right click to show context menu
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    for (let i = 0; i < foodSources.length; i++) {
        if ((foodSources[i].x - x) ** 2 + (foodSources[i].y - y) ** 2 < 64) {
            showContextMenu(e.clientX, e.clientY, i);
            return false;
        }
    }
    
    return false;
});

// === ALGORITHM INFORMATION SYSTEM ===
const ALGORITHM_INFO = {
    "slime": {
        name: "🦠 Slime Mold Algorithm",
        description: "Bio-inspired swarm intelligence that mimics how slime molds find optimal paths between food sources. Agents leave pheromone trails that guide other agents.",
        howItWorks: "Agents move randomly at first, depositing trails. When they find food, stronger trails form. Other agents follow these trails, reinforcing good paths and letting bad ones decay.",
        strengths: [
            "Self-organizing and adaptive",
            "Handles multiple food sources naturally",
            "Excellent for exploration and pathfinding",
            "Visually impressive trail formation"
        ],
        bestFor: "Learning about swarm intelligence, exploring unknown environments, artistic visualizations"
    },
    "tpsma": {
        name: "🧬 TPSMA (Tube-based Physarum Algorithm)",
        description: "Advanced mathematical algorithm based on Physarum polycephalum (slime mold) tube formation. Solves the Traveling Salesman Problem optimally.",
        howItWorks: "Creates a virtual tube network between points. Uses pressure and flow equations to find the shortest route that visits all points exactly once.",
        strengths: [
            "Mathematically proven optimal solutions",
            "Excellent for route optimization",
            "Handles obstacles intelligently",
            "Used in real-world logistics"
        ],
        bestFor: "Delivery routes, network optimization, solving complex routing problems"
    },
    "astar": {
        name: "🎯 A* Pathfinding",
        description: "Classical computer science algorithm that finds the shortest path between two specific points using smart heuristics.",
        howItWorks: "Explores paths systematically, always choosing the most promising direction. Uses grid-based navigation to avoid obstacles efficiently.",
        strengths: [
            "Guaranteed shortest path",
            "Very fast execution",
            "Excellent obstacle avoidance",
            "Used in games and robotics"
        ],
        bestFor: "Point-to-point navigation, robotics, game AI, GPS systems"
    }
};

function showAlgorithmInfo() {
    const currentAlgorithm = controls.solver ? controls.solver.value : 'slime';
    const info = ALGORITHM_INFO[currentAlgorithm];
    
    if (!info) {
        alert("Algorithm information not available.");
        return;
    }
    
    const message = `
${info.name}

${info.description}

HOW IT WORKS:
${info.howItWorks}

STRENGTHS:
${info.strengths.map(s => `• ${s}`).join('\n')}

BEST FOR:
${info.bestFor}

COMPARISON:
• Slime Mold: Best for learning and exploration (many agents, organic behavior)
• TPSMA: Best for optimal routing (mathematical precision, multiple stops)  
• A*: Best for simple pathfinding (fast, two points, guaranteed optimal)

Try switching between algorithms and clicking 'Optimize Path' to see the differences!
    `;
    
    alert(message);
}

// Add algorithm info button event listener
function addAlgorithmInfoButton() {
    const solverControl = document.getElementById('solver');
    if (!solverControl) return;
    
    const infoButton = document.createElement('button');
    infoButton.textContent = 'ℹ️ Algorithm Info';
    infoButton.style.marginTop = '5px';
    infoButton.style.fontSize = '12px';
    infoButton.onclick = showAlgorithmInfo;
    
    const controlGroup = solverControl.closest('.control-group');
    if (controlGroup) {
        controlGroup.appendChild(infoButton);
    }
}