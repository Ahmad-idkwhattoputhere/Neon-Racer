
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Interface elements
const $ = (id) => document.getElementById(id);

const ui = {
    distance: $("distance"),
    score: $("score"),
    bestScore: $("bestScore"),
    speed: $("speed"),
    speedFill: $("speedFill"),
    nitroFill: $("nitroFill"),
    nitroPercent: $("nitroPercent"),
    carsPassed: $("carsPassed"),
    level: $("level"),
    gameStatus: $("gameStatus"),
    startScreen: $("startScreen"),
    pauseScreen: $("pauseScreen"),
    gameOverScreen: $("gameOverScreen"),
    finalScore: $("finalScore")
};

// Game dimensions
const W = canvas.width;
const H = canvas.height;

const ROAD = {
    left: 85,
    right: 415,
    width: 330,
    lanes: [140, 250, 360]
};

// Game state
let state = "ready";
let lastTime = 0;
let roadOffset = 0;
let spawnTimer = 0;
let distance = 0;
let score = 0;
let carsPassed = 0;
let speed = 0;
let nitro = 100;
let nitroActive = false;
let traffic = [];
let particles = [];

let bestScore = 0;

try {
    bestScore = Number(localStorage.getItem("neonRacerBest")) || 0;
} catch {
    bestScore = 0;
}

ui.bestScore.textContent = bestScore;

// Player car
const player = {
    x: 250,
    y: 620,
    width: 48,
    height: 88,
    steering: 0
};

// Keyboard controls
const keys = {};

window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    if (["arrowleft", "arrowright", "arrowup", " ", "arrowdown"].includes(key)) {
        e.preventDefault();
    }

    keys[key] = true;

    if (key === "escape") {
        if (state === "playing") pauseGame();
        else if (state === "paused") resumeGame();
    }
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    if (state === "playing") pauseGame();
});

// Random number helper
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Draw a rounded rectangle
function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
}

// Road background
function drawRoad(dt) {
    // Grass / surrounding area
    ctx.fillStyle = "#10251d";
    ctx.fillRect(0, 0, W, H);

    // Road surface
    ctx.fillStyle = "#292e38";
    ctx.fillRect(ROAD.left, 0, ROAD.width, H);

    // Road texture
    for (let i = 0; i < 35; i++) {
        const x = ROAD.left + ((i * 73) % ROAD.width);
        const y = ((i * 137 + roadOffset * 0.35) % H);

        ctx.fillStyle = "#ffffff08";
        ctx.fillRect(x, y, 2, 12);
    }

    // Roadside strips
    ctx.fillStyle = "#e9e9e9";
    ctx.fillRect(ROAD.left - 9, 0, 9, H);
    ctx.fillRect(ROAD.right, 0, 9, H);

    // Red and white rumble strips
    const stripHeight = 45;

    for (let y = -stripHeight; y < H + stripHeight; y += stripHeight) {
        const offset = (y + roadOffset) % H;
        const index = Math.floor((y + roadOffset) / stripHeight);

        ctx.fillStyle = index % 2 === 0 ? "#ff3e65" : "#f5f5f5";
        ctx.fillRect(ROAD.left - 9, offset, 9, stripHeight);
        ctx.fillRect(ROAD.right, offset, 9, stripHeight);
    }

    // Lane markings
    ctx.setLineDash([35, 30]);
    ctx.lineDashOffset = -roadOffset;

    ctx.strokeStyle = "#dce4ed";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(195, 0);
    ctx.lineTo(195, H);
    ctx.moveTo(305, 0);
    ctx.lineTo(305, H);
    ctx.stroke();

    ctx.setLineDash([]);

    // Roadside lights
    for (let i = 0; i < 10; i++) {
        const y = (i * 95 + roadOffset * 0.8) % H;

        ctx.fillStyle = "#00e5ff";
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 12;

        ctx.fillRect(62, y, 4, 15);
        ctx.fillRect(434, y, 4, 15);

        ctx.shadowBlur = 0;
    }
}

// Draw a detailed racing car
function drawCar(x, y, color, isPlayer = false) {
    ctx.save();
    ctx.translate(x, y);

    const w = isPlayer ? player.width : 46;
    const h = isPlayer ? player.height : 84;

    // Shadow
    ctx.fillStyle = "#0008";
    roundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 10);
    ctx.fill();

    // Wheels
    ctx.fillStyle = "#080b10";

    for (const side of [-1, 1]) {
        roundedRect(side * (w / 2 - 2) - 5, -h / 2 + 12, 9, 22, 3);
        ctx.fill();

        roundedRect(side * (w / 2 - 2) - 5, h / 2 - 34, 9, 22, 3);
        ctx.fill();
    }

    // Main body
    const gradient = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    gradient.addColorStop(0, "#171b25");
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, "#171b25");

    ctx.fillStyle = gradient;
    roundedRect(-w / 2, -h / 2, w, h, 11);
    ctx.fill();

    // Body highlight
    ctx.fillStyle = "#ffffff22";
    roundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, 12, 5);
    ctx.fill();

    // Windscreen
    ctx.fillStyle = "#152e40";
    roundedRect(-w / 2 + 7, -h / 2 + 20, w - 14, 23, 7);
    ctx.fill();

    // Windscreen reflection
    ctx.fillStyle = "#8deeff22";
    ctx.fillRect(-w / 2 + 11, -h / 2 + 24, 5, 13);

    // Rear window
    ctx.fillStyle = "#142b3a";
    roundedRect(-w / 2 + 8, h / 2 - 38, w - 16, 15, 5);
    ctx.fill();

    // Central stripe
    ctx.fillStyle = isPlayer ? "#ffffff55" : "#ffffff30";
    ctx.fillRect(-2, -h / 2 + 5, 4, h - 10);

    // Headlights
    ctx.fillStyle = "#d8fbff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = isPlayer ? 14 : 5;

    ctx.fillRect(-w / 2 + 5, -h / 2 + 3, 10, 5);
    ctx.fillRect(w / 2 - 15, -h / 2 + 3, 10, 5);

    ctx.shadowBlur = 0;

    // Rear lights
    ctx.fillStyle = "#ff315e";
    ctx.fillRect(-w / 2 + 5, h / 2 - 8, 10, 5);
    ctx.fillRect(w / 2 - 15, h / 2 - 8, 10, 5);

    // Player neon glow
    if (isPlayer) {
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 15;

        roundedRect(-w / 2, -h / 2, w, h, 11);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

// Traffic generation
function spawnTraffic() {
    const lane = Math.floor(Math.random() * ROAD.lanes.length);

    // Avoid spawning directly beside another car
    const blocked = traffic.some(car =>
        Math.abs(car.x - ROAD.lanes[lane]) < 5 && car.y < 145
    );

    if (blocked) return;

    const colors = [
        "#f04465",
        "#f6a623",
        "#9c6cff",
        "#e9edf5",
        "#29a7e8",
        "#3bc58a"
    ];

    traffic.push({
        x: ROAD.lanes[lane],
        y: -100,
        speed: random(30, 100),
        color: colors[Math.floor(Math.random() * colors.length)],
        passed: false
    });
}

// Particles
function addParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x,
            y,
            vx: random(-150, 150),
            vy: random(-150, 150),
            life: random(0.25, 0.65),
            maxLife: 0.65,
            color
        });
    }
}

function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }

    ctx.globalAlpha = 1;
}

// Collision detection
function collides(a, b) {
    return (
        Math.abs(a.x - b.x) < (a.width + 46) / 2 - 8 &&
        Math.abs(a.y - b.y) < (a.height + 84) / 2 - 12
    );
}

// Start or restart
function resetGame() {
    state = "playing";

    player.x = 250;
    player.steering = 0;

    distance = 0;
    score = 0;
    carsPassed = 0;
    speed = 180;
    nitro = 100;
    nitroActive = false;

    roadOffset = 0;
    spawnTimer = 0.5;

    traffic = [];
    particles = [];

    Object.keys(keys).forEach(key => keys[key] = false);

    ui.startScreen.classList.add("hidden");
    ui.pauseScreen.classList.add("hidden");
    ui.gameOverScreen.classList.add("hidden");

    ui.gameStatus.textContent = "RACE IN PROGRESS";

    updateUI();
    lastTime = performance.now();
}

function pauseGame() {
    if (state !== "playing") return;

    state = "paused";
    ui.pauseScreen.classList.remove("hidden");
    ui.gameStatus.textContent = "PAUSED";
}

function resumeGame() {
    if (state !== "paused") return;

    state = "playing";
    ui.pauseScreen.classList.add("hidden");
    ui.gameStatus.textContent = "RACE IN PROGRESS";

    lastTime = performance.now();
}

function endGame() {
    state = "over";

    addParticles(player.x, player.y, "#ff3e65", 35);

    ui.finalScore.textContent = Math.floor(score);
    ui.gameOverScreen.classList.remove("hidden");
    ui.gameStatus.textContent = "RACE FINISHED";

    if (score > bestScore) {
        bestScore = Math.floor(score);
        ui.bestScore.textContent = bestScore;

        try {
            localStorage.setItem("neonRacerBest", bestScore);
        } catch {
            // Game remains playable if storage is unavailable.
        }
    }
}

// Interface updates
function updateUI() {
    const level = Math.floor(distance / 500) + 1;

    ui.distance.innerHTML = `${Math.floor(distance)} <small>m</small>`;
    ui.score.textContent = Math.floor(score);
    ui.bestScore.textContent = bestScore;
    ui.speed.textContent = Math.round(speed / 2.5);
    ui.carsPassed.textContent = carsPassed;
    ui.level.textContent = String(level).padStart(2, "0");

    ui.speedFill.style.width = `${Math.min(speed / 600 * 100, 100)}%`;
    ui.nitroFill.style.width = `${nitro}%`;
    ui.nitroPercent.textContent = `${Math.round(nitro)}%`;
}

// Main game update
function update(dt) {
    if (state !== "playing") return;

    const accelerating = keys["w"] || keys["arrowup"];
    const braking = keys["s"] || keys["arrowdown"];
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];

    nitroActive = keys[" "] && nitro > 0;

    let targetSpeed = 180;

    if (accelerating) targetSpeed = 340;
    if (braking) targetSpeed = 90;

    if (nitroActive) {
        targetSpeed = 520;
        nitro = Math.max(0, nitro - 35 * dt);
    } else {
        nitro = Math.min(100, nitro + 10 * dt);
    }

    speed += (targetSpeed - speed) * Math.min(1, dt * 2.5);

    // Steering
    const steering = (right ? 1 : 0) - (left ? 1 : 0);
    player.steering += (steering - player.steering) * Math.min(1, dt * 10);

    player.x += player.steering * (300 + speed * 0.35) * dt;

    player.x = Math.max(
        ROAD.left + 28,
        Math.min(ROAD.right - 28, player.x)
    );

    // Road movement
    roadOffset = (roadOffset + speed * dt) % 75;

    // Distance and score
    distance += speed * dt * 0.09;
    score += speed * dt * 0.12;

    // Difficulty
    const level = Math.floor(distance / 500) + 1;

    // Spawn traffic
    spawnTimer -= dt;

    const spawnInterval = Math.max(0.65, 1.55 - level * 0.055);

    if (spawnTimer <= 0) {
        spawnTraffic();
        spawnTimer = random(spawnInterval * 0.8, spawnInterval * 1.2);
    }

    // Update traffic
    for (let i = traffic.length - 1; i >= 0; i--) {
        const car = traffic[i];

        car.y += (speed * 0.55 + car.speed) * dt;

        const enemy = {
            x: car.x,
            y: car.y,
            width: 46,
            height: 84
        };

        if (collides(player, enemy)) {
            addParticles(player.x, player.y, "#ff3e65", 25);
            endGame();
            break;
        }

        if (!car.passed && car.y > player.y + 65) {
            car.passed = true;
            carsPassed++;
            score += 100;
        }

        if (car.y > H + 100) {
            traffic.splice(i, 1);
        }
    }

    // Nitro trail
    if (nitroActive && Math.random() > 0.35) {
        addParticles(
            player.x + random(-12, 12),
            player.y + 43,
            "#00e5ff",
            1
        );
    }

    drawParticles(dt);
    updateUI();
}

// Rendering
function draw() {
    ctx.clearRect(0, 0, W, H);

    drawRoad(0);

    // Traffic
    traffic.forEach(car => {
        drawCar(car.x, car.y, car.color);
    });

    // Nitro flame
    if (nitroActive && state === "playing") {
        ctx.save();
        ctx.fillStyle = "#00e5ff";
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.moveTo(player.x - 9, player.y + 43);
        ctx.lineTo(player.x, player.y + random(60, 85));
        ctx.lineTo(player.x + 9, player.y + 43);
        ctx.fill();

        ctx.restore();
    }

    // Player
    drawCar(player.x, player.y, "#00d9f5", true);

    // Particles
    drawParticles(0);
}

// Animation loop
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.04) || 0;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Button events
$("startButton").addEventListener("click", resetGame);
$("restartButton").addEventListener("click", resetGame);
$("resumeButton").addEventListener("click", resumeGame);
$("pauseButton").addEventListener("click", pauseGame);

// Initial setup
updateUI();
draw();
requestAnimationFrame((timestamp) => {
    lastTime = timestamp;
    gameLoop(timestamp);
});
