// --- Global Variable for Chart ---
let myChart;

// --- Navigation Logic ---
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    // Reset Sidebar Buttons
    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('bg-slate-800', 'text-white', 'border-indigo-500', 'border-emerald-500', 'border-rose-500', 'border-amber-500');
        el.classList.add('text-slate-300', 'border-transparent');
    });
    
    // Show Target Tab
    document.getElementById(tabId).classList.add('active');
    
    // Highlight Button
    const btn = document.getElementById('btn-' + tabId);
    btn.classList.remove('text-slate-300', 'border-transparent');
    btn.classList.add('bg-slate-800', 'text-white');
    
    // Add specific border color based on tab
    if(tabId === 'problem') btn.classList.add('border-indigo-500');
    if(tabId === 'erasure') btn.classList.add('border-emerald-500');
    if(tabId === 'bitflip') btn.classList.add('border-rose-500');
    if(tabId === 'insights') btn.classList.add('border-amber-500');

    // --- CRITICAL FIX FOR CHART.JS ---
    // Chart.js cannot render on a hidden canvas (width=0). 
    // When switching to the erasure tab, we must manually trigger a resize/update.
    if (tabId === 'erasure' && window.myChart) {
        setTimeout(() => {
            window.myChart.resize();
            window.myChart.update();
        }, 50); // Short delay to allow CSS display:block to apply
    }
}

// --- Initialize Chart on Load ---
document.addEventListener("DOMContentLoaded", function() {
    const ctx = document.getElementById('capacityChart').getContext('2d');
    const kappaSlider = document.getElementById('kappa-slider');
    const lambdaSlider = document.getElementById('lambda-slider');
    const valKappa = document.getElementById('val-kappa');
    const valLambda = document.getElementById('val-lambda');
    const resMM1 = document.getElementById('res-mm1');
    const resMD1 = document.getElementById('res-md1');

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                {
                    label: 'M/M/1 (Random Service)',
                    borderColor: '#2563EB',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    data: [],
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'M/D/1 (Deterministic)',
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.0)',
                    borderDash: [5, 5],
                    data: [],
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { 
                    title: { display: true, text: 'Arrival Rate (λ)' }, 
                    min: 0, max: 1,
                    grid: { display: false }
                },
                y: { 
                    title: { display: true, text: 'Capacity (bits/sec)' }, 
                    min: 0, max: 1,
                    border: { dash: [4, 4] }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 13 },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: true
                }
            }
        }
    });

    // --- Capacity Formulas from the Paper ---
    function calculateCapacityMM1(lambda, kappa) {
        const alpha = 1 / (1 + kappa);
        const denom = 1 - (alpha * lambda);
        if (denom <= 0.001) return 0; // Avoid division by zero/singularity visuals
        return (lambda * (1 - lambda)) / denom;
    }

    function calculateCapacityMD1(lambda, kappa) {
        const alpha = (1 - Math.exp(-kappa)) / kappa;
        const denom = 1 - (alpha * lambda);
        if (denom <= 0.001) return 0;
        return (lambda * (1 - lambda)) / denom;
    }

    // --- Update Function ---
    function updateChart() {
        const k = parseFloat(kappaSlider.value);
        const l = parseFloat(lambdaSlider.value);
        
        valKappa.textContent = k.toFixed(2);
        valLambda.textContent = l.toFixed(2);

        const labels = [];
        const dataMM1 = [];
        const dataMD1 = [];
        
        // Plot curve from 0.01 to 0.99
        for(let i=1; i<100; i++) {
            const lam = i/100;
            labels.push(lam.toFixed(2));
            dataMM1.push(calculateCapacityMM1(lam, k));
            dataMD1.push(calculateCapacityMD1(lam, k));
        }

        window.myChart.data.labels = labels;
        window.myChart.data.datasets[0].data = dataMM1;
        window.myChart.data.datasets[1].data = dataMD1;
        
        // Calculate Specific Point
        const currentMM1 = calculateCapacityMM1(l, k);
        const currentMD1 = calculateCapacityMD1(l, k);
        
        resMM1.textContent = currentMM1.toFixed(3);
        resMD1.textContent = currentMD1.toFixed(3);

        window.myChart.update('none'); // Update without full re-animation for smoothness
    }

    kappaSlider.addEventListener('input', updateChart);
    lambdaSlider.addEventListener('input', updateChart);
    
    // Initial call
    updateChart();
});

// --- Bit-Flip Simulation Logic ---
function runSimulation() {
    const msg = document.getElementById('sim-input').value;
    const lam = parseFloat(document.getElementById('sim-lambda').value);
    const kappa = parseFloat(document.getElementById('sim-kappa').value);
    const consoleDiv = document.getElementById('sim-console');

    consoleDiv.innerHTML = '';
    
    // Binary conversion
    let binaryMsg = '';
    for (let i = 0; i < msg.length; i++) {
        binaryMsg += msg[i].charCodeAt(0).toString(2).padStart(8, '0');
    }

    consoleDiv.innerHTML += `<div><span class="text-blue-400">></span> Transforming "${msg}" to ${binaryMsg.length} qubits...</div>`;

    let errors = 0;
    let totalWait = 0;
    let outputBinary = '';

    let currentTime = 0;
    let departureTime = 0;

    for(let i=0; i<binaryMsg.length; i++) {
        // Inter-arrival (Exp(lambda))
        const interArrival = -Math.log(1 - Math.random()) / lam;
        currentTime += interArrival;

        const arrival = currentTime;
        const serviceStart = Math.max(arrival, departureTime);
        const waitTime = serviceStart - arrival;
        totalWait += waitTime;

        // Service Time (Exp(mu=1))
        const serviceTime = -Math.log(1 - Math.random());
        departureTime = serviceStart + serviceTime;

        // Bit Flip Probability
        const errorProb = 0.5 * (1 - Math.exp(-kappa * waitTime));
        
        const originalBit = binaryMsg[i];
        let receivedBit = originalBit;
        let status = "OK";

        if(Math.random() < errorProb) {
            receivedBit = originalBit === '0' ? '1' : '0';
            errors++;
            status = "FLIP";
        }

        outputBinary += receivedBit;
        
        // Log first 8 qubits or any errors found
        if(i < 8 || status === "FLIP") {
            const color = status === "FLIP" ? "text-rose-500 font-bold" : "text-green-500";
            consoleDiv.innerHTML += `<div class="font-mono border-l-2 border-slate-700 pl-2 mb-1 opacity-90 hover:opacity-100 transition">
                Q[${i.toString().padStart(2, '0')}] Wait:${waitTime.toFixed(2)}s | ErrProb:${errorProb.toFixed(2)} | <span class="${color}">${status}</span>
            </div>`;
        }
    }
    
    const avgWait = totalWait / binaryMsg.length;
    const ber = errors / binaryMsg.length;
    
    // Note: This capacity calc is for M/M/1 Erasure, used here as a proxy for "Performance"
    const theoreticalCap = (lam * (1 - lam) / (1 - (1/(1+kappa))*lam)).toFixed(3);

    document.getElementById('sim-wait').innerText = avgWait.toFixed(2) + "s";
    document.getElementById('sim-ber').innerText = (ber * 100).toFixed(1) + "%";
    document.getElementById('sim-cap').innerText = theoreticalCap;

    consoleDiv.innerHTML += `<div class="mt-4 text-white border-t border-slate-600 pt-2"><span class="text-green-400">></span> Transmission Complete. ${errors} errors.</div>`;
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}
