'use client'

import * as React from 'react'
import { useContext } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { HiOutlineMenu } from 'react-icons/hi'
import ChatContext from '@/components/chat/chatContext'
import ThemeToggle from '@/components/theme/toggle'
import { Button } from '@/components/ui/button'

export const Header = () => {
  const context = useContext(ChatContext)
  const { onToggleSidebar } = context || {}

  return (
    <header className="sticky top-0 z-20 w-full bg-background border-b border-border">
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleSidebar?.()}
            className="transition-colors"
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            <HiOutlineMenu className="h-5 w-5" />
          </Button>

          {/* The logo link */}
          <Link
            href="https://vitagroup-gpt.vercel.app/chat"
            target="_blank"
            className="block max-w-[120px] sm:max-w-[200px]"
          >
            <Image
              src="/vitagroup.png"
              alt="vitagroup GPT"
              width={200}
              height={50}
              className="w-full h-auto object-contain cursor-pointer"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
