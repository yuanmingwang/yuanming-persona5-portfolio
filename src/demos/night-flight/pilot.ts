import { scrollSpeed } from './flight.ts'
import type { Flight } from './flight.ts'
import { captureFrame, FRAME_COUNT } from './frames.ts'
import { decideFlight, readFrame } from './vision.ts'
import type { VisionWeights } from './vision.ts'

export function createPilot(weights?: VisionWeights) {
  const observations: { frame: Uint8Array; reading: ReturnType<typeof readFrame> }[] = []
  let lastFlap: number | null = null

  return {
    recordFlap(tick: number) {
      lastFlap = tick
    },
    sample(flight: Flight) {
      const start = performance.now()
      const frame = captureFrame(flight)
      const reading = readFrame(frame, weights)
      observations.unshift({ frame, reading })
      if (observations.length > FRAME_COUNT) observations.pop()

      const decision = decideFlight(
        observations.map(observation => observation.reading),
        lastFlap === null ? null : flight.ticks - lastFlap,
        scrollSpeed(flight.score),
      )
      return {
        ...decision,
        classMap: reading.classMap,
        frames: observations.map(observation => observation.frame),
        duration: performance.now() - start,
      }
    },
  }
}

export type PilotSample = ReturnType<ReturnType<typeof createPilot>['sample']>
