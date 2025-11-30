import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // We now mostly care about 'type' (chat vs image)
    const { input, type } = body

    // 1. Load Credentials
    const endpoint = process.env.AZURE_OPENAI_API_BASE_URL
    const apiKey = process.env.AZURE_OPENAI_API_KEY

    if (!endpoint || !apiKey) {
      return NextResponse.json({ error: 'Missing Azure Configuration' }, { status: 500 })
    }

    // 2. QUICK SELECTION: Select Deployment based on TYPE only
    // This is "Quicker" because it removes the need for string matching maps
    let deploymentName = ''
    let apiVersion = ''
    let url = ''
    let payload = {}

    // Ensure endpoint ends with /
    const base = endpoint.endsWith('/') ? endpoint : `${endpoint}/`

    // --- CASE 1: CHAT ---
    if (type === 'chat') {
      deploymentName = process.env.AZURE_DEPLOYMENT_GPT4 || 'gpt-4'
      apiVersion = process.env.AZURE_DEPLOYMENT_GPT4_VERSION || '2024-02-15-preview'

      url = `${base}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`

      payload = {
        messages: [{ role: 'user', content: input }],
        stream: true
      }
    }
    // --- CASE 2: IMAGE ---
    else if (type === 'image') {
      deploymentName = process.env.AZURE_DEPLOYMENT_DALLE3 || 'dall-e-3'
      apiVersion = process.env.AZURE_DEPLOYMENT_DALLE3_VERSION || '2024-02-01'

      url = `${base}openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`

      payload = {
        prompt: input,
        size: '1024x1024',
        n: 1
      }
    } else {
      return NextResponse.json({ error: 'Invalid Type' }, { status: 400 })
    }

    // 3. Fetch
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      // Extract clean error message
      let errMsg = response.statusText
      try {
        const json = JSON.parse(errText)
        errMsg = json.error?.message || json.error || errText
      } catch (e) {
        /* fallback */
      }

      throw new Error(errMsg)
    }

    // 4. Return Response (Stream or JSON)
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
                  } catch (e) {}
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
