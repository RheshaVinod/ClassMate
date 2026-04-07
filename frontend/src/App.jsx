import { useState, useRef, useEffect } from "react"
import axios from "axios"
import { cacheResponse, findCachedResponse, getCacheSize } from './cache'

const LANGUAGES = [
  { code: "English",    label: "English",    flag: "🇺🇸" },
  { code: "Spanish",    label: "Español",    flag: "🇪🇸" },
  { code: "Hindi",      label: "हिन्दी",      flag: "🇮🇳" },
  { code: "French",     label: "Français",   flag: "🇫🇷" },
  { code: "Arabic",     label: "العربية",    flag: "🇸🇦" },
  { code: "Portuguese", label: "Português",  flag: "🇧🇷" },
  { code: "Swahili",    label: "Kiswahili",  flag: "🇰🇪" },
  { code: "Bengali",    label: "বাংলা",      flag: "🇧🇩" },
  { code: "Mandarin",   label: "中文",       flag: "🇨🇳" },
  { code: "Tamil",      label: "தமிழ்",      flag: "🇱🇰" },
]

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm ClassMate. You can type a question or tap the camera to photo your homework!" }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [language, setLanguage] = useState("English")
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [studentName, setStudentName] = useState("")
  const [nameSet, setNameSet] = useState(false)
  const [cacheCount, setCacheCount] = useState(getCacheSize())
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const greetings = {
      English:    "Hi! I'm ClassMate. Type a question or tap the camera to photo your homework!",
      Spanish:    "¡Hola! Soy ClassMate. ¡Escribe una pregunta o toca la cámara para fotografiar tu tarea!",
      Hindi:      "नमस्ते! मैं ClassMate हूं। कोई सवाल टाइप करें या होमवर्क की फोटो लेने के लिए कैमरा दबाएं!",
      French:     "Bonjour! Je suis ClassMate. Pose une question ou prends en photo ton devoir!",
      Arabic:     "مرحباً! أنا ClassMate. اكتب سؤالاً أو التقط صورة لواجبك المنزلي!",
      Portuguese: "Olá! Sou o ClassMate. Digite uma pergunta ou tire foto da sua lição de casa!",
      Swahili:    "Habari! Mimi ni ClassMate. Andika swali au piga picha ya kazi yako ya nyumbani!",
      Bengali:    "হ্যালো! আমি ClassMate। একটি প্রশ্ন টাইপ করুন বা আপনার হোমওয়ার্কের ছবি তুলুন!",
      Mandarin:   "你好！我是ClassMate。输入问题或拍下你的作业照片！",
      Tamil:      "வணக்கம்! நான் ClassMate. ஒரு கேள்வி தட்டச்சு செய்யுங்கள் அல்லது உங்கள் வீட்டுப்பாடத்தின் படம் எடுங்கள்!",
    }
    setMessages([{
      role: "assistant",
      content: greetings[language] || greetings["English"]
    }])
  }, [language])

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    fileInputRef.current.value = ""
  }

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile) || loading) return

    const userMessage = {
      role: "user",
      content: input || "Can you help me with this?",
      image: imagePreview
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput("")
    setLoading(true)

    try {
      let reply

      if (!isOnline) {
        const cached = findCachedResponse(input, language)
        reply = cached
          ? `${cached}\n\n*(from cache — you are offline)*`
          : "You're offline and I don't have a cached answer for this yet. Ask me again when you're connected!"

      } else if (imageFile) {
        const formData = new FormData()
        formData.append("file", imageFile)
        formData.append("message", input || "Help me with this problem")
        formData.append("language", language)
        formData.append("student_name", studentName)
        const { data } = await axios.post("/api/chat-with-image", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
        reply = data.reply
        clearImage()
        cacheResponse(input || "image question", reply, language)
        setCacheCount(getCacheSize())

      } else {
        const history = updatedMessages
          .slice(1).slice(-10)
          .map(m => ({ role: m.role, content: m.content }))
        const { data } = await axios.post("/api/chat", {
          message: input,
          history: history.slice(0, -1),
          language: language,
          student_name: studentName
        })
        reply = data.reply
        cacheResponse(input, reply, language)
        setCacheCount(getCacheSize())
      }

      setMessages(prev => [...prev, { role: "assistant", content: reply }])

    } catch (err) {
      const cached = findCachedResponse(input, language)
      setMessages(prev => [...prev, {
        role: "assistant",
        content: cached
          ? `${cached}\n\n*(from cache — connection lost)*`
          : "Sorry, I lost connection. Try again in a moment!"
      }])
    } finally {
      setLoading(false)
    }
  }

  const currentLang = LANGUAGES.find(l => l.code === language)

  if (!nameSet) return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "system-ui",
      background: "#f9f9f9", padding: "40px"
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        padding: "32px", maxWidth: "320px", width: "100%",
        border: "1px solid #eee", textAlign: "center"
      }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>📚</div>
        <h2 style={{ margin: "0 0 8px", color: "#1a1a2e" }}>Welcome to ClassMate</h2>
        <p style={{ color: "#666", fontSize: "14px", margin: "0 0 24px" }}>
          Your AI tutor powered by Gemma 4
        </p>
        <input
          placeholder="Enter your name"
          value={studentName}
          onChange={e => setStudentName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && studentName.trim() && setNameSet(true)}
          style={{
            width: "100%", padding: "12px 16px",
            borderRadius: "12px", border: "1px solid #ddd",
            fontSize: "15px", outline: "none",
            marginBottom: "12px", boxSizing: "border-box"
          }}
          autoFocus
        />
        <button
          onClick={() => studentName.trim() && setNameSet(true)}
          style={{
            width: "100%", padding: "12px",
            background: "#1a1a2e", color: "white",
            border: "none", borderRadius: "12px",
            fontSize: "15px", cursor: "pointer"
          }}
        >
          Start learning
        </button>
      </div>
    </div>
  )

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      maxWidth: "640px",
      margin: "0 auto",
      fontFamily: "system-ui, sans-serif",
      background: "#f9f9f9",
      position: "relative"
    }}>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          background: "#f59e0b",
          color: "white",
          padding: "8px 20px",
          fontSize: "13px",
          textAlign: "center",
          fontWeight: 500
        }}>
          You are offline — showing cached responses
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: "#1a1a2e",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <span style={{ fontWeight: 600, fontSize: "18px" }}>ClassMate</span>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Language picker */}
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              padding: "6px 12px",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span style={{ fontSize: "16px" }}>{currentLang.flag}</span>
            {currentLang.label}
            <span style={{ fontSize: "10px", opacity: 0.7 }}>▼</span>
          </button>

          {/* Teacher view */}
          <a
            href="/dashboard"
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
              marginLeft: "4px"
            }}
          >
            Teacher view
          </a>

          {/* Cache count */}
          <span style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.4)",
            marginLeft: "4px"
          }}>
            {cacheCount} cached
          </span>
        </div>
      </div>

      {/* Language dropdown */}
      {showLangPicker && (
        <div style={{
          position: "absolute",
          top: "60px",
          right: "16px",
          background: "white",
          border: "1px solid #ddd",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 100,
          overflow: "hidden",
          minWidth: "180px"
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                setShowLangPicker(false)
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "12px 16px",
                background: language === lang.code ? "#f0f0ff" : "white",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                color: "#1a1a2e",
                textAlign: "left",
                borderBottom: "1px solid #f0f0f0"
              }}
            >
              <span style={{ fontSize: "20px" }}>{lang.flag}</span>
              <span>{lang.label}</span>
              {language === lang.code && (
                <span style={{ marginLeft: "auto", color: "#1a1a2e" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
        onClick={() => setShowLangPicker(false)}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
          }}>
            <div style={{
              maxWidth: "80%",
              borderRadius: msg.role === "user"
                ? "18px 18px 4px 18px"
                : "18px 18px 18px 4px",
              background: msg.role === "user" ? "#1a1a2e" : "white",
              color: msg.role === "user" ? "white" : "#1a1a2e",
              fontSize: "15px",
              lineHeight: "1.6",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              overflow: "hidden"
            }}>
              {msg.image && (
                <img
                  src={msg.image}
                  alt="homework"
                  style={{
                    width: "100%",
                    maxHeight: "200px",
                    objectFit: "cover",
                    display: "block"
                  }}
                />
              )}
              <div style={{ padding: "12px 16px" }}>{msg.content}</div>
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
              {imageFile ? "reading your image..." : "thinking..."}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image preview bar */}
      {imagePreview && (
        <div style={{
          padding: "10px 20px",
          background: "white",
          borderTop: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <img
            src={imagePreview}
            alt="preview"
            style={{
              width: "48px",
              height: "48px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid #ddd"
            }}
          />
          <span style={{ fontSize: "13px", color: "#666", flex: 1 }}>
            Image ready — ask a question or just hit Send
          </span>
          <button
            onClick={clearImage}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              color: "#999"
            }}
          >✕</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: "12px 16px",
        background: "white",
        borderTop: "1px solid #eee",
        display: "flex",
        gap: "8px",
        alignItems: "center"
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
          style={{ display: "none" }}
        />

        <button
          onClick={() => fileInputRef.current.click()}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "1px solid #ddd",
            background: imageFile ? "#1a1a2e" : "white",
            cursor: "pointer",
            fontSize: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >📷</button>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={imageFile ? "Ask about the image..." : "Ask ClassMate anything..."}
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
            opacity: loading ? 0.6 : 1,
            flexShrink: 0
          }}
        >Send</button>
      </div>
    </div>
  )
}