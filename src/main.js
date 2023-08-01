import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Delaunator from 'delaunator';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// special thanks to of which this is based uppon  
// https://discourse.threejs.org/t/three-js-delaunator/4952
// https://discourse.threejs.org/t/hexagonal-grid-formation/18396

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);


var renderer = new THREE.WebGLRenderer({
  antialias: true
});
let width = window.innerWidth;
let height = window.innerHeight;
renderer.setSize(width, height);

var canvas = renderer.domElement;
document.body.appendChild(canvas);

var controls = new OrbitControls(camera, canvas);

controls.minDistance = 10;  // The camera cannot get closer than 10 units
controls.maxDistance = 50; // The camera cannot get further than 100 units

// You can also adjust the camera's current position:
camera.position.set(0, 0, 50);

const angleInDegrees = 30;
const angleInRadians = THREE.MathUtils.degToRad(angleInDegrees);


// Make sure to update the controls after changing the camera's position:
controls.update();


// var light = new THREE.DirectionalLight(0xffffff, 1.5);
// light.position.setScalar(100);
// scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));


var points3d = [];


var points3d = [];
points3d.push(new THREE.Vector3());


let unit = Math.sqrt(3) * 2;

let angle = Math.PI / 3;
let axis = new THREE.Vector3(0, 0, 1);

let axisVector = new THREE.Vector3(0, -unit, 0);
let sideVector = new THREE.Vector3(0, unit, 0).applyAxisAngle(axis, -angle);
let circleCount = 10;
let tempV3 = new THREE.Vector3();
for (let seg = 0; seg < 6; seg++) {
  for (let ax = 1; ax <= circleCount; ax++) {
    for (let sd = 0; sd < ax; sd++) {
      tempV3.copy(axisVector)
      	.multiplyScalar(ax)
        .addScaledVector(sideVector, sd)
        .applyAxisAngle(axis, angle * seg);
        
      points3d.push(new THREE.Vector3().copy(tempV3));
    }
  }
}


var geom = new THREE.BufferGeometry().setFromPoints(points3d);
var cloud = new THREE.Points(
  geom,
  new THREE.PointsMaterial({ color: 0x99ccff, size: 2 })
);
//scene.add(cloud);

let coords = points3d.map(pt => [pt.x, pt.y]);  // convert 3D points to 2D

// triangulate x, z
var indexDelaunay = Delaunator.from(
  points3d.map(pt => [pt.x, pt.y])
);


var meshIndex = []; // delaunay index => three.js index
for (let i = 0; i < indexDelaunay.triangles.length; i++){
  meshIndex.push(indexDelaunay.triangles[i]);
}

geom.setIndex(meshIndex); // add three.js index to the existing geometry
geom.computeVertexNormals();


let highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000,side: THREE.DoubleSide });

let materialArray = []
for(let i = 0; i < meshIndex.length; i++){
  materialArray.push(highlightMaterial);
}


var mesh = new THREE.Mesh(
  geom, // re-use the existing geometry
  new THREE.MeshLambertMaterial({ color: "yellow", wireframe: true, side: THREE.DoubleSide }),
);

scene.add(mesh);


render();

function resize(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

function render() {
  if (resize(renderer)) {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}


var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();


var selectedMeshes = [];

var faces  = [];


function onMouseClick(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    var intersects = raycaster.intersectObject(mesh);

    // intersects is an array that contains all the triangles that the ray intersected
    for (var i = 0; i < intersects.length; i++) {

        
        // Get vertices of the intersected face
        let vertices = [
            mesh.geometry.attributes.position.array[intersects[i].face.a * 3],
            mesh.geometry.attributes.position.array[intersects[i].face.a * 3 + 1],
            mesh.geometry.attributes.position.array[intersects[i].face.a * 3 + 2],

            mesh.geometry.attributes.position.array[intersects[i].face.b * 3],
            mesh.geometry.attributes.position.array[intersects[i].face.b * 3 + 1],
            mesh.geometry.attributes.position.array[intersects[i].face.b * 3 + 2],

            mesh.geometry.attributes.position.array[intersects[i].face.c * 3],
            mesh.geometry.attributes.position.array[intersects[i].face.c * 3 + 1],
            mesh.geometry.attributes.position.array[intersects[i].face.c * 3 + 2]
        ];

        // Create new buffer geometry
        var highlightGeometry = new THREE.BufferGeometry();
        highlightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        highlightGeometry.computeVertexNormals();

        // Create new mesh with the geometry and add it to the scene
        let highlightedMesh = new THREE.Mesh(
            highlightGeometry,
            highlightMaterial
        );

        scene.add(highlightedMesh);

        // Save the mesh for later usage
        selectedMeshes.push(highlightedMesh);

        console.log("intersects[i].face", intersects[i].face);
    }
}

window.addEventListener('click', onMouseClick, false);



// You can add an event listener to the window resize event:
window.addEventListener('resize', function() {
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
  //controls.update();
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});


function downloadPLY(plyData, filename) {
  let blob = new Blob([plyData], { type: 'text/plain' });
  let url = URL.createObjectURL(blob);
  let link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
}

document.getElementById('downloadButton').addEventListener('click', function() {
  // let plyData = generatePLY(selectedMeshes);
  // downloadPLY(plyData, 'selected_meshes.ply');

  let result_geometry = BufferGeometryUtils.mergeGeometries(
    selectedMeshes.map(mesh => mesh.geometry)
  );
  result_geometry = BufferGeometryUtils.mergeVertices(result_geometry);
  
  let exporter = new PLYExporter();
  let plyData = exporter.parse(new THREE.Mesh(result_geometry));
  plyData = plyData.replace("property list uchar int vertex_index",
                            "property list uint8 int32 vertex_indices") 
  

  downloadPLY(plyData, 'selected_meshes.ply');

});

