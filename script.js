let simulationQuality = 0;
let convergenceRate = 0;
let networkMetrics = { connectivity: 0, efficiency: 0, robustness: 0 };
let optimalSpeed = 1.2;
let agentEfficiency = 0;

const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const controlPanel = document.getElementById('controlPanel');
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
    bgOpacityValue: document.getElementById('bgOpacityValue') 
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

// --- Update Parameters from Controls ---
function updateParams() { 
    PARAMS = { 
        numAgents: parseInt(controls.numAgents.value), 
        agentSpeed: parseFloat(controls.agentSpeed.value), 
        sensorDist: parseFloat(controls.sensorDist.value), 
        sensorAngleRad: degreesToRadians(parseFloat(controls.sensorAngle.value)), 
        turnAngleRad: degreesToRadians(parseFloat(controls.turnAngle.value)), 
        trailDeposit: parseFloat(controls.trailDeposit.value), 
        decayFactor: parseFloat(controls.decayFactor.value), 
        diffusionFactor: parseFloat(controls.diffusionFactor.value), 
        foodStrength: parseFloat(controls.foodStrength.value), 
        foodAttractionRadius: parseFloat(controls.foodAttractionRadius.value), 
        drawAgents: controls.drawAgents.checked 
    }; 
    controls.numAgentsValue.textContent = PARAMS.numAgents; 
    controls.agentSpeedValue.textContent = PARAMS.agentSpeed.toFixed(1); 
    controls.sensorDistValue.textContent = PARAMS.sensorDist.toFixed(0); 
    controls.sensorAngleValue.textContent = controls.sensorAngle.value; 
    controls.turnAngleValue.textContent = controls.turnAngle.value; 
    controls.trailDepositValue.textContent = PARAMS.trailDeposit.toFixed(1); 
    controls.decayFactorValue.textContent = PARAMS.decayFactor.toFixed(3); 
    controls.diffusionFactorValue.textContent = PARAMS.diffusionFactor.toFixed(2); 
    controls.foodStrengthValue.textContent = PARAMS.foodStrength.toFixed(0); 
    controls.foodAttractionRadiusValue.textContent = PARAMS.foodAttractionRadius.toFixed(0); 
    showBackground = controls.showBackground.checked; 
    backgroundOpacity = parseFloat(controls.bgOpacitySlider.value); 
    controls.bgOpacityValue.textContent = backgroundOpacity.toFixed(2); 
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
    // Get the available space in the main content area
    const mainContentRect = document.getElementById('mainContent').getBoundingClientRect();
    // Let's try to fit the canvas while maintaining aspect ratio
    const availableWidth = mainContentRect.width - 40; // 20px padding on each side
    const availableHeight = window.innerHeight - 150; // Approx height of header and footer elements

    const aspectRatio = 800 / 600; // Original aspect ratio
    
    let newWidth = availableWidth;
    let newHeight = newWidth / aspectRatio;

    if (newHeight > availableHeight) {
        newHeight = availableHeight;
        newWidth = newHeight * aspectRatio;
    }
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    canvasWidth = newWidth;
    canvasHeight = newHeight;

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
    console.log("Optimized path created with", lastOptimizedPathPoints.length, "points");
    
    resetSimulationDataState(false);
    isOptimizedViewActive = true;
    drawOptimizedSingleCurve(lastOptimizedPathPoints);
    updateButtonStates();
    runButton.disabled = false;
    pauseButton.disabled = true;
    
    // Calculate and display path length
    let totalLength = 0;
    for (let i = 1; i < lastOptimizedPathPoints.length; i++) {
        const dx = lastOptimizedPathPoints[i].x - lastOptimizedPathPoints[i-1].x;
        const dy = lastOptimizedPathPoints[i].y - lastOptimizedPathPoints[i-1].y;
        totalLength += Math.sqrt(dx*dx + dy*dy);
    }
    console.log("Total path length:", totalLength.toFixed(1), "pixels");
}

// Get food source order (nearest neighbor heuristic)
function getFoodSourceOrder() {
    if (foodSources.length === 0) return [];
    if (foodSources.length === 1) return [foodSources[0]];
    if (foodSources.length === 2) return [...foodSources];
    
    // Start with nearest neighbor tour
    const remaining = new Set(foodSources.map((_, index) => index));
    const tour = [];
    let currentIndex = 0;
    tour.push(currentIndex);
    remaining.delete(currentIndex);
    
    // Build initial tour with nearest neighbor
    while (remaining.size > 0) {
        let nearestIndex = -1;
        let minDistSq = Infinity;
        const currentPoint = foodSources[currentIndex];
        
        for (const index of remaining) {
            const distSq = distanceSq(currentPoint, foodSources[index]);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearestIndex = index;
            }
        }
        
        if (nearestIndex === -1) break;
        currentIndex = nearestIndex;
        tour.push(currentIndex);
        remaining.delete(currentIndex);
    }
    
    // Optimize with 2-opt
    let improved = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        for (let i = 1; i < tour.length - 2; i++) {
            for (let j = i + 1; j < tour.length; j++) {
                if (j - i === 1) continue; // Skip adjacent edges
                
                const a = foodSources[tour[i - 1]];
                const b = foodSources[tour[i]];
                const c = foodSources[tour[j - 1]];
                const d = foodSources[tour[j]];
                
                const currentDist = Math.sqrt(distanceSq(a, b)) + Math.sqrt(distanceSq(c, d));
                const newDist = Math.sqrt(distanceSq(a, c)) + Math.sqrt(distanceSq(b, d));
                
                if (newDist < currentDist) {
                    // Reverse the segment between i and j-1
                    const newTour = [...tour];
                    for (let k = 0; k < Math.floor((j - i) / 2); k++) {
                        const temp = newTour[i + k];
                        newTour[i + k] = newTour[j - 1 - k];
                        newTour[j - 1 - k] = temp;
                    }
                    tour.splice(0, tour.length, ...newTour);
                    improved = true;
                }
            }
        }
    }
    
    return tour.map(index => foodSources[index]);
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
    const sensorCount = 3; // Simplified for better performance
    const sensors = [];
    
    for (let i = 0; i < sensorCount; i++) {
        const sensorAngle = angle + (i - 1) * PARAMS.sensorAngleRad;
        const sensorX = agent.x + Math.cos(sensorAngle) * PARAMS.sensorDist;
        const sensorY = agent.y + Math.sin(sensorAngle) * PARAMS.sensorDist;
        
        const trailIntensity = getTrailIntensity(sensorX, sensorY);
        const foodAttraction = getFoodAttraction(sensorX, sensorY);
        const pathGuidance = getPathGuidance(sensorX, sensorY);
        
        sensors.push(trailIntensity + foodAttraction + pathGuidance);
    }
    
    return sensors;
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
    
    // Improved diffusion algorithm
    if (diffusion > 0) {
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                tempTrailMap[x][y] = trailMap[x][y];
            }
        }
        
        // Gaussian-like diffusion
        for (let x = 1; x < gridWidth - 1; x++) {
            for (let y = 1; y < gridHeight - 1; y++) {
                let sum = 0;
                let totalWeight = 0;
                
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const weight = 1 / (1 + Math.abs(dx) + Math.abs(dy));
                        sum += tempTrailMap[x + dx][y + dy] * weight;
                        totalWeight += weight;
                    }
                }
                
                const blurredValue = sum / totalWeight;
                trailMap[x][y] = tempTrailMap[x][y] * (1 - diffusion) + blurredValue * diffusion;
            }
        }
    }
    
    // Apply decay
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            trailMap[x][y] = Math.max(0, trailMap[x][y] * decay);
        }
    }
}

// --- NEW: Quality Assessment ---
function assessSimulationQuality() {
    // Calculate path efficiency
    let totalTrailValue = 0;
    let activeTrailCells = 0;
    
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            if (trailMap[x][y] > 1) {
                totalTrailValue += trailMap[x][y];
                activeTrailCells++;
            }
        }
    }
    
    // Calculate metrics
    const trailDensity = activeTrailCells / (gridWidth * gridHeight);
    const avgTrailStrength = activeTrailCells > 0 ? totalTrailValue / activeTrailCells : 0;
    
    simulationQuality = Math.min(100, (trailDensity * 100 + avgTrailStrength / 10) / 2);
    convergenceRate = Math.min(100, generationCount / 500 * 100);
    
    // Update UI
    updateQualityIndicators();
}

function updateQualityIndicators() {
    const qualityDot = document.getElementById('qualityDot');
    const qualityText = document.getElementById('qualityText');
    const convergenceProgress = document.getElementById('convergenceProgress');
    const convergenceText = document.getElementById('convergenceText');
    
    // Quality indicator
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
    
    // Convergence progress
    convergenceProgress.style.width = convergenceRate + '%';
    convergenceText.textContent = `Convergence: ${convergenceRate.toFixed(1)}%`;
}

// --- AUTO-OPTIMIZATION ---
document.getElementById('autoOptimizeSpeed').onclick = () => {
    // Calculate optimal speed based on current conditions
    const agentDensity = agents.length / (canvasWidth * canvasHeight);
    const foodDensity = foodSources.length / (canvasWidth * canvasHeight);
    
    optimalSpeed = Math.max(0.5, Math.min(2.5, 1.0 + foodDensity * 1000 - agentDensity * 100000));
    
    controls.agentSpeed.value = optimalSpeed;
    updateParams();
    
    document.getElementById('speedOptimal').textContent = `(Optimal: ${optimalSpeed.toFixed(1)})`;
};

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
        document.getElementById('connectivityScore').textContent = networkMetrics.connectivity.toFixed(1) + '%';
        document.getElementById('efficiencyScore').textContent = networkMetrics.efficiency.toFixed(1) + '%';
        document.getElementById('robustnessScore').textContent = networkMetrics.robustness.toFixed(1) + '%';
    }
}

// --- EXPORT FUNCTIONALITY ---
document.getElementById('exportAnalysisBtn').onclick = () => {
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

// --- MODIFIED ANIMATION LOOP ---
function animate() {
    if (!simulationRunning) {
        animationFrameId = null;
        return;
    }
    
    generationCount++;
    generationCounter.textContent = `Generation: ${generationCount}`;
    
    updateAgents();
    updateTrailMap();
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
    
    // Draw optimized path as guidance (faint)
    if (lastOptimizedPathPoints && lastOptimizedPathPoints.length > 1) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(lastOptimizedPathPoints[0].x, lastOptimizedPathPoints[0].y);
        for (let i = 1; i < lastOptimizedPathPoints.length; i++) {
            ctx.lineTo(lastOptimizedPathPoints[i].x, lastOptimizedPathPoints[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Draw trails with better visibility
    for (let gridX = 0; gridX < gridWidth; gridX++) {
        for (let gridY = 0; gridY < gridHeight; gridY++) {
            const trailValue = trailMap[gridX][gridY];
            if (trailValue > 0.5) {
                const intensity = Math.min(1, trailValue / 50);
                const alpha = Math.min(0.8, intensity);
                
                ctx.fillStyle = `rgba(0, 150, 255, ${alpha})`;
                ctx.fillRect(gridX * trailResolution, gridY * trailResolution, trailResolution, trailResolution);
            }
        }
    }
    
    // Draw agents
    if (PARAMS.drawAgents) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        agents.forEach(agent => {
            ctx.beginPath();
            ctx.arc(agent.x, agent.y, 1, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
    
    drawFoodSources();
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

canvas.addEventListener('click', (event) => { 
    const rect = canvas.getBoundingClientRect(); 
    const scaleX = canvas.width / rect.width; 
    const scaleY = canvas.height / rect.height; 
    const x = (event.clientX - rect.left) * scaleX; 
    const y = (event.clientY - rect.top) * scaleY; 
    if (x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight) { 
        addFoodSource(x, y); 
    } 
});

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

// --- Points Editor ---
function renderPointsList() {
    const ul = document.getElementById('pointsList');
    ul.innerHTML = '';
    foodSources.forEach((pt, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <input class="point-label-input" type="text" value="${pt.label || ''}" placeholder="Name" data-idx="${idx}">
            <input class="point-coord-input" type="number" value="${pt.x.toFixed(0)}" data-idx="${idx}" data-coord="x">
            <input class="point-coord-input" type="number" value="${pt.y.toFixed(0)}" data-idx="${idx}" data-coord="y">
            <button class="delete-point-btn" data-idx="${idx}">&times;</button>
        `;
        ul.appendChild(li);
    });
}

document.getElementById('addPointBtn').onclick = () => {
    const randomX = Math.random() * canvasWidth;
    const randomY = Math.random() * canvasHeight;
    foodSources.push({ x: randomX, y: randomY, label: `Point ${foodSources.length + 1}` });
    renderPointsList();
    drawStaticElements();
};

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
// Right click to delete
canvas.addEventListener('contextmenu', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    for (let i=0; i<foodSources.length; ++i) {
        if ((foodSources[i].x-x)**2 + (foodSources[i].y-y)**2 < 64) {
            foodSources.splice(i,1);
            renderPointsList();
            drawStaticElements();
            e.preventDefault();
            return false;
        }
    }
});

// --- Analysis ---
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

document.getElementById('generationSlider').addEventListener('input', (e) => {
    timelinePosition = parseInt(e.target.value);
    document.getElementById('timelineValue').textContent = timelinePosition;
    
    // Find closest snapshot
    const snapshot = trailHistory.find(s => s.generation >= timelinePosition) || trailHistory[trailHistory.length - 1];
    if (snapshot && !simulationRunning) {
        // Temporarily display this snapshot
        trailMap = JSON.parse(JSON.stringify(snapshot.trails));
        drawSimulation();
    }
});

document.getElementById('playTimelineBtn').onclick = () => {
    if (isTimelinePlaying) return;
    isTimelinePlaying = true;
    playTimeline();
};

document.getElementById('pauseTimelineBtn').onclick = () => {
    isTimelinePlaying = false;
    if (timelineAnimationId) {
        clearTimeout(timelineAnimationId);
        timelineAnimationId = null;
    }
};

document.getElementById('resetTimelineBtn').onclick = () => {
    isTimelinePlaying = false;
    timelinePosition = 0;
    document.getElementById('generationSlider').value = 0;
    document.getElementById('timelineValue').textContent = '0';
    if (timelineAnimationId) {
        clearTimeout(timelineAnimationId);
        timelineAnimationId = null;
    }
};

function playTimeline() {
    if (!isTimelinePlaying || timelinePosition >= trailHistory.length - 1) {
        isTimelinePlaying = false;
        return;
    }
    
    timelinePosition += 1;
    document.getElementById('generationSlider').value = trailHistory[timelinePosition]?.generation || timelinePosition;
    document.getElementById('timelineValue').textContent = trailHistory[timelinePosition]?.generation || timelinePosition;
    
    if (trailHistory[timelinePosition]) {
        trailMap = JSON.parse(JSON.stringify(trailHistory[timelinePosition].trails));
        drawSimulation();
    }
    
    timelineAnimationId = setTimeout(playTimeline, 100);
}

// --- Modified Animation Loop to save snapshots ---
function animate() { 
    if (!simulationRunning) { 
        animationFrameId = null; 
        return; 
    } 
    generationCount++; 
    generationCounter.textContent = `Generation: ${generationCount}`; 
    updateAgents(); 
    updateTrailMap(); 
    drawSimulation(); 
    
    // Save snapshot every 10 generations
    if (generationCount % 10 === 0) {
        saveTrailSnapshot();
    }
    
    animationFrameId = requestAnimationFrame(animate); 
}

// --- Scenarios (FIXED loading) ---
function updateScenarioDropdown() {
    const dd = document.getElementById('scenarioDropdown');
    dd.innerHTML = '<option value="">Select scenario...</option>';
    Object.keys(scenarios).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        dd.appendChild(opt);
    });
}

document.getElementById('saveScenarioBtn').onclick = () => {
    const name = prompt('Scenario name?');
    if (!name) return;
    scenarios[name] = {
        foodSources: JSON.parse(JSON.stringify(foodSources)),
        params: {...PARAMS}
    };
    updateScenarioDropdown();
    localStorage.setItem('slime_scenarios', JSON.stringify(scenarios));
};

document.getElementById('loadScenarioBtn').onclick = () => {
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

// --- Preset Maps (FIXED) ---
const presetMaps = {
    tokyo: [{x:100,y:100,label:"Shinjuku"},{x:300,y:200,label:"Ueno"},{x:500,y:400,label:"Shibuya"}],
    osaka: [{x:120,y:180,label:"Namba"},{x:400,y:300,label:"Umeda"}],
    zagreb: [{x:150,y:150,label:"Trg"},{x:350,y:350,label:"Jarun"},{x:250,y:400,label:"Maksimir"}]
};
document.querySelectorAll('.map-btn').forEach(btn => {
    btn.onclick = () => {
        const map = btn.dataset.map;
        if (presetMaps[map]) {
            // Adjust coordinates to current canvas size
            const scaleX = canvasWidth / 600;
            const scaleY = canvasHeight / 500;
            foodSources = presetMaps[map].map(point => ({
                x: point.x * scaleX,
                y: point.y * scaleY,
                label: point.label
            }));
            renderPointsList();
            drawStaticElements();
        }
    };
});

// --- Zoom Controls (FIXED) ---
document.getElementById('zoomInBtn').onclick = () => { 
    bgZoom *= 1.1; 
    drawStaticElements(); 
};

document.getElementById('zoomOutBtn').onclick = () => { 
    bgZoom /= 1.1; 
    drawStaticElements(); 
};

// --- Load scenarios from localStorage ---
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
    updateParams(); 
    setupCanvas();
    resetSimulationState(true);
    renderPointsList();
    updateScenarioDropdown();
    loadSavedScenarios();
    analyzeNetwork();
    
    assessSimulationQuality();
    updateQualityIndicators();
    
    console.log("Simulation ready. Add food sources, import state/background, or press Run.");
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

function drawFoodSources() {
    ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.strokeStyle = 'rgba(255, 50, 50, 1)';
    ctx.lineWidth = 2;
    
    foodSources.forEach((food, index) => {
        // Draw food source circle
        ctx.beginPath();
        ctx.arc(food.x, food.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw label if exists
        if (food.label) {
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(food.label, food.x, food.y - 12);
            ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
        }
    });
}

// Fix the analyzeNetwork function
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

// Add the missing compare networks functionality
document.getElementById('compareNetworksBtn').onclick = () => {
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

// Fix window resize handler
window.addEventListener('resize', () => {
    setupCanvas();
    drawStaticElements();
});

function drawStaticElements() {
    clearAndDrawBackground();
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