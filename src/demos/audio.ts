const soundNames = ['jump', 'die', 'point'] as const

export function createArcadeAudio() {
  return createGameAudio('dino', soundNames, 'wav')
}

export function createGameAudio<Name extends string>(folder: string, names: readonly Name[], extension: 'wav' | 'mp3') {
  const context = new AudioContext()
  const volume = context.createGain()
  volume.gain.value = .4
  volume.connect(context.destination)

  const request = new AbortController()
  const clips = new Map(names.map(name => [
    name,
    fetch(`${import.meta.env.BASE_URL}audio/${folder}/${name}.${extension}`, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Unable to load ${name} sound`)
        return response.arrayBuffer()
      })
      .then(bytes => context.decodeAudioData(bytes))
      .catch(() => null),
  ]))

  return {
    enable(enabled: boolean) {
      volume.gain.value = enabled ? .4 : 0
      if (enabled) void context.resume().catch(() => {})
    },
    play(name: Name) {
      if (volume.gain.value === 0) return
      void clips.get(name)?.then(buffer => {
        if (!buffer || context.state !== 'running' || volume.gain.value === 0) return
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(volume)
        source.start()
      })
    },
    close() {
      request.abort()
      void context.close().catch(() => {})
    },
  }
}
