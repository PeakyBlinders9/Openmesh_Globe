import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GlobeScene from './components/GlobeScene';
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
    </div>
  );
};

export default App;