import React, { useRef } from "react";
import { Canvas, useFrame, extend, useLoader } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";

// ------------------------------------------------------------------
// Reconstructed material based on analyzed shader logic
// ------------------------------------------------------------------
const RainMaterial = shaderMaterial(
  {
    uTime: 0,
    uIntensity: 1.0, // 0: no water, 1: fully wet
    tDiffuse: null, // background screen (injected from post-processing)
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader (core logic restored)
  `
    uniform float uTime;
    uniform float uIntensity;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    // Random noise function (original code approach)
    vec3 N13(float p) {
       vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
       p3 += dot(p3, p3.yzx + 19.19);
       return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
    }

    float N(float t) {
      return fract(sin(t*12345.564)*7658.76);
    }

    float Saw(float b, float t) {
      return smoothstep(0., b, t) * smoothstep(1., b, t);
    }

    // Static drops (small sparkling droplets)
    float StaticDrops(vec2 uv, float t) {
        uv *= 40.;

        vec2 id = floor(uv);
        uv = fract(uv) - .5;
        vec3 n = N13(id.x*107.45 + id.y*3543.654);
        vec2 p = (n.xy - .5) * .7;
        float d = length(uv - p);

        float fade = Saw(.025, fract(t + n.z));
        float c = smoothstep(.3, 0., d) * fract(n.z*10.) * fade;
        return c;
    }

    // Droplet layer generation function (based on logic extracted from file)
    vec2 DropLayer2(vec2 uv, float t) {
        vec2 UV = uv;

        // Move UV coordinates to create flowing water effect
        uv.y += t * 0.75;

        // Divide screen into grid
        vec2 a = vec2(6.0, 1.0);
        vec2 grid = a * 2.0;
        vec2 id = floor(uv * grid);

        float colShift = N(id.x);
        uv.y += colShift;

        id = floor(uv * grid);
        vec3 n = N13(id.x*35.2 + id.y*2376.1);

        // Reduce number of droplets (remove 70%, keep 30%)
        if (n.y < 0.8) return vec2(0.0);

        vec2 st = fract(uv * grid) - vec2(0.5, 0);

        // Wiggle droplet X coordinate for natural movement
        float x = n.x - 0.5;
        float y = UV.y * 20.0;
        float wiggle = sin(y + sin(y));
        x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
        x *= 0.7;

        float ti = fract(t + n.z);
        y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
        vec2 p = vec2(x, y);

        // Calculate main droplet distance
        float d = length((st - p) * a.yx);
        float mainDrop = smoothstep(0.4, 0.0, d);

        // Trail and small droplets left behind
        float r = sqrt(smoothstep(1.0, y, st.y));
        float cd = abs(st.x - x);
        float trail = smoothstep(0.23 * r, 0.15 * r * r, cd);
        float trailFront = smoothstep(-0.02, 0.02, st.y - y);
        trail *= trailFront * r * r;

        // Combine raindrop shapes
        float y2 = UV.y;
        float trail2 = smoothstep(0.2 * r, 0.0, cd);
        float droplets = max(0.0, (sin(y2 * (1.0 - y2) * 120.0) - st.y)) * trail2 * trailFront * n.z;
        y2 = fract(y2 * 10.0) + (st.y - 0.5);
        float dd = length(st - vec2(x, y2));
        droplets = smoothstep(0.3, 0.0, dd);
        float m = mainDrop + droplets * r * trailFront;

        return vec2(m, trail);
    }

    // Multi-layer system (size variation)
    vec2 Drops(vec2 uv, float t, float l0, float l1, float l2, float l3) {
        float s = StaticDrops(uv, t) * l0;
        vec2 m1 = DropLayer2(uv, t) * l1;           // medium size
        vec2 m2 = DropLayer2(uv*2.5, t) * l2;       // small droplets
        vec2 m3 = DropLayer2(uv*0.6, t) * l3;       // large droplets

        float c = s + m1.x + m2.x + m3.x;
        c = smoothstep(.3, 1., c);

        return vec2(c, max(max(m1.y*l0, m2.y*l1), m3.y*l2));
    }

    void main() {
        vec2 uv = vUv * 2.0;  // larger droplets (3.0 -> 2.0)
        vec2 UV = vUv;
        float t = uTime * 0.2;

        // Multi-layer intensity settings (4 layers)
        float staticDrops = 0.0;   // remove static drops (small particles)
        float layer1 = 1.0;         // medium size
        float layer2 = 0.8;         // small droplets
        float layer3 = 1.2;         // large droplets (increased intensity)

        vec2 c = Drops(uv, t, staticDrops, layer1, layer2, layer3);

        // Expensive normals (original method - sampling neighbor pixels)
        vec2 e = vec2(.001, 0.);
        float cx = Drops(uv + e, t, staticDrops, layer1, layer2, layer3).x;
        float cy = Drops(uv + e.yx, t, staticDrops, layer1, layer2, layer3).x;
        vec2 n = vec2(cx - c.x, cy - c.x);

        // Background refraction (excluding fog blur effect)
        vec3 col = texture2D(tDiffuse, UV + n).rgb;

        gl_FragColor = vec4(col, 1.0);
    }
  `
);

extend({ RainMaterial });

const Scene = () => {
  const materialRef = useRef();

  // Load background image
  const backgroundTexture = useLoader(
    THREE.TextureLoader,
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop"
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uTime = clock.getElapsedTime();
      // Pass background texture to shader
      materialRef.current.tDiffuse = backgroundTexture;
    }
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[4, 4]} />
      <rainMaterial ref={materialRef} />
    </mesh>
  );
};

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <Scene />
    </Canvas>
  );
}
