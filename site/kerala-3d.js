import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const mount = document.getElementById('kerala3d');
if (!mount) throw new Error('3D map container is missing.');

const mapPoints = [
  [-0.06,3.72],[0.42,3.57],[0.66,3.26],[0.44,2.94],[0.98,2.55],[0.47,2.26],
  [0.62,1.92],[0.12,1.68],[0.58,1.32],[0.14,0.98],[0.47,0.58],[-0.02,0.28],
  [0.28,-0.18],[-0.08,-0.55],[0.18,-0.98],[-0.18,-1.34],[-0.39,-1.80],[-0.62,-2.18],
  [-0.53,-2.57],[-0.82,-2.94],[-1.14,-3.28],[-1.43,-3.51],[-1.42,-3.16],[-1.12,-2.85],
  [-1.34,-2.48],[-1.02,-2.12],[-1.22,-1.76],[-0.88,-1.40],[-1.00,-0.96],[-0.68,-0.57],
  [-0.96,-0.16],[-0.61,0.27],[-0.82,0.70],[-0.43,1.08],[-0.62,1.50],[-0.27,1.91],
  [-0.48,2.34],[-0.16,2.69],[-0.42,3.10],[-0.10,3.43]
];

const stops = [
  {name:'Thiruvananthapuram',xy:[-0.73,-3.22],kind:'temple'},
  {name:'Varkala',xy:[-0.70,-2.63],kind:'cliff'},
  {name:'Alappuzha',xy:[-0.70,-1.67],kind:'boat'},
  {name:'Kochi',xy:[-0.42,-0.73],kind:'city'},
  {name:'Munnar',xy:[0.43,-0.25],kind:'tea'},
  {name:'Kozhikode',xy:[-0.28,1.15],kind:'beach'},
  {name:'Wayanad',xy:[0.43,2.06],kind:'forest'}
];

const MAP_X=.78;
const worldAt = ([x,y], height=0.68) => new THREE.Vector3(x*MAP_X,height,-y);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9bdde2');
scene.fog = new THREE.Fog('#9bdde2', 13, 27);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
} catch (error) {
  const loading = mount.querySelector('.maploading');
  if (loading) loading.textContent = '3D needs a browser with WebGL. The route map is shown below.';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-hidden','true');
mount.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 60);
camera.position.set(0.15, 8.8, 10.3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.15,0.82,0);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 6.5;
controls.maxDistance = 15.5;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = 1.3;
controls.minAzimuthAngle = -1.15;
controls.maxAzimuthAngle = 1.15;

scene.add(new THREE.HemisphereLight(0xdffaff,0x62845a,2.05));
const sun = new THREE.DirectionalLight(0xfff0d0,3.1);
sun.position.set(-4,10,6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb5eaff,1.1);
fill.position.set(5,5,-6);scene.add(fill);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(22,16),
  new THREE.MeshPhysicalMaterial({color:0x61bac9,roughness:0.3,metalness:0.08,clearcoat:0.65,clearcoatRoughness:0.25})
);
water.rotation.x=-Math.PI/2;water.position.y=-0.28;water.receiveShadow=true;scene.add(water);
const seaLines=new THREE.Group();scene.add(seaLines);
for(let i=0;i<7;i++){
  const z=-3.8+i*1.25;
  const pts=[];for(let x=-7;x<=7;x+=0.3)pts.push(new THREE.Vector3(x,-0.24,z+Math.sin(x*1.15+i)*0.07));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xd6ffff,transparent:true,opacity:0.22}));seaLines.add(line);
}

function makeShape(scale=1){
  const s=new THREE.Shape();
  s.moveTo(mapPoints[0][0]*scale*MAP_X,mapPoints[0][1]*scale);
  for(let i=1;i<mapPoints.length;i++)s.lineTo(mapPoints[i][0]*scale*MAP_X,mapPoints[i][1]*scale);
  s.closePath();return s;
}
function landLayer(scale,depth,material,y){
  const geometry=new THREE.ExtrudeGeometry(makeShape(scale),{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.075,bevelThickness:0.075,curveSegments:4});
  geometry.rotateX(-Math.PI/2);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
landLayer(1.12,0.22,new THREE.MeshStandardMaterial({color:0xc9aa72,roughness:0.9}),-0.12);
landLayer(1.035,0.34,new THREE.MeshStandardMaterial({color:0x397f5c,roughness:0.94}),0.02);
landLayer(1,0.51,new THREE.MeshStandardMaterial({color:0x7ab96e,roughness:0.88}),0.16);
const LAND=0.67;

function inside(x,y){let ok=false;for(let i=0,j=mapPoints.length-1;i<mapPoints.length;j=i++){const [xi,yi]=mapPoints[i],[xj,yj]=mapPoints[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ok=!ok}return ok}

// Rolling Western Ghats and tea country make the tall green state shape read as terrain.
const hillMaterial=new THREE.MeshStandardMaterial({color:0x5d9f68,roughness:0.98});
const hillMaterials=[0x5b9d66,0x6cac70,0x78b977].map(color=>new THREE.MeshStandardMaterial({color,roughness:0.96}));
const hillSites=[[0.98,-0.35,0.55],[1.05,0.28,0.56],[0.94,0.95,0.62],[0.86,1.55,0.6],[0.72,2.18,0.52],[0.92,2.68,0.46],[0.98,-1.08,0.42]];
for(const [x,y,r] of hillSites){
  const h=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),hillMaterials[Math.floor(Math.random()*hillMaterials.length)]);
  h.scale.set(r*1.3,r*1.18,r*0.94);h.position.copy(worldAt([x,y],LAND+r*0.22));h.castShadow=true;h.receiveShadow=true;scene.add(h);
}
// A distant Western Ghats ridge makes the elevation change legible in the 3D view.
for(let i=0;i<8;i++){
  const r=.58+(i%3)*.16,x=1.2+(i%2)*.22,y=-2.8+i*.82;
  const peak=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),hillMaterials[i%hillMaterials.length]);
  peak.scale.set(r*.95,r*1.35,r*1.2);peak.position.copy(worldAt([x,y],LAND+r*.31));peak.castShadow=true;peak.receiveShadow=true;scene.add(peak);
}
for(let i=0;i<4;i++){
  const y=-0.53+i*0.2;const pts=[];
  for(let t=0;t<=20;t++){const x=0.05+t*0.045;const yy=y+Math.sin(t*0.38+i)*0.04;pts.push(worldAt([x,yy],LAND+0.13+i*0.005))}
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xc4da89,transparent:true,opacity:0.62})));
}

// Instanced trees keep the scene light enough for phones.
const leafGeo=new THREE.ConeGeometry(0.14,0.42,6);
const trunkGeo=new THREE.CylinderGeometry(0.025,0.04,0.22,5);
const leafInst=new THREE.InstancedMesh(leafGeo,new THREE.MeshStandardMaterial({color:0x4e9663,roughness:0.9}),105);
const trunkInst=new THREE.InstancedMesh(trunkGeo,new THREE.MeshStandardMaterial({color:0x805c3d,roughness:0.95}),105);
const dummy=new THREE.Object3D();let treeCount=0,tries=0;
while(treeCount<105&&tries<1800){tries++;const x=-1.35+Math.random()*2.45,y=-3.3+Math.random()*6.6;if(!inside(x,y))continue;if(stops.some(s=>Math.hypot(x-s.xy[0],y-s.xy[1])<0.28))continue;if(x>0.25&&y>-0.7&&y<0.7)continue;
  const p=worldAt([x,y],LAND+0.1),scale=0.65+Math.random()*0.55;
  dummy.position.set(p.x,p.y+0.22*scale,p.z);dummy.scale.setScalar(scale);dummy.rotation.y=Math.random()*6.28;dummy.updateMatrix();leafInst.setMatrixAt(treeCount,dummy.matrix);
  dummy.position.set(p.x,p.y+0.08*scale,p.z);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();trunkInst.setMatrixAt(treeCount,dummy.matrix);treeCount++;
}
leafInst.count=treeCount;trunkInst.count=treeCount;leafInst.castShadow=true;trunkInst.castShadow=true;scene.add(leafInst,trunkInst);

function labelTexture(text,accent='#315b48'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=132;const c=canvas.getContext('2d');
  c.fillStyle='rgba(255,253,244,.96)';c.beginPath();c.roundRect(12,18,488,98,36);c.fill();
  c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=7;c.stroke();c.fillStyle=accent;c.font='800 36px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text.toUpperCase(),256,69,450);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function addLabel(text,pos,scale=1.12){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(text),transparent:true,depthWrite:false}));sprite.position.copy(worldAt(pos,LAND+0.48));sprite.scale.set(scale,scale*0.29,1);scene.add(sprite);return sprite}

function addBuilding(pos,color=0xe8bd7b,roof=0xa9574d){
  const g=new THREE.Group();const wall=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.2,0.24),new THREE.MeshStandardMaterial({color,roughness:0.8}));wall.position.y=0.1;wall.castShadow=true;g.add(wall);
  const r=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.18,4),new THREE.MeshStandardMaterial({color:roof,roughness:0.82}));r.rotation.y=Math.PI/4;r.position.y=0.29;r.castShadow=true;g.add(r);g.position.copy(worldAt(pos,LAND+0.06));scene.add(g);return g;
}
function addStopLandmark(stop,index){
  const [x,y]=stop.xy;
  if(stop.kind==='temple'){
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,.12,8),new THREE.MeshStandardMaterial({color:0xd6b46b}));base.position.copy(worldAt([x+0.28,y],LAND+0.08));scene.add(base);
    for(let i=0;i<4;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(.16-i*.026,.17,5),new THREE.MeshStandardMaterial({color:i%2?0xc17d4f:0xe9be78}));cone.position.set((x+.28)*MAP_X,LAND+.2+i*.13,-y);scene.add(cone)}
  } else if(stop.kind==='boat'){
    const boat=new THREE.Group();const hull=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.42,4,8),new THREE.MeshStandardMaterial({color:0x744b36,roughness:.8}));hull.rotation.z=Math.PI/2;hull.position.y=.05;boat.add(hull);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.18),new THREE.MeshStandardMaterial({color:0xf3dbad}));cabin.position.y=.16;boat.add(cabin);boat.position.copy(worldAt([x+.28,y-.04],LAND+.04));scene.add(boat);
  } else if(stop.kind==='cliff'){
    const cliff=new THREE.Mesh(new THREE.BoxGeometry(.44,.22,.25),new THREE.MeshStandardMaterial({color:0xb86c4f}));cliff.position.copy(worldAt([x+.25,y],LAND+.1));cliff.castShadow=true;scene.add(cliff);
    const palm=createPalm();palm.position.copy(worldAt([x-.25,y+.08],LAND+.06));palm.scale.setScalar(.55);scene.add(palm);
  } else if(stop.kind==='tea'){
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const shrub=new THREE.Mesh(new THREE.SphereGeometry(.07,7,6),new THREE.MeshStandardMaterial({color:row%2?0x518b57:0x74ae63}));
      shrub.position.copy(worldAt([x-.36+col*.12,y-.22+row*.12],LAND+.12));shrub.scale.set(1,.6,1);scene.add(shrub);
    }
    addBuilding([x+.25,y+.12],0xe8d5ae,0x7e7159);
  } else if(stop.kind==='city'){
    const shades=[0xe4c8a1,0xb6d2cb,0xd4baa4,0x9bb8bb,0xe8dabc];
    for(let i=0;i<5;i++){
      const w=.13+(i%2)*.05,h=.24+(i%3)*.12,d=.13+(i%2)*.03;
      const bx=x+.21+(i%3)*.14,by=y-.22+Math.floor(i/3)*.25;
      const tower=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:shades[i],roughness:.82}));tower.position.copy(worldAt([bx,by],LAND+.05+h/2));tower.castShadow=true;scene.add(tower);
      const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.025,.035,d+.025),new THREE.MeshStandardMaterial({color:0x8e6851,roughness:.86}));roof.position.copy(worldAt([bx,by],LAND+.08+h));roof.castShadow=true;scene.add(roof);
      for(let floor=0;floor<Math.floor(h/.11);floor++){const windowMesh=new THREE.Mesh(new THREE.BoxGeometry(w*.22,.045,.012),new THREE.MeshStandardMaterial({color:0x77b6c1,metalness:.12,roughness:.25}));windowMesh.position.set(bx*MAP_X,LAND+.08+floor*.11+h*.25,-by-d/2-.007);scene.add(windowMesh)}
    }
  } else if(stop.kind==='beach'||stop.kind==='forest'){
    const feature=new THREE.Mesh(new THREE.ConeGeometry(.21,.38,7),new THREE.MeshStandardMaterial({color:stop.kind==='beach'?0xe3ab65:0x548d5b}));feature.position.copy(worldAt([x+.3,y],LAND+.24));feature.castShadow=true;scene.add(feature);
  } else addBuilding([x+.27,y],0xe7bd83,0x9e554b);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.024,.42,6),new THREE.MeshStandardMaterial({color:0xf8f2d6,metalness:.18,roughness:.4}));pole.position.copy(worldAt([x,y],LAND+.34));pole.castShadow=true;scene.add(pole);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(index===0?0.14:0.105,16,12),new THREE.MeshStandardMaterial({color:0xffcf4e,emissive:0x8c5718,emissiveIntensity:.35,roughness:.26}));dot.position.copy(worldAt([x,y],LAND+.57));dot.castShadow=true;scene.add(dot);
  const offset=index%2===0?0.55:-0.55;addLabel(stop.name,[x+offset,y],index===0?1.54:1.18);
}
function createPalm(){const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,.75,7),new THREE.MeshStandardMaterial({color:0x936241}));trunk.position.y=.37;g.add(trunk);for(let i=0;i<6;i++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.065,.62,5),new THREE.MeshStandardMaterial({color:0x4d9862}));leaf.position.y=.78;leaf.rotation.z=Math.PI/2;leaf.rotation.y=i*Math.PI/3;leaf.scale.set(1,1,.6);g.add(leaf)}return g}

const routePoints=stops.map(s=>worldAt(s.xy,LAND+.055));
const routeCurve=new THREE.CatmullRomCurve3(routePoints);
const roadEdge=new THREE.Mesh(new THREE.TubeGeometry(routeCurve,160,.122,10,false),new THREE.MeshStandardMaterial({color:0xc6b58a,roughness:.9}));roadEdge.receiveShadow=true;scene.add(roadEdge);
const road=new THREE.Mesh(new THREE.TubeGeometry(routeCurve,160,.105,10,false),new THREE.MeshStandardMaterial({color:0x59615a,roughness:.94}));road.receiveShadow=true;scene.add(road);
const centerPoints=routeCurve.getPoints(160).map(p=>p.clone().add(new THREE.Vector3(0,.102,0)));
const centerCurve=new THREE.CatmullRomCurve3(centerPoints);
const route=new THREE.Mesh(new THREE.TubeGeometry(centerCurve,160,.012,5,false),new THREE.MeshStandardMaterial({color:0xffdc71,emissive:0x92652a,emissiveIntensity:.18,roughness:.42}));scene.add(route);
stops.forEach(addStopLandmark);
const canalPoints=[[-.82,-2.05],[-.66,-1.82],[-.77,-1.57],[-.62,-1.32],[-.73,-1.08],[-.55,-.86]].map(p=>worldAt(p,LAND+.035));
const canalCurve=new THREE.CatmullRomCurve3(canalPoints);
const backwater=new THREE.Mesh(new THREE.TubeGeometry(canalCurve,72,.072,9,false),new THREE.MeshPhysicalMaterial({color:0x69c5d0,roughness:.2,metalness:.06,clearcoat:.8,transparent:true,opacity:.92}));scene.add(backwater);

const avatarColors=[0xe9ae55,0x78b8ab,0xd67e76,0x8c7ad1,0x77a8d1];
function material(color,roughness=.72){return new THREE.MeshStandardMaterial({color,roughness})}
function limb(group,a,b,r,mat){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(to,from);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*0.78,r,d.length(),8),mat);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.castShadow=true;group.add(mesh);return mesh}
function createPerson(name,index){
  const person=new THREE.Group();const skin=material([0x98644e,0xc98b69,0xe1ac83,0xb9795e,0xd39d76][index%5]);const shirt=material(avatarColors[index%avatarColors.length]);const pants=material(index%2?0x405d76:0x4c5964);const hair=material([0x342c28,0x4b352b,0x272b30,0x6a4938][index%4]);const shoe=material(0x493a34);const dark=material(0x302d2a,.38);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.36,7,14),shirt);torso.position.y=.84;torso.castShadow=true;person.add(torso);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.07,10),material(0xf6eee0));collar.position.y=1.08;person.add(collar);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,.1,12),skin);neck.position.y=1.12;person.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.17,24,18),skin);head.position.y=1.3;head.castShadow=true;person.add(head);
  const haircap=new THREE.Mesh(new THREE.SphereGeometry(.177,20,12,0,Math.PI*2,0,Math.PI*.55),hair);haircap.position.set(0,1.345,-.012);haircap.castShadow=true;person.add(haircap);
  const eyeWhite=material(0xfff8e9),pupil=material(0x302d2a,.28),brow=material(0x49352f,.55);
  for(const side of [-1,1]){
    const ear=new THREE.Mesh(new THREE.SphereGeometry(.043,12,10),skin);ear.position.set(side*.158,1.295,.015);ear.scale.set(.65,1,.75);person.add(ear);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.031,12,10),eyeWhite);eye.position.set(side*.058,1.316,.15);person.add(eye);
    const pupilDot=new THREE.Mesh(new THREE.SphereGeometry(.014,10,8),pupil);pupilDot.position.set(side*.055,1.314,.178);person.add(pupilDot);
    limb(person,[side*.04,1.36,.147],[side*.078,1.355,.142],.009,brow);
    const legX=side*.075;limb(person,[legX,.61,0],[legX,.18,0],.055,pants);
    const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.057,.06,.035,10),material(0x526271));cuff.position.set(legX,.2,0);person.add(cuff);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.13,.07,.2),shoe);foot.position.set(legX,.09,.035);foot.castShadow=true;person.add(foot);
    limb(person,[side*.14,1.02,0],[side*.19,.9,.015],.058,shirt);
    limb(person,[side*.19,.9,.015],[side*.235,.7,.04],.038,skin);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),skin);hand.position.set(side*.235,.69,.04);person.add(hand);
  }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.026,10,10),skin);nose.position.set(0,1.274,.17);nose.scale.set(.7,.8,.7);person.add(nose);
  const smileCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.035,1.235,.158),new THREE.Vector3(0,1.225,.172),new THREE.Vector3(.035,1.235,.158)]);const smile=new THREE.Mesh(new THREE.TubeGeometry(smileCurve,8,.005,5,false),material(0x75463d));person.add(smile);
  for(const y of [.91,.83,.75]){const button=new THREE.Mesh(new THREE.SphereGeometry(.011,8,6),material(0xfff0cf));button.position.set(0,y,.163);person.add(button)}
  const bag=new THREE.Mesh(new THREE.BoxGeometry(.2,.27,.11),material(index%2?0x7c5a42:0x3f7060));bag.position.set(0,.86,-.17);bag.castShadow=true;person.add(bag);
  for(const side of [-1,1])limb(person,[side*.075,1.02,-.135],[side*.075,.72,-.15],.018,material(0x554b39));
  const badge=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(name,'#355f50'),transparent:true,depthWrite:false}));badge.position.y=1.73;badge.scale.set(.78,.2,1);person.add(badge);
  return person;
}
function makeVehicle(type){
  const g=new THREE.Group();const bodyMat=material(type==='bus'?0xf3bd4d:type==='bike'?0xd65249:0x31a16f,.42);const dark=material(0x303a3b,.55);const glass=new THREE.MeshStandardMaterial({color:0xa9e5ec,metalness:.18,roughness:.22,transparent:true,opacity:.43});
  function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
 function wheel(x,y,z,r=.13){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.09,12),dark);m.rotation.z=Math.PI/2;m.position.set(x,y,z);m.castShadow=true;m.userData.rollingWheel=true;m.userData.wheelAxis='x';g.add(m)}
  if(type==='bus'){
    box(.8,.48,1.1,bodyMat,0,.32,0);box(.68,.2,1.02,glass,0,.46,.02);box(.82,.1,1.12,material(0xf7d27c),0,.1,0);
    for(let z=-.38;z<=.42;z+=.27){box(.035,.23,.035,material(0xffefc2),-.405,.36,z);box(.035,.23,.035,material(0xffefc2),.405,.36,z)}
    box(.69,.22,.025,glass,0,.39,-.55);box(.13,.06,.03,material(0xffed9a),-.28,.17,-.57);box(.13,.06,.03,material(0xffed9a),.28,.17,-.57);
    wheel(-.37,.14,-.34);wheel(.37,.14,-.34);wheel(-.37,.14,.34);wheel(.37,.14,.34);
  }else if(type==='auto'){
    box(.55,.25,.72,bodyMat,0,.2,0);box(.5,.34,.45,material(0xf4cf70),0,.49,.04);box(.44,.18,.035,glass,0,.52,-.2);box(.46,.035,.48,material(0xf2c747),0,.68,.02);
    wheel(-.29,.1,-.23,.11);wheel(.29,.1,-.23,.11);wheel(0,.1,.37,.11);box(.6,.06,.08,dark,0,.09,-.28);
  }else if(type==='car'){
    box(1.18,.34,1.92,bodyMat,0,.29,0);box(1.04,.38,.88,bodyMat,0,.62,-.05);box(.94,.28,.03,glass,0,.62,.39);box(.94,.28,.03,glass,0,.62,-.5);
    box(.035,.28,.74,glass,-.51,.62,-.04);box(.035,.28,.74,glass,.51,.62,-.04);box(1.13,.12,.2,material(0x9ed4de,.25),0,.39,.88);box(1.1,.1,.12,material(0xffecb1,.2),0,.39,-.96);
    for(const x of [-.55,.55])for(const z of [-.58,.62])wheel(x,.17,z,.16);
    box(.95,.07,.05,dark,0,.1,.9);box(.95,.07,.05,dark,0,.1,-.9);
  }else{
    const torus=new THREE.MeshStandardMaterial({color:0x293235,roughness:.85});
    for(const z of [-.35,.36]){const w=new THREE.Mesh(new THREE.TorusGeometry(.16,.04,7,20),torus);w.rotation.y=Math.PI/2;w.position.set(0,.18,z);w.castShadow=true;w.userData.rollingWheel=true;w.userData.wheelAxis='x';g.add(w);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.05,10),material(0xb7c6c2));hub.rotation.z=Math.PI/2;hub.position.set(0,.18,z);g.add(hub)}
    box(.13,.19,.3,bodyMat,0,.43,.02);box(.34,.08,.21,dark,0,.57,.09);box(.29,.06,.12,material(0x4b7764),0,.68,-.02);box(.06,.05,.2,material(0xe7bd72),0,.78,-.16);
    limb(g,[-.22,.62,-.16],[.22,.62,-.16],.025,dark);box(.1,.05,.12,material(0xf7e5aa),0,.61,-.34);
  }
  return g;
}

function makeBikeRider(name='Traveler',index=0,helmeted=true){
  const rider=new THREE.Group();
  const skin=material([0x98644e,0xc98b69,0xe1ac83,0xb9795e,0xd39d76][index%5]);
  const jacket=material(avatarColors[index%avatarColors.length],.82),pants=material(0x354b62,.88),dark=material(0x28353a,.54),helmetMat=material([0xe7a941,0x48a89b,0xd65d4d,0x7164bd][index%4],.34);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.115,.25,7,12),jacket);torso.position.set(0,.79,-.01);torso.rotation.x=-.38;torso.castShadow=true;rider.add(torso);
  const hip=new THREE.Mesh(new THREE.SphereGeometry(.12,12,10),pants);hip.position.set(0,.59,.055);rider.add(hip);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,.09,10),skin);neck.position.set(0,.99,-.065);rider.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.14,18,14),skin);head.position.set(0,1.1,-.085);head.castShadow=true;rider.add(head);
  const eyeWhite=material(0xfff7e8),eyes=material(0x302d2a,.32);
  for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,9,7),eyeWhite);eye.position.set(side*.045,1.11,-.212);rider.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.009,8,6),eyes);pupil.position.set(side*.045,1.109,-.228);rider.add(pupil)}
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.017,8,7),skin);nose.position.set(0,1.075,-.22);rider.add(nose);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.145,16,10,0,Math.PI*2,0,Math.PI*.58),material(0x382c28,.88));hair.position.set(0,1.13,-.075);rider.add(hair);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.16,18,12),helmetMat);helmet.scale.set(1.12,.78,1.15);helmet.position.set(0,1.18,-.078);helmet.castShadow=true;helmet.visible=helmeted;rider.add(helmet);
  const visor=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshStandardMaterial({color:0x587b85,metalness:.22,roughness:.22,transparent:true,opacity:.78}));visor.scale.set(1,.44,.4);visor.position.set(0,1.105,-.199);visor.visible=helmeted;rider.add(visor);
  const boots=material(0x342f2b,.86),gloves=material(0xe5d8c2,.8);
  for(const side of [-1,1]){
    limb(rider,[side*.07,.61,.03],[side*.15,.39,-.11],.052,pants);
    limb(rider,[side*.15,.39,-.11],[side*.19,.31,.11],.042,pants);
    const boot=new THREE.Mesh(new THREE.BoxGeometry(.11,.07,.15),boots);boot.position.set(side*.19,.28,.12);rider.add(boot);
    limb(rider,[side*.1,.88,-.02],[side*.17,.73,-.13],.046,jacket);
    limb(rider,[side*.17,.73,-.13],[side*.2,.625,-.19],.032,skin);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.038,9,8),gloves);hand.position.set(side*.2,.62,-.19);rider.add(hand);
  }
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(name,'#355f50'),transparent:true,depthWrite:false}));label.position.set(0,1.48,0);label.scale.set(.74,.18,1);rider.add(label);
  return rider;
}

const vehicleRoot=new THREE.Group();scene.add(vehicleRoot);
let vehicleModel=null,vehicleType='bus',currentStop=0,peopleRoot=new THREE.Group(),people=[],desiredAt=worldAt(stops[0].xy,LAND+.17),riderName='Traveler',rideFromStop=0,rideToStop=0,rideProgress=1,rideDuration=2.8,manualDrive=false,driveLaneOffset=0,driveSpeed=0,driveSteer=0;
scene.add(peopleRoot);
function rebuildVehicle(type){vehicleType=type;if(vehicleModel)vehicleRoot.remove(vehicleModel);vehicleModel=makeVehicle(type);vehicleModel.scale.setScalar(type==='bus'?.62:.72);const driver=makeBikeRider(riderName,0,type==='bike');if(type==='bus'){driver.scale.setScalar(.43);driver.position.set(0,.015,-.29)}else if(type==='auto'){driver.scale.setScalar(.43);driver.position.set(0,.055,-.035)}else if(type==='car'){driver.scale.setScalar(.43);driver.position.set(0,.18,-.03)}vehicleModel.add(driver);vehicleRoot.add(vehicleModel)}
function rebuildPeople(names){peopleRoot.clear();people=[];const list=(names&&names.length?names:['You','Maya']).slice(0,5);list.forEach((name,i)=>{const p=createPerson(String(name||'Traveler').slice(0,18),i);p.position.set((i-(list.length-1)/2)*.38,0,.72);p.scale.setScalar(.58);peopleRoot.add(p);people.push(p)})}
function updateJourney(state={}){
  const type=['bus','bike','auto','car'].includes(state.vehicle)?state.vehicle:'bus';
  const nextName=String(state.members?.[0]?.name||'Traveler');if(nextName!==riderName){riderName=nextName;if(type==='bike')rebuildVehicle('bike')}
  if(type!==vehicleType)rebuildVehicle(type);
  const nextStop=Math.max(0,Math.min(stops.length-1,(Number(state.places)||1)-1));
  if(nextStop>currentStop){const eased=rideProgress*rideProgress*(3-2*rideProgress);rideFromStop=rideProgress<1?rideFromStop+(rideToStop-rideFromStop)*eased:currentStop;rideToStop=nextStop;rideProgress=0;rideDuration=Math.min(8,2.8*(nextStop-rideFromStop));peopleRoot.visible=false}
  else if(nextStop<currentStop){rideProgress=1}
  currentStop=nextStop;
  desiredAt=worldAt(stops[currentStop].xy,LAND+.17);
  if(rideProgress>=1)vehicleRoot.position.copy(desiredAt);
  peopleRoot.position.copy(worldAt(stops[currentStop].xy,LAND-.03));
  if(rideProgress>=1)peopleRoot.visible=true;
  stops.forEach((s,i)=>{if(s.marker){s.marker.material.color.setHex(i<=currentStop?0xffcc52:0x91a991);s.marker.material.emissive.setHex(i===currentStop?0x754c1c:0x263d2b)}});
  if(state.members)rebuildPeople(state.members.map(m=>m.name||'Traveler'));
}
function fit(){const w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(fit).observe(mount);fit();
document.getElementById('resetMapView')?.addEventListener('click',()=>{camera.position.set(.15,8.8,10.3);controls.target.set(-.15,.82,0);controls.update()});

window.addEventListener('kerala-trip-state',e=>updateJourney(e.detail||{}));
window.addEventListener('kerala-drive-frame',e=>{const d=e.detail||{};manualDrive=true;rideProgress=Math.max(0,Math.min(1,Number(d.progress)||0));driveLaneOffset=Number(d.laneOffset)||0;driveSpeed=Number(d.speed)||0;driveSteer=Number(d.steer)||0;if(d.vehicle&&d.vehicle!==vehicleType)rebuildVehicle(d.vehicle)});
window.addEventListener('kerala-drive-arrival',()=>{rideProgress=1;driveSpeed=0;driveSteer=0;peopleRoot.visible=true});
stops.forEach((s,i)=>{s.marker=new THREE.Mesh(new THREE.SphereGeometry(.11,14,10),new THREE.MeshStandardMaterial({color:0xffcc52,emissive:0x754c1c,emissiveIntensity:.35,roughness:.28}));s.marker.position.copy(worldAt(s.xy,LAND+.49));s.marker.castShadow=true;scene.add(s.marker)});
rebuildVehicle('bus');rebuildPeople(['You','Maya']);updateJourney(window.getKeralaTripState?.()||{});
const mapHint=mount.querySelector('.maphint');if(mapHint)mapHint.textContent='3D TERRAIN · DRAG TO ROTATE · PINCH TO ZOOM';
mount.querySelector('.mapfallback')?.remove();mount.querySelector('.maploading')?.remove();
window.dispatchEvent(new CustomEvent('kerala-trip-3d-ready'));

let last=performance.now();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;controls.update();
  if(rideProgress<1){
    if(!manualDrive)rideProgress=Math.min(1,rideProgress+dt/rideDuration);
    const eased=rideProgress*rideProgress*(3-2*rideProgress),t=(rideFromStop+(rideToStop-rideFromStop)*eased)/(stops.length-1);
    vehicleRoot.position.copy(routeCurve.getPoint(t));vehicleRoot.position.y+=.115+Math.sin(now*.004)*.012;
    const tangent=routeCurve.getTangent(t);vehicleRoot.rotation.y=Math.atan2(-tangent.x,-tangent.z);vehicleRoot.rotation.z=vehicleType==='bike'?-driveSteer*.14:0;
    if(manualDrive){const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();vehicleRoot.position.addScaledVector(side,driveLaneOffset*.08)}
    if(rideProgress>=1)peopleRoot.visible=true;
    vehicleModel?.traverse(o=>{if(o.userData.rollingWheel){if(o.userData.wheelAxis==='x')o.rotateX(dt*(manualDrive?driveSpeed*12:8));else o.rotateZ(dt*(manualDrive?driveSpeed*12:8))}});
  }else{vehicleRoot.position.lerp(desiredAt,Math.min(1,dt*3.5));vehicleRoot.position.y=desiredAt.y+Math.sin(now*.0028)*.012}
  peopleRoot.position.lerp(worldAt(stops[currentStop].xy,LAND-.03),Math.min(1,dt*2.3));
  people.forEach((p,i)=>{p.rotation.y=Math.sin(now*.0016+i)*.06;p.position.y=.015+Math.sin(now*.003+i*1.7)*.025});
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
