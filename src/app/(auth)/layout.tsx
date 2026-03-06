'use client'

import { Brain } from '@phosphor-icons/react/dist/ssr'
import LightPillar from '@/components/LightPillar'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 relative overflow-hidden">
      {/* LightPillar Background */}
      <div className="absolute inset-0 pointer-events-none">
        <LightPillar
          topColor="#22c55e"
          bottomColor="#059669"
          intensity={0.8}
          rotationSpeed={0.2}
          glowAmount={0.003}
          pillarWidth={3}
          pillarHeight={0.4}
          noiseIntensity={0.4}
          pillarRotation={25}
          interactive={false}
          mixBlendMode="screen"
          quality="high"
        />
      </div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          {/* Logo Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
              <Brain className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl text-white tracking-tight">
            Thinker
          </h1>
          <p className="text-white/50 mt-2 text-sm tracking-wide">
            Assistentes de IA inteligentes
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
