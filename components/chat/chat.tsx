'use client'

import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import ContentEditable, { ContentEditableEvent } from 'react-contenteditable'
import { AiOutlineClear, AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FiSend } from 'react-icons/fi'
import sanitizeHtml from 'sanitize-html'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import ChatContext from './chatContext'
// Make sure these imports exist, otherwise verify the interfaces below
import type { Chat, ChatMessage } from './interface'
import { Message } from './message'
import { Dropdown } from '@/components/ui/dropdown'

export interface ChatProps {}

export interface ChatGPInstance {
  setConversation: (messages: ChatMessage[]) => void
  getConversation: () => ChatMessage[]
  focus: () => void
}

/**
 * Backend API call
 */
const postChatOrQuestion = async (
  chat: Chat,
  messages: ChatMessage[],
  input: string,
  model: string
) => {
  // Normalize model name logic
  const isImageModel = model.includes('DALL') || model.toLowerCase().includes('image')
  const sendModel = isImageModel ? 'dall-e3' : 'gpt-4.1'
  const type = isImageModel ? 'image' : 'chat'

  const url = '/api/chat'

  const data = {
    messages: [...messages],
    input,
    model: sendModel,
    type
  }

  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}

const Chat = (props: ChatProps, ref: React.Ref<ChatGPInstance>) => {
  const { currentChatRef, saveMessages, forceUpdate } = useContext(ChatContext)

  // --- FIX 1: INSTANT MEMORY (Solves "Click Twice") ---
  const modelRef = useRef<string>('GPT-4.1')
  const [selectedModel, setSelectedModel] = useState<string>('GPT-4.1')

  // --- FIX 2: CONNECTOR FUNCTION ---
  const handleModelChange = (newModel: string) => {
    modelRef.current = newModel
    setSelectedModel(newModel)
    textAreaRef.current?.focus()
  }

  const [isLoading, setIsLoading] = useState(false)
  const conversationRef = useRef<ChatMessage[]>([])
  const conversation = useRef<ChatMessage[]>([])

  const [message, setMessage] = useState('')
  const [currentMessage, setCurrentMessage] = useState<string>('')

  const textAreaRef = useRef<HTMLElement>(null) as React.MutableRefObject<HTMLElement>
  const bottomOfChatRef = useRef<HTMLDivElement>(null)

  /**
   * SEND MESSAGE
   */
  const sendMessage = useCallback(
    async (e: React.FormEvent | React.MouseEvent, overrideModel?: string) => {
      // Prevent form defaults & double clicks
      if (e) e.preventDefault()
      if (isLoading) return

      // --- FIX 3: USE REF FOR CURRENT MODEL ---
      const currentModel = modelRef.current

      const input = sanitizeHtml(textAreaRef.current?.innerHTML || '')
      if (!input.trim()) {
        toast.error('Please type a message to continue.')
        return
      }

      const previousMessages = [...conversation.current]

      // Optimistic UI update
      conversation.current = [...conversation.current, { content: input, role: 'user' }]
      setMessage('')
      setIsLoading(true)

      if (!currentChatRef?.current) {
        toast.error('No chat selected.')
        setIsLoading(false)
        return
      }

      try {
        const response = await postChatOrQuestion(
          currentChatRef.current,
          previousMessages,
          input,
          currentModel // <--- Sending the REF value
        )

        // Error Handling
        if (!response.ok) {
          const errData = await response.json()
          const errorMsg = errData.error?.message || errData.error || response.statusText
          throw new Error(errorMsg)
        }

        const isImage =
          currentModel.includes('DALL') || currentModel.toLowerCase().includes('image')

        if (isImage) {
          // 1. IMAGE RESPONSE (JSON)
          const result = await response.json()

          if (!result.content) throw new Error('No image returned')

          conversation.current = [
            ...conversation.current,
            { content: result.content, role: 'assistant' }
          ]
          forceUpdate?.()
        } else {
          // 2. CHAT RESPONSE (STREAM)
          const data = response.body
          if (!data) throw new Error('No data')

          const reader = data.getReader()
          const decoder = new TextDecoder('utf-8')
          let done = false
          let resultContent = ''

          while (!done) {
            const { value, done: readerDone } = await reader.read()
            const chunk = decoder.decode(value)

            if (chunk) {
              resultContent += chunk
              setCurrentMessage(resultContent)
            }
            done = readerDone
          }

          // Finalize chat message
          conversation.current = [
            ...conversation.current,
            { content: resultContent, role: 'assistant' }
          ]
          setCurrentMessage('')
        }
      } catch (error: any) {
        console.error(error)

        // --- CONTENT POLICY HANDLER ---
        if (
          error.message &&
          (error.message.includes('safety') || error.message.includes('policy'))
        ) {
          toast.error(
            "⚠️ Image blocked by Azure Safety Filter. Try asking for an 'Illustration' instead."
          )
          conversation.current.pop()
          forceUpdate?.()
        } else {
          toast.error(error.message || 'An error occurred')
        }
      } finally {
        setIsLoading(false)
      }
    },
    [currentChatRef, isLoading, forceUpdate]
  )

  const handleKeypress = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.keyCode === 13 && !e.shiftKey) {
        e.preventDefault()
        sendMessage(e as any) // Casting as any to satisfy generic event handler type
      }
    },
    [sendMessage]
  )

  const clearMessages = () => {
    conversation.current = []
    forceUpdate?.()
  }

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = '50px'
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight + 2}px`
    }
  }, [message])

  useEffect(() => {
    bottomOfChatRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, currentMessage])

  useEffect(() => {
    conversationRef.current = conversation.current
    if (currentChatRef?.current?.id) {
      saveMessages?.(conversation.current)
    }
  }, [conversation.current])

  useEffect(() => {
    if (!isLoading) textAreaRef.current?.focus()
  }, [isLoading])

  useImperativeHandle(ref, () => ({
    setConversation(messages: ChatMessage[]) {
      conversation.current = messages
      forceUpdate?.()
    },
    getConversation() {
      return conversationRef.current
    },
    focus: () => {
      textAreaRef.current?.focus()
    }
  }))

  return (
    <div className="relative flex flex-col h-full bg-background text-foreground">
      {/* Chat area */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {conversation.current.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] space-y-8 px-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-normal text-foreground">
                    Hello, I&apos;m here to help
                  </h1>
                  <p className="text-muted-foreground text-base md:text-lg">
                    Ask me anything, or try one of these:
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                  <div
                    className="p-4 rounded-xl border border-border hover:border-sidebar cursor-pointer transition-colors"
                    onClick={() => {
                      setMessage('What does vitagroup do?')
                      textAreaRef.current?.focus()
                    }}
                  >
                    <p className="text-foreground text-sm">What does vitagroup do?</p>
                  </div>
                  <div
                    className="p-4 rounded-xl border border-border hover:border-sidebar cursor-pointer transition-colors"
                    onClick={() => {
                      setMessage(
                        'What are the main benefits of HIP for hospitals and care providers?'
                      )
                      textAreaRef.current?.focus()
                    }}
                  >
                    <p className="text-foreground text-sm">
                      What are the main benefits of HIP for hospitals and care providers?
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-xl border border-border hover:border-sidebar cursor-pointer transition-colors"
                    onClick={() => {
                      setMessage('How does vitagroup make healthcare more accessible to patients?')
                      textAreaRef.current?.focus()
                    }}
                  >
                    <p className="text-foreground text-sm">
                      How does vitagroup make healthcare more accessible to patients?
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-xl border border-border hover:border-sidebar cursor-pointer transition-colors"
                    onClick={() => {
                      setMessage(
                        'How does vitagroup enable digital and AI-driven healthcare innovations?'
                      )
                      textAreaRef.current?.focus()
                    }}
                  >
                    <p className="text-foreground text-sm">
                      How does vitagroup enable digital and AI-driven healthcare innovations?
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {conversation.current.map((item, index) => (
                  <Message key={index} message={item} />
                ))}
                {currentMessage && (
                  <Message message={{ content: currentMessage, role: 'assistant' }} />
                )}
                <div ref={bottomOfChatRef}></div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* INPUT AREA */}
      <div className="border-t border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {conversation.current.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg mb-3"
              disabled={isLoading}
              onClick={clearMessages}
              type="button"
            >
              <AiOutlineClear className="size-4 mr-2" />
              Clear chat
            </Button>
          )}

          <div className="flex items-center gap-4 w-full">
            {/* --- FIX 4: CORRECT DROPDOWN PROPS --- */}
            <Dropdown currentModel={selectedModel} onModelSelect={handleModelChange} />

            {/* INPUT */}
            <div className="flex-1">
              <div className="flex items-center gap-3 bg-secondary rounded-3xl border border-border focus-within:border-sidebar">
                <div className="flex-1 px-4 py-3 min-h-[52px] flex items-center">
                  <ContentEditable
                    innerRef={textAreaRef}
                    style={{
                      minHeight: '24px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      outline: 'none'
                    }}
                    className="w-full bg-transparent text-foreground placeholder-muted-foreground focus:outline-sidebar text-base resize-none"
                    html={message}
                    disabled={isLoading}
                    onChange={(e: ContentEditableEvent) => {
                      setMessage(sanitizeHtml(e.target.value))
                    }}
                    onKeyDown={handleKeypress}
                  />
                </div>

                <div className="flex items-center pr-2 pb-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-2">
                      <AiOutlineLoading3Quarters className="animate-spin size-5 text-muted-foreground" />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      disabled={isLoading || !message.trim()}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      onClick={(e) => sendMessage(e)}
                    >
                      <FiSend className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default forwardRef<ChatGPInstance, ChatProps>(Chat)
