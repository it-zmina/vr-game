import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader";

export function getGltfLoader() {
    const loader = new GLTFLoader()
    // Provide a DRACOLoader instance to decode compressed mesh data
    const draco = new DRACOLoader()
    draco.setDecoderPath('draco/')
    loader.setDRACOLoader(draco)

    return loader
}

export function cloneGLTF(gltf) {

    const clone = {
        animations: gltf.animations,
        scene: gltf.scene.clone(true)
    };

    const skinnedMeshes = {};

    gltf.scene.traverse(node => {
        if (node.isSkinnedMesh) {
            skinnedMeshes[node.name] = node;
        }
    });

    const cloneBones = {};
    const cloneSkinnedMeshes = {};

    clone.scene.traverse(node => {
        if (node.isBone) {
            cloneBones[node.name] = node;
        }
        if (node.isSkinnedMesh) {
            cloneSkinnedMeshes[node.name] = node;
        }
    });

    for (let name in skinnedMeshes) {
        const skinnedMesh = skinnedMeshes[name];
        const skeleton = skinnedMesh.skeleton;
        const cloneSkinnedMesh = cloneSkinnedMeshes[name];
        const orderedCloneBones = [];
        for (let i = 0; i < skeleton.bones.length; ++i) {
            const cloneBone = cloneBones[skeleton.bones[i].name];
            orderedCloneBones.push(cloneBone);
        }
        cloneSkinnedMesh.bind(
            new THREE.Skeleton(orderedCloneBones, skeleton.boneInverses),
            cloneSkinnedMesh.matrixWorld);
    }

    return clone;

}
