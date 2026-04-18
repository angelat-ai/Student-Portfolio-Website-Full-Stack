import React, { useState, useEffect } from 'react'
import './Loader.css'

const MESSAGES = [
  'Loading your experience...',
  'This will be the best choice for you!',
  'Preparing your creative space...',
  'Almost ready, future star ✨',
]

export default function Loader() {
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="loader-wrap">
      <div className="loader-logo">SDPMS</div>
      <div className="loader-spinner" />
      <p className="loader-msg">{MESSAGES[msgIdx]}</p>
    </div>
  )
}