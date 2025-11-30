import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // We receive 'messages' (history) from the frontend now
    const { input, type, messages } = body

    const endpoint = process.env.AZURE_OPENAI_API_BASE_URL
    const apiKey = process.env.AZURE_OPENAI_API_KEY

    if (!endpoint || !apiKey) {
      return NextResponse.json({ error: 'Missing Azure Configuration' }, { status: 500 })
    }

    // --- 1. GET CURRENT DATE & TIME ---
    const now = new Date()
    const dateTimeString = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'short'
    })

    // --- 2. CREATE SYSTEM PROMPT ---
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant for a healthcare application called "Symptom Checker". 
      The current date and time is: ${dateTimeString}. 
      If the user asks about time or date, use this information.`
    }

    let url = ''
    let payload = {}
    const base = endpoint.endsWith('/') ? endpoint : `${endpoint}/`

    // --- SCENARIO A: CHAT ---
    if (type === 'chat') {
      const deploymentName = process.env.AZURE_DEPLOYMENT_GPT4 || 'gpt-4'
      const apiVersion = process.env.AZURE_DEPLOYMENT_GPT4_VERSION || '2024-02-15-preview'

      url = `${base}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`

      const cleanHistory = messages ? messages.filter((m: any) => m.role !== 'system') : []

      payload = {
        messages: [systemMessage, ...cleanHistory, { role: 'user', content: input }],
        stream: true
      }
    }
    // --- SCENARIO B: IMAGE ---
    else if (type === 'image') {
      const deploymentName = process.env.AZURE_DEPLOYMENT_DALLE3 || 'dall-e-3'
      const apiVersion = process.env.AZURE_DEPLOYMENT_DALLE3_VERSION || '2024-02-01'

      url = `${base}openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`

      payload = {
        prompt: input,
        size: '1024x1024',
        n: 1
      }
    } else {
      return NextResponse.json({ error: 'Invalid Type' }, { status: 400 })
    }

    // Fetch from Azure
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      let errMsg = response.statusText
      try {
        const json = JSON.parse(errText)
        errMsg = json.error?.message || json.error || errText
      } catch {
        /* fallback to statusText if parse fails */
      }
      throw new Error(errMsg)
    }

    // Handle Response
    if (type === 'chat') {
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          if (!reader) {
            controller.close()
            return
          }
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value)
              const lines = chunk.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const json = JSON.parse(line.replace('data: ', ''))
                    const content = json.choices[0]?.delta?.content || ''
                    if (content) controller.enqueue(new TextEncoder().encode(content))
                  } catch {
                    /* ignore parsing errors on partial chunks */
                  }
                }
              }
            }
          } finally {
            controller.close()
          }
        }
      })
      return new Response(stream, { headers: { 'Content-Type': 'text/plain' } })
    } else {
      const data = await response.json()
      return NextResponse.json({
        content: `![Generated Image](${data.data[0].url})`,
        role: 'assistant'
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
