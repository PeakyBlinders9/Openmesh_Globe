import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Color, AdditiveBlending, ShaderMaterial, BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { Stars } from '@react-three/drei';

const EARTH_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg";

// Updated Aurora Gradient
// Primary glow: #003CFF – #001F8B
// Outer fade: #00163D – #000A1C
const COLOR_A = new Color('#003CFF'); // Primary Bright (Core)
const COLOR_B = new Color('#000A1C'); // Outer Fade (Edge)

const VertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position; // Local position
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LandAuroraFragmentShader = `
  uniform sampler2D globeTexture;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uFocusPoint; // The center of the active area (Local Space)
  uniform float uDistortionStrength;
  uniform float time;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  // Simplex-like 3D Noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; 
    vec3 x3 = x0 - D.yyy;      

    // Permutations
    i = mod289(i); 
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857; 
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    // Distance from current pixel to the focus point (mouse/camera center)
    float mouseDist = distance(normalize(vPosition), normalize(uFocusPoint));

    // --- LIQUID DISTORTION LOGIC ---
    // 1. Create a mask that is strong near the focus point and fades out
    float liquidRadius = 0.6;
    float liquidMask = smoothstep(liquidRadius, 0.0, mouseDist);

    // 2. Calculate a ripple wave pattern
    // sin(distance - time) creates outward movement
    float ripple = sin(mouseDist * 20.0 - time * 4.0);

    // 3. Determine flow direction (pushing away/around the center)
    // We project the 3D direction onto the 2D UV plane roughly
    vec2 flowDir = normalize(vPosition.xy - uFocusPoint.xy);
    
    // 4. Calculate final distortion vector
    // intensity * mask * wave * direction * strength
    vec2 liquidOffset = flowDir * liquidMask * ripple * 0.03 * uDistortionStrength;


    // --- 1. ORGANIC UV DISTORTION (Base) ---
    // Warp the coordinates slightly with noise to break the rigid cartographic grid.
    float warp = snoise(vPosition * 1.0 + time * 0.05) * 0.04;
    
    // Apply both the base noise warp AND the interactive liquid distortion to the UVs
    vec2 distortedUv = vUv + vec2(warp, -warp) + liquidOffset;

    // --- 2. ABSTRACT BLUR (Mipmap Bias) ---
    // By using a large bias (6.0), we force the GPU to sample a very low-resolution mipmap.
    vec4 mapColor = texture2D(globeTexture, distortedUv, 6.0);
    
    // --- 3. SOFT SILHOUETTE MASK ---
    // water (~1.0) -> 0.0, land (~0.0) -> 1.0
    float landDensity = smoothstep(0.75, 0.05, mapColor.r);
    
    // --- 4. SPOTLIGHT GLOW (The "Active" Continent) ---
    // Soft, wide spotlight
    float spotMask = smoothstep(1.6, 0.2, mouseDist); 
    
    // Discard completely dark areas
    if (spotMask * landDensity < 0.01) discard;

    // --- 5. ATMOSPHERIC FLOW ---
    // Low frequency noise for "drifting" feel
    // We also distort the noise lookup position slightly with the liquid mask for extra turbulence
    vec3 noisePos = vPosition * 0.3 + vec3(0.0, time * 0.1, 0.0);
    noisePos += vec3(liquidOffset, 0.0) * 2.0; 

    float n = snoise(noisePos);
    float atmosphere = n * 0.2 + 0.8;
    
    // --- 6. BREATHING EFFECT ---
    float breath = 0.85 + 0.15 * sin(time * 1.5); 

    // Combine
    float strength = landDensity * spotMask * atmosphere * breath;

    // Color mixing
    vec3 finalColor = mix(uColorB, uColorA, strength);
    
    // Highlight - soft glossy core
    vec3 highlightColor = vec3(0.6, 0.85, 1.0);
    finalColor += highlightColor * pow(spotMask, 3.0) * 0.5 * strength;

    // Alpha - slightly ghostly
    float alpha = strength * 0.85; 

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const ParticlesVertexShader = `
  uniform float time;
  uniform vec3 uFocusPoint;
  uniform float uDistortionStrength;
  attribute float size;
  attribute float phase;
  attribute float brightness;
  varying float vOpacity;

  void main() {
    vOpacity = brightness;

    vec3 pos = position;

    // --- LIQUID DISTORTION (Match LandShader) ---
    float mouseDist = distance(normalize(pos), normalize(uFocusPoint));
    float liquidRadius = 0.6;
    float liquidMask = smoothstep(liquidRadius, 0.0, mouseDist);
    float ripple = sin(mouseDist * 20.0 - time * 4.0);
    
    // Direction away from focus point
    vec3 flowDir = normalize(pos - uFocusPoint);
    
    // Displace particles physically in 3D space to match the visual liquid wave
    vec3 distortion = flowDir * liquidMask * ripple * 0.05 * uDistortionStrength;
    pos += distortion;

    // --- FLOATING ANIMATION ---
    // We oscillate along the surface normal (Radial direction) to simulate "floating up and down"
    // relative to the ground. This preserves the particle's geographic location.
    float speed = 1.5;
    float amplitude = 0.015; 
    float osc = sin(time * speed + phase) * amplitude;
    
    // Apply floating oscillation on top of distortion
    // We use original position for normal to keep orientation consistent
    pos += normalize(position) * osc;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Scale particles based on depth
    gl_PointSize = size * (100.0 / -mvPosition.z);
  }
`;

const ParticlesFragmentShader = `
  varying float vOpacity;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    // Circular crop
    if (dist > 0.5) discard;
    
    // Sharp falloff for star-like appearance
    // 1.0 at center, drops quickly
    float strength = 1.0 - (dist * 2.0);
    strength = pow(strength, 3.0); 

    gl_FragColor = vec4(vec3(1.0), strength * vOpacity);
  }
`;

const GlobeScene: React.FC = () => {
  const groupRef = useRef<any>(null);
  const surfaceRef = useRef<any>(null);
  const particlesRef = useRef<any>(null);
  
  // Refs for logic (no re-renders)
  const hoverState = useRef({
    active: false,
    point: new Vector3(1, 0, 0)
  });
  const currentFocus = useRef(new Vector3(0, 0, 1));
  const distortionStrength = useRef(0);

  const earthTexture = useLoader(TextureLoader, EARTH_TEXTURE_URL, (loader) => {
    loader.setCrossOrigin('anonymous');
  });

  const landMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        globeTexture: { value: earthTexture },
        uColorA: { value: COLOR_A },
        uColorB: { value: COLOR_B },
        uFocusPoint: { value: new Vector3(0, 0, 1) },
        uDistortionStrength: { value: 0 }, 
        time: { value: 0 }
      },
      vertexShader: VertexShader,
      fragmentShader: LandAuroraFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      side: 2, 
      depthWrite: false, 
    });
  }, [earthTexture]);

  const particlesGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const count = 5500; // Increased density
    
    const positions = [];
    const sizes = [];
    const phases = [];
    const brightnesses = [];
    
    const radius = 2.05;

    let imgData: Uint8ClampedArray | null = null;
    let width = 0;
    let height = 0;

    try {
        const img = earthTexture.image;
        if (img && img.width > 0) {
            const canvas = document.createElement('canvas');
            width = img.width;
            height = img.height;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                imgData = ctx.getImageData(0, 0, width, height).data;
            }
        }
    } catch (e) {
        console.warn("Texture data read error:", e);
    }

    let validParticles = 0;
    let attempts = 0;
    const maxAttempts = count * 20; 

    while (validParticles < count && attempts < maxAttempts) {
        attempts++;
        const theta = Math.acos(Math.random() * 2 - 1); 
        const phi = Math.random() * Math.PI * 2; 

        const u = phi / (2 * Math.PI);
        const v = 1 - (theta / Math.PI);

        if (imgData) {
            const x = Math.floor(u * (width - 1));
            const y = Math.floor((1 - v) * (height - 1));
            const index = (y * width + x) * 4;
            const r = imgData[index]; 
            
            // Only place particles on Land (Black pixels in specular map)
            if (r > 40) continue; 
        }

        const px = -radius * Math.sin(theta) * Math.cos(phi);
        const py = radius * Math.cos(theta);
        const pz = radius * Math.sin(theta) * Math.sin(phi);

        positions.push(px, py, pz);
        // Size Range: 0.1 to 0.6
        sizes.push(Math.random() * 0.5 + 0.1); 
        // Random phase for independent animation
        phases.push(Math.random() * Math.PI * 2);
        // Varying brightness
        brightnesses.push(Math.random() * 0.5 + 0.5);

        validParticles++;
    }

    const positionArray = new Float32Array(positions);
    const sizeArray = new Float32Array(sizes);
    const phaseArray = new Float32Array(phases);
    const brightnessArray = new Float32Array(brightnesses);

    geometry.setAttribute('position', new BufferAttribute(positionArray, 3));
    geometry.setAttribute('size', new BufferAttribute(sizeArray, 1));
    geometry.setAttribute('phase', new BufferAttribute(phaseArray, 1));
    geometry.setAttribute('brightness', new BufferAttribute(brightnessArray, 1));
    
    return geometry;
  }, [earthTexture]);

  const particlesMaterial = useMemo(() => {
      return new ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            uFocusPoint: { value: new Vector3(0, 0, 1) },
            uDistortionStrength: { value: 0 }
        },
        vertexShader: ParticlesVertexShader,
        fragmentShader: ParticlesFragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      });
  }, []);

  useFrame((state, delta) => {
    // 1. Rotate the entire globe group
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015;
    }

    // 2. Determine Target Focus Point
    const target = new Vector3();

    if (hoverState.current.active) {
        // CASE A: User is hovering. 
        target.copy(hoverState.current.point);
    } else {
        // CASE B: Default "Camera Facing" logic.
        if (surfaceRef.current) {
            const camPos = state.camera.position.clone();
            surfaceRef.current.worldToLocal(camPos); 
            target.copy(camPos).normalize();
        }
    }

    // 3. Smoothly interpolate current focus to target
    currentFocus.current.lerp(target, 0.1);

    // 4. Interpolate Distortion Strength (0 = idle, 1 = hovering)
    const targetStrength = hoverState.current.active ? 1.0 : 0.0;
    distortionStrength.current += (targetStrength - distortionStrength.current) * 0.1;

    // 5. Update Shader Time & Uniforms
    if (surfaceRef.current) {
        surfaceRef.current.material.uniforms.time.value += delta;
        surfaceRef.current.material.uniforms.uFocusPoint.value.copy(currentFocus.current);
        surfaceRef.current.material.uniforms.uDistortionStrength.value = distortionStrength.current;
    }
    if (particlesRef.current) {
        particlesRef.current.material.uniforms.time.value += delta;
        particlesRef.current.material.uniforms.uFocusPoint.value.copy(currentFocus.current);
        particlesRef.current.material.uniforms.uDistortionStrength.value = distortionStrength.current;
    }
  });

  return (
    <group ref={groupRef} scale={0.75}>
      {/* 1. Base Black Sphere (Oceans) */}
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* 2. Abstract Smooth Aurora Land Glow */}
      <mesh 
        ref={surfaceRef}
        onPointerMove={(e) => {
            e.stopPropagation();
            if (surfaceRef.current) {
                const localPoint = surfaceRef.current.worldToLocal(e.point.clone());
                hoverState.current.active = true;
                hoverState.current.point.copy(localPoint).normalize();
            }
        }}
        onPointerOut={() => {
            hoverState.current.active = false;
        }}
      >
        <sphereGeometry args={[2.01, 128, 128]} />
        <primitive object={landMaterial} attach="material" />
      </mesh>

      {/* 3. Random Star Particles (Foreground) */}
      <points ref={particlesRef} geometry={particlesGeometry}>
         <primitive object={particlesMaterial} attach="material" />
      </points>
      
      <Stars radius={300} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
    </group>
  );
};

export default GlobeScene;