import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Color, AdditiveBlending, ShaderMaterial, BufferAttribute, BufferGeometry } from 'three';
import { Stars } from '@react-three/drei';

const EARTH_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg";

// Deep Dark Neon Blue #021266 (Darker than previous #0533F3)
const NEON_BLUE = new Color('#021266');

const VertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LandAuroraFragmentShader = `
  uniform sampler2D globeTexture;
  uniform vec3 color;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec4 mapColor = texture2D(globeTexture, vUv);
    
    // SPECULAR MAP LOGIC:
    // Water = White (> 0.5)
    // Land = Black (< 0.5)
    
    // We want Neon on Land.
    // So if it is Water, discard it.
    if (mapColor.r > 0.5) discard;

    // Aurora / Plasma effect animation on land
    float noise = random(vUv * 50.0);
    float wave = 0.5 + 0.5 * sin(vPosition.y * 2.5 + time * 0.6 + vPosition.x * 2.0);
    
    // Fresnel rim glow for depth
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    float fresnel = pow(1.0 - dot(vNormal, viewDir), 3.0);

    vec3 finalColor = color;
    
    // Add pulsing intensity from the wave
    finalColor *= (0.6 + 0.6 * wave);
    
    // Add bright edges (Reduced intensity for darker look)
    finalColor += color * fresnel * 2.0;

    // Slight digital noise texture
    finalColor += color * noise * 0.15;

    gl_FragColor = vec4(finalColor, 0.85);
  }
`;

// Simplified Vertex Shader - Logic moved to JS
const ParticlesVertexShader = `
  attribute float size;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Scale by view depth for perspective
    gl_PointSize = size * (150.0 / -mvPosition.z);
  }
`;

const ParticlesFragmentShader = `
  uniform vec3 color;
  
  void main() {
    // Simple soft circular particle
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    // White center, blueish edge
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(mix(vec3(1.0), color, 0.2), alpha);
  }
`;

const GlobeScene: React.FC = () => {
  const groupRef = useRef<any>(null);
  const surfaceRef = useRef<any>(null);
  
  const earthTexture = useLoader(TextureLoader, EARTH_TEXTURE_URL, (loader) => {
    loader.setCrossOrigin('anonymous');
  });

  const landMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        globeTexture: { value: earthTexture },
        color: { value: NEON_BLUE },
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
    const count = 20000; // High density for dust effect
    
    const positions = [];
    const sizes = [];
    const radius = 2.05;

    // Create a canvas to read the texture data
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
        console.warn("Could not read texture data for particle filtering:", e);
    }

    let validParticles = 0;
    let attempts = 0;
    const maxAttempts = count * 10; // Prevent infinite loop

    while (validParticles < count && attempts < maxAttempts) {
        attempts++;

        // Random Spherical Coordinates
        const theta = Math.acos(Math.random() * 2 - 1); // 0 to PI
        const phi = Math.random() * Math.PI * 2; // 0 to 2PI

        // Calculate UVs to sample texture
        // u = phi / 2PI
        // v = 1 - (theta / PI)
        const u = phi / (2 * Math.PI);
        const v = 1 - (theta / Math.PI);

        // Filter Logic
        if (imgData) {
            // Map UV to pixel coordinates
            // Texture coordinates: (0,0) is top-left in canvas 2d
            // v=1 is top (y=0), v=0 is bottom (y=height)
            const x = Math.floor(u * (width - 1));
            const y = Math.floor((1 - v) * (height - 1));
            
            const index = (y * width + x) * 4;
            const r = imgData[index]; // Red channel
            
            // Specular Map: Black (0) is Land, White (255) is Water.
            // Strict check: if red > 40, consider it water/ocean and skip.
            if (r > 40) {
                continue;
            }
        }

        // If we are here, it's land (or we have no data to filter)
        
        // Convert to Cartesian
        const px = -radius * Math.sin(theta) * Math.cos(phi);
        const py = radius * Math.cos(theta);
        const pz = radius * Math.sin(theta) * Math.sin(phi);

        positions.push(px, py, pz);
        
        // Tiny uneven sizes for "dust" effect: 0.05 to 0.15
        sizes.push(Math.random() * 0.10 + 0.05);
        
        validParticles++;
    }

    const positionArray = new Float32Array(positions);
    const sizeArray = new Float32Array(sizes);

    geometry.setAttribute('position', new BufferAttribute(positionArray, 3));
    geometry.setAttribute('size', new BufferAttribute(sizeArray, 1));
    
    return geometry;
  }, [earthTexture]);

  const particlesMaterial = useMemo(() => {
      return new ShaderMaterial({
        uniforms: {
            color: { value: new Color('#88ccff') }
        },
        vertexShader: ParticlesVertexShader,
        fragmentShader: ParticlesFragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      });
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015;
    }
    if (surfaceRef.current) {
        surfaceRef.current.material.uniforms.time.value = state.clock.getElapsedTime();
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Base Black Sphere (The Void / Water Background) */}
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* 2. Neon Land Aurora (Only renders on land pixels) */}
      <mesh ref={surfaceRef}>
        <sphereGeometry args={[2.01, 128, 128]} />
        <primitive object={landMaterial} attach="material" />
      </mesh>

      {/* 3. Random Particles (Pre-filtered to Land Only) */}
      <points geometry={particlesGeometry}>
         <primitive object={particlesMaterial} attach="material" />
      </points>
      
      <Stars radius={300} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
    </group>
  );
};

export default GlobeScene;