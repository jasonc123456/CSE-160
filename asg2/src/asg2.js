
// HelloPoint1.js (c) 2012 matsuda
// Vertex shader program
var vertexShaderSource = 
  'attribute vec4 a_Position;'+
  'uniform float u_Size;'+
  'void main() {\n' +
  '  gl_Position = a_Position;\n' + // Set the vertex coordinates of the point
  '  gl_PointSize = u_Size;' +                    // Set the point size
  '}';

// Fragment shader program
var fragmentShaderSource =
  'precision mediump float;'+
  'uniform vec4 u_FragColor;'+
  'void main() {' +
  '  gl_FragColor = u_FragColor;' + // Set the point color
  '}';
// global variables
let canvas, gl, aPosition, uFragColor, uPointSize;
let triangleVertexBuffer = null;
let pictureShapes = [];
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
function setupWebGl(){
  canvas = document.getElementById("webgl");
  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if(!gl){
    console.log("Failed to get WebGL context");
    return;
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
function connectVariablesToGlsl(){
  if(!initShaders(gl, vertexShaderSource, fragmentShaderSource)){
    console.log("Failed to initialize shaders");
    return;
  }
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
  uPointSize = gl.getUniformLocation(gl.program, "u_Size");
  if(!uPointSize){
    console.log("Failed to get uniform location: u_Size");
    return;
  }
  triangleVertexBuffer = gl.createBuffer();
  if (!triangleVertexBuffer) {
    console.log("Failed to create shared triangle buffer");
    return;
  }
}
function renderAllShapes(){
  gl.clear(gl.COLOR_BUFFER_BIT);
  for(const shape of pictureShapes){
    shape.render();
  }
  for (const shape of shapes){
    shape.render();
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
  document.getElementById("clearButton").onclick = function(){
    shapes = [];
    pictureShapes = [];
    renderAllShapes();
  };
  document.getElementById("squareButton").onclick = function(){
    selectedBrushType = brushSquare;
  };
  document.getElementById("triButton").onclick = function(){
    selectedBrushType = brushTriangle;
  };
  document.getElementById("circleButton").onclick = function(){
    selectedBrushType = brushCircle;
  };
  document.getElementById("drawPictureButton").onclick = function(){
    drawMinecraftDiamondSword();
    renderAllShapes();
  };
  document.getElementById("eraserButton").onclick = function () {
    selectedBrushType = brushEraser;
  };
  const updateSelectedColorFromSliders = () => {
    const r = document.getElementById("redSlide").value / 100;
    const g = document.getElementById("greenSlide").value / 100;
    const b = document.getElementById("blueSlide").value / 100;
    selectedColorRgba = [r, g, b, 1];
  };
  document.getElementById("redSlide").addEventListener("input", updateSelectedColorFromSliders);
  document.getElementById("greenSlide").addEventListener("input", updateSelectedColorFromSliders);
  document.getElementById("blueSlide").addEventListener("input", updateSelectedColorFromSliders);
  updateSelectedColorFromSliders();
  document.getElementById("sizeSlide").addEventListener("input", (ev) => {
    selectedSize = Number(ev.target.value);
  });
  document.getElementById("segSlide").addEventListener("input", (ev) => {
    selectedCircleSegments = Number(ev.target.value);
  });
  document.getElementById("rotSlide").addEventListener("input", function(ev){
    selectedRotationDeg = Number(ev.target.value);
    document.getElementById("rotVal").innerText = String(selectedRotationDeg);
  });
  document.getElementById("eraserSlide").addEventListener("input", function(ev){
    eraserSize = Number(ev.target.value);
    document.getElementById("eraserVal").innerText = String(eraserSize);
  });
  
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
    gl.uniform1f(uPointSize, this.size);
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
