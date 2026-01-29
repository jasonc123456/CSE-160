
// HelloPoint1.js (c) 2012 matsuda
// Vertex shader program
var vertexShaderSource = `
  attribute vec3 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
  }
`;
// Fragment shader program
var fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;
// global variables
let canvas, gl;
let aPosition, uFragColor, uModelMatrix, uGlobalRotateMatrix;
let triangleVertexBuffer = null;
let pictureShapes = [];
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
let gTailAngle = 0;
let gEarFlap = 0;
//mouse control rotation
let gMouseYaw = 0;
let gMousePitch = 0;
//poke animation (shift-click)
let gPokeStartMs = -1;
//fps
let g_lastMs = 0;
let g_fpsSmoothed = 0;
//non-cube primitive (cylinder)
let cylVertexBuffer = null;
let cylVertCount = 0;
//Brush modes
const brushSquare = 0;
const brushTriangle = 1;
const brushCircle = 2;
// Default brush and settings
let selectedBrushType = brushSquare;
let selectedColorRgba = [1, 1, 1, 1];
let selectedSize = 10;
let selectedCircleSegments = 12;
const brushEraser = 3;
let selectedRotationDeg = 0;
let eraserSize = 20; // in pixels
//List holding all shapes that needs to be rendered
let shapes = [];
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
  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if(!gl){
    console.log("Failed to get WebGL context");
    return;
  }
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
function connectVariablesToGlsl(){
  //Compile/link shaders FIRST so gl.program exists
  if(!initShaders(gl, vertexShaderSource, fragmentShaderSource)){
    console.log("Failed to initialize shaders");
    return;
  }
  //Get attribute/uniform locations
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
  //Create shared triangle buffer
  triangleVertexBuffer = gl.createBuffer();
  if (!triangleVertexBuffer) {
    console.log("Failed to create shared triangle buffer");
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
function renderAllShapes(){
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const I = new Matrix4();
  gl.uniformMatrix4fv(uModelMatrix, false, I.elements);
  gl.uniformMatrix4fv(uGlobalRotateMatrix, false, I.elements);
  for(const shape of pictureShapes){
    shape.render();
  }
  for (const shape of shapes){
    shape.render();
  }
}
//drawCube + scene render (ADD)
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
  // hip frame (level 1)
  const M = new Matrix4();
  M.set(root);
  M.translate(x, attachY, z);
  M.rotate(hipDeg, 1, 0, 0);
  // thigh
  {
    const T = new Matrix4();
    T.set(M);
    T.translate(0, -0.12, 0);
    T.scale(0.14, 0.24, 0.14);
    drawCube(T, legColor);
  }
  // knee pivot (level 2)
  M.translate(0, -0.24, 0);
  M.rotate(kneeDeg, 1, 0, 0);
  // calf
  {
    const C = new Matrix4();
    C.set(M);
    C.translate(0, -0.11, 0);
    C.scale(0.13, 0.22, 0.13);
    drawCube(C, legColor);
  }
  // ankle pivot (level 3)
  M.translate(0, -0.22, 0);
  M.rotate(ankleDeg, 1, 0, 0);
  // hoof
  {
    const H = new Matrix4();
    H.set(M);
    H.translate(0, -0.05, 0.02);
    H.scale(0.16, 0.10, 0.20);
    drawCube(H, hoofColor);
  }
}
function handleCanvasDraw(mouseEvent){
  const [clipX, clipY] = mouseEventToClipSpace(mouseEvent);
  if (selectedBrushType === brushEraser){
    const radiusClip = (eraserSize / canvas.width) * 2.0;
    eraseAt(clipX, clipY, radiusClip);
    renderAllShapes();
    return;
  }
  let shapeToAdd;
  if (selectedBrushType === brushSquare){
    shapeToAdd = new SquareShape();
  }else if(selectedBrushType === brushTriangle){
    shapeToAdd = new TriangleShape();
  }else{
    shapeToAdd = new CircleShape();
    shapeToAdd.segments = selectedCircleSegments;
  }
  shapeToAdd.position = [clipX, clipY];
  shapeToAdd.color = [...selectedColorRgba];
  shapeToAdd.size = selectedSize;
  shapeToAdd.rotationDeg = selectedRotationDeg;
  shapes.push(shapeToAdd);
  renderAllShapes();
}
function mouseEventToClipSpace(mouseEvent){
  const rect = mouseEvent.target.getBoundingClientRect();
  const pixelX = mouseEvent.clientX - rect.left;
  const pixelY = mouseEvent.clientY - rect.top;
  const clipX = (pixelX - canvas.width / 2) / (canvas.width / 2);
  const clipY = (canvas.height / 2 - pixelY) / (canvas.height / 2);
  return [clipX, clipY];
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
  document.getElementById("animButton").onclick = ()=>{
    gAnimationOn = !gAnimationOn;
  };
}
function eraseAt(x, y, radiusClip){
  const r2 = radiusClip * radiusClip;
  shapes = shapes.filter(function (s) {
    if (!s.position) return true;
    const dx = s.position[0] - x;
    const dy = s.position[1] - y;
    return (dx*dx + dy*dy) > r2;
  });
}
function main(){
  setupWebGl();
  connectVariablesToGlsl();
  addActionsForHtmlUi();
  canvas.onmousedown = handleCanvasDraw;
  canvas.onmousemove = function (ev) {
    if (ev.buttons === 1) {
      handleCanvasDraw(ev);
    }
  };
  renderAllShapes();
}
function degToRad(deg){
  return (deg * Math.PI) / 180;
}

function rotatePoint(x, y, cx, cy, rad){
  const dx = x - cx;
  const dy = y - cy;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  return [cx + dx*cosA - dy*sinA, cy + dx*sinA + dy*cosA];
}
class SquareShape{
  constructor(){
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.disableVertexAttribArray(aPosition);
    gl.vertexAttrib3f(aPosition, this.position[0], this.position[1], 0);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}
function drawTriangleVertices(vertices){
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
class TriangleShape{
  constructor(){
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    const centerX = this.position[0];
    const centerY = this.position[1];
    const halfSize = this.size / 200;
    // Base (unrotated) triangle vertices
    let v0 = [centerX, centerY + halfSize];
    let v1 = [centerX - halfSize, centerY - halfSize];
    let v2 = [centerX + halfSize, centerY - halfSize];
    // Rotate around center
    const rad = degToRad(this.rotationDeg || 0);
    v0 = rotatePoint(v0[0], v0[1], centerX, centerY, rad);
    v1 = rotatePoint(v1[0], v1[1], centerX, centerY, rad);
    v2 = rotatePoint(v2[0], v2[1], centerX, centerY, rad);
    drawTriangleVertices([v0[0], v0[1], v1[0], v1[1], v2[0], v2[1]]);
  }
}
class CircleShape{
  constructor() {
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
    this.segments = 12;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    const centerX = this.position[0];
    const centerY = this.position[1];
    const radius = this.size / 200;
    const angleStep = (2 * Math.PI) / this.segments;
    for (let i = 0; i < this.segments; i++){
      const angle0 = i * angleStep;
      const angle1 = (i + 1) * angleStep;
      const x0 = centerX + radius * Math.cos(angle0);
      const y0 = centerY + radius * Math.sin(angle0);
      const x1 = centerX + radius * Math.cos(angle1);
      const y1 = centerY + radius * Math.sin(angle1);
      drawTriangleVertices([centerX, centerY, x0, y0, x1, y1]);
    }
  }
}
class RawTriangle{
  constructor(vertices, color){
    this.vertices = vertices;
    this.color = color;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    drawTriangleVertices(this.vertices);
  }
}
function makeGridMapper(cols, rows, left, right, bottom, top){
  const cellW = (right - left) / cols;
  const cellH = (top - bottom) / rows;
  return function cellToClip(col, row){
    const x0 = left + col * cellW;
    const x1 = x0 + cellW;
    const y1 = top - row * cellH;
    const y0 = y1 - cellH;
    return [x0, y0, x1, y1];
  };
}
function addRectTriangles(targetList, x0, y0, x1, y1, color){
  targetList.push(new RawTriangle([x0, y0, x1, y0, x1, y1], color));
  targetList.push(new RawTriangle([x0, y0, x1, y1, x0, y1], color));
}
function addRectTrianglesTwoTone(list, x0, y0, x1, y1, colorA, colorB){
  list.push(new RawTriangle([x0, y0, x1, y0, x1, y1], colorA));
  list.push(new RawTriangle([x0, y0, x1, y1, x0, y1], colorB));
}
//Referenced AI input on how to create the drawing 
function drawMinecraftDiamondSword(){
  pictureShapes = [];
  // Grid area
  const cols = 40;
  const rows = 40;
  const cellToClip = makeGridMapper(cols, rows, -0.75, 0.75, -0.9, 0.9);
  function put(col, row, color){
    const p = cellToClip(col, row);
    addRectTriangles(pictureShapes, p[0], p[1], p[2], p[3], color);
  }
  function putTwoTone(col, row, colorA, colorB){
    const p = cellToClip(col, row);
    addRectTrianglesTwoTone(pictureShapes, p[0], p[1], p[2], p[3], colorA, colorB);
  }
  // Color palette
  const outline = [0.05, 0.05, 0.07, 1.0];
  const bladeHi = [0.70, 0.97, 0.97, 1.0];
  const bladeMd = [0.30, 0.85, 0.85, 1.0];
  const bladeLo = [0.12, 0.55, 0.60, 1.0];
  const guardAu = [0.95, 0.80, 0.20, 1.0];
  const guardSh = [0.70, 0.55, 0.12, 1.0];
  const handleD = [0.35, 0.20, 0.10, 1.0];
  const handleL = [0.55, 0.32, 0.16, 1.0];
  // Secondary shades
  const bladeHi2 = [0.55, 0.93, 0.93, 1.0];
  const bladeMd2 = [0.22, 0.78, 0.80, 1.0];
  const bladeLo2 = [0.10, 0.48, 0.55, 1.0];
  const guardAu2 = [0.78, 0.62, 0.16, 1.0];
  const guardSh2 = [0.55, 0.42, 0.10, 1.0];
  const handleD2 = [0.25, 0.14, 0.07, 1.0];
  const handleL2 = [0.40, 0.24, 0.12, 1.0];
  const baseCol = 22;
  const guardR = 22;
  const guardC = baseCol;
  const bladeLen = 16;
  const bladeBaseR = guardR - 1;
  // Blade
  for (let i = 0; i < bladeLen; i++){
    const c = baseCol;
    const r = bladeBaseR - i;
    put(c - 2, r, outline);
    put(c + 2, r, outline);
    putTwoTone(c - 1, r, bladeLo, bladeLo2);
    putTwoTone(c, r, bladeMd, bladeMd2);
    putTwoTone(c + 1, r, bladeHi, bladeHi2);
  }
  // Tip
  {
    const tipC = baseCol;
    const tipR = bladeBaseR - bladeLen;
    put(tipC, tipR, outline);
    put(tipC - 1, tipR + 1, outline);
    put(tipC + 1, tipR + 1, outline);
    putTwoTone(tipC, tipR + 1, bladeMd, bladeMd2);
  }
  // Guard
  for (let dx = -3; dx <= 3; dx++){
    if (dx === 0 || dx === -1){
      putTwoTone(guardC + dx, guardR, guardSh, guardSh2);
    } else {
      putTwoTone(guardC + dx, guardR, guardAu, guardAu2);
    }
  }
  put(guardC - 4, guardR, outline);
  put(guardC + 4, guardR, outline);
  // Handle
  const handleStartR = guardR + 1;
  for (let i = 0; i < 10; i++){
    const r = handleStartR + i;
    putTwoTone(guardC - 1, r, handleD, handleD2);
    putTwoTone(guardC, r, handleL, handleL2);
    putTwoTone(guardC + 1, r, handleD, handleD2);
    put(guardC - 2, r, outline);
    put(guardC + 2, r, outline);
  }
  const initialsA = [0.90, 0.90, 0.95, 1.0];
  const initialsB = [0.60, 0.60, 0.75, 1.0];
  const initialsCol = 30;
  const initialsRow = 34;
  function drawLetterJ(col0, row0){
    for (let dx = 0; dx < 5; dx++) putTwoTone(col0 + dx, row0 + 0, initialsA, initialsB);
    for (let dy = 1; dy < 5; dy++) putTwoTone(col0 + 4, row0 + dy, initialsA, initialsB);
    for (let dx = 1; dx < 4; dx++) putTwoTone(col0 + dx, row0 + 5, initialsA, initialsB);
    putTwoTone(col0 + 0, row0 + 4, initialsA, initialsB);
    putTwoTone(col0 + 1, row0 + 4, initialsA, initialsB);
  }
  function drawLetterC(col0, row0){
    for (let dx = 0; dx < 5; dx++) putTwoTone(col0 + dx, row0 + 0, initialsA, initialsB);
    for (let dy = 1; dy < 5; dy++) putTwoTone(col0 + 0, row0 + dy, initialsA, initialsB);
    for (let dx = 0; dx < 5; dx++) putTwoTone(col0 + dx, row0 + 5, initialsA, initialsB);
  }
  drawLetterJ(initialsCol, initialsRow);
  drawLetterC(initialsCol + 6, initialsRow);
}
