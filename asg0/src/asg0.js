var ctx;
function main() {  
  // Retrieve <canvas> element
  var canvas = document.getElementById('example');  
  if (!canvas) { 
    console.log('Failed to retrieve the <canvas> element');
    return false; 
  } 

  // Get the rendering context for 2DCG
  ctx = canvas.getContext('2d');
  const v1 = new Vector3([2.25, 2.25, 0]);
  // Draw a blue rectangle
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 400, 400);        // Fill a rectangle with the color 400 x 400
  drawVector(v1, "red");
}
function drawVector(v, color){
  const xOrigin = ctx.canvas.width / 2;
  const yOrigin = ctx.canvas.height / 2;
  const scaleFactor = 20;
  const x1 = xOrigin + v.elements[0] * scaleFactor;
  const y1 = yOrigin - v.elements[1] * scaleFactor;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(xOrigin,yOrigin);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function handleDrawEvent(){
  const x1 = parseFloat(document.getElementById('x1Coord').value);
  const y1 = parseFloat(document.getElementById('y1Coord').value);
  const x2 = parseFloat(document.getElementById('x2Coord').value);
  const y2 = parseFloat(document.getElementById('y2Coord').value);
  //console.log("x1,y1,x2,y2 =", x1, y1, x2, y2);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!isNaN(x1) && !isNaN(y1)){
    const v1 = new Vector3([x1, y1, 0]);
    drawVector(v1, "red");
  }
  if(!isNaN(x2) && !isNaN(y2)){
    const v2 = new Vector3([x2, y2, 0]);
    drawVector(v2, "blue");
  }
}
function handleDrawOperationEvent(){
  const x1 = parseFloat(document.getElementById('x1Coord').value);
  const y1 = parseFloat(document.getElementById('y1Coord').value);
  const x2 = parseFloat(document.getElementById('x2Coord').value);
  const y2 = parseFloat(document.getElementById('y2Coord').value);
  //console.log("x1,y1,x2,y2 =", x1, y1, x2, y2);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
  const v1 = new Vector3([x1, y1, 0]);
  drawVector(v1, "red");
  const v2 = new Vector3([x2, y2, 0]);
  drawVector(v2, "blue");
  const operation = document.getElementById('opSelect').value;
  const scalar = parseFloat(document.getElementById('scalarInput').value);
  if(operation == "add"){
    const v3 = new Vector3([x1, y1, 0]);
    v3.add(v2);
    drawVector(v3, "green");
  }else if(operation == "sub"){
    const v3 = new Vector3([x1, y1, 0]);
    v3.sub(v2);
    drawVector(v3, "green");
  }else if(operation == "mul"){
    if(isNaN(scalar)) return;
    const v3 = new Vector3([x1, y1, 0]);
    const v4 = new Vector3([x2, y2, 0]);
    v3.mul(scalar);
    v4.mul(scalar);
    drawVector(v3, "green");
    drawVector(v4, "green");
  }else if(operation == "div"){
    if(isNaN(scalar)) return;
    const v3 = new Vector3([x1, y1, 0]);
    const v4 = new Vector3([x2, y2, 0]);
    v3.div(scalar);
    v4.div(scalar);
    drawVector(v3, "green");
    drawVector(v4, "green");
  }else if(operation == "dot"){
    const dot = Vector3.dot(v1, v2);
    const m1 = v1.magnitude();
    const m2 = v2.magnitude();
    if(m1 === 0 || m2 === 0) return;
    let cosAlpha = dot / (m1 * m2);
    if(cosAlpha > 1) cosAlpha = 1;
    if(cosAlpha < -1) cosAlpha = -1;
    const angleDegree = Math.acos(cosAlpha) * 180 / Math.PI;
    console.log("Angle Between (Degrees rounded to 2 decimal places)", Math.round(angleDegree*100) / 100);
  }else if(operation == "cro"){
    const crossVector = Vector3.cross(v1, v2);
    const parallelogramArea = crossVector.magnitude();
    const triangleArea = parallelogramArea / 2;
    console.log("Area of triangle =", triangleArea);
  }else if(operation == "mag"){
    console.log("v1 magnitude =", v1.magnitude());
    console.log("v2 magnitude =", v2.magnitude());
  }else if(operation == "nor"){
    const v3 = new Vector3([x1, y1, 0]);
    const v4 = new Vector3([x2, y2, 0]);
    v3.normalize();
    v4.normalize();
    drawVector(v3, "green");
    drawVector(v4, "green");
  }
}