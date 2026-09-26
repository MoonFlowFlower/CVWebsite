"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { ALCHE_TOP_POST, type AlcheTopSceneState } from "@/lib/alche-top-page";

interface AlcheTopPagePostProcessingProps {
  sceneState: AlcheTopSceneState;
}

const FinalCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uChromatic: { value: ALCHE_TOP_POST.chromaticOffset },
    uNoise: { value: ALCHE_TOP_POST.filmNoise },
    uVignette: { value: ALCHE_TOP_POST.vignette },
    uWhiteMix: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;

    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChromatic;
    uniform float uNoise;
    uniform float uVignette;
    uniform float uWhiteMix;

    float grain(vec2 uv) {
      return fract(sin(dot(uv + fract(uTime * 0.01), vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float radius = dot(centered, centered);
      vec2 offset = centered * (uChromatic * (0.8 + radius * 3.6));

      vec4 sourceR = texture2D(tDiffuse, vUv + offset);
      vec4 sourceG = texture2D(tDiffuse, vUv);
      vec4 sourceB = texture2D(tDiffuse, vUv - offset);
      vec3 color = vec3(sourceR.r, sourceG.g, sourceB.b);

      float noise = (grain(vUv * vec2(1400.0, 900.0)) - 0.5) * uNoise;
      float vignette = smoothstep(1.05, 0.12, 1.0 - radius * 1.85);
      float whiteEase = mix(1.0, 0.92, uWhiteMix);

      color += noise;
      color *= mix(1.0 - uVignette * radius * 1.45, vignette, 0.6);
      color *= whiteEase;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function AlcheTopPagePostProcessing({ sceneState }: AlcheTopPagePostProcessingProps) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const finalPassRef = useRef<ShaderPass | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const previousAutoClearRef = useRef(true);
  const resolution = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    previousAutoClearRef.current = gl.autoClear;
    gl.autoClear = false;

    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.2, 0.42, 0.82);
    const finalPass = new ShaderPass(FinalCompositeShader);
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(finalPass);
    composer.addPass(outputPass);

    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    composer.setSize(size.width, size.height);

    composerRef.current = composer;
    finalPassRef.current = finalPass;
    bloomRef.current = bloomPass;

    return () => {
      gl.autoClear = previousAutoClearRef.current;
      composer.dispose();
      composerRef.current = null;
      finalPassRef.current = null;
      bloomRef.current = null;
    };
  }, [camera, gl, scene, size.height, size.width]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    composer.setSize(size.width, size.height);
  }, [size.height, size.width]);

  useFrame((state) => {
    const composer = composerRef.current;
    const finalPass = finalPassRef.current;
    const bloomPass = bloomRef.current;
    if (!composer || !finalPass || !bloomPass) return;

    resolution.set(size.width, size.height);

    const whiteMix = Math.max(sceneState.missionIn.whiteMix, sceneState.mission.whiteMix, sceneState.vision.densityMix * 0.42);
    // Reference kv wordmark is crisp with only a soft halo.
    bloomPass.strength = THREE.MathUtils.lerp(0.2, 0.04, whiteMix) * Math.max(sceneState.introProgress, 0.15);
    bloomPass.radius = THREE.MathUtils.lerp(0.4, 0.14, whiteMix);
    bloomPass.threshold = THREE.MathUtils.lerp(0.8, 0.97, whiteMix);

    finalPass.uniforms.uTime.value = state.clock.elapsedTime;
    finalPass.uniforms.uChromatic.value = 0.0;
    finalPass.uniforms.uNoise.value = 0.002;
    finalPass.uniforms.uVignette.value = 0.04;
    finalPass.uniforms.uWhiteMix.value = whiteMix;

    composer.render();
  }, 1);

  return null;
}
// dark-direction pass 2026-07-13
