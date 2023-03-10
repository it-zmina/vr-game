import * as THREE from 'three';

import venice_sunset_environment from "../assets/hdr/venice_sunset_1k.hdr"
import dungeon from "../assets/dungeon.glb"
// TASK 3.? Link GLB-files with ghoul and gun models
import ghoulModel from "../assets/ghoul.glb"
import gunModel from "../assets/flare-gun.glb"

// TASK 3.? Link MP3-files with audio
import ambient from "../assets/sfx/ambient.mp3"
import shot from "../assets/sfx/shot.mp3"
import snarl from "../assets/sfx/snarl.mp3"
import swish from "../assets/sfx/swish.mp3"

import {GLTFLoader} from "three/addons/loaders/GLTFLoader";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader";
import {RGBELoader} from "three/addons/loaders/RGBELoader";
import Stats from "three/addons/libs/stats.module";
import {LoadingBar} from "./utils/LoadingBar";
import {VRButton} from "./utils/VRButton";
import {Player} from "./models/Player";
import {XRControllerModelFactory} from "three/addons/webxr/XRControllerModelFactory";
import {TeleportMesh} from "./models/TeleportMesh";
import {Interactable} from "./utils/Interactable";
import {Pathfinding} from "three-pathfinding";
import {Bullet} from "./models/Bullet";
import {cloneGLTF, getGltfLoader, getLoader} from "./utils/loaderUtils";

const soundFiles = {
     ambient: ambient,
     shot: shot,
     snarl: snarl,
     swish: swish
}

class App {
    // TASK 3.? Link sound files with audio names

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

        // TASK 3.? Configure debug options
        this.debug = { showPath:false, teleport: true };

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
        this.interactables = [];
        // TASK 3.? Create empty array for
        this.markables = [];

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
                        // TASK 3.? Store markable mesh (chest)
                        } else if (child.name == "SD_Prop_Chest_Skull_01") {
                            self.markables.push(child);
                        } else {
                            // TASK 2.1.2 Check if mesh is interacting
                            self.storeIfInteractingMesh.bind(self, child).call()
                            child.castShadow = false;
                            child.receiveShadow = true;
                        }
                    }
                });

                gltf.scene.scale.set(scale, scale, scale);

                // TASK 3.? Load other assets
                self.initPathfinding();
                self.loadGhoul();
                // self.initGame();
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
        if (!mesh.isMesh) return

        if (mesh.name == "SD_Prop_Chest_Skull_Lid_01") {
            this.interactables.push(new Interactable(mesh, {
                mode: 'tweens',
                tweens: [
                    {
                        target: mesh.quaternion,
                        channel: 'x',
                        start: 0,
                        end: -0.7,
                        duration: 1
                    }
                ]
            }));
        } else if (mesh.name == "Door_1") {
            this.interactables.push(new Interactable(mesh, {
                mode: 'tweens',
                tweens: [
                    {
                        target: mesh.quaternion,
                        channel: 'z',
                        start: 0,
                        end: 0.6,
                        duration: 1
                    }
                ]
            }));
        }
    }

    loadGhoul() {
        const loader = getGltfLoader()

        const self = this;

        const anims = [
            {start: 81, end: 161, name: "idle", loop: true},
            {start: 250, end: 290, name: "block", loop: false},
            {start: 300, end: 320, name: "gethit", loop: false},
            {start: 340, end: 375, name: "die", loop: false},
            {start: 380, end: 430, name: "attack", loop: false},
            {start: 470, end: 500, name: "walk", loop: true},
            {start: 540, end: 560, name: "run", loop: true}
        ];

        // Load a GLTF resource
        loader.load(
            // resource URL
            ghoulModel,
            // called when the resource is loaded
            function (gltf) {
                const gltfs = [gltf];
                for (let i = 0; i < 3; i++) gltfs.push(cloneGLTF(gltf));

                self.ghouls = [];

                gltfs.forEach(function (gltf) {
                    const object = gltf.scene.children[0];

                    object.traverse(function (child) {
                        if (child.isMesh) {
                            child.castShadow = true;
                        }
                    });

                    const options = {
                        object: object,
                        speed: 0.8,
                        assetsPath: self.assetsPath,
                        loader: loader,
                        anims: anims,
                        clip: gltf.animations[0],
                        app: self,
                        name: 'ghoul',
                        npc: true
                    };

                    const ghoul = new Player(options);

                    const scale = 0.01;
                    ghoul.object.scale.set(scale, scale, scale);

                    ghoul.object.position.copy(self.randomWaypoint);
                    ghoul.newPath(self.randomWaypoint);

                    self.ghouls.push(ghoul);

                });

                self.loadGun();
            },
            // called while loading is progressing
            function (xhr) {

                self.loadingBar.progress = (xhr.loaded / xhr.total) * 0.33 + 0.33;

            },
            // called when loading has errors
            function (error) {

                console.error(error.message);

            }
        );
    }

    loadGun() {
        const loader = getGltfLoader()
        const self = this;

        // Load a GLTF resource
        loader.load(
            // resource URL
            gunModel,
            // called when the resource is loaded
            function (gltf) {
                self.gun = gltf.scene;
                self.gun.position.set(-0.430, 0.877, 3.013);
                self.gun.rotateX(Math.PI / 2);
                self.scene.add(self.gun);

                const bullet = gltf.scene.getObjectByName("Bullet");
                self.scene.add(bullet);

                const targets = [];
                self.ghouls.forEach(ghoul => targets.push(ghoul.object.children[1]));

                self.bullet = new Bullet(bullet, {
                    gun: self.gun,
                    targets
                });

                self.bullet.addEventListener('hit', ev => {
                    const tmp = self.ghouls.filter(ghoul =>
                        ev.hitObject == ghoul.object.children[1]);
                    if (tmp.length > 0) {
                        self.sounds.snarl.play();
                        const ghoul = tmp[0];
                        ghoul.action = 'die';
                        ghoul.dead = true;
                        ghoul.calculatedPath = null;
                        ghoul.curAction.loop = THREE.LoopOnce;
                        ghoul.curAction.clampWhenFinished = true;
                        ghoul.mixer.addEventListener('finished', (e) => {
                            self.scene.remove(ghoul.object);
                            self.ghouls.splice(self.ghouls.indexOf(ghoul), 1);
                        });
                    }
                });

                self.initGame();
            },
            // called while loading is progressing
            function (xhr) {

                self.loadingBar.progress = (xhr.loaded / xhr.total) * 0.33 + 0.66;

            },
            // called when loading has errors
            function (error) {

                console.error(error.message);

            }
        );
    }

    loadAudio() {

        if (this.audioListener === undefined) {
            this.audioListener = new THREE.AudioListener();
            // add the listener to the camera
            this.camera.add(this.audioListener);
            this.sounds = {};

            this.audio = {
                index: 0,
                names: Object.keys(soundFiles)
            }
        }

        const name = this.audio.names[this.audio.index];

        const loader = new THREE.AudioLoader();
        const self = this;

        // load a resource
        loader.load(
            // resource URL
            soundFiles[name],

            // onLoad callback
            function (audioBuffer) {
                // set the audio object buffer to the loaded object
                let snd;
                if (name === 'snarl') {
                    snd = new THREE.PositionalAudio(self.audioListener);
                } else {
                    snd = new THREE.Audio(self.audioListener);
                    self.scene.add(snd);
                    if (name === 'ambient') {
                        snd.setLoop(true);
                        snd.setVolume(0.5);
                    }
                }
                snd.setBuffer(audioBuffer);

                // play the audio
                if (name === 'ambient') snd.play();

                self.sounds[name] = snd;

                self.audio.index++;

                if (self.audio.index < self.audio.names.length) {
                    self.loadAudio();
                }
            },

            // onProgress callback
            function (xhr) {
                const peraudio = 0.25 / self.audio.length;
                self.loadingBar.progress = ((xhr.loaded / xhr.total) + self.audio.index) * peraudio + 0.75;
            },

            // onError callback
            function (err) {
                console.log('An error happened');
            }
        );
    }

    get randomWaypoint() {
        const index = Math.floor(Math.random() * this.waypoints.length);
        return this.waypoints[index];
    }

    initPathfinding() {
        this.waypoints = [
            new THREE.Vector3(8.689, 2.687, 0.349),
            new THREE.Vector3(0.552, 2.589, -2.122),
            new THREE.Vector3(-7.722, 2.630, 0.298),
            new THREE.Vector3(2.238, 2.728, 7.050),
            new THREE.Vector3(2.318, 2.699, 6.957),
            new THREE.Vector3(-1.837, 0.111, 1.782)
        ];
        this.pathfinder = new Pathfinding();
        this.ZONE = 'dungeon';
        this.pathfinder.setZoneData(this.ZONE, Pathfinding.createZone(this.navmesh.geometry));
    }

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
        this.teleports = [];
        locations.forEach(location => {
            const teleport = new TeleportMesh();
            teleport.position.copy(location);
            self.scene.add(teleport);
            self.teleports.push(teleport);
        })

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
            // TASK 3.? Store grip model to the controller
            controller.userData.grip = grip;
        }

        return controllers;
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        const self = this;

        function onSelectStart() {
            this.userData.selectPressed = true;
            // TASK 3.? Shout if controller is with the gun model
            if (this.userData.gun && !self.bullet.firing){
                self.sounds.shot.play();
                self.bullet.fire();
            } else

            // TASK 1.6 On select press move to the selected teleport
            if (this.userData.teleport) {
                self.player.object.position.copy(this.userData.teleport.position);
                self.teleports.forEach(teleport => teleport.fadeOut(0.5));
                // TASK 3.? Add teleportation sound
                self.sounds.swish.play();
                this.userData.teleport.visible = false
            }
            // TASK 2.5 Call play for the interactable
            else if (this.userData.interactable) {
                this.userData.interactable.play();
            }

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
            self.teleports.forEach(teleport => teleport.fadeIn(1));
        }

        function onSqueezeEnd() {
            this.userData.squeezePressed = false;
            // TASK 1.3 Hide teleports when squeeze button is released
            self.teleports.forEach(teleport => teleport.fadeOut(1));
        }

        // TASK 3.? Load audio after entering VR mode
        function onSessionStart() {
            if (self.sounds === undefined) self.loadAudio();
        }

        const btn = new VRButton(this.renderer, { onSessionStart });

        this.controllers = this.buildControllers();

        this.controllers.forEach(controller => {
            controller.addEventListener('selectstart', onSelectStart);
            controller.addEventListener('selectend', onSelectEnd);
            controller.addEventListener('squeezestart', onSqueezeStart);
            controller.addEventListener('squeezeend', onSqueezeEnd);
        })

        this.collisionObjects = [this.navmesh];
        // TASK 1.5.1 Add teleports cylinders to the collisionObjects
        this.teleports.forEach(teleport =>
            self.collisionObjects.push(teleport.children[0]));

        // TASK 2.3 Add meshes to the list of collisionObjects for selecting them by the controllers.
        this.interactables.forEach( interactable => self.collisionObjects.push( interactable.mesh ));
        // TASK 3.? Add chest and gun collider to collision objects
        this.markables.forEach( markable => self.collisionObjects.push( markable ));

        const gunCollider = this.gun.getObjectByName( 'Collider' );
        gunCollider.material.visible = false;
        this.collisionObjects.push( gunCollider );
    }

    // TASK 3.? Change controller model
    pickupGun(controller = this.controllers[0]) {
        this.gun.position.set(0, 0, 0);
        this.gun.quaternion.identity();
        //this.gun.rotateY( -Math.PI/2 )
        controller.children[0].visible = false;
        controller.add(this.gun);
        controller.userData.gun = true;
        const grip = controller.userData.grip;
        this.dolly.remove(grip);
    }

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
            // TASK 3.? Check if intersect markable object
            const markable = (this.markables.indexOf(intersect.object) != -1);

            if (intersect.object === this.navmesh || markable) {
                marker.scale.set(1, 1, 1);
                marker.position.copy(intersect.point);
                marker.visible = true;
            }
            // TASK 3.? Pick up gun if marker on gun collider
            else if (intersect.object.parent === this.gun) {
                this.pickupGun(controller);
            }
            // TASK 1.5.2 Highlight and store intersected teleport
            else if (intersect.object.parent
                && intersect.object.parent instanceof TeleportMesh) {
                intersect.object.parent.selected = true;
                controller.userData.teleport = intersect.object.parent;
            }
            // TASK 2.4 Add the selected interactable to the controller's userData object.
            else {
                const selectedInteractableMesh = this.interactables.filter(interactable => interactable.mesh == intersect.object);

                if (selectedInteractableMesh.length > 0) {
                    controller.userData.interactable = selectedInteractableMesh[0];
                }
            }

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
            this.teleports.forEach(teleport => {
                teleport.selected = false;
                teleport.update();
            });

            this.controllers.forEach(controller => {
                // TASK 3.? Disable selecting by controller with gun
                if (!controller.userData.gun) {
                    self.intersectObjects(controller);
                }
            })

            // TASK 2.2 Update interactable meshes
            this.interactables.forEach(interactable => interactable.update(dt));

            this.player.update(dt);
            // TASK 3.? Update ghouls and bullet models
            this.ghouls.forEach( ghoul => { ghoul.update(dt) });

            this.bullet.update(dt);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

export {App};
