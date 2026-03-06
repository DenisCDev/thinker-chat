'use client'

import Image from 'next/image'
import {
  Robot,
  Scales,
  Bank,
  FileText,
  Calculator,
  Plant,
  Truck,
  Buildings,
  Coins,
  Receipt,
  CurrencyDollar,
  Leaf,
  Tree,
  Sun,
  MapPin,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'

// Map of icon IDs to Phosphor components
const ICON_MAP: Record<string, PhosphorIcon> = {
  bot: Robot,
  scale: Scales,
  landmark: Bank,
  'file-text': FileText,
  calculator: Calculator,
  wheat: Plant,
  tractor: Truck,
  building: Buildings,
  coins: Coins,
  receipt: Receipt,
  dollar: CurrencyDollar,
  leaf: Leaf,
  tree: Tree,
  sun: Sun,
  map: MapPin,
}

interface AssistantIconProps {
  iconUrl: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: { container: 'w-8 h-8', icon: 'h-4 w-4' },
  md: { container: 'w-12 h-12', icon: 'h-6 w-6' },
  lg: { container: 'w-16 h-16', icon: 'h-8 w-8' },
}

export function AssistantIcon({ iconUrl, size = 'md', className = 'text-lime' }: AssistantIconProps) {
  const sizeClasses = SIZE_MAP[size]

  // Check if it's an image URL
  const isImageUrl = iconUrl && (iconUrl.startsWith('http') || iconUrl.startsWith('/'))

  if (isImageUrl) {
    return (
      <div className={`relative ${sizeClasses.container} rounded-lg overflow-hidden bg-muted ${className}`}>
        <Image
          src={iconUrl}
          alt="Assistant icon"
          fill
          className="object-cover"
        />
      </div>
    )
  }

  // Get Lucide icon component
  const IconComponent = iconUrl ? ICON_MAP[iconUrl] || Robot : Robot

  return (
    <IconComponent className={`${sizeClasses.icon} ${className}`} />
  )
}
