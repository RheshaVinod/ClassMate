import { useState, useEffect } from "react"
import axios from "axios"

const COLORS = {
  Math: "#4F46E5", Science: "#0891B2",
  History: "#B45309", English: "#15803D", General: "#6B7280"
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentData, setStudentData] = useState(null)

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = async () => {
    try {
      const { data } = await axios.get("/api/dashboard/overview")
      setData(data)
    } catch (err) {
      console.error("Dashboard load failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadStudent = async (name) => {
    setSelectedStudent(name)
    const { data } = await axios.get(`/api/dashboard/student/${name}`)
    setStudentData(data)
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>
      Loading dashboard...
    </div>
  )

  if (!data) return (
    <div style={{ padding: "40px", fontFamily: "system-ui", color: "#666" }}>
      No data yet. Have students use ClassMate first!
    </div>
  )

  return (
    <div style={{
      fontFamily: "system-ui, sans-serif",
      background: "#f9f9f9",
      minHeight: "100vh",
      padding: "24px"
    }}>

      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 600, color: "#1a1a2e" }}>
            Teacher Dashboard
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
            ClassMate · powered by Gemma 4
          </p>
        </div>
        <button
          onClick={loadDashboard}
          style={{
            padding: "8px 16px", borderRadius: "8px",
            background: "#1a1a2e", color: "white",
            border: "none", cursor: "pointer", fontSize: "13px"
          }}
        >
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Total students", value: data.total_students },
          { label: "Total sessions", value: data.total_sessions },
          { label: "Languages used", value: data.languages.length },
        ].map(stat => (
          <div key={stat.label} style={{
            background: "white", borderRadius: "12px",
            padding: "16px", border: "0.5px solid #eee"
          }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "28px", fontWeight: 600, color: "#1a1a2e" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

        {/* Top struggles */}
        <div style={{
          background: "white", borderRadius: "12px",
          padding: "20px", border: "0.5px solid #eee"
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#1a1a2e" }}>
            Class is struggling with
          </h2>
          {data.top_struggles.length === 0 ? (
            <p style={{ color: "#999", fontSize: "13px" }}>No data yet</p>
          ) : (
            data.top_struggles.slice(0, 6).map((item, i) => (
              <div key={i} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", color: "#333" }}>{item.concept}</span>
                  <span style={{ fontSize: "12px", color: "#888" }}>{item.count}x</span>
                </div>
                <div style={{ background: "#f0f0f0", borderRadius: "4px", height: "6px" }}>
                  <div style={{
                    background: "#1a1a2e",
                    borderRadius: "4px",
                    height: "6px",
                    width: `${Math.min(100, (item.count / data.top_struggles[0].count) * 100)}%`
                  }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Subject breakdown */}
        <div style={{
          background: "white", borderRadius: "12px",
          padding: "20px", border: "0.5px solid #eee"
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#1a1a2e" }}>
            Questions by subject
          </h2>
          {data.subjects.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center",
              gap: "10px", marginBottom: "10px"
            }}>
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%",
                background: COLORS[s.subject] || "#6B7280",
                flexShrink: 0
              }} />
              <span style={{ fontSize: "13px", flex: 1, color: "#333" }}>{s.subject}</span>
              <span style={{
                fontSize: "11px", fontWeight: 500,
                background: "#f0f0f0", padding: "2px 8px",
                borderRadius: "10px", color: "#555"
              }}>{s.count}</span>
            </div>
          ))}

          {/* Language breakdown */}
          <h2 style={{ margin: "16px 0 12px", fontSize: "15px", fontWeight: 600, color: "#1a1a2e" }}>
            Languages
          </h2>
          {data.languages.map((l, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: "13px", color: "#555", marginBottom: "6px"
            }}>
              <span>{l.language}</span>
              <span style={{ color: "#888" }}>{l.count} sessions</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{
        background: "white", borderRadius: "12px",
        padding: "20px", border: "0.5px solid #eee",
        marginBottom: "16px"
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#1a1a2e" }}>
          Recent activity
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
              {["Student", "Subject", "Asked", "Time"].map(h => (
                <th key={h} style={{
                  padding: "8px 12px", textAlign: "left",
                  color: "#888", fontWeight: 500, fontSize: "12px"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recent.map((r, i) => (
              <tr
                key={i}
                style={{ borderBottom: "1px solid #f9f9f9", cursor: "pointer" }}
                onClick={() => loadStudent(r.student)}
              >
                <td style={{ padding: "10px 12px", color: "#1a1a2e", fontWeight: 500 }}>{r.student}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    background: COLORS[r.subject] + "20",
                    color: COLORS[r.subject] || "#666",
                    padding: "2px 8px", borderRadius: "10px", fontSize: "11px"
                  }}>{r.subject}</span>
                </td>
                <td style={{ padding: "10px 12px", color: "#555" }}>{r.message}...</td>
                <td style={{ padding: "10px 12px", color: "#999", fontSize: "12px" }}>{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student detail panel */}
      {selectedStudent && studentData && (
        <div style={{
          background: "white", borderRadius: "12px",
          padding: "20px", border: "0.5px solid #eee"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#1a1a2e" }}>
              {selectedStudent}'s progress
            </h2>
            <button
              onClick={() => { setSelectedStudent(null); setStudentData(null) }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#999" }}
            >✕</button>
          </div>

          <h3 style={{ fontSize: "13px", color: "#888", fontWeight: 500, margin: "0 0 10px" }}>
            Struggling with
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
            {studentData.concepts.map((c, i) => (
              <span key={i} style={{
                padding: "4px 12px", borderRadius: "20px",
                background: c.struggles > 2 ? "#FEE2E2" : "#F3F4F6",
                color: c.struggles > 2 ? "#991B1B" : "#374151",
                fontSize: "12px"
              }}>
                {c.concept} ({c.struggles}x)
              </span>
            ))}
          </div>

          <h3 style={{ fontSize: "13px", color: "#888", fontWeight: 500, margin: "0 0 10px" }}>
            Recent sessions
          </h3>
          {studentData.sessions.slice(0, 5).map((s, i) => (
            <div key={i} style={{
              padding: "12px", background: "#f9f9f9",
              borderRadius: "8px", marginBottom: "8px"
            }}>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
                {s.subject} · {s.time}
              </div>
              <div style={{ fontSize: "13px", color: "#333", marginBottom: "4px" }}>
                <strong>Student:</strong> {s.message}
              </div>
              <div style={{ fontSize: "13px", color: "#555" }}>
                <strong>ClassMate:</strong> {s.reply}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}