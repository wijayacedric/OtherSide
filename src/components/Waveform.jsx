const heights = [
  0.35, 0.62, 0.9, 0.5, 0.76, 1, 0.44, 0.7, 0.94, 0.56, 0.82, 0.4, 0.86,
  0.66, 0.98, 0.52, 0.74, 0.9, 0.43, 0.69,
]

export default function Waveform({ playing, progress = 0 }) {
  return (
    <div
      className="flex h-10 items-center justify-center gap-[3px]"
      aria-hidden="true"
    >
      {heights.map((height, index) => {
        const reached = index / heights.length <= progress
        return (
          <span
            key={index}
            className={`wave-bar w-[3px] rounded-full transition-opacity ${
              reached ? 'opacity-100' : 'opacity-25'
            }`}
            style={{
              height: `${Math.round(height * 100)}%`,
              animationDelay: `${index * 45}ms`,
              animationPlayState: playing ? 'running' : 'paused',
            }}
          />
        )
      })}
    </div>
  )
}
