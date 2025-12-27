import React, { useRef } from "react";
import { Canvas, useFrame, extend, useLoader } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";

// ------------------------------------------------------------------
// 분석된 쉐이더 로직을 기반으로 재구성한 재질
// ------------------------------------------------------------------
const RainMaterial = shaderMaterial(
  {
    uTime: 0,
    uIntensity: 1.0, // 0: 물 없음, 1: 물 꽉 참
    tDiffuse: null, // 배경 화면 (Post-processing에서 주입됨)
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader (핵심 로직 복원)
  `
    uniform float uTime;
    uniform float uIntensity;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    // 랜덤 노이즈 함수 (원본 코드 방식)
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

    // 정적 물방울 (작고 반짝이는 물방울들)
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

    // 물방울 레이어 생성 함수 (파일에서 추출된 로직 기반)
    vec2 DropLayer2(vec2 uv, float t) {
        vec2 UV = uv;
        
        // UV 좌표를 이동시켜 물이 흐르는 느낌 연출
        uv.y += t * 0.75;
        
        // 화면을 격자(Grid)로 분할
        vec2 a = vec2(6.0, 1.0);
        vec2 grid = a * 2.0;
        vec2 id = floor(uv * grid);
        
        float colShift = N(id.x);
        uv.y += colShift;

        id = floor(uv * grid);
        vec3 n = N13(id.x*35.2 + id.y*2376.1);

        // 물방울 개수 줄이기 (70% 제거, 30% 남음)
        if (n.y < 0.8) return vec2(0.0);

        vec2 st = fract(uv * grid) - vec2(0.5, 0);
        
        // 물방울의 X 좌표를 흔들어서 자연스럽게 만듦
        float x = n.x - 0.5;
        float y = UV.y * 20.0;
        float wiggle = sin(y + sin(y));
        x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
        x *= 0.7;
        
        float ti = fract(t + n.z);
        y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
        vec2 p = vec2(x, y);
        
        // 메인 물방울 거리 계산
        float d = length((st - p) * a.yx);
        float mainDrop = smoothstep(0.4, 0.0, d);
        
        // 물방울이 지나간 자국(Trail)과 작은 물방울들
        float r = sqrt(smoothstep(1.0, y, st.y));
        float cd = abs(st.x - x);
        float trail = smoothstep(0.23 * r, 0.15 * r * r, cd);
        float trailFront = smoothstep(-0.02, 0.02, st.y - y);
        trail *= trailFront * r * r;
        
        // 빗방울 모양 합치기
        float y2 = UV.y;
        float trail2 = smoothstep(0.2 * r, 0.0, cd);
        float droplets = max(0.0, (sin(y2 * (1.0 - y2) * 120.0) - st.y)) * trail2 * trailFront * n.z;
        y2 = fract(y2 * 10.0) + (st.y - 0.5);
        float dd = length(st - vec2(x, y2));
        droplets = smoothstep(0.3, 0.0, dd);
        float m = mainDrop + droplets * r * trailFront;
        
        return vec2(m, trail);
    }

    // 다층 레이어 시스템 (크기 다양화)
    vec2 Drops(vec2 uv, float t, float l0, float l1, float l2, float l3) {
        float s = StaticDrops(uv, t) * l0;
        vec2 m1 = DropLayer2(uv, t) * l1;           // 중간 크기
        vec2 m2 = DropLayer2(uv*2.5, t) * l2;       // 작은 물방울
        vec2 m3 = DropLayer2(uv*0.6, t) * l3;       // 큰 물방울

        float c = s + m1.x + m2.x + m3.x;
        c = smoothstep(.3, 1., c);

        return vec2(c, max(max(m1.y*l0, m2.y*l1), m3.y*l2));
    }

    void main() {
        vec2 uv = vUv * 2.0;  // 물방울 더 크게 (3.0 -> 2.0)
        vec2 UV = vUv;
        float t = uTime * 0.2;

        // 다층 레이어 강도 설정 (4개 레이어)
        float staticDrops = 0.0;   // 정적 물방울 제거 (작은 알갱이)
        float layer1 = 1.0;         // 중간 크기
        float layer2 = 0.8;         // 작은 물방울
        float layer3 = 1.2;         // 큰 물방울 (강도 높임)

        vec2 c = Drops(uv, t, staticDrops, layer1, layer2, layer3);

        // Expensive Normals (원본 방식 - 주변 픽셀 샘플링)
        vec2 e = vec2(.001, 0.);
        float cx = Drops(uv + e, t, staticDrops, layer1, layer2, layer3).x;
        float cy = Drops(uv + e.yx, t, staticDrops, layer1, layer2, layer3).x;
        vec2 n = vec2(cx - c.x, cy - c.x);

        // 배경 굴절 (안개 흐림 효과 제외)
        vec3 col = texture2D(tDiffuse, UV + n).rgb;

        gl_FragColor = vec4(col, 1.0);
    }
  `
);

extend({ RainMaterial });

const Scene = () => {
  const materialRef = useRef();

  // 배경 이미지 로드
  const backgroundTexture = useLoader(
    THREE.TextureLoader,
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop"
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uTime = clock.getElapsedTime();
      // 배경 텍스처를 쉐이더에 전달
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
