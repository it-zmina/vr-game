import * as THREE from 'three';

import venice_sunset_environment from "../assets/hdr/venice_sunset_1k.hdr"
import dungeon from "../assets/dungeon.glb"
// TASK 3.2 Link GLB-files with ghoul and gun models

// TASK 3.3 Link MP3-files with sound effects

import {GLTFLoader} from "three/addons/loaders/GLTFLoader";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader";
import {RGBELoader} from "three/addons/loaders/RGBELoader";
import Stats from "three/addons/libs/stats.module";
import {LoadingBar} from "./utils/LoadingBar";
import {VRButton} from "./utils/VRButton";
import {Player} from "./models/Player";
import {XRControllerModelFactory} from "three/addons/webxr/XRControllerModelFactory";
import {TeleportMesh} from "./models/TeleportMesh";

const soundFiles = {
     ambient: ambient,
     shot: shot,
     snarl: snarl,
     swish: swish
}

class App {

    constructor() {
        const container = document.createElement('div');
        container.style.position = 'fixed'
        container.style.top = '0px'
        container.style.left = '0px'
        document.body.appendChild(container);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
        this.camera.position.set(0, 1.6, 0);

        this.scene = new THREE.Scene();

        const ambient = new THREE.HemisphereLight(0x555555, 0x999999);
        this.scene.add(ambient);

        this.sun = new THREE.DirectionalLight(0xAAAAFF, 2.5);
        this.sun.castShadow = true;

        const lightSize = 5;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 17;
        this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -lightSize;
        this.sun.shadow.camera.right = this.sun.shadow.camera.top = lightSize;

        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;

        this.sun.position.set(0, 10, 10);
        this.scene.add(this.sun);

        // TASK 3.4 Configure debug options

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
        this.setEnvironment();

        this.workingMatrix = new THREE.Matrix4();
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();

        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        this.loadEnvironment();

        this.loading = true;

        window.addEventListener('resize', this.resize.bind(this));
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setEnvironment() {
        const loader = new RGBELoader().setDataType(THREE.HalfFloatType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const self = this;

        loader.load(venice_sunset_environment, (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();

            self.scene.environment = envMap;

        }, undefined, (err) => {
            console.error('An error occurred setting the environment');
        });
    }

    loadEnvironment() {
        const loader = getGltfLoader()

        // Prepare loading bar
        this.loadingBar = new LoadingBar(loader);

        // TASK 2.1.1 Create empty array for storing interacting meshes

        // TASK 3.5 Create empty array for markables models


        const self = this;

        // Load a glTF resource
        loader.load(
            // resource URL
            dungeon,
            // called when the resource is loaded
            function (gltf) {
                const scale = 0.5;

                self.scene.add(gltf.scene);

                gltf.scene.traverse(function (child) {
                    if (child.isMesh) {
                        if (child.name == "Navmesh") {
                            child.material.visible = false;
                            self.navmesh = child;
                            child.geometry.scale(scale, scale, scale);
                            child.scale.set(2, 2, 2);
                        // TASK 3.6 Store markable mesh (chest)

                        } else {
                            // TASK 2.1.2 Check if mesh is interacting
                            self.storeIfInteractingMesh.bind(self, child).call()
                            child.castShadow = false;
                            child.receiveShadow = true;
                        }
                    }
                });

                gltf.scene.scale.set(scale, scale, scale);

                // TASK 3.7 Load all assets
                self.initGame();
            },
            // called while loading is progressing
            function (xhr) {

                self.loadingBar.progress = (xhr.loaded / xhr.total);

            },
            // called when loading has errors
            function (error) {

                console.log('An error happened');

            }
        );
    }

    // TASK 2.1.3 Store if object is interacting meshes
    storeIfInteractingMesh(mesh) {

    }

    // TASK 3.8 Load ghoul, gun models and sound effects



    // TASK 3.9 Init path finding



    initGame() {
        this.player = this.createPlayer();

        const locations = [
            new THREE.Vector3(-0.409, 0.086, 4.038),
            new THREE.Vector3(-0.846, 0.112, 5.777),
            new THREE.Vector3(5.220, 0.176, 2.677),
            new THREE.Vector3(1.490, 2.305, -1.599),
            new THREE.Vector3(7.565, 2.694, 0.008),
            new THREE.Vector3(-8.417, 2.676, 0.192),
            new THREE.Vector3(-6.644, 2.600, -4.114)
        ];

        const self = this;

        // TASK 1.1 Create teleports and add them to the scene

        this.setupXR();

        this.loading = false;

        this.renderer.setAnimationLoop(this.render.bind(this));

        this.loadingBar.visible = false;
    }

    createMarker(geometry, material) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }

    buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();

        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

        const line = new THREE.Line(geometry);
        line.name = 'ray';
        line.scale.z = 10;

        const geometry2 = new THREE.SphereGeometry(0.03, 8, 6);
        const material = new THREE.MeshBasicMaterial({color: 0xFF0000});

        const controllers = [];

        for (let i = 0; i <= 1; i++) {
            const controller = this.renderer.xr.getController(i);
            controller.userData.index = i;
            controller.userData.selectPressed = false;
            controller.add(line.clone());
            controller.userData.marker = this.createMarker(geometry2, material);
            controllers.push(controller);
            this.dolly.add(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            this.dolly.add(grip);
            // TASK 3.10 Store grip model to the controller

        }

        return controllers;
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        const self = this;

        function onSelectStart() {
            this.userData.selectPressed = true;
            // TASK 3.11 Shout if controller is with the gun model

            // TASK 1.6 On select press move to the selected teleport
            if (false) {

            }
            // TASK 3.12 Add teleportation sound

            // TASK 2.5 Call play for the interactable


            else if (this.userData.marker.visible) {
                const pos = this.userData.marker.position;
                console.log(`${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}`);
            }
        }

        function onSelectEnd() {
            this.userData.selectPressed = false;
        }

        function onSqueezeStart() {
            this.userData.squeezePressed = true;
            // TASK 1.2 Display teleports when squeeze button is pressed
        }

        function onSqueezeEnd() {
            this.userData.squeezePressed = false;
            // TASK 1.3 Hide teleports when squeeze button is released

        }

        // TASK 3.13 Load audio after entering VR mode

        const btn = new VRButton(this.renderer);

        this.controllers = this.buildControllers();

        this.controllers.forEach(controller => {
            controller.addEventListener('selectstart', onSelectStart);
            controller.addEventListener('selectend', onSelectEnd);
            controller.addEventListener('squeezestart', onSqueezeStart);
            controller.addEventListener('squeezeend', onSqueezeEnd);
        })

        this.collisionObjects = [this.navmesh];
        // TASK 1.5.1 Add teleports cylinders to the collisionObjects


        // TASK 2.3 Add meshes to the list of collisionObjects for selecting them by the controllers.

        // TASK 3.14 Add chest and gun collider to collision objects

    }

    // TASK 3.15 Change controller model


    intersectObjects(controller) {

        const line = controller.getObjectByName('ray');
        this.workingMatrix.identity().extractRotation(controller.matrixWorld);

        this.raycaster.ray.origin
            .setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction
            .set(0, 0, -1)
            .applyMatrix4(this.workingMatrix);

        const intersects = this.raycaster.intersectObjects(this.collisionObjects);
        const marker = controller.userData.marker;
        marker.visible = false;

        controller.userData.teleport = undefined;

        if (intersects.length > 0) {

            const intersect = intersects[0];
            line.scale.z = intersect.distance;
            // TASK 3.16 Check if intersect markable object


            if (intersect.object === this.navmesh || markable) {
                marker.scale.set(1, 1, 1);
                marker.position.copy(intersect.point);
                marker.visible = true;
            }
            // TASK 3.17 Pick up gun if marker on gun collider

            // TASK 1.5.2 Highlight and store intersected teleport

            // TASK 2.4 Add the selected interactable to the controller's userData object.

        }

    }

    createPlayer() {
        const target = new THREE.Object3D();
        target.position.set(-3, 0.25, 2);

        const options = {
            object: target,
            speed: 5,
            app: this,
            name: 'player',
            npc: false
        };

        const player = new Player(options);

        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, -0.25, 0);
        this.dolly.add(this.camera);

        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        target.add(this.dolly);

        this.dolly.rotation.y = Math.PI;

        return player;
    }

    render() {
        const dt = this.clock.getDelta();
        const self = this;

        this.sun.position.copy(this.dummyCam.position);
        this.sun.position.y += 10;
        this.sun.position.z += 10;

        this.stats.update();

        if (this.renderer.xr.isPresenting) {
            // TASK 1.4 Redraw teleports with update method

            this.controllers.forEach(controller => {
                // TASK 3.18 Disable selecting by controller with gun

            })

            // TASK 2.2 Update interactable meshes

            this.player.update(dt);
            // TASK 3.19 Update ghouls and bullet models

        }

        this.renderer.render(this.scene, this.camera);
    }
}

export {App};
