"use client";

import {
  useRef,
  useState,
  Suspense,
  useEffect,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type MeshPhongMaterial,
  Loader,
} from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import type {
  BiometricScanResult,
  BiometricSubsystemId,
} from "../../../shared/types";

const OBJ_MODEL_URL = "/models/Mesh_Horse.obj";

/** Loader that loads OBJ with MTL materials (texture support) */
class OBJWithMTLLoader extends Loader {
  load(
    url: string,
    onLoad: (object: Group) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ) {
    const basePath = url.substring(0, url.lastIndexOf("/") + 1);
    const mtlFile = url.substring(url.lastIndexOf("/") + 1).replace(".obj", ".mtl");
    const objFile = url.substring(url.lastIndexOf("/") + 1);

    const mtlLoader = new MTLLoader(this.manager);
    mtlLoader.setPath(basePath);
    mtlLoader.load(
      mtlFile,
      (materials) => {
        materials.preload();
        const objLoader = new OBJLoader(this.manager);
        objLoader.setPath(basePath);
        objLoader.setMaterials(materials);
        objLoader.load(objFile, onLoad, onProgress, onError);
      },
      onProgress,
      onError,
    );
  }
}
import { MARKER_POSITIONS } from "./markerPositions";
import { CAMERA_PRESETS } from "./cameraPresets";
import { SUBSYSTEM_COLORS } from "./subsystemColors";

const SUBSYSTEM_NAMES: Record<BiometricSubsystemId, string> = {
  heart: "Cardiac",
  lungs: "Respiratory",
  skeletal: "Skeletal",
  musculature: "Musculature",
  joints: "Joints",
};

interface BiometricModelCanvasProps {
  scan: BiometricScanResult;
  wireframe: boolean;
  selectedMarker: BiometricSubsystemId | null;
  onMarkerSelect: (id: BiometricSubsystemId | null) => void;
  cameraPreset: string;
  onLoaded?: () => void;
}

function HorseModel({ wireframe }: { wireframe: boolean }) {
  const group = useRef<Group>(null);
  const obj = useLoader(OBJWithMTLLoader, OBJ_MODEL_URL) as Group;

  useEffect(() => {
    const wireframeColor = 0x00d4ff; // high-tech blue
    const solidColor = 0x1a1414; // matches UI card background
    obj.traverse((child) => {
      if ("material" in child && child.material) {
        const mat = (child as Mesh).material as
          | MeshStandardMaterial
          | MeshPhongMaterial;
        if (mat) {
          if ("wireframe" in mat) mat.wireframe = wireframe;
          if ("color" in mat) {
            mat.color.setHex(wireframe ? wireframeColor : solidColor);
          }
          const m = mat as MeshPhongMaterial & { emissive?: { setHex: (n: number) => void } };
          if (m.emissive) m.emissive.setHex(wireframe ? 0x00d4ff : 0x1a1414);
        }
      }
    });
  }, [obj, wireframe]);

  return (
    <group
      scale={0.024}
      position={[-0.35, -0.7, -0.55]}
    >
      <primitive ref={group} object={obj} />
    </group>
  );
}

class HorseModelErrorBoundary extends Component<{
  wireframe: boolean;
  children: ReactNode;
}> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) {
      return <PlaceholderHorse wireframe={this.props.wireframe} />;
    }
    return this.props.children;
  }
}

function PlaceholderHorse({ wireframe }: { wireframe: boolean }) {
  const color = wireframe ? "#00d4ff" : "#1a1414";
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.5, 0.6]} />
        <meshStandardMaterial
          color={color}
          wireframe={wireframe}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0.6, 1.2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.35, 0.35]} />
        <meshStandardMaterial
          color={color}
          wireframe={wireframe}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      {/* Neck */}
      <mesh position={[0.35, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.4, 8]} />
        <meshStandardMaterial
          color={color}
          wireframe={wireframe}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      {/* Legs */}
      {[
        [0.35, 0.5, 0.25],
        [0.35, 0.5, -0.25],
        [-0.35, 0.5, 0.25],
        [-0.35, 0.5, -0.25],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
          <meshStandardMaterial
            color={color}
            wireframe={wireframe}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

function CameraController({
  presetId,
  onComplete,
}: {
  presetId: string;
  onComplete?: () => void;
}) {
  const { camera } = useThree();
  const preset = CAMERA_PRESETS.find((p) => p.id === presetId);
  const targetRef = useRef({ x: 0, y: 0, z: 0 });
  const startRef = useRef({ x: 0, y: 0, z: 0 });
  const progressRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!preset) return;
    targetRef.current = {
      x: preset.position[0],
      y: preset.position[1],
      z: preset.position[2],
    };
    startRef.current = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };
    progressRef.current = 0;
    doneRef.current = false;
  }, [presetId, preset, camera]);

  useFrame((_, delta) => {
    if (!preset || doneRef.current) return;
    progressRef.current = Math.min(1, progressRef.current + delta * 1.8);
    const t = progressRef.current;
    const eased = t * t * (3 - 2 * t);
    camera.position.x = startRef.current.x + (targetRef.current.x - startRef.current.x) * eased;
    camera.position.y = startRef.current.y + (targetRef.current.y - startRef.current.y) * eased;
    camera.position.z = startRef.current.z + (targetRef.current.z - startRef.current.z) * eased;
    camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);
    if (t >= 1) {
      doneRef.current = true;
      onComplete?.();
    }
  });

  return null;
}

function Marker({
  id,
  position,
  subsystem,
  selected,
  onClick,
}: {
  id: BiometricSubsystemId;
  position: [number, number, number];
  subsystem: { label: string; score: number };
  selected: boolean;
  onClick: () => void;
}) {
  const color = SUBSYSTEM_COLORS[id];
  return (
    <group position={position} onClick={(e) => (e.stopPropagation(), onClick())}>
      {selected && (
        <mesh>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.25}
          />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[selected ? 0.1 : 0.06, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 1 : 0.85}
        />
      </mesh>
      {selected && (
        <Html
          center
          position={[0, 0.18, 0]}
          distanceFactor={5}
          style={{
            pointerEvents: "none",
            fontSize: "18px",
            fontWeight: 700,
            color,
            whiteSpace: "nowrap",
            textShadow: `0 0 12px ${color}40, 0 0 24px ${color}30`,
          }}
        >
          {SUBSYSTEM_NAMES[id]} {subsystem.score}
        </Html>
      )}
    </group>
  );
}

function SceneContent(props: BiometricModelCanvasProps) {
  const {
    scan,
    wireframe,
    selectedMarker,
    onMarkerSelect,
    cameraPreset,
    onLoaded,
  } = props;

  const [modelLoaded, setModelLoaded] = useState(false);
  const [usePlaceholder, setUsePlaceholder] = useState(false);

  useEffect(() => {
    fetch(OBJ_MODEL_URL)
      .then((r) => {
        if (!r.ok) throw new Error("No model");
        return r.blob();
      })
      .then(() => setModelLoaded(true))
      .catch(() => setUsePlaceholder(true));
  }, []);

  useEffect(() => {
    if (modelLoaded || usePlaceholder) onLoaded?.();
  }, [modelLoaded, usePlaceholder, onLoaded]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#00d4ff", "#1a1414", 0.7]} />
      <directionalLight
        position={[5, 6, 5]}
        intensity={1.2}
        color="#00d4ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-4, 4, -4]} intensity={0.5} color="#22d3ee" />
      <pointLight position={[0, 3, 2]} intensity={0.4} color="#7dd3fc" />

      <OrbitControls
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        minDistance={2}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2 + 0.2}
      />

      <CameraController presetId={cameraPreset} />

      {usePlaceholder ? (
        <PlaceholderHorse wireframe={wireframe} />
      ) : modelLoaded ? (
        <HorseModelErrorBoundary wireframe={wireframe}>
          <Suspense fallback={<PlaceholderHorse wireframe={wireframe} />}>
            <HorseModel wireframe={wireframe} />
          </Suspense>
        </HorseModelErrorBoundary>
      ) : (
        <PlaceholderHorse wireframe={wireframe} />
      )}

      {scan.subsystems.map((sub) => (
          <Marker
            key={sub.id}
            id={sub.id}
            position={MARKER_POSITIONS[sub.id]}
            subsystem={sub}
            selected={selectedMarker === sub.id}
            onClick={() => onMarkerSelect(selectedMarker === sub.id ? null : sub.id)}
          />
        ))}
    </>
  );
}

export function BiometricModelCanvas(props: BiometricModelCanvasProps) {
  return (
    <div className="w-full flex-1 min-h-[260px] overflow-hidden bg-card relative">
      <Canvas
        camera={{ position: [4.0, 0.5, 3.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }}
      >
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color="#333" wireframe />
            </mesh>
          }
        >
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
