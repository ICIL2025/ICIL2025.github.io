// Algorithm Information and Help System

const ALGORITHM_INFO = {
    "slime": {
        name: "Slime Mold Algorithm",
        description: "Bio-inspired swarm intelligence that mimics how slime molds find optimal paths between food sources.",
        strengths: [
            "Excellent for pathfinding in complex environments",
            "Self-organizing and adaptive",
            "Good for exploring unknown territories",
            "Naturally handles multiple objectives"
        ],
        weaknesses: [
            "Can be slow to converge",
            "May get stuck in local optima",
            "Requires tuning of many parameters"
        ],
        bestFor: "Complex pathfinding, exploration, biological simulation",
        parameters: [
            "Agent Speed: How fast agents move",
            "Sensor Distance: How far agents can sense",
            "Sensor Angle: Field of view for sensors",
            "Turn Angle: Maximum turning rate",
            "Trail Deposit: How much pheromone is left",
            "Decay Factor: How fast trails fade",
            "Diffusion: How trails spread"
        ]
    },
    "tpsma": {
        name: "TPSMA (Tube-based Physarum Swarm Algorithm)",
        description: "Advanced bio-inspired algorithm based on Physarum polycephalum tube formation for solving traveling salesman problems.",
        strengths: [
            "Excellent for TSP and routing problems",
            "Mathematically robust",
            "Good convergence properties",
            "Handles obstacles well"
        ],
        weaknesses: [
            "Complex to understand",
            "May require more computation",
            "Less intuitive parameter tuning"
        ],
        bestFor: "Traveling Salesman Problem, route optimization, network design",
        parameters: [
            "Iterations: Number of optimization steps",
            "Epsilon: Exploration parameter",
            "Delta: Convergence threshold",
            "DT: Time step size"
        ]
    },
    "astar": {
        name: "A* Pathfinding",
        description: "Classical computer science algorithm for finding the shortest path between two points using heuristics.",
        strengths: [
            "Guaranteed optimal path",
            "Fast and efficient",
            "Well-understood algorithm",
            "Excellent obstacle avoidance"
        ],
        weaknesses: [
            "Only works between two points",
            "No swarm behavior",
            "Limited to grid-based pathfinding",
            "Cannot handle multiple objectives"
        ],
        bestFor: "Point-to-point pathfinding, robotics, game AI",
        parameters: [
            "Cell Size: Grid resolution for pathfinding",
            "Obstacle Source: Use polygons or mask for obstacles"
        ]
    }
};

function showAlgorithmHelp(algorithmType) {
    const info = ALGORITHM_INFO[algorithmType];
    if (!info) return;
    
    const helpContent = `
        <div class="algorithm-help">
            <h3>${info.name}</h3>
            <p><strong>Description:</strong> ${info.description}</p>
            
            <div class="strengths-weaknesses">
                <div class="strengths">
                    <h4>Strengths:</h4>
                    <ul>
                        ${info.strengths.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
                <div class="weaknesses">
                    <h4>Weaknesses:</h4>
                    <ul>
                        ${info.weaknesses.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <p><strong>Best for:</strong> ${info.bestFor}</p>
            
            <div class="parameters">
                <h4>Key Parameters:</h4>
                <ul>
                    ${info.parameters.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    
    // Create modal or display area
    let helpModal = document.getElementById('algorithmHelpModal');
    if (!helpModal) {
        helpModal = document.createElement('div');
        helpModal.id = 'algorithmHelpModal';
        helpModal.className = 'modal';
        helpModal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <div id="algorithmHelpContent"></div>
            </div>
        `;
        document.body.appendChild(helpModal);
        
        // Add close functionality
        helpModal.querySelector('.close').onclick = () => {
            helpModal.style.display = 'none';
        };
        
        window.onclick = (event) => {
            if (event.target === helpModal) {
                helpModal.style.display = 'none';
            }
        };
    }
    
    document.getElementById('algorithmHelpContent').innerHTML = helpContent;
    helpModal.style.display = 'block';
}

// Add comparison functionality
function compareAlgorithms() {
    const comparison = `
        <div class="algorithm-comparison">
            <h3>Algorithm Comparison</h3>
            <table>
                <thead>
                    <tr>
                        <th>Feature</th>
                        <th>Slime Mold</th>
                        <th>TPSMA</th>
                        <th>A*</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Multiple Points</td>
                        <td>✅ Excellent</td>
                        <td>✅ Excellent</td>
                        <td>❌ Two points only</td>
                    </tr>
                    <tr>
                        <td>Obstacle Handling</td>
                        <td>✅ Good</td>
                        <td>✅ Excellent</td>
                        <td>✅ Excellent</td>
                    </tr>
                    <tr>
                        <td>Optimality</td>
                        <td>⚠️ Near-optimal</td>
                        <td>✅ Optimal</td>
                        <td>✅ Optimal</td>
                    </tr>
                    <tr>
                        <td>Speed</td>
                        <td>⚠️ Moderate</td>
                        <td>⚠️ Slow</td>
                        <td>✅ Fast</td>
                    </tr>
                    <tr>
                        <td>Visualization</td>
                        <td>✅ Excellent</td>
                        <td>✅ Good</td>
                        <td>✅ Good</td>
                    </tr>
                    <tr>
                        <td>Real-world Accuracy</td>
                        <td>✅ High</td>
                        <td>✅ Very High</td>
                        <td>⚠️ Grid-based</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="recommendations">
                <h4>Recommendations:</h4>
                <ul>
                    <li><strong>For exploring and learning:</strong> Start with Slime Mold</li>
                    <li><strong>For optimal routing:</strong> Use TPSMA</li>
                    <li><strong>For simple pathfinding:</strong> Use A*</li>
                    <li><strong>For complex networks:</strong> Use TPSMA or Slime Mold</li>
                </ul>
            </div>
        </div>
    `;
    
    let helpModal = document.getElementById('algorithmHelpModal');
    if (!helpModal) {
        showAlgorithmHelp('slime'); // Create modal first
        helpModal = document.getElementById('algorithmHelpModal');
    }
    
    document.getElementById('algorithmHelpContent').innerHTML = comparison;
    helpModal.style.display = 'block';
}
