import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

export interface DualRenderer {
  webgl: THREE.WebGLRenderer;
  css3d: CSS3DRenderer;
  camera: THREE.PerspectiveCamera;
  dispose: () => void;
}

/**
 * Layers a CSS3DRenderer on top of a WebGLRenderer, sharing one camera. The
 * WebGL layer draws the room, starfield, and frame borders; the CSS3D layer
 * draws live <img> elements for frame content. Cross-origin satellite images
 * can't be sampled as WebGL textures without CORS headers we don't control,
 * but a plain <img> tag displays them fine — CSS3D sidesteps the problem
 * entirely by compositing real DOM elements into the 3D scene.
 */
export function createRenderers(container: HTMLElement): DualRenderer {
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, 0, 6);

  const webgl = new THREE.WebGLRenderer({ antialias: true });
  webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  webgl.setSize(window.innerWidth, window.innerHeight);
  Object.assign(webgl.domElement.style, { position: 'absolute', inset: '0', zIndex: '1' });

  const css3d = new CSS3DRenderer();
  css3d.setSize(window.innerWidth, window.innerHeight);
  Object.assign(css3d.domElement.style, { position: 'absolute', inset: '0', zIndex: '2', pointerEvents: 'none' });

  container.appendChild(webgl.domElement);
  container.appendChild(css3d.domElement);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    webgl.setSize(window.innerWidth, window.innerHeight);
    css3d.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  return {
    webgl,
    css3d,
    camera,
    dispose: () => {
      window.removeEventListener('resize', onResize);
      webgl.dispose();
      container.removeChild(webgl.domElement);
      container.removeChild(css3d.domElement);
    },
  };
}
