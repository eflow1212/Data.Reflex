let song;
let fft;
let amplitude;
let currentScreen = "title"; 
let font;

let particles = [];
let particleCount = 1500; // More particles for a dense look
let connectionDistance = 50; // Distance to draw connections between particles
let maxConnections = 3; // Maximum connections per particle
let noiseScale = 0.01; // Scale for Perlin noise
let noiseTime = 0; // Time variable for noise
let flowField = []; // For storing the noise-based flow field
let fieldResolution = 200; // Resolution of the flow field
let flowFieldSize = 900; // Size of the flow field

let spectrum = [];
let waveform = [];
let energyBins = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0
};

let beatDetected = false;
let lastBeatTime = 0;
let beatThreshold = 0.8;   // Lower threshold for more subtle beats
let beatDelay = 250;        // Slightly longer delay between beats
let beatValue = 0;
let beatHistory = [];
let beatHistoryMax = 40;    // Longer history for more stable detection
let bassEnergy = 0;         // Specific tracking for bass energy
let previousBassEnergy = 0;
let bassTrigger = 0.2;      // Adjusted for more subtle bass

let angleX = 0;
let angleY = 0;
let targetAngleX = 0;
let targetAngleY = 0;
let previousMouseX, previousMouseY;

let userShapes = [];
let currentShape = [];
let toolMode = "move"; 

let globalTime = 0; 
let pulseSize = 1.5; // Size multiplier that pulses with the beat
let attractionPoint; 
let repulsionMode = false; 

let currentShape3D = [];
let targetShape3D = [];
let morphProgress = 0;
let shouldMorph = false;
let morphShapes = [
  "sphere", "torus", "cube", "wave"
];
let currentMorphShape = 0;
let morphSpeed = 0.02;

function preload() {
  song = loadSound('ageispolis.mp3');
  
  font = loadFont('https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  textFont(font);
  textAlign(CENTER, CENTER);
  
  fft = new p5.FFT(0.8, 1024);
  amplitude = new p5.Amplitude();
  
  for (let i = 0; i < beatHistoryMax; i++) {
    beatHistory.push(0);
  }
  
  generateFlowField();
  
  generateParticles();
  
  angleX = PI/8;
  angleY = PI/8;
  
  attractionPoint = createVector(0, 0, 0);
  
  initShapeMorph("sphere");
}

function draw() {
  background(0);
  
  if (song.isPlaying()) {
    analyzeAudio();
    detectBeat();
  }
  
  globalTime += 0.01;
  
  if (frameCount % 10 === 0) {
    updateFlowField();
  }
  
  if (shouldMorph) {
    morphProgress += morphSpeed;
    if (morphProgress >= 1) {
      morphProgress = 0;
      shouldMorph = false;
      
      currentShape3D = [...targetShape3D];
    }
  }
  
  if (currentScreen === "title") {
    drawTitleScreen();
  } else if (currentScreen === "experience") {
    drawExperienceScreen();
  } else if (currentScreen === "draw") {
    drawDrawScreen();
  }
}

function analyzeAudio() {
  fft.analyze();
  spectrum = fft.spectrum;
  waveform = fft.waveform();
  
  energyBins.bass = fft.getEnergy("bass");
  energyBins.lowMid = fft.getEnergy("lowMid");
  energyBins.mid = fft.getEnergy("mid");
  energyBins.highMid = fft.getEnergy("highMid");
  energyBins.treble = fft.getEnergy("treble");
  
  previousBassEnergy = bassEnergy;
  bassEnergy = energyBins.bass / 255;
}

function detectBeat() {
  let level = amplitude.getLevel();
  
  beatHistory.push(level);
  beatHistory.shift();
  
  let sum = 0;
  for (let i = 0; i < beatHistory.length; i++) {
    sum += beatHistory[i];
  }
  let avgLevel = sum / beatHistory.length;
  
  let currentTime = millis();
  if (level > avgLevel + beatThreshold && currentTime > lastBeatTime + beatDelay) {
    beatDetected = true;
    lastBeatTime = currentTime;
    beatValue = 1;
    
    // Trigger shape morphing on strong beats (randomly)
    if (random() < 0.8 && !shouldMorph) {
      triggerMorph();
    }
    
    // Toggle repulsion mode occasionally
    if (random() < 0.1) {
      repulsionMode = !repulsionMode;
    }
  } else {
    beatDetected = false;
    beatValue = max(0, beatValue - 0.05); 
  }
  
  if (bassEnergy - previousBassEnergy > bassTrigger) {
    // Special effect for bass drops
    pulseSize = 2;
  } else {
    pulseSize = lerp(pulseSize, 1 + (beatValue * 0.2), 0.1);
  }
}

function drawTitleScreen() {
  
  push();
  fill(255, 200);
  textSize(width / 20);
  text("DATA.REFLEX", 0, -100);
  
  textSize(width / 60);
  text("Click to Start", 0, 0);
  pop();
}

function drawExperienceScreen() {
  if (toolMode === "move" && mouseIsPressed && 
      mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    targetAngleY += (mouseX - pmouseX) * 0.01;
    targetAngleX += (mouseY - pmouseY) * 0.01;
  }
  
  angleX = lerp(angleX, targetAngleX, 0.1);
  angleY = lerp(angleY, targetAngleY, 0.1);
  
  rotateX(angleX);
  rotateY(angleY);
  
  rotateY(sin(globalTime * 0.2) * 0.02);
  rotateX(cos(globalTime * 0.3) * 0.02);
  
  updateParticleSystem();
  
  drawUserShapes();
  
  if (toolMode === "draw" && currentShape.length > 0) {
    push();
    stroke(255);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < currentShape.length; i++) {
      vertex(currentShape[i].x, currentShape[i].y, currentShape[i].z);
    }
    endShape();
    pop();
  }
  
  push();
  camera(); 
  noLights();
  
  // Draw minimalist beat visualizer at bottom
  drawMinimalistBeatVisualizer();
  
  pop();
}

function drawDrawScreen() {
  drawExperienceScreen();
}

function drawUserShapes() {
  push();
  stroke(255);
  strokeWeight(2);
  noFill();
  
  for (let shape of userShapes) {
    beginShape();
    for (let i = 0; i < shape.length; i++) {
      vertex(shape[i].x, shape[i].y, shape[i].z);
    }
    endShape(CLOSE);
  }
  pop();
}

function drawMinimalistBeatVisualizer() {
  let visualizerHeight = 30;
  let visualizerY = height - visualizerHeight - 10;
  
  push();
  noFill();
  stroke(255, 80);
  strokeWeight(1);
  
  // Draw waveform line
  beginShape();
  for (let i = 0; i < width; i += 2) {
    if (waveform && waveform.length > 0) {
      let index = floor(map(i, 0, width, 0, waveform.length));
      let y = map(waveform[index], -1, 1, visualizerY + visualizerHeight, visualizerY);
      vertex(i, y);
    } else {
      // If no waveform, draw a flat line
      vertex(i, visualizerY + visualizerHeight/2);
    }
  }
  endShape();
  
  // Draw beat indicator
  noStroke();
  fill(255, beatValue * 255);
  ellipse(width - 30, visualizerY + visualizerHeight/2, 20 * beatValue);
  
  pop();
}

function generateFlowField() {
  // Create a 3D flow field based on Perlin noise
  flowField = [];
  
  let cols = ceil(flowFieldSize / fieldResolution);
  let rows = cols;
  let layers = cols;
  
  for (let z = 0; z < layers; z++) {
    let layer = [];
    for (let y = 0; y < rows; y++) {
      let row = [];
      for (let x = 0; x < cols; x++) {
        // Calculate vector based on 3D Perlin noise
        let angle = noise(x * noiseScale, y * noiseScale, z * noiseScale + noiseTime) * TWO_PI * 2;
        let vec = p5.Vector.fromAngle(angle);
        vec.mult(0.5); // Scale down the force
        row.push(vec);
      }
      layer.push(row);
    }
    flowField.push(layer);
  }
}

function updateFlowField() {
  // Update the flow field over time
  noiseTime += 0.01;
  
  // If there's a beat, add more turbulence
  if (beatDetected) {
    noiseTime += 0.09;
  }
  
  generateFlowField();
}

function generateParticles() {
  // Generate initial particles
  particles = [];
  
  for (let i = 0; i < particleCount; i++) {
    let radius = random(100, 200);
    let theta = random(TWO_PI);
    let phi = random(PI);
    
    let x = radius * sin(phi) * cos(theta);
    let y = radius * sin(phi) * sin(theta);
    let z = radius * cos(phi);
    
    particles.push({
      position: createVector(x, y, z),
      velocity: createVector(0, 0, 0),
      acceleration: createVector(0, 0, 0),
      size: random(1, 3),
      brightness: random(50, 200),
      connections: [],
      lastUpdate: 0
    });
  }
}

function updateParticleSystem() {
  push();
  stroke(255);
  strokeWeight(0.5);
  
  let neighbors = {};
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    let gridX = floor(p.position.x / connectionDistance);
    let gridY = floor(p.position.y / connectionDistance);
    let gridZ = floor(p.position.z / connectionDistance);
    let gridKey = `${gridX},${gridY},${gridZ}`;
    
    if (!neighbors[gridKey]) {
      neighbors[gridKey] = [];
    }
    neighbors[gridKey].push(i);
  }
  
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    
    p.acceleration.mult(0);
    
    let flowForce = getFlowFieldForce(p.position);
    p.acceleration.add(flowForce);
    
    let direction = p5.Vector.sub(attractionPoint, p.position);
    let distance = direction.mag();
    
    if (distance > 0) {
      direction.normalize();
      
      if (repulsionMode) {
        direction.mult(-1);
      }
      
      let strength = 0.1 / (1 + distance * 0.01);
      direction.mult(strength);
      
      p.acceleration.add(direction);
    }
    
    if (song.isPlaying()) {
      let distFromCenter = p.position.mag();
      let normDist = constrain(map(distFromCenter, 0, 300, 0, 1), 0, 1);
      
      // Low frequencies affect particles closer to center, high frequencies affect outer particles
      let freqInfluence;
      if (normDist < 0.1) {
        freqInfluence = energyBins.bass / 255;
      } else if (normDist < 0.6) {
        freqInfluence = energyBins.mid / 255;
      } else {
        freqInfluence = energyBins.treble / 255;
      }
      
      // Add oscillation based on frequency
      let oscillation = p5.Vector.random3D();
      oscillation.mult(freqInfluence * 0.2);
      p.acceleration.add(oscillation);
      
      // On beat, add impulse toward current morph shape
      if (beatDetected) {
        let toMorphShape = getForceTowardMorphShape(p.position);
        toMorphShape.mult(0.6); // Scale the force
        p.acceleration.add(toMorphShape);
      }
    }
    
    let jitter = p5.Vector.random3D();
    jitter.mult(0.01);
    p.acceleration.add(jitter);
    
    p.velocity.add(p.acceleration);
    
    p.velocity.mult(0.97);
    
    let maxSpeed = 2;
    if (p.velocity.mag() > maxSpeed) {
      p.velocity.normalize();
      p.velocity.mult(maxSpeed);
    }
    
    p.position.add(p.velocity);
    
    let maxRadius = 300;
    let r = p.position.mag();
    if (r > maxRadius) {
      let oppositeDir = p.position.copy().mult(-1).normalize();
      p.position = oppositeDir.mult(maxRadius * 0.9);
      p.velocity.mult(0.5);
    }
  }
  
  let drawnConnections = new Set(); // To avoid drawing the same connection twice
  
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    p.connections = []; // Reset connections
    
    let gridX = floor(p.position.x / connectionDistance);
    let gridY = floor(p.position.y / connectionDistance);
    let gridZ = floor(p.position.z / connectionDistance);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          let checkKey = `${gridX + dx},${gridY + dy},${gridZ + dz}`;
          if (neighbors[checkKey]) {
            for (let j of neighbors[checkKey]) {
              if (i !== j) {
                let otherP = particles[j];
                let d = p5.Vector.dist(p.position, otherP.position);
                
                if (d < connectionDistance && p.connections.length < maxConnections) {
                  // Add connection if not already connected
                  if (!p.connections.includes(j)) {
                    p.connections.push(j);
                    
                    // Create a unique key for this connection (smaller index first)
                    let connectionKey = i < j ? `${i}-${j}` : `${j}-${i}`;
                    
                    // Only draw if we haven't drawn this connection yet
                    if (!drawnConnections.has(connectionKey)) {
                      drawnConnections.add(connectionKey);
                      
                      // Adjust alpha based on distance
                      let alpha = map(d, 0, connectionDistance, 150, 20);
                      stroke(255, alpha);
                      
                      // Draw the connection
                      line(
                        p.position.x, p.position.y, p.position.z,
                        otherP.position.x, otherP.position.y, otherP.position.z
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    push();
    translate(p.position.x, p.position.y, p.position.z);
    
    let displaySize = p.size * pulseSize;
    
    // Draw as point for better performance
    strokeWeight(displaySize);
    stroke(255, p.brightness);
    point(0, 0);
    pop();
  }
  
  pop();
}

function getFlowFieldForce(position) {
  // Convert world position to flow field indices
  let cols = flowField[0][0].length;
  let rows = flowField[0].length;
  let layers = flowField.length;
  
  let halfSize = flowFieldSize / 2;
  
  // Map position from world space to flow field indices
  let x = floor(map(position.x, -halfSize, halfSize, 0, cols - 1));
  let y = floor(map(position.y, -halfSize, halfSize, 0, rows - 1));
  let z = floor(map(position.z, -halfSize, halfSize, 0, layers - 1));
  
  // Ensure indices are in bounds
  x = constrain(x, 0, cols - 1);
  y = constrain(y, 0, rows - 1);
  z = constrain(z, 0, layers - 1);
  
  // Get the flow vector at this position
  return flowField[z][y][x].copy();
}

function initShapeMorph(shapeName) {
  currentShape3D = [];
  targetShape3D = [];
  
  // Number of points to generate for the shape
  let numPoints = 200;
  
  // Generate current shape (just generate random points on a sphere as starting point)
  for (let i = 0; i < numPoints; i++) {
    let radius = 200;
    let theta = random(TWO_PI);
    let phi = random(PI);
    
    let x = radius * sin(phi) * cos(theta);
    let y = radius * sin(phi) * sin(theta);
    let z = radius * cos(phi);
    
    currentShape3D.push(createVector(x, y, z));
  }
  
  // Generate target shape based on the requested shape
  generateTargetShape(shapeName, numPoints);
}

function generateTargetShape(shapeName, numPoints) {
  targetShape3D = [];
  
  if (shapeName === "sphere") {
    // Generate points on a sphere
    for (let i = 0; i < numPoints; i++) {
      let radius = 200;
      let theta = random(TWO_PI);
      let phi = random(PI);
      
      let x = radius * sin(phi) * cos(theta);
      let y = radius * sin(phi) * sin(theta);
      let z = radius * cos(phi);
      
      targetShape3D.push(createVector(x, y, z));
    }
  } else if (shapeName === "torus") {
    // Generate points on a torus
    let R = 150; // Major radius
    let r = 50;  // Minor radius
    
    for (let i = 0; i < numPoints; i++) {
      let theta = random(TWO_PI);
      let phi = random(TWO_PI);
      
      let x = (R + r * cos(phi)) * cos(theta);
      let y = (R + r * cos(phi)) * sin(theta);
      let z = r * sin(phi);
      
      targetShape3D.push(createVector(x, y, z));
    }
  } else if (shapeName === "cube") {
    // Generate points on a cube
    let size = 150;
    
    for (let i = 0; i < numPoints; i++) {
      // Randomly select one of the 6 faces
      let face = floor(random(6));
      let x, y, z;
      
      switch (face) {
        case 0: // Front face
          x = random(-size, size);
          y = random(-size, size);
          z = size;
          break;
        case 1: // Back face
          x = random(-size, size);
          y = random(-size, size);
          z = -size;
          break;
        case 2: // Left face
          x = -size;
          y = random(-size, size);
          z = random(-size, size);
          break;
        case 3: // Right face
          x = size;
          y = random(-size, size);
          z = random(-size, size);
          break;
        case 4: // Top face
          x = random(-size, size);
          y = -size;
          z = random(-size, size);
          break;
        case 5: // Bottom face
          x = random(-size, size);
          y = size;
          z = random(-size, size);
          break;
      }
      
      targetShape3D.push(createVector(x, y, z));
    }
  } else if (shapeName === "wave") {
    // Generate points on a wave surface
    let size = 200;
    
    for (let i = 0; i < numPoints; i++) {
      let x = random(-size, size);
      let z = random(-size, size);
      
      // Wave function for y
      let frequency = 0.02;
      let amplitude = 50;
      let y = amplitude * sin(x * frequency) * cos(z * frequency);
      
      targetShape3D.push(createVector(x, y, z));
    }
  }
}

function triggerMorph() {
  // Select next shape to morph to
  currentMorphShape = (currentMorphShape + 1) % morphShapes.length;
  generateTargetShape(morphShapes[currentMorphShape], 200);
  
  // Start morphing
  morphProgress = 0;
  shouldMorph = true;
}

function getForceTowardMorphShape(position) {
  // Find the closest point in the target shape
  let closestPoint = null;
  let minDist = Infinity;
  
  let targetPoints = shouldMorph ? 
    interpolateShapes(currentShape3D, targetShape3D, morphProgress) : 
    currentShape3D;
  
  for (let point of targetPoints) {
    let d = p5.Vector.dist(position, point);
    if (d < minDist) {
      minDist = d;
      closestPoint = point;
    }
  }
  
  if (closestPoint) {
    let force = p5.Vector.sub(closestPoint, position);
    force.normalize();
    return force;
  }
  
  return createVector(0, 0, 0);
}

function interpolateShapes(shape1, shape2, progress) {
  // Interpolate between two shapes based on progress (0-1)
  let result = [];
  
  for (let i = 0; i < min(shape1.length, shape2.length); i++) {
    let x = lerp(shape1[i].x, shape2[i].x, progress);
    let y = lerp(shape1[i].y, shape2[i].y, progress);
    let z = lerp(shape1[i].z, shape2[i].z, progress);
    
    result.push(createVector(x, y, z));
  }
  
  return result;
}

function mousePressed() {
  if (currentScreen === "title") {
    // Start the experience when clicked from title screen
    currentScreen = "experience";
    if (!song.isPlaying()) {
      song.play();
    }
  } else if (currentScreen === "experience" || currentScreen === "draw") {
    // Handle interactions in experience mode
    if (toolMode === "draw") {
      // Start a new shape or add to existing shape
      let mouse3D = getMouseIn3D();
      if (mouse3D) {
        currentShape.push(mouse3D);
      }
    }
  }
}

function mouseDragged() {
  if ((currentScreen === "experience" || currentScreen === "draw") && toolMode === "draw") {
    // Add points to the current shape
    if (frameCount % 5 === 0) { // Only add points every few frames to avoid too many
      let mouse3D = getMouseIn3D();
      if (mouse3D) {
        currentShape.push(mouse3D);
      }
    }
  }
}

function mouseReleased() {
  previousMouseX = null;
  previousMouseY = null;
}

function getMouseIn3D() {
  
  let mouseNormX = (mouseX / width) * 2 - 1;
  let mouseNormY = (mouseY / height) * 2 - 1;
  
  let mousePlaneZ = 200; // Distance from camera
  let mouseXin3D = mouseNormX * mousePlaneZ;
  let mouseYin3D = -mouseNormY * mousePlaneZ;
  
  let rotatedX = mouseXin3D * cos(angleY) + mousePlaneZ * sin(angleY);
  let rotatedY = mouseYin3D * cos(angleX) - mousePlaneZ * sin(angleX) * sin(angleY);
  let rotatedZ = -mouseYin3D * sin(angleX) - mousePlaneZ * cos(angleX) * sin(angleY);
  
  return createVector(rotatedX, rotatedY, rotatedZ);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
