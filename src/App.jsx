import { useRef, useState } from 'react'
import Stars from './Stars'
import Webcam from './Webcam'
import Scene3D from './Scene3D'

const DRAW_COLORS = [
  { name: 'Cyber Rose', value: '#ff2ec4' },
  { name: 'Galactic Orchid', value: '#a78bfa' },
  { name: 'Aurora Mint', value: '#3df2b0' },
  { name: 'Aurora Gold', value: '#ffd166' },
  { name: 'Supernova', value: '#ffffff' },
]

function App() {
  const handDataRef = useRef({ hands: [] })
  const webcamRef = useRef(null)
  const sceneRef = useRef(null)

  const [tab, setTab] = useState('draw')
  const [mode, setMode] = useState('idle')
  const [color, setColor] = useState('#ff2ec4')
  const [brushSize, setBrushSize] = useState(4)
  const [glowIntensity, setGlowIntensity] = useState(15)

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Webcam
        ref={webcamRef}
        onHandData={(data) => { handDataRef.current = data }}
        onModeChange={setMode}
        color={color}
        brushSize={brushSize}
        glowIntensity={glowIntensity}
        middleLayer={<Scene3D ref={sceneRef} handDataRef={handDataRef} />}
      />
      <Stars />

      {/* Top: title + mode pill, minimal */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-300 to-teal-200 bg-clip-text text-transparent">
          GlowCelestia
        </h1>
        <span className="text-[11px] px-3 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 capitalize">
          {mode}
        </span>
      </div>

      {/* Bottom: single unified toolbar with tabs */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
          <button
            onClick={() => setTab('draw')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              tab === 'draw' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            🎨 Draw
          </button>
          <button
            onClick={() => setTab('objects')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              tab === 'objects' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            🔮 Objects
          </button>
        </div>

        {/* Panel content */}
        <div className="flex items-center gap-5 px-6 py-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg min-h-[68px]">
          {tab === 'draw' && (
            <>
              <div className="flex gap-2">
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      color === c.value ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.value, boxShadow: `0 0 10px ${c.value}` }}
                  />
                ))}
              </div>

              <div className="w-px h-8 bg-white/20" />

              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-white/70 uppercase tracking-wide">Brush</span>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-20 accent-pink-400"
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-white/70 uppercase tracking-wide">Glow</span>
                <input
                  type="range"
                  min={5}
                  max={35}
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(Number(e.target.value))}
                  className="w-20 accent-purple-300"
                />
              </div>

              <div className="w-px h-8 bg-white/20" />

              <div className="flex gap-2">
                <button
                  onClick={() => webcamRef.current?.undo()}
                  title="Undo"
                  className="w-9 h-9 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                >
                  ↺
                </button>
                <button
                  onClick={() => webcamRef.current?.redo()}
                  title="Redo"
                  className="w-9 h-9 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                >
                  ↻
                </button>
                <button
                  onClick={() => webcamRef.current?.clear()}
                  title="Clear Canvas"
                  className="w-9 h-9 rounded-full bg-pink-500/20 border border-pink-400/40 text-white hover:bg-pink-500/40 transition"
                >
                  ✕
                </button>
              </div>
            </>
          )}

          {tab === 'objects' && (
            <>
              <button
                onClick={() => sceneRef.current?.spawn('crystal')}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition"
              >
                ✦ Crystal
              </button>
              <button
                onClick={() => sceneRef.current?.spawn('sphere')}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition"
              >
                ✦ Stardust
              </button>
              <button
                onClick={() => sceneRef.current?.spawn('blob')}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition"
              >
                ✦ Fluid Mesh
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App