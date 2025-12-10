// Global Chart Variable
let capacityChart;

// --- NAVIGATION LOGIC ---
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    
    document.getElementById(sectionId).style.display = 'block';
    const navItems = document.querySelectorAll('.nav-links li');
    if(sectionId === 'problem') navItems[0].classList.add('active');
    if(sectionId === 'erasure') {
        navItems[1].classList.add('active');
        initChart();
    }
    if(sectionId === 'bitflip') navItems[2].classList.add('active');
    if(sectionId === 'insights') navItems[3].classList.add('active');
}

// --- ERASURE CHANNEL LOGIC (Theorems 2 & 3) ---

// M/M/1 Capacity Formula (Theorem 2 & Corollary 1)
function calcMM1(lambda, kappa) {
    if(lambda >= 1) return 0; // Stability check
    const alpha = 1 / (1 + kappa);
    const numerator = lambda * (1 - lambda);
    const denominator = 1 - (alpha * lambda);
    // Multiply by alpha to account for decoherence during service time
    return Math.max(0, alpha * (numerator / denominator));
}

// M/D/1 Capacity Formula (Theorem 3 & 4)
function calcMD1(lambda, kappa) {
    if(lambda >= 1) return 0; // Stability check
    // alpha for Queue Wait Time (derived from Pollaczek-Khinchin)
    const alpha = (1 - Math.exp(-kappa)) / kappa;
    
    const numerator = lambda * (1 - lambda);
    const denominator = 1 - (alpha * lambda);
    
    // Multiply by e^-kappa to account for the deterministic service time (1 unit)
    const serviceDecay = Math.exp(-kappa);
    
    return Math.max(0, serviceDecay * (numerator / denominator));
}

function updateDashboard() {
    const kappa = parseFloat(document.getElementById('kappaSlider').value);
    const lambda = parseFloat(document.getElementById('lambdaSlider').value);

    document.getElementById('kappaValue').innerText = kappa.toFixed(2);
    document.getElementById('lambdaValue').innerText = lambda.toFixed(2);

    const mm1Val = calcMM1(lambda, kappa);
    const md1Val = calcMD1(lambda, kappa);

    document.getElementById('mm1-stat').innerText = mm1Val.toFixed(3);
    document.getElementById('md1-stat').innerText = md1Val.toFixed(3);

    updateChart(kappa, lambda);
}

// Chart Initialization with Linear Axis for smooth sliding
function initChart() {
    if(capacityChart) return; 

    const ctx = document.getElementById('capacityChart').getContext('2d');
    
    capacityChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'M/M/1 (Random)',
                borderColor: '#2196f3',
                data: [], // Filled dynamically
                fill: false,
                tension: 0.4,
                pointRadius: 0 // Hide points for a clean line
            }, {
                label: 'M/D/1 (Deterministic)',
                borderColor: '#4caf50',
                data: [],
                fill: false,
                tension: 0.4,
                pointRadius: 0
            },
            {
                label: 'Current Operating Point',
                borderColor: '#e14eca',
                backgroundColor: '#e14eca',
                data: [],
                pointRadius: 8,
                pointHoverRadius: 10,
                type: 'scatter'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'linear', // Critical: Allows float values for smooth X movement
                    position: 'bottom',
                    title: { display: true, text: 'Arrival Rate (λ)' }, 
                    grid: {color: '#444'},
                    min: 0,
                    max: 1.0
                },
                y: { 
                    title: { display: true, text: 'Capacity (bits/sec)' }, 
                    grid: {color: '#444'}, 
                    min: 0, 
                    max: 1.0 // Increased max to prevent clipping at low kappa
                }
            },
            plugins: {
                legend: { labels: { color: 'white' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`;
                        }
                    }
                }
            }
        }
    });

    updateDashboard();
}

function updateChart(kappa, currentLambda) {
    if(!capacityChart) return;

    const dataMM1 = [];
    const dataMD1 = [];

    // Generate high-resolution curve points
    for(let l=0.0; l<0.99; l+=0.01) {
        dataMM1.push({x: l, y: calcMM1(l, kappa)});
        dataMD1.push({x: l, y: calcMD1(l, kappa)});
    }

    capacityChart.data.datasets[0].data = dataMM1;
    capacityChart.data.datasets[1].data = dataMD1;

    // Update the Scatter Dot position
    const currentCap = calcMM1(currentLambda, kappa);
    capacityChart.data.datasets[2].data = [{x: currentLambda, y: currentCap}];

    capacityChart.update();
}

document.getElementById('kappaSlider').addEventListener('input', updateDashboard);
document.getElementById('lambdaSlider').addEventListener('input', updateDashboard);


// --- BIT-FLIP SIMULATION LOGIC ---

// Helper: Calculate Binary Entropy H(p)
function binaryEntropy(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

document.getElementById('simLambda').addEventListener('input', (e) => {
    document.getElementById('simLambdaVal').innerText = parseFloat(e.target.value).toFixed(2);
});
document.getElementById('simKappa').addEventListener('input', (e) => {
    document.getElementById('simKappaVal').innerText = parseFloat(e.target.value).toFixed(2);
});

function runSimulation() {
    const inputStr = document.getElementById('simInput').value;
    const lambda = parseFloat(document.getElementById('simLambda').value);
    const kappa = parseFloat(document.getElementById('simKappa').value);
    const consoleDiv = document.getElementById('consoleOutput');

    consoleDiv.innerText = `> Initializing Transmission...\n> Message: "${inputStr}"\n> Lambda: ${lambda} | Kappa: ${kappa}\n\n`;

    let outputStr = "";
    let totalWait = 0;
    let totalFlipProb = 0; // Accumulator for avg noise
    let bitErrors = 0;
    const serviceRate = 1.0; 
    
    const totalBits = inputStr.length * 8; // Approx 8 bits per char

    for(let i=0; i<inputStr.length; i++) {
        const u = Math.random();
        
        // Stability check
        if(lambda >= serviceRate) {
             consoleDiv.innerText += `ERROR: System Unstable (Lambda >= 1.0). Queue overflow.\n`;
             return;
        }
        
        // Random Wait Time (M/M/1 System Time)
        const waitTime = -Math.log(u) / (serviceRate - lambda);
        totalWait += waitTime;

        // Bit Flip Probability: phi(W) = 0.5 * (1 - exp(-kappa * W))
        const probFlip = 0.5 * (1 - Math.exp(-kappa * waitTime));
        totalFlipProb += probFlip;

        // Simulate 8 bits per character individually
        let charIsCorrupt = false;
        
        for(let b=0; b<8; b++) {
            if(Math.random() < probFlip) {
                charIsCorrupt = true;
                bitErrors++;
            }
        }
        
        // Construct visual output
        if(charIsCorrupt) {
            outputStr += randomChar();
        } else {
            outputStr += inputStr[i];
        }

        // Detailed log for first 3 packets
        if(i < 3) {
             consoleDiv.innerText += `Packet ${i}: Wait ${waitTime.toFixed(3)}s -> BitFlipProb ${(probFlip*100).toFixed(1)}% -> ${charIsCorrupt ? "CORRUPT" : "OK"}\n`;
        }
    }

    consoleDiv.innerText += `...\n> Transmission Complete.\n> Received: "${outputStr}"`;

    const avgWait = totalWait / inputStr.length;
    const avgFlipProb = totalFlipProb / inputStr.length;
    
    document.getElementById('simAvgWait').innerText = avgWait.toFixed(3) + 's';
    
    // Actual Bit Error Rate
    const actualBER = (bitErrors / totalBits);
    document.getElementById('simBer').innerText = (actualBER * 100).toFixed(1) + '%';
    
    // Theoretical Capacity Calculation (Corollary 2)
    // C = lambda * (1 - H(avg_noise))
    const entropy = binaryEntropy(avgFlipProb);
    const capacity = lambda * (1 - entropy);
    
    document.getElementById('simCap').innerText = capacity.toFixed(3) + " bits/s";
}

function randomChar() {
    const chars = "?#@&%$!";
    return chars.charAt(Math.floor(Math.random() * chars.length));
}
