export async function sendMessage(messages) {
  try {
    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get response')
    }

    const data = await response.json()
    return {
      success: true,
      message: data.message,
      usage: data.usage,
    }
  } catch (error) {
    console.error('Chatbot API error:', error)
    return {
      success: false,
      message: error.message || 'Failed to send message. Please try again.',
      error: error.message,
    }
  }
}
