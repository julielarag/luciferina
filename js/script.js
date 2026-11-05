const LOGO_PATH = "img/logo.svg";
const BACKGROUND_LOGO_PATH = "img/logo_correcto.png";
const PARTICLE_COLOR = "#00dbff";
const PARTICLE_COUNT = 150;
const PARTICLE_SIZE_MIN = 2;
const PARTICLE_SIZE_MAX = 2;
const LOGO_WIDTH_RATIO = 0.88;
const LOGO_HEIGHT_RATIO = 0.6;

let logo;
let backgroundLogo;
let particles = [];

function preload() {
    logo = loadImage(LOGO_PATH);
    backgroundLogo = loadImage(BACKGROUND_LOGO_PATH);
}

function setup() {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("sketch-container");
    pixelDensity(1);
    logo.loadPixels();
    createParticles();
    noStroke();
}

function createParticles() {
    particles = [];
    const logoPoints = [];

    for (let y = 0; y < logo.height; y++) {
        for (let x = 0; x < logo.width; x++) {
            const alpha = logo.pixels[(y * logo.width + x) * 4 + 3];

            if (alpha > 20) {
                logoPoints.push({ x, y });
            }
        }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const point = random(logoPoints);
        const diameter = random(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX);
        const isEllipse = random() > 0.55;

        particles.push({
            x: point.x,
            y: point.y,
            width: diameter * (isEllipse ? random(1.3, 2) : 1),
            height: diameter,
            phase: random(TWO_PI)
        });
    }
}

function draw() {
    clear();

    const scaleFactor = min(
        (width * LOGO_WIDTH_RATIO) / logo.width,
        (height * LOGO_HEIGHT_RATIO) / logo.height
    );
    const offsetX = (width - logo.width * scaleFactor) / 2;
    const offsetY = (height - logo.height * scaleFactor) / 2;

    push();
    translate(offsetX, offsetY);
    scale(scaleFactor);
    image(backgroundLogo, 0, 0, logo.width, logo.height);
    fill(PARTICLE_COLOR);

    for (const particle of particles) {
        const drift = frameCount * 0.018 + particle.phase;
        const x = particle.x + sin(drift) * 0.7;
        const y = particle.y + cos(drift) * 0.7;
        const pulse = 0.9 + sin(drift) * 0.1;

        ellipse(x, y, particle.width * pulse, particle.height * pulse);
    }

    pop();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
