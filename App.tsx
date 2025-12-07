import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GlobeScene from './components/GlobeScene';
import ChatInterface from './components/ChatInterface';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={
            <div className="flex items-center justify-center w-full h-full">
                <div className="flex flex-col items-center gap-4 text-[#0533F3]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs tracking-[0.2em] uppercase">Initializing Globe...</span>
                </div>
            </div>
        }>
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={0.1} />
                <pointLight position={[10, 10, 10]} intensity={1.5} color="#4444ff" />
                <GlobeScene />
                <OrbitControls 
                    enablePan={false} 
                    minDistance={3} 
                    maxDistance={10} 
                    autoRotate 
                    autoRotateSpeed={0.5}
                />
            </Canvas>
        </Suspense>
      </div>

      {/* Overlay UI Layer */}
      <div className="absolute top-0 left-0 p-8 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-[#0533F3] opacity-90">
            NEON GAIA
        </h1>
        <div className="h-px w-24 bg-[#0533F3] mt-4 mb-2"></div>
        <p className="text-xs text-blue-300/60 max-w-[200px] leading-relaxed uppercase tracking-widest">
            Real-time planetary data visualization & AI interface
        </p>
      </div>

      <div className="absolute bottom-8 left-8 z-10 pointer-events-none text-[10px] text-[#0533F3]/40 tracking-widest font-mono">
        COORD: 34.0522° N, 118.2437° W <br/>
        SYSTEM: ONLINE <br/>
        V 1.0.4
      </div>

      <ChatInterface />
    </div>
  );
};

export default App;
