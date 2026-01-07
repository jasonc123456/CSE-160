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
  console.log("x1,y1,x2,y2 =", x1, y1, x2, y2);
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