import { useState, useRef, useEffect } from "react"
import axios from "axios"

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm ClassMate. What are you working on today?" }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = { role: "user", content: input }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput("")
    setLoading(true)

    try {
      const history = updatedMessages
        .slice(1)  // skip the opening greeting
        .slice(-10) // keep last 10 turns for context
        .map(m => ({ role: m.role, content: m.content }))

      const { data } = await axios.post("/api/chat", {
        message: input,
        history: history.slice(0, -1) // exclude the message we just added
      })

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Are you offline?"
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      maxWidth: "640px",
      margin: "0 auto",
      fontFamily: "system-ui, sans-serif",
      background: "#f9f9f9"
    }}>

      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: "#1a1a2e",
        color: "white",
        fontWeight: 600,
        fontSize: "18px"
      }}>
        ClassMate
        <span style={{ fontSize: "12px", fontWeight: 400, marginLeft: "8px", opacity: 0.6 }}>
          powered by Gemma 4
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
          }}>
            <div style={{
              maxWidth: "80%",
              padding: "12px 16px",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === "user" ? "#1a1a2e" : "white",
              color: msg.role === "user" ? "white" : "#1a1a2e",
              fontSize: "15px",
              lineHeight: "1.5",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "12px 16px",
              borderRadius: "18px 18px 18px 4px",
              background: "white",
              color: "#999",
              fontSize: "15px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
            }}>
              thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 20px",
        background: "white",
        borderTop: "1px solid #eee",
        display: "flex",
        gap: "10px"
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Ask ClassMate anything..."
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "24px",
            border: "1px solid #ddd",
            fontSize: "15px",
            outline: "none"
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            padding: "12px 20px",
            borderRadius: "24px",
            background: "#1a1a2e",
            color: "white",
            border: "none",
            fontSize: "15px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}