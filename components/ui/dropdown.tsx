'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Define the model structure
interface ModelOption {
  name: string
  type: 'chat' | 'image'
}

const availableModels: ModelOption[] = [
  { name: 'GPT-4.1', type: 'chat' },
  { name: 'DALL-E 3', type: 'image' },
]

interface DropdownProps {
  currentModel: string
  onModelSelect: (model: string) => void
  className?: string
}

export const Dropdown = ({ 
  currentModel, 
  onModelSelect, 
  className 
}: DropdownProps) => {
  const [open, setOpen] = useState(false)

  const handleSelect = (modelName: string) => {
    onModelSelect(modelName)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`w-56 justify-between ${className || ''}`}
          type="button"
        >
          {currentModel}
          <span className="ml-2 opacity-50 text-[10px]">▼</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
        <DropdownMenuGroup>
          {availableModels.map((model) => (
            <DropdownMenuItem
              key={model.name}
              onSelect={(e) => {
                e.preventDefault() 
                handleSelect(model.name)
              }}
              className="cursor-pointer flex justify-between"
            >
              {model.name}
              {currentModel === model.name && <span>✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}