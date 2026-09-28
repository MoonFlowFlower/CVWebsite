"use client";

import * as THREE from "three";

/**
 * Pointer fluid for the kv LED wall (the reference site feeds a fluid texture
 * into its panel sides and grid; this is our own implementation of the
 * standard stable-fluids pipeline, kept small).
 *
 * One RGBA half-float field in screen uv holds velocity (rg, texels/second)
 * and dye (b). Each frame:
 *   1. curl of the velocity
 *   2. vorticity confinement (spins up small eddies into visible swirls)
 *   3. divergence -> Jacobi pressure solve -> subtract the pressure gradient
 *      (incompressible flow: pushed fluid rolls into eddies instead of
 *      smearing)
 *   4. self-advection + dissipation, then the pointer splats its motion and
 *      dye along the segment it travelled this frame.
 */

const FLUID_WIDTH = 192;
const FLUID_HEIGHT = 108;
const PRESSURE_ITERATIONS = 16;
const CURL_STRENGTH = 20;

const FLUID_VERTEX = /* glsl */ `
  uniform vec2 uTexel;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  void main() {
    vUv = uv;
    vL = uv - vec2(uTexel.x, 0.0);
    vR = uv + vec2(uTexel.x, 0.0);
    vT = uv + vec2(0.0, uTexel.y);
    vB = uv - vec2(0.0, uTexel.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function createPass(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTexel: { value: new THREE.Vector2(1 / FLUID_WIDTH, 1 / FLUID_HEIGHT) }, ...uniforms },
    vertexShader: FLUID_VERTEX,
    fragmentShader,
  });
}

const FLUID_VARYINGS = /* glsl */ `
  uniform vec2 uTexel;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
`;

function createFluidPasses() {
  const curl = createPass(
    `
      uniform sampler2D uField;
      ${FLUID_VARYINGS}
      void main() {
        float l = texture2D(uField, vL).y;
        float r = texture2D(uField, vR).y;
        float t = texture2D(uField, vT).x;
        float b = texture2D(uField, vB).x;
        gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
      }
    `,
    { uField: { value: null } },
  );

  const vorticity = createPass(
    `
      uniform sampler2D uField;
      uniform sampler2D uCurl;
      uniform float uCurlStrength;
      uniform float uDt;
      ${FLUID_VARYINGS}
      void main() {
        float l = texture2D(uCurl, vL).x;
        float r = texture2D(uCurl, vR).x;
        float t = texture2D(uCurl, vT).x;
        float b = texture2D(uCurl, vB).x;
        float c = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
        force /= length(force) + 1e-4;
        force *= uCurlStrength * c;
        force.y *= -1.0;
        vec4 field = texture2D(uField, vUv);
        vec2 velocity = field.xy + force * uDt;
        velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));
        gl_FragColor = vec4(velocity, field.zw);
      }
    `,
    { uField: { value: null }, uCurl: { value: null }, uCurlStrength: { value: CURL_STRENGTH }, uDt: { value: 1 / 60 } },
  );

  const divergence = createPass(
    `
      uniform sampler2D uField;
      ${FLUID_VARYINGS}
      void main() {
        float l = texture2D(uField, vL).x;
        float r = texture2D(uField, vR).x;
        float t = texture2D(uField, vT).y;
        float b = texture2D(uField, vB).y;
        // Closed walls: reflect velocity at the border.
        vec2 c = texture2D(uField, vUv).xy;
        if (vL.x < 0.0) l = -c.x;
        if (vR.x > 1.0) r = -c.x;
        if (vT.y > 1.0) t = -c.y;
        if (vB.y < 0.0) b = -c.y;
        gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
      }
    `,
    { uField: { value: null } },
  );

  const pressure = createPass(
    `
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      ${FLUID_VARYINGS}
      void main() {
        float l = texture2D(uPressure, vL).x;
        float r = texture2D(uPressure, vR).x;
        float t = texture2D(uPressure, vT).x;
        float b = texture2D(uPressure, vB).x;
        float div = texture2D(uDivergence, vUv).x;
        gl_FragColor = vec4((l + r + b + t - div) * 0.25, 0.0, 0.0, 1.0);
      }
    `,
    { uPressure: { value: null }, uDivergence: { value: null } },
  );

  const gradient = createPass(
    `
      uniform sampler2D uPressure;
      uniform sampler2D uField;
      ${FLUID_VARYINGS}
      void main() {
        float l = texture2D(uPressure, vL).x;
        float r = texture2D(uPressure, vR).x;
        float t = texture2D(uPressure, vT).x;
        float b = texture2D(uPressure, vB).x;
        vec4 field = texture2D(uField, vUv);
        field.xy -= vec2(r - l, t - b);
        gl_FragColor = field;
      }
    `,
    { uPressure: { value: null }, uField: { value: null } },
  );

  const advect = createPass(
    `
      uniform sampler2D uField;
      uniform vec2 uPointer;
      uniform vec2 uPointerPrev;
      uniform float uDt;
      uniform float uAspect;
      uniform float uActive;
      ${FLUID_VARYINGS}
      void main() {
        float dt = clamp(uDt, 0.001, 0.05);
        vec4 here = texture2D(uField, vUv);
        vec4 advected = texture2D(uField, vUv - here.xy * uTexel * dt);
        vec2 velocity = advected.xy * pow(0.55, dt);
        float dye = advected.z * pow(0.4, dt);

        // Splat along the pointer's path this frame (capsule falloff).
        vec2 seg = uPointer - uPointerPrev;
        float h = clamp(dot(vUv - uPointerPrev, seg) / max(dot(seg, seg), 1e-7), 0.0, 1.0);
        vec2 q = (vUv - (uPointerPrev + seg * h)) * vec2(uAspect, 1.0);
        float splat = exp(-dot(q, q) / 0.0028) * uActive;
        vec2 pointerVelocity = seg / dt;
        velocity += pointerVelocity / uTexel * splat * 0.4;
        dye += splat * clamp(length(pointerVelocity) * 1.2, 0.0, 1.0) * dt * 11.0;

        gl_FragColor = vec4(clamp(velocity, vec2(-1000.0), vec2(1000.0)), clamp(dye, 0.0, 3.0), 1.0);
      }
    `,
    {
      uField: { value: null },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uPointerPrev: { value: new THREE.Vector2(0.5, 0.5) },
      uDt: { value: 1 / 60 },
      uAspect: { value: 1 },
      uActive: { value: 0 },
    },
  );

  return { curl, vorticity, divergence, pressure, gradient, advect };
}

export interface WallFluidStepParams {
  pointerUv: THREE.Vector2;
  pointerPrevUv: THREE.Vector2;
  dt: number;
  aspect: number;
  active: boolean;
}

export class WallFluid {
  /** Velocity (texels/s) in rg, dye in b. */
  readonly texelsPerUv = new THREE.Vector2(FLUID_WIDTH, FLUID_HEIGHT);

  private readonly field: THREE.WebGLRenderTarget[];
  private readonly pressure: THREE.WebGLRenderTarget[];
  private readonly curl: THREE.WebGLRenderTarget;
  private readonly divergence: THREE.WebGLRenderTarget;
  private readonly passes = createFluidPasses();
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fieldRead = 0;
  private pressureRead = 0;
  private cleared = false;

  constructor() {
    const makeTarget = () =>
      new THREE.WebGLRenderTarget(FLUID_WIDTH, FLUID_HEIGHT, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });
    this.field = [makeTarget(), makeTarget()];
    this.pressure = [makeTarget(), makeTarget()];
    this.curl = makeTarget();
    this.divergence = makeTarget();
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  get texture() {
    return this.field[this.fieldRead].texture;
  }

  private run(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget, gl: THREE.WebGLRenderer) {
    this.quad.material = material;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  private clear(gl: THREE.WebGLRenderer) {
    const previousClear = gl.getClearColor(new THREE.Color());
    const previousAlpha = gl.getClearAlpha();
    gl.setClearColor(0x000000, 0);
    [...this.field, ...this.pressure, this.curl, this.divergence].forEach((target) => {
      gl.setRenderTarget(target);
      gl.clear(true, false, false);
    });
    gl.setClearColor(previousClear, previousAlpha);
    this.cleared = true;
  }

  step(gl: THREE.WebGLRenderer, params: WallFluidStepParams) {
    const previousTarget = gl.getRenderTarget();
    if (!this.cleared) this.clear(gl);
    const dt = THREE.MathUtils.clamp(params.dt, 0.001, 0.05);
    const { curl, vorticity, divergence, pressure, gradient, advect } = this.passes;

    curl.uniforms.uField.value = this.field[this.fieldRead].texture;
    this.run(curl, this.curl, gl);

    vorticity.uniforms.uField.value = this.field[this.fieldRead].texture;
    vorticity.uniforms.uCurl.value = this.curl.texture;
    vorticity.uniforms.uDt.value = dt;
    this.run(vorticity, this.field[1 - this.fieldRead], gl);
    this.fieldRead = 1 - this.fieldRead;

    divergence.uniforms.uField.value = this.field[this.fieldRead].texture;
    this.run(divergence, this.divergence, gl);

    pressure.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < PRESSURE_ITERATIONS; i += 1) {
      pressure.uniforms.uPressure.value = this.pressure[this.pressureRead].texture;
      this.run(pressure, this.pressure[1 - this.pressureRead], gl);
      this.pressureRead = 1 - this.pressureRead;
    }

    gradient.uniforms.uPressure.value = this.pressure[this.pressureRead].texture;
    gradient.uniforms.uField.value = this.field[this.fieldRead].texture;
    this.run(gradient, this.field[1 - this.fieldRead], gl);
    this.fieldRead = 1 - this.fieldRead;

    advect.uniforms.uField.value = this.field[this.fieldRead].texture;
    advect.uniforms.uPointer.value.copy(params.pointerUv);
    advect.uniforms.uPointerPrev.value.copy(params.pointerPrevUv);
    advect.uniforms.uDt.value = dt;
    advect.uniforms.uAspect.value = params.aspect;
    advect.uniforms.uActive.value = params.active ? 1 : 0;
    this.run(advect, this.field[1 - this.fieldRead], gl);
    this.fieldRead = 1 - this.fieldRead;

    gl.setRenderTarget(previousTarget);
  }

  dispose() {
    [...this.field, ...this.pressure, this.curl, this.divergence].forEach((target) => target.dispose());
    Object.values(this.passes).forEach((material) => material.dispose());
    this.quad.geometry.dispose();
  }
}
