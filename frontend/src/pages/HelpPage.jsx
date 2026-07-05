import { useState, useRef, useEffect } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'
import './HelpPage.css'

const FAQS = [
  { q: 'How do I book an appointment?', a: 'Go to the Appointments page and tap "Book an Appointment". Pick a therapy type, a therapist, and a date and time that works for you.' },
  { q: 'How do I message my therapist?', a: 'Open the Messages page from the sidebar, choose your therapist, and type your message at the bottom.' },
  { q: 'What is Quick Log for?', a: 'Quick Log is on your Home page. It lets you record how you feel, whether you did your exercises, and how much you hurt — every day.' },
  { q: 'Can my parent see my progress?', a: 'Yes. Turn on "Share progress with family" in Settings → Privacy, and your parent or guardian will be able to see your progress notes.' },
  { q: 'How do I change my password?', a: 'Go to Settings, scroll to the Security section, and use the Change Password form.' },
  { q: 'What do I do if I miss an appointment?', a: 'Contact the clinic as soon as you can using the phone number or email below, and we will help you find a new time.' },
]

const GUIDES = [
  {
    icon: '📅',
    title: 'How to Book an Appointment',
    steps: [
      'Open Appointments from the sidebar.',
      'Tap "Book an Appointment".',
      'Choose your therapy type and a therapist.',
      'Pick a date and time you like.',
      'Tap Confirm — it will show up on your calendar.',
    ],
  },
  {
    icon: '📝',
    title: 'How to Use Quick Log',
    steps: [
      'Go to your Home page.',
      'Find the Quick Log card and tap Show.',
      'Tap the face that matches how you feel today.',
      'Check the box if you did your exercises.',
      'Tap the face that matches how much it hurts.',
    ],
  },
  {
    icon: '💬',
    title: 'How to Message Your Therapist',
    steps: [
      'Open Messages from the sidebar.',
      "Tap on your therapist's name.",
      'Type your message in the box at the bottom.',
      'Tap the send button.',
    ],
  },
  {
    icon: '👤',
    title: 'How to Update Your Profile',
    steps: [
      'Tap "View Profile" in the sidebar.',
      'Tap the Edit button.',
      'Change your name, photo, or bio.',
      'Tap Save.',
    ],
  },
]

const BOT_RESPONSES = [
  { keywords: ['appointment', 'book', 'schedule'], reply: 'You can book an appointment from the Appointments page — tap "Book an Appointment" and pick a time that works for you!' },
  { keywords: ['password', 'login', 'sign in', 'sign-in'], reply: 'To change your password, go to Settings → Security and use the Change Password form.' },
  { keywords: ['pain', 'hurt'], reply: 'You can log how much you hurt in the Quick Log on your Home page — just tap the face that matches how you feel.' },
  { keywords: ['message', 'therapist', 'chat', 'talk'], reply: 'You can message your therapist anytime from the Messages page in the sidebar.' },
  { keywords: ['bill', 'payment', 'subscription', 'pay'], reply: 'For billing questions, check the Subscription page, or email us at support@therapypro.com.' },
  { keywords: ['exercise', 'homework'], reply: 'Your daily exercises are in the Quick Log on your Home page — check the box once you finish them!' },
]
const DEFAULT_REPLY = "Thanks for asking! For anything I can't help with, please email support@therapypro.com or call us — our team replies within one business day."

function findBotReply(text) {
  const lower = text.toLowerCase()
  const match = BOT_RESPONSES.find((r) => r.keywords.some((k) => lower.includes(k)))
  return match ? match.reply : DEFAULT_REPLY
}

function ChevronIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function PhoneIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.3 1.6.54 2.36a2 2 0 0 1-.45 2.11L8.09 9.09a16 16 0 0 0 6 6l.9-1.11a2 2 0 0 1 2.11-.45c.76.24 1.55.42 2.36.54A2 2 0 0 1 22 16.92z" /></svg>
}
function MailIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7 10-7" /></svg>
}
function SendIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
}
function XIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}
function BotIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M9 4h6" /><circle cx="9" cy="14" r="1.2" fill="currentColor" /><circle cx="15" cy="14" r="1.2" fill="currentColor" /></svg>
}

export default function HelpPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [activeGuide, setActiveGuide] = useState(null)
  const [toast, setToast] = useState('')

  const [contactForm, setContactForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    subject: 'General Question',
    message: '',
  })

  const [chatMessages, setChatMessages] = useState([
    { from: 'bot', text: "Hi! I'm the TherapyPro Support Assistant. Ask me about appointments, messages, or your account." },
  ])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const handleContactSubmit = (e) => {
    e.preventDefault()
    if (!contactForm.message.trim()) return
    showToast("Message sent! We'll get back to you soon.")
    setContactForm((f) => ({ ...f, message: '' }))
  }

  const handleChatSend = (e) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    const reply = findBotReply(text)
    setChatMessages((prev) => [...prev, { from: 'me', text }, { from: 'bot', text: reply }])
    setChatInput('')
  }

  return (
    <div className="page-with-sidebar">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      <main className="page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)}>☰</button>

        <div className="page-header">
          <h1>Help &amp; Support</h1>
          <p>Get help with using Therapy Pro</p>
        </div>

        <div className="help-container">
          {/* Quick contact */}
          <div className="help-contact-cards">
            <a className="help-contact-card" href="tel:+18005551234">
              <div className="help-contact-icon"><PhoneIcon /></div>
              <div>
                <span className="help-contact-label">Call Us</span>
                <span className="help-contact-value">1-800-555-1234</span>
              </div>
            </a>
            <a className="help-contact-card" href="mailto:support@therapypro.com">
              <div className="help-contact-icon"><MailIcon /></div>
              <div>
                <span className="help-contact-label">Email Us</span>
                <span className="help-contact-value">support@therapypro.com</span>
              </div>
            </a>
          </div>

          {/* FAQ */}
          <section className="help-section">
            <h2 className="help-section-title">Frequently Asked Questions</h2>
            <div className="faq-list">
              {FAQS.map((faq, i) => (
                <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                  <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                    <span>{faq.q}</span>
                    <ChevronIcon open={openFaq === i} />
                  </button>
                  {openFaq === i && <p className="faq-answer">{faq.a}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* How-to guides */}
          <section className="help-section">
            <h2 className="help-section-title">How-To Guides</h2>
            <div className="guide-grid">
              {GUIDES.map((guide, i) => (
                <button key={i} className="guide-card" onClick={() => setActiveGuide(guide)}>
                  <span className="guide-icon">{guide.icon}</span>
                  <span className="guide-title">{guide.title}</span>
                  <span className="guide-cta">View Steps →</span>
                </button>
              ))}
            </div>
          </section>

          {/* Support assistant chat */}
          <section className="help-section">
            <h2 className="help-section-title">Chat with Our Support Assistant</h2>
            <div className="support-chat">
              <div className="support-chat-messages">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`support-bubble-wrap ${m.from === 'me' ? 'me' : 'bot'}`}>
                    {m.from === 'bot' && <span className="support-bot-avatar"><BotIcon /></span>}
                    <div className={`support-bubble ${m.from === 'me' ? 'me' : 'bot'}`}>{m.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form className="support-chat-input-row" onSubmit={handleChatSend}>
                <input
                  type="text"
                  placeholder="Type your question…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  aria-label="Type your question for the support assistant"
                />
                <button type="submit" className="support-chat-send" aria-label="Send"><SendIcon /></button>
              </form>
            </div>
          </section>

          {/* Contact form */}
          <section className="help-section">
            <h2 className="help-section-title">Send Us a Message</h2>
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <div className="contact-form-grid">
                <label className="contact-field">
                  <span>Your Name</span>
                  <input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} />
                </label>
                <label className="contact-field">
                  <span>Your Email</span>
                  <input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
                <label className="contact-field contact-field-full">
                  <span>Subject</span>
                  <select value={contactForm.subject} onChange={(e) => setContactForm((f) => ({ ...f, subject: e.target.value }))}>
                    <option>General Question</option>
                    <option>Appointment Issue</option>
                    <option>Billing</option>
                    <option>Technical Problem</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="contact-field contact-field-full">
                  <span>Message</span>
                  <textarea rows={4} value={contactForm.message} onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))} />
                </label>
              </div>
              <button type="submit" className="contact-submit-btn"><SendIcon /> Send Message</button>
            </form>
          </section>
        </div>
      </main>

      {activeGuide && (
        <div className="help-modal-backdrop" onClick={() => setActiveGuide(null)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3><span>{activeGuide.icon}</span> {activeGuide.title}</h3>
              <button className="help-modal-close" onClick={() => setActiveGuide(null)} aria-label="Close"><XIcon /></button>
            </div>
            <ol className="guide-steps">
              {activeGuide.steps.map((step, i) => (
                <li key={i}>
                  <span className="guide-step-num">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button className="help-modal-done-btn" onClick={() => setActiveGuide(null)}>Got It</button>
          </div>
        </div>
      )}

      {toast && <div className="help-toast">{toast}</div>}
    </div>
  )
}
