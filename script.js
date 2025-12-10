// Global Chart Variable
let capacityChart;

// --- NAVIGATION LOGIC ---
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
    // Remove active class from nav
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    
    // Show target section
    document.getElementById(sectionId).style.display = 'block';
    // Add active class to clicked nav item
    const navItems = document.querySelectorAll('.nav-links li');
    if(sectionId === 'problem') navItems[0].classList.add('active');
    if(sectionId === 'erasure') {
        navItems[1].classList.add('active');
        initChart(); // Render chart when this tab is opened
    }
    if(sectionId === 'bitflip') navItems[2].classList.add('active');
    if(sectionId === 'insights') navItems[3].classList.add('active');
}

// --- ERASURE CHANNEL LOGIC (Theorems 2 & 3) ---

// M/M/1 Capacity Formula: C = lambda(1-lambda) / (1 - alpha*lambda)
// where alpha = 1 / (1 + kappa)
function calcMM1(lambda, kappa) {
    const alpha = 1 / (1 + kappa);
    const numerator = lambda * (1 - lambda);
    const denominator = 1 - (alpha * lambda);
    return Math.max(0, numerator / denominator);
}

// M/D/1 Capacity Formula (Theorem 3 & 4)
// where alpha = (1 - exp(-kappa)) / kappa
function calcMD1(lambda, kappa) {
    const alpha = (1 - Math.exp(-kappa)) / kappa;
    const numerator = lambda * (1 - lambda);
    const denominator = 1 - (alpha * lambda);
    return Math.max(0, numerator / denominator);
}

// Update Dashboard function
function updateDashboard() {
    const kappa = parseFloat(document.getElementById('kappaSlider').value);
    const lambda = parseFloat(document.getElementById('lambdaSlider').value);

    // Update Text
    document.getElementById('kappaValue').innerText = kappa.toFixed(2);
    document.getElementById('lambdaValue').innerText = lambda.toFixed(2);

    // Calculate current point values
    const mm1Val = calcMM1(lambda, kappa);
    const md1Val = calcMD1(lambda, kappa);

    document.getElementById('mm1-stat').innerText = mm1Val.toFixed(3);
    document.getElementById('md1-stat').innerText = md1Val.toFixed(3);

    // Update Chart Data
    updateChart(kappa, lambda);
}

// Initialize Chart.js
function initChart() {
    if(capacityChart) return; // Prevent re-init

    const ctx = document.getElementById('capacityChart').getContext('2d');
    
    // Generate data points for lambda 0 to 1
    const labels = [];
    for(let i=0; i<1; i+=0.02) labels.push(i.toFixed(2));

    capacityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'M/M/1 (Random)',
                borderColor: '#2196f3',
                data: [],
                fill: false,
                tension: 0.4
            }, {
                label: 'M/D/1 (Deterministic)',
                borderColor: '#4caf50',
                data: [],
                fill: false,
                tension: 0.4
            },
            {
                label: 'Current Operating Point',
                borderColor: '#e14eca',
                backgroundColor: '#e14eca',
                data: [],
                pointRadius: 6,
                type: 'scatter'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Arrival Rate (λ)' }, grid: {color: '#444'} },
                y: { title: { display: true, text: 'Capacity (bits/sec)' }, grid: {color: '#444'}, min:0, max: 0.6 }
            },
            plugins: {
                legend: { labels: { color: 'white' } }
            }
        }
    });

    updateDashboard(); // Initial Draw
}

function updateChart(kappa, currentLambda) {
    if(!capacityChart) return;

    const dataMM1 = [];
    const dataMD1 = [];
    const labels = [];

    // Generate curves
    for(let l=0.0; l<1.0; l+=0.02) {
        labels.push(l.toFixed(2));
        dataMM1.push(calcMM1(l, kappa));
        dataMD1.push(calcMD1(l, kappa));
    }

    // Update chart datasets
    capacityChart.data.labels = labels;
    capacityChart.data.datasets[0].data = dataMM1;
    capacityChart.data.datasets[1].data = dataMD1;

    // Update "Current Point" marker
    const currentCap = calcMM1(currentLambda, kappa);
    capacityChart.data.datasets[2].data = [{x: currentLambda, y: currentCap}];

    capacityChart.update();
}

// Listeners
document.getElementById('kappaSlider').addEventListener('input', updateDashboard);
document.getElementById('lambdaSlider').addEventListener('input', updateDashboard);


// --- BIT-FLIP SIMULATION LOGIC ---

// Updates Simulation labels
document.getElementById('simLambda').addEventListener('input', (e) => {
    document.getElementById('simLambdaVal').innerText = e.target.value;
});
document.getElementById('simKappa').addEventListener('input', (e) => {
    document.getElementById('simKappaVal').innerText = e.target.value;
});

function runSimulation() {
    const inputStr = document.getElementById('simInput').value;
    const lambda = parseFloat(document.getElementById('simLambda').value);
    const kappa = parseFloat(document.getElementById('simKappa').value);
    const consoleDiv = document.getElementById('consoleOutput');

    consoleDiv.innerText = `> Initializing Transmission...\n> Message: "${inputStr}"\n> Lambda: ${lambda} | Kappa: ${kappa}\n\n`;

    let outputStr = "";
    let totalWait = 0;
    let errors = 0;
    let bits = inputStr.length * 8; // approx bits

    // Convert string to binary array (conceptual simulation)
    // We simulate character by character
    
    // M/M/1 Average Wait Time Formula: W = 1 / (mu - lambda) assuming mu=1
    // However, wait times are random exponential.
    // Wait time W is distributed as Exp(1 - lambda) for M/M/1.
    // Mean wait = 1/(1-lambda) *service included* or just queue? 
    // Paper uses total sojourn time typically. M/M/1 sojourn is Exp(mu-lambda).
    const serviceRate = 1.0; 
    
    // Simulate each character
    for(let i=0; i<inputStr.length; i++) {
        // Generate a random wait time for this packet based on distribution
        // T ~ Exp(1 - lambda) => T = -ln(U) / (1 - lambda)
        const u = Math.random();
        const waitTime = -Math.log(u) / (serviceRate - lambda);
        totalWait += waitTime;

        // Calculate Probability of Bit Flip: phi(W) = 0.5 * (1 - exp(-kappa * W))
        const probFlip = 0.5 * (1 - Math.exp(-kappa * waitTime));

        // Let's see if the char gets corrupted
        // We simulate this by checking if a random check falls below probability
        // Since a char is 8 bits, we simulate chance of *visible* corruption
        
        const isCorrupted = Math.random() < (probFlip * 8); // Rough approx for visualization
        
        if(isCorrupted) {
            outputStr += randomChar();
            errors++;
        } else {
            outputStr += inputStr[i];
        }

        // Add detailed log for first few
        if(i < 3) {
             consoleDiv.innerText += `Packet ${i}: Wait ${waitTime.toFixed(3)}s -> ErrProb ${(probFlip*100).toFixed(1)}% -> ${isCorrupted ? "CORRUPT" : "OK"}\n`;
        }
    }

    consoleDiv.innerText += `...\n> Transmission Complete.\n> Received: "${outputStr}"`;

    // Update stats
    const avgWait = totalWait / inputStr.length;
    document.getElementById('simAvgWait').innerText = avgWait.toFixed(3) + 's';
    document.getElementById('simBer').innerText = ((errors / inputStr.length)*100).toFixed(1) + '%';
    
    // Theoretical Capacity (Corollary 2)
    // C = lambda * (1 - E[H(phi(W))])
    // This is complex to calc on fly, using approximation for display:
    // Low wait = High Cap. 
    const approxCap = (lambda * (1 - (avgWait * kappa * 0.5))).toFixed(2); // very rough heuristic
    document.getElementById('simCap').innerText = "~" + Math.max(0, approxCap) + " bits/s";
}

function randomChar() {
    const chars = "?#@&%$!";
    return chars.charAt(Math.floor(Math.random() * chars.length));
}
