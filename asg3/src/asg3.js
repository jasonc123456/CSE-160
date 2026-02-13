window.ASG3 = window.ASG3 || {};
const ASG3 = window.ASG3;
var vertexShaderSource = `
  attribute vec3 a_Position;
  attribute vec2 a_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_UV;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
    v_UV = a_UV;
  }
`;
var fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_FragColor;
  uniform float u_texColorWeight;
  uniform int u_whichTexture;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  varying vec2 v_UV;
  void main() {
    vec4 texColor = vec4(1.0);
    if (u_whichTexture == 0) texColor = texture2D(u_Sampler0, v_UV);
    else if (u_whichTexture == 1) texColor = texture2D(u_Sampler1, v_UV);
    else if (u_whichTexture == 2) texColor = texture2D(u_Sampler2, v_UV);
    float t = u_texColorWeight;
    gl_FragColor = (1.0 - t) * u_FragColor + t * texColor;
  }
`;
//global variables
let canvas, gl;
let aPosition, uFragColor, uModelMatrix, uGlobalRotateMatrix;
let cubeVertexBuffer = null;
let gAnimalGlobalRotation = 0;
let gHipAngle = 0;
let gKneeAngle = 0;
let gAnimationOn = false;
//UI joint angles for manual movement when animation is off
let gHipAngleUI = 0;
let gKneeAngleUI = 0;
let gAnkleAngleUI = 0;
//3rd level joint + extra animated parts
let gAnkleAngle = 0;
let gHeadYaw = 0;
let gHeadYawUI = 0;
let gTailAngle = 0;
let gBlink = 0;
let gMouthOpen = 0;
let gEarFlap = 0;
//mouse control rotation
let gMouseYaw = 0;
let gMousePitch = 0;
//poke animation (shift-click)
let gPokeStartMs = -1;
//fps
let g_lastMs = 0;
//non-cube primitive (cylinder)
let cylVertexBuffer = null;
let cylVertCount = 0;
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
const CUBE_VERTS = new Float32Array([
  //Front (+Z)
  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5,   0.5, 0.5, 0.5,
  -0.5,-0.5, 0.5,   0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,
  //Back (-Z)
  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5,
  -0.5,-0.5,-0.5,   0.5, 0.5,-0.5,   0.5,-0.5,-0.5,
  //Left (-X)
  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5,  -0.5, 0.5, 0.5,
  -0.5,-0.5,-0.5,  -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,
  //Right (+X)
   0.5,-0.5,-0.5,   0.5, 0.5,-0.5,   0.5, 0.5, 0.5,
   0.5,-0.5,-0.5,   0.5, 0.5, 0.5,   0.5,-0.5, 0.5,
  //Top (+Y)
  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5,   0.5, 0.5, 0.5,
  -0.5, 0.5,-0.5,   0.5, 0.5, 0.5,   0.5, 0.5,-0.5,
  //Bottom (-Y)
  -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,
  -0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5,
]);
const POKE_MS = 900;
function isPokeActive(nowMs) {
  return (gPokeStartMs >= 0) && ((nowMs - gPokeStartMs) < POKE_MS);
}
function initCubeBuffer(){
  cubeVertexBuffer = gl.createBuffer();
  if(!cubeVertexBuffer){
    console.log("Failed to create cubeVertexBuffer");
    return false;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTS, gl.STATIC_DRAW);
  return true;
}
function buildCylinderVerts(segments){
  const verts = [];
  const r = 0.5;
  const yTop = 0.5;
  const yBot = -0.5;
  for(let i = 0; i < segments; i++){
    const t0 = (i / segments) * 2 * Math.PI;
    const t1 = ((i + 1) / segments) * 2 * Math.PI;
    const x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    const x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    //side
    verts.push(
      x0, yBot, z0, x1, yBot, z1, x1, yTop, z1,
      x0, yBot, z0, x1, yTop, z1, x0, yTop, z0
    );
    //top cap
    verts.push(0, yTop, 0,  x1, yTop, z1,  x0, yTop, z0);
    //bottom cap
    verts.push(0, yBot, 0,  x0, yBot, z0,  x1, yBot, z1);
  }
  return new Float32Array(verts);
}
function initCylinderBuffer(){
  const data = buildCylinderVerts(24);
  cylVertCount = data.length / 3;
  cylVertexBuffer = gl.createBuffer();
  if(!cylVertexBuffer){
    console.log("Failed to create cylVertexBuffer");
    return false;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, cylVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return true;
}
function setupWebGl(){
  canvas = document.getElementById("webgl");
  if(!canvas){
    console.log("Canvas #webgl not found (check your HTML).");
    return;
  }
  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if(!gl){
    console.log("Failed to get WebGL context");
    return;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.53, 0.81, 0.92, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
function connectVariablesToGlsl(){
  if(!initShaders(gl, vertexShaderSource, fragmentShaderSource)){
    console.log("Failed to initialize shaders");
    return;
  }
  //Get attribute and uniform locations
  aPosition = gl.getAttribLocation(gl.program, "a_Position");
  if(aPosition < 0){
    console.log("Failed to get attribute location: a_Position");
    return;
  }
  uFragColor = gl.getUniformLocation(gl.program, "u_FragColor");
  if(!uFragColor){
    console.log("Failed to get uniform location: u_FragColor");
    return;
  }
  uModelMatrix = gl.getUniformLocation(gl.program, "u_ModelMatrix");
  uGlobalRotateMatrix = gl.getUniformLocation(gl.program, "u_GlobalRotateMatrix");
  if(!uModelMatrix || !uGlobalRotateMatrix){
    console.log("Failed to get matrix uniform(s)");
    return;
  }
  //cube buffer (ADD)
  if(!initCubeBuffer()){
    return;
  }
  //cylinder buffer for non-cube primitive
  if(!initCylinderBuffer()){
    return;
  }
  //Initialize matrices to identity
  const I = new Matrix4();
  gl.uniformMatrix4fv(uModelMatrix, false, I.elements);
  gl.uniformMatrix4fv(uGlobalRotateMatrix, false, I.elements);
}
//drawCube and scene render (ADD)
function drawCube(M, color){
  gl.uniformMatrix4fv(uModelMatrix, false, M.elements);
  gl.uniform4f(uFragColor, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}
function drawCylinder(M, color){
  gl.uniformMatrix4fv(uModelMatrix, false, M.elements);
  gl.uniform4f(uFragColor, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, cylVertexBuffer);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.drawArrays(gl.TRIANGLES, 0, cylVertCount);
}
function drawLeg(root, x, z, hipDeg, kneeDeg, ankleDeg, legColor, hoofColor){
  const attachY = -0.05;
  //hip frame (level 1)
  const M = new Matrix4();
  M.set(root);
  M.translate(x, attachY, z);
  M.rotate(hipDeg, 0, 0, 1);
  //thigh
  {
    const T = new Matrix4();
    T.set(M);
    T.translate(0, -0.12, 0);
    T.scale(0.14, 0.24, 0.14);
    drawCube(T, legColor);
  }
  //knee pivot level 2
  M.translate(0, -0.24, 0);
  M.rotate(kneeDeg, 0, 0, 1);
  //calf
  {
    const C = new Matrix4();
    C.set(M);
    C.translate(0, -0.11, 0);
    C.scale(0.13, 0.22, 0.13);
    drawCube(C, legColor);
  }
  //ankle pivot level 3
  M.translate(0, -0.22, 0);
  M.rotate(ankleDeg, 0, 0, 1);
  //hoof
  {
    const H = new Matrix4();
    H.set(M);
    H.translate(0.02, -0.05, 0);
    H.scale(0.16, 0.10, 0.20);
    drawCube(H, hoofColor);
  }
}
function addActionsForHtmlUi(){
  const globalSlide = document.getElementById("globalRotSlide");
  const globalVal = document.getElementById("globalRotVal");
  globalSlide.addEventListener("input", (ev)=>{
    gAnimalGlobalRotation = Number(ev.target.value);
    globalVal.innerText = String(gAnimalGlobalRotation);
    renderScene();
  });
  const hipSlide = document.getElementById("hipSlide");
  const hipVal = document.getElementById("hipVal");
  hipSlide.addEventListener("input", (ev)=>{
    gHipAngleUI = Number(ev.target.value);
    hipVal.innerText = String(gHipAngleUI);
    if(!gAnimationOn) renderScene();
  });
  const kneeSlide = document.getElementById("kneeSlide");
  const kneeVal = document.getElementById("kneeVal");
  kneeSlide.addEventListener("input", (ev)=>{
    gKneeAngleUI = Number(ev.target.value);
    kneeVal.innerText = String(gKneeAngleUI);
    if(!gAnimationOn) renderScene();
  });
  const ankleSlide = document.getElementById("ankleSlide");
  const ankleVal = document.getElementById("ankleVal");
  if(ankleSlide){
    ankleSlide.addEventListener("input",(ev)=>{
      gAnkleAngleUI = Number(ev.target.value);
      if(ankleVal) ankleVal.innerText = String(gAnkleAngleUI);
      if(!gAnimationOn) renderScene();
    });
  }
  const animBtn = document.getElementById("animButton");
  if(animBtn){
    animBtn.onclick = ()=>{
      gAnimationOn = !gAnimationOn;
      if(!gAnimationOn){
        gBlink = 0;
        gMouthOpen = 0;
      }
      animBtn.innerText = gAnimationOn ? "Animation: ON" : "Animation: OFF";
      renderScene();
    };
  }
  const headSlide = document.getElementById("headSlide");
  const headVal = document.getElementById("headVal");
  if(headSlide){
    headSlide.addEventListener("input",(ev)=>{
      gHeadYawUI = Number(ev.target.value);
      if(headVal) headVal.innerText = String(gHeadYawUI);
      if(!gAnimationOn) renderScene();
    });
  }
}
function main(){
  setupWebGl();
  connectVariablesToGlsl();
  addActionsForHtmlUi();
  if(!gl) return;
  setupMouseControls();
  renderScene();
  requestAnimationFrame(tick);
}
function mouseEventToCanvasNorm(ev){
  const rect = canvas.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const py = ev.clientY - rect.top;
  const xNorm = (px / canvas.width) * 2 - 1;
  const yNorm = (py / canvas.height) * 2 - 1;
  return [xNorm, yNorm];
}
function updateMouseRotation(ev){
  const [xNorm, yNorm] = mouseEventToCanvasNorm(ev);
  gMouseYaw = xNorm * 180;
  gMousePitch = -yNorm * 90;
  renderScene();
}
function triggerPoke(){
  const now = performance.now();
  if(isPokeActive(now)) return;
  gPokeStartMs = now;
}
function setupMouseControls(){
  let dragging = false;
  canvas.addEventListener("mousedown", (ev)=>{
    if(ev.shiftKey){
      triggerPoke();
      return;
    }
    dragging = true;
    updateMouseRotation(ev);
  });
  canvas.addEventListener("mousemove", (ev)=>{
    if(!dragging) return;
    updateMouseRotation(ev);
  });
  window.addEventListener("mouseup", ()=>{ dragging = false; });
}
function updateAnimationAngles(tSec, nowMs){
  const pokeActive = isPokeActive(nowMs);
  if(pokeActive){
    const u = (nowMs - gPokeStartMs) / POKE_MS;
    const wiggle = Math.sin(u * 10 * Math.PI);
    gHeadYaw = 35 * wiggle;
    gTailAngle = 60 * wiggle;
    gEarFlap = 25 * Math.sin(u * 14 * Math.PI);
    gHipAngle = -30;
    gKneeAngle = 55;
    gAnkleAngle = -25;
    gMouthOpen = 0.9;
    gBlink = (Math.sin(u * 12 * Math.PI) > 0.65) ? 1 : 0;
    return;
  }
  //normal walk
  const w = tSec * 4.0;
  gHipAngle = 25 * Math.sin(w);
  gKneeAngle = 35 * Math.max(0, Math.sin(w + Math.PI/2)) - 10;
  gAnkleAngle = 18 * Math.sin(w + Math.PI/2);
  gHeadYaw = 8 * Math.sin(tSec * 2.0);
  gTailAngle = 18 * Math.sin(tSec * 6.0);
  gEarFlap = 10 * Math.sin(tSec * 5.0);
  //mouth open/close
  gMouthOpen = 0.35 + 0.35 * Math.max(0, Math.sin(tSec * 4.0));
  //blink envelope short blink every 2.4s
  const period = 2.4;
  const p = (tSec % period) / period;
  if(p < 0.03) gBlink = p / 0.03; //closing
  else if(p < 0.06) gBlink = 1 - (p - 0.03) / 0.03; //opening
  else gBlink = 0;
}
function tick(nowMs){
  if(!g_lastMs) g_lastMs = nowMs;
  const dt = nowMs - g_lastMs;
  g_lastMs = nowMs;
  updateFPS(dt);
  const pokeActive = isPokeActive(nowMs);
  //update angles only if walk anim is on or poke is active
  if(gAnimationOn || pokeActive){
    updateAnimationAngles(nowMs / 1000.0, nowMs);
  }
  if(!pokeActive && gPokeStartMs >= 0){
    gPokeStartMs = -1;
    if(!gAnimationOn){
      gHeadYaw = 0;
      gTailAngle = 0;
      gEarFlap = 0;
      gBlink = 0;
      gMouthOpen = 0;
    }
  }
  renderScene(nowMs);
  requestAnimationFrame(tick);
}
function renderScene(nowMs = performance.now()){
  const pokeActive = isPokeActive(nowMs);
  const headAnim = gAnimationOn || pokeActive;
  const legAnim  = gAnimationOn;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  //global rotation uniform: slider + mouse
  const G = new Matrix4();
  G.rotate(gMousePitch, 1,0,0);
  G.rotate(gAnimalGlobalRotation + gMouseYaw, 0,1,0);
  gl.uniformMatrix4fv(uGlobalRotateMatrix, false, G.elements);
  //colors
  const grass = [0.35,0.70,0.35,1.0];
  const wool  = [0.95,0.95,0.95,1.0];
  const wool2 = [0.90,0.90,0.90,1.0];
  const hoof  = [0.39, 0.40, 0.40, 1.0];
  const eyeCol = [0.05,0.05,0.05,1.0];
  const woolHead = [0.96, 0.96, 0.96, 1.0];
  const woolTrim = [0.90, 0.90, 0.90, 1.0];
  const faceTan  = [0.70, 0.62, 0.52, 1.0];
  const nosePink = [0.95, 0.75, 0.80, 1.0];
  const skin = [0.93, 0.82, 0.76, 1.0];
  //ground
  {
    const M = new Matrix4();
    M.translate(0,-0.75,0);
    M.scale(3.0, 0.03, 3.0);
    drawCube(M, grass);
  }
  //root
  const root = new Matrix4();
  root.translate(0,-0.05,0);
  //body
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(0,0.22,0);
    M.scale(0.85,0.55,0.55);
    drawCube(M, wool);
  }
  //elly shade
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(0.05,0.18,0);
    M.scale(0.78,0.40,0.48);
    drawCube(M, wool2);
  }
  //head frame (pivot)
  const headFrame = new Matrix4();
  headFrame.set(root);
  headFrame.translate(0.49, 0.26, 0);
  const headYaw = headAnim ? gHeadYaw : gHeadYawUI;
  headFrame.rotate(headYaw, 0, 1, 0);

  //wool head block
  {
    const M = new Matrix4();
    M.set(headFrame);
    M.translate(0.10, 0.02, 0.00);
    M.scale(0.34, 0.30, 0.34);
    drawCube(M, woolHead);
  }
  //ultra-thin flat face plate
  {
    const plateX = 0.27; //front location
    const plateT = 0.02; //thickness (thin)
    const plateH = 0.22;
    const plateW = 0.26;
    //face
    const F = new Matrix4();
    F.set(headFrame);
    F.translate(plateX, -0.02, 0.00);
    F.scale(plateT, plateH, plateW);
    drawCube(F, faceTan);
    const top = new Matrix4();
    top.set(headFrame);
    top.translate(plateX - 0.005, 0.11, 0.00);
    top.scale(plateT + 0.01, 0.04, plateW + 0.04);
    drawCube(top, woolTrim);
    const bot = new Matrix4();
    bot.set(headFrame);
    bot.translate(plateX - 0.005, -0.15, 0.00);
    bot.scale(plateT + 0.01, 0.04, plateW + 0.04);
    drawCube(bot, woolTrim);
    const side1 = new Matrix4();
    side1.set(headFrame);
    side1.translate(plateX - 0.005, -0.02, 0.15);
    side1.scale(plateT + 0.01, plateH + 0.08, 0.04);
    drawCube(side1, woolTrim);
    const side2 = new Matrix4();
    side2.set(headFrame);
    side2.translate(plateX - 0.005, -0.02, -0.15);
    side2.scale(plateT + 0.01, plateH + 0.08, 0.04);
    drawCube(side2, woolTrim);
    //subtle face shading stripe (optional)
    const F2 = new Matrix4();
    F2.set(headFrame);
    F2.translate(plateX + 0.002, -0.02, 0.00);
    F2.scale(plateT * 0.9, plateH * 0.85, plateW * 0.85);
    drawCube(F2, skin);
  }
  //eyes flat on the face plate, blink by shrinking Y
  {
    const eyeX = 0.279; //slightly in front of plate
    const blink = headAnim ? gBlink : 0;
    const eyeYScale = 0.035 * (1.0 - 0.95 * blink) + 0.002;
    const E1 = new Matrix4();
    E1.set(headFrame);
    E1.translate(eyeX, 0.02, 0.095);
    E1.scale(0.022, eyeYScale, 0.07);
    drawCube(E1, eyeCol);
    const E2 = new Matrix4();
    E2.set(headFrame);
    E2.translate(eyeX, 0.02, -0.095);
    E2.scale(0.022, eyeYScale, 0.07);
    drawCube(E2, eyeCol);
  }
  //nose with flat pink patch on face
  {
    const N = new Matrix4();
    N.set(headFrame);
    N.translate(0.279, -0.08, 0.00);
    N.scale(0.022, 0.08, 0.12);
    drawCube(N, nosePink);
  }
  //mouth
  {
    const mouthOpen = headAnim ? gMouthOpen : 0;
    const mouthH = 0.01 + 0.03 * mouthOpen;
    const M = new Matrix4();
    M.set(headFrame);
    M.translate(0.279, -0.14 - 0.01 * mouthOpen, 0.00);
    M.scale(0.022, mouthH, 0.14);
    drawCube(M, [0.90, 0.76, 0.76, 1.0]);
  }
  //ears
  {
    const earColor = [0.86, 0.86, 0.86, 1.0]; //slightly darker than head
    const flap = headAnim ? gEarFlap : 0;
    const zOut = 0.20;
    const sx = 0.06; //thickness (X)
    const sy = 0.28; //length (Y)
    const sz = 0.10; //thickness (Z)
    //Attach near upper side of head
    const attachX = 0.10;
    const attachY = 0.16;
    const centerY = attachY - sy * 0.5;
    //Right ear (+Z)
    const E1 = new Matrix4();
    E1.set(headFrame);
    E1.translate(attachX, centerY, +zOut);
    E1.rotate(flap, 1, 0, 0);
    E1.scale(sx, sy, sz);
    drawCube(E1, earColor);
    //Left ear (-Z)
    const E2 = new Matrix4();
    E2.set(headFrame);
    E2.translate(attachX, centerY, -zOut);
    E2.rotate(-flap, 1, 0, 0);
    E2.scale(sx, sy, sz);
    drawCube(E2, earColor);
  }
  //tail
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(-0.455, 0.25, 0.00);
    M.rotate(headAnim ? gTailAngle : 0, 0, 0, 1);
    M.rotate(140, 0,0,1);
    M.scale(0.10, 0.22, 0.10);
    drawCylinder(M, wool2);
  }
  //joints use only when animation is off
  const hip = legAnim ? gHipAngle : gHipAngleUI;
  const knee = legAnim ? gKneeAngle : gKneeAngleUI;
  const ankle = legAnim ? gAnkleAngle : gAnkleAngleUI;
  //4 legs, each has 3 levels thigh, calf, hoof
  drawLeg(root,  0.34,  0.22,  hip,  knee, ankle, skin, hoof);
  drawLeg(root,  0.34, -0.22, -hip,  knee, ankle, skin, hoof);
  drawLeg(root, -0.34,  0.22, -hip,  knee, ankle, skin, hoof);
  drawLeg(root, -0.34, -0.22,  hip,  knee, ankle, skin, hoof);
}
//referenced AI suggestions
function updateFPS(dtMs){
  fpsFrameCount++;
  const now = performance.now();
  const elapsed = now - fpsLastTime;
  if (elapsed >= 500){ 
    const fps = (fpsFrameCount * 1000) / elapsed;
    const fpsEl = document.getElementById("fps");
    const msEl = document.getElementById("ms");
    if (fpsEl) fpsEl.innerText = fps.toFixed(1);
    if (msEl) msEl.innerText = dtMs.toFixed(2);
    fpsFrameCount = 0;
    fpsLastTime = now;
  }
}