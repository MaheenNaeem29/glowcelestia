import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const FINGER_COLORS = {
  thumb: '#ff6b6b',
  index: '#4ecdc4',
  middle: '#ffe66d',
  ring: '#a78bfa',
  pinky: '#ff8fab',
}

const FINGERS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
}

const PALM_CONNECTIONS = [
  [0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [17, 0],
]

const Webcam = forwardRef(function Webcam(
  { onHandData, onModeChange, middleLayer, color, brushSize, glowIntensity },
  ref
) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const drawCanvasRef = useRef(null)

  const strokesRef = useRef([])
  const currentStrokeRef = useRef(null)
  const redoStackRef = useRef([])

  const smoothPos = useRef({ x: null, y: null })
  const modeHistory = useRef([])
  const modeRef = useRef('idle')
  const missingFramesRef = useRef(0)

  const colorRef = useRef(color)
  const brushSizeRef = useRef(brushSize)
  const glowRef = useRef(glowIntensity)

  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])
  useEffect(() => { glowRef.current = glowIntensity }, [glowIntensity])

  function finalizeCurrentStroke() {
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      strokesRef.current.push(currentStrokeRef.current)
    }
    currentStrokeRef.current = null
  }

  useImperativeHandle(ref, () => ({
    undo() {
      finalizeCurrentStroke()
      const last = strokesRef.current.pop()
      if (last) redoStackRef.current.push(last)
    },
    redo() {
      const stroke = redoStackRef.current.pop()
      if (stroke) strokesRef.current.push(stroke)
    },
    clear() {
      finalizeCurrentStroke()
      strokesRef.current = []
      redoStackRef.current = []
    },
  }))

  function isFingerUp(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y < landmarks[pipIdx].y - 0.02
  }

  function getHandState(landmarks) {
    const indexUp = isFingerUp(landmarks, 8, 6)
    const middleUp = isFingerUp(landmarks, 12, 10)
    const ringUp = isFingerUp(landmarks, 16, 14)
    const pinkyUp = isFingerUp(landmarks, 20, 18)

    const wrist = landmarks[0]
    const middleMcp = landmarks[9]
    const handSize = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y)

    const indexTip = landmarks[8]
    const middleTip = landmarks[12]
    const fingersDist = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y)
    const fingersRatio = fingersDist / handSize

    if (indexUp && middleUp && !ringUp && !pinkyUp && fingersRatio < 0.4) return 'erasing'
    if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'paused'
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'drawing'
    return 'idle'
  }

  function getStableMode(rawState) {
    modeHistory.current.push(rawState)
    if (modeHistory.current.length > 4) modeHistory.current.shift()
    const last = modeHistory.current
    const allSame = last.length >= 3 && last.slice(-3).every((m) => m === last[last.length - 1])
    return allSame ? last[last.length - 1] : modeRef.current
  }

  function drawHandSkeleton(ctx, landmarks, w, h) {
    const pts = landmarks.map((p) => ({ x: p.x * w, y: p.y * h }))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs) - 20
    const maxX = Math.max(...xs) + 20
    const minY = Math.min(...ys) - 20
    const maxY = Math.max(...ys) + 20

    ctx.strokeStyle = 'rgba(255, 46, 196, 0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
    ctx.setLineDash([])

    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    for (const [a, b] of PALM_CONNECTIONS) {
      ctx.beginPath()
      ctx.moveTo(pts[a].x, pts[a].y)
      ctx.lineTo(pts[b].x, pts[b].y)
      ctx.stroke()
    }

    for (const [fingerName, indices] of Object.entries(FINGERS)) {
      const fcolor = FINGER_COLORS[fingerName]
      ctx.strokeStyle = fcolor
      ctx.lineWidth = 2
      for (let i = 0; i < indices.length - 1; i++) {
        const a = pts[indices[i]]
        const b = pts[indices[i + 1]]
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      for (const idx of indices) {
        const p = pts[idx]
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI)
        ctx.fillStyle = fcolor
        ctx.shadowColor = fcolor
        ctx.shadowBlur = 6
        ctx.fill()
      }
    }

    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, 4, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 6
    ctx.fill()
    ctx.shadowBlur = 0
  }

  function renderStroke(dctx, points) {
    if (points.length < 2) return
    dctx.beginPath()
    dctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2
      const midY = (points[i].y + points[i + 1].y) / 2
      dctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
    }
    const last = points[points.length - 1]
    dctx.lineTo(last.x, last.y)
    dctx.stroke()
  }

  useEffect(() => {
    let camera = null

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    })

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    })

    hands.onResults((results) => {
      const canvas = canvasRef.current
      const drawCanvas = drawCanvasRef.current
      const video = videoRef.current
      if (!canvas || !video || !drawCanvas) return

      const w = video.videoWidth || 480
      const h = video.videoHeight || 360
      canvas.width = w
      canvas.height = h
      if (drawCanvas.width !== w || drawCanvas.height !== h) {
        drawCanvas.width = w
        drawCanvas.height = h
      }

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, w, h)

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        missingFramesRef.current = 0

        for (const landmarks of results.multiHandLandmarks) {
          drawHandSkeleton(ctx, landmarks, w, h)
        }

        if (onHandData) {
          const handsData = results.multiHandLandmarks.map((landmarks, i) => ({
            landmarks,
            label: results.multiHandedness?.[i]?.label || 'Right',
          }))
          onHandData({ hands: handsData })
        }

        const landmarks = results.multiHandLandmarks[0]
        const rawState = getHandState(landmarks)
        const stableState = getStableMode(rawState)
        modeRef.current = stableState
        setModeAndNotify(stableState)

        const tip = landmarks[8]
        const rawX = tip.x * w
        const rawY = tip.y * h

        if (smoothPos.current.x === null) {
          smoothPos.current = { x: rawX, y: rawY }
        } else {
          const dist = Math.hypot(rawX - smoothPos.current.x, rawY - smoothPos.current.y)
          const smoothing = dist > 8 ? 0.9 : 0.35
          smoothPos.current.x += (rawX - smoothPos.current.x) * smoothing
          smoothPos.current.y += (rawY - smoothPos.current.y) * smoothing
        }
        const x = smoothPos.current.x
        const y = smoothPos.current.y

        if (stableState === 'drawing') {
          if (!currentStrokeRef.current) {
            currentStrokeRef.current = {
              color: colorRef.current,
              size: brushSizeRef.current,
              glow: glowRef.current,
              points: [{ x, y }],
            }
            redoStackRef.current = []
          } else {
            const pts = currentStrokeRef.current.points
            const lastPoint = pts[pts.length - 1]
            const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y)
            if (dist > 2) {
              if (dist > 18) {
                const steps = Math.min(Math.ceil(dist / 12), 6)
                for (let i = 1; i <= steps; i++) {
                  const t = i / steps
                  pts.push({
                    x: lastPoint.x + (x - lastPoint.x) * t,
                    y: lastPoint.y + (y - lastPoint.y) * t,
                  })
                }
              } else {
                pts.push({ x, y })
              }
            }
          }
        } else if (stableState === 'erasing') {
          finalizeCurrentStroke()
          const eraseRadius = 70
          strokesRef.current = strokesRef.current
            .map((stroke) => ({
              ...stroke,
              points: stroke.points.filter((p) => Math.hypot(p.x - x, p.y - y) > eraseRadius),
            }))
            .filter((stroke) => stroke.points.length > 1)
        } else if (stableState === 'paused') {
          finalizeCurrentStroke()
        }
      } else {
        if (onHandData) onHandData({ hands: [] })
        missingFramesRef.current += 1
        if (missingFramesRef.current > 15) {
          finalizeCurrentStroke()
          smoothPos.current = { x: null, y: null }
          modeRef.current = 'idle'
          setModeAndNotify('idle')
        }
      }

      const dctx = drawCanvas.getContext('2d')
      dctx.clearRect(0, 0, w, h)
      dctx.lineJoin = 'round'
      dctx.lineCap = 'round'

      for (const stroke of strokesRef.current) {
        dctx.strokeStyle = stroke.color
        dctx.shadowColor = stroke.color
        dctx.shadowBlur = stroke.glow
        dctx.lineWidth = stroke.size
        renderStroke(dctx, stroke.points)
      }
      if (currentStrokeRef.current) {
        const s = currentStrokeRef.current
        dctx.strokeStyle = s.color
        dctx.shadowColor = s.color
        dctx.shadowBlur = s.glow
        dctx.lineWidth = s.size
        renderStroke(dctx, s.points)
      }
    })

    function setModeAndNotify(m) {
      if (onModeChange) onModeChange(m)
    }

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360 },
        })
        if (videoRef.current) videoRef.current.srcObject = stream

        camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current })
          },
          width: 480,
          height: 360,
        })
        camera.start()
      } catch (err) {
        console.error('Setup error:', err)
      }
    }

    setup()

    return () => {
      if (camera) camera.stop()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-40"
      />
      {middleLayer}
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />
    </div>
  )
})

export default Webcam