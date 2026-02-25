// sheep.js
function drawSheepAt(x, y, z, yawDeg, tSec){
  const A = window.gameApi;
  if(!A || !A.drawCubeColored) return;
  const root = new Matrix4();
  root.setIdentity();
  root.translate(x, y, z);
  //referenced chatGPT suggestions to ensure sheep walks forward
  root.rotate(90 - yawDeg, 0, 1, 0);
  root.scale(0.9, 0.9, 0.9);
  //walk cycle
  const w = tSec * 6.0;
  const legA = 20 * Math.sin(w);
  const legB = 20 * Math.sin(w + Math.PI);
  const wool = [0.95, 0.95, 0.95, 1.0];
  const wool2 = [0.90, 0.90, 0.90, 1.0];
  const face = [0.70, 0.62, 0.52, 1.0];
  const leg = [0.35, 0.35, 0.35, 1.0];
  const eye = [0.05, 0.05, 0.05, 1.0];
  //body
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(0, 0.95, 0);
    M.scale(1.4, 0.9, 0.9);
    A.drawCubeColored(M, wool);
  }
  //belly shade
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(0.05, 0.80, 0);
    M.scale(1.25, 0.65, 0.75);
    A.drawCubeColored(M, wool2);
  }
  //head
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(1.05, 1.05, 0);
    M.scale(0.6, 0.5, 0.5);
    A.drawCubeColored(M, wool);
  }
  //face plate
  {
    const M = new Matrix4();
    M.set(root);
    M.translate(1.32, 1.00, 0);
    M.scale(0.22, 0.38, 0.38);
    A.drawCubeColored(M, face);
  }
  //eyes
  {
    const E1 = new Matrix4();
    E1.set(root);
    E1.translate(1.40, 1.12, 0.16);
    E1.scale(0.08, 0.08, 0.08);
    A.drawCubeColored(E1, eye);
    const E2 = new Matrix4();
    E2.set(root);
    E2.translate(1.40, 1.12, -0.16);
    E2.scale(0.08, 0.08, 0.08);
    A.drawCubeColored(E2, eye);
  }
  //legs
  function legBlock(lx, lz, ang){
    const legH = 0.7;
    const legW = 0.22;
    const hipY = 0.50;
    const M = new Matrix4();
    M.set(root);
    M.translate(lx, hipY, lz);
    M.rotate(ang, 0, 0, 1);
    M.translate(0, -legH/2, 0);
    M.scale(legW, legH, legW);
    A.drawCubeColored(M, leg);
  }
  legBlock( 0.55, 0.28, legA);
  legBlock( 0.55, -0.28, -legA);
  legBlock(-0.55, 0.28, -legB);
  legBlock(-0.55, -0.28, legB);
}
