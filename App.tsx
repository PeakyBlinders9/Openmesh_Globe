import React, { Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GlobeScene from './components/GlobeScene';
import { Loader2 } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-black text-[#0533F3]">
          <div className="text-center">
            <p className="mb-4">Rendering error occurred</p>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-[#0533F3] text-white rounded"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary>
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
                      enableZoom={false}
                      minDistance={3} 
                      maxDistance={10} 
                      autoRotate 
                      autoRotateSpeed={0.5}
                  />
              </Canvas>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;