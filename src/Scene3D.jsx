import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles, MeshDistortMaterial } from '@react-three/drei'

function ObjectMesh({ obj }) {
  const meshRef = useRef()

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.006
      meshRef.current.rotation.x += 0.003
    }
  })

  const opacity = obj.opacity ?? 1
  const floatY = obj.thrown ? 0 : Math.sin((obj.floatPhase || 0) * 1.5) * 0.15
  const pos = [obj.position.x, obj.position.y + floatY, obj.position.z]

  if (obj.type === 'emitter') {
    return (
      <group position={pos}>
        <Sparkles count={40} scale={2.2} size={4} speed={0.6} color="#ff2ec4" />
        <mesh>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ff2ec4"
            emissiveIntensity={2}
            transparent
            opacity={opacity}
          />
        </mesh>
      </group>
    )
  }

  return (
    <mesh ref={meshRef} position={pos} scale={obj.scale}>
      {obj.type === 'crystal' && <icosahedronGeometry args={[0.6, 0]} />}
      {obj.type === 'sphere' && <sphereGeometry args={[0.5, 32, 32]} />}
      {obj.type === 'blob' && <sphereGeometry args={[0.55, 32, 32]} />}

      {obj.type === 'blob' ? (
        <MeshDistortMaterial
          color={obj.color}
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.5}
          transparent
          opacity={opacity}
        />
      ) : (
        <meshStandardMaterial
          color={obj.color}
          emissive={obj.color}
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.7}
          transparent
          opacity={opacity}
        />
      )}
    </mesh>
  )
}

function SceneManager({ objects, setObjects, handDataRef, refs, spawnObject }) {
  const { heldRef, prevPinchRef, twoHandInitRef, heartCooldownRef } = refs

  useFrame((state, delta) => {
    const data = handDataRef.current
    const hands = data?.hands || []
    const now = state.clock.elapsedTime

    const pinchInfos = hands.map((hand) => {
      const landmarks = hand.landmarks
      const thumb = landmarks[4]
      const index = landmarks[8]
      const wrist = landmarks[0]
      const midMcp = landmarks[9]
      const handSize = Math.hypot(wrist.x - midMcp.x, wrist.y - midMcp.y) || 0.001
      const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y)
      const isPinching = pinchDist / handSize < 0.55
      const midX = (thumb.x + index.x) / 2
      const midY = (thumb.y + index.y) / 2
      return {
        isPinching,
        worldX: (midX - 0.5) * 8,
        worldY: (0.5 - midY) * 6,
      }
    })

    if (hands.length === 2) {
      const [h0, h1] = hands
      const idxDist = Math.hypot(
        h0.landmarks[8].x - h1.landmarks[8].x,
        h0.landmarks[8].y - h1.landmarks[8].y
      )
      const thumbDist = Math.hypot(
        h0.landmarks[4].x - h1.landmarks[4].x,
        h0.landmarks[4].y - h1.landmarks[4].y
      )
      if (idxDist < 0.08 && thumbDist < 0.08 && !heartCooldownRef.current) {
        const midX = (h0.landmarks[8].x + h1.landmarks[8].x) / 2
        const midY = (h0.landmarks[8].y + h1.landmarks[8].y) / 2
        spawnObject('emitter', { x: (midX - 0.5) * 8, y: (0.5 - midY) * 6, z: 0 })
        heartCooldownRef.current = true
      }
      if (idxDist > 0.15) heartCooldownRef.current = false
    } else {
      heartCooldownRef.current = false
    }

    setObjects((prev) => {
      let next = prev.map((o) => ({ ...o, position: { ...o.position } }))

      pinchInfos.forEach((info, idx) => {
        const heldId = heldRef.current[idx]
        if (info.isPinching) {
          if (!heldId) {
            let nearest = null
            let nearestDist = Infinity
            next.forEach((o) => {
              if (o.thrown) return
              const d = Math.hypot(o.position.x - info.worldX, o.position.y - info.worldY)
              if (d < 1.3 && d < nearestDist) {
                nearest = o
                nearestDist = d
              }
            })
            if (nearest) {
              heldRef.current[idx] = nearest.id
              prevPinchRef.current[idx] = { x: info.worldX, y: info.worldY, t: now }
            }
          } else {
            const obj = next.find((o) => o.id === heldId)
            if (obj) {
              const prevP = prevPinchRef.current[idx] || { x: info.worldX, y: info.worldY, t: now }
              const dt = Math.max(now - prevP.t, 0.001)
              obj.velocity = {
                x: (info.worldX - prevP.x) / dt,
                y: (info.worldY - prevP.y) / dt,
                z: 0,
              }
              obj.position = { x: info.worldX, y: info.worldY, z: obj.position.z }
              prevPinchRef.current[idx] = { x: info.worldX, y: info.worldY, t: now }
            }
          }
        } else if (heldId) {
          const obj = next.find((o) => o.id === heldId)
          if (obj) {
            const speed = Math.hypot(obj.velocity?.x || 0, obj.velocity?.y || 0)
            if (speed > 4) {
              obj.thrown = true
              obj.thrownAt = now
              obj.velocity = {
                x: (obj.velocity.x || 0) * 0.5,
                y: (obj.velocity.y || 0) * 0.5,
                z: -2 - Math.random() * 2,
              }
            }
          }
          delete heldRef.current[idx]
          delete prevPinchRef.current[idx]
        }
      })

      const pinching = pinchInfos.filter((p) => p.isPinching)
      if (pinching.length === 2) {
        const heldIds = [...new Set(Object.values(heldRef.current))]
        if (heldIds.length === 1) {
          const obj = next.find((o) => o.id === heldIds[0])
          if (obj) {
            const d = Math.hypot(
              pinching[0].worldX - pinching[1].worldX,
              pinching[0].worldY - pinching[1].worldY
            )
            if (!twoHandInitRef.current || twoHandInitRef.current.objectId !== obj.id) {
              twoHandInitRef.current = { distance: d, objectId: obj.id, baseScale: obj.scale }
            } else {
              const ratio = d / twoHandInitRef.current.distance
              obj.scale = Math.min(Math.max(twoHandInitRef.current.baseScale * ratio, 0.3), 3)
            }
          }
        }
      } else {
        twoHandInitRef.current = null
      }

      next = next.map((o) => {
        if (o.thrown) {
          const vy = (o.velocity?.y || 0) - 9.8 * delta
          const age = now - (o.thrownAt || now)
          return {
            ...o,
            position: {
              x: o.position.x + (o.velocity?.x || 0) * delta,
              y: o.position.y + vy * delta,
              z: o.position.z + (o.velocity?.z || 0) * delta,
            },
            velocity: { ...o.velocity, y: vy },
            opacity: Math.max(1 - age / 1.2, 0),
          }
        }
        return { ...o, floatPhase: (o.floatPhase || 0) + delta }
      })

      return next.filter((o) => !o.thrown || o.opacity > 0.02)
    })
  })

  return (
    <>
      {objects.map((obj) => (
        <ObjectMesh key={obj.id} obj={obj} />
      ))}
    </>
  )
}

const Scene3D = forwardRef(function Scene3D({ handDataRef }, ref) {
  const [objects, setObjects] = useState([])
  const heldRef = useRef({})
  const prevPinchRef = useRef({})
  const twoHandInitRef = useRef(null)
  const heartCooldownRef = useRef(false)

  function spawnObject(type, pos) {
    const colors = { crystal: '#a78bfa', sphere: '#3df2b0', blob: '#ff2ec4', emitter: '#ffffff' }
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setObjects((prev) => [
      ...prev,
      {
        id,
        type,
        position: pos || { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 2, z: 0 },
        scale: 1,
        color: colors[type] || '#ffffff',
        thrown: false,
        velocity: { x: 0, y: 0, z: 0 },
        opacity: 1,
        floatPhase: Math.random() * 10,
      },
    ])
  }

  useImperativeHandle(ref, () => ({
    spawn(type) {
      spawnObject(type)
    },
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={1.2} color="#ff2ec4" />
        <pointLight position={[-5, -3, 5]} intensity={0.8} color="#a78bfa" />
        <SceneManager
          objects={objects}
          setObjects={setObjects}
          handDataRef={handDataRef}
          refs={{ heldRef, prevPinchRef, twoHandInitRef, heartCooldownRef }}
          spawnObject={spawnObject}
        />
      </Canvas>
    </div>
  )
})

export default Scene3D