import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './PatientSidebar.css'

// SVG Icons
function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  )
}

function AppointmentsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
    </svg>
  )
}

function NotesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

function MessagesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
    </svg>
  )
}

function SubscriptionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
    </svg>
  )
}

const DEFAULT_MENU_ITEMS = [
  { id: 'home', label: 'Home', icon: <HomeIcon />, path: '/dashboard' },
  { id: 'appointments', label: 'Appointments', icon: <AppointmentsIcon />, path: '/appointments' },
  { id: 'notes', label: 'Notes', icon: <NotesIcon />, path: '/notes' },
  { id: 'messages', label: 'Messages', icon: <MessagesIcon />, path: '/messages' },
  { id: 'subscription', label: 'Subscription', icon: <SubscriptionIcon />, path: '/subscription' },
]

const DEFAULT_BOTTOM_MENU_ITEMS = [
  { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  { id: 'help', label: 'Help & Support', icon: <HelpIcon />, path: '/help' },
]

export default function PatientSidebar({
  user,
  onLogout,
  isOpen,
  onClose,
  menuItems = DEFAULT_MENU_ITEMS,
  bottomMenuItems = DEFAULT_BOTTOM_MENU_ITEMS,
  profileRoleLabel,
  profileName,
  profileAvatar,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeItem, setActiveItem] = useState('home')

  const handleNavigation = (path, item) => {
    setActiveItem(item)
    navigate(path)
    if (onClose) onClose() // Close sidebar on mobile after navigation
  }

  const handleLogout = () => {
    if (onLogout) onLogout()
    navigate('/')
  }

  const resolvedProfileName = profileName || user?.name || 'Maria Santos'
  const resolvedProfileRole = profileRoleLabel || user?.role || 'Parent'
  const resolvedAvatar = profileAvatar || user?.avatar || '/therapy-pro-logo.png'

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      
      <aside className={`patient-sidebar ${isOpen ? 'open' : ''}`}>
        {/* User Profile Section */}
        <div className="sidebar-profile">
          <div className="profile-avatar">
            <img 
              src={resolvedAvatar} 
              alt={resolvedProfileName} 
            />
          </div>
          <div className="profile-info">
            <h3 className="profile-name">{resolvedProfileName}</h3>
            <p className="profile-role">{resolvedProfileRole}</p>
          </div>
          <button className="view-profile-btn">View Profile</button>
        </div>

        {/* Main Navigation */}
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeItem === item.id || location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path, item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Navigation */}
        <nav className="sidebar-nav-bottom">
          {bottomMenuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeItem === item.id || location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path, item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}

          {/* Logout Button */}
          <button className="nav-item logout-item" onClick={handleLogout}>
            <span className="nav-icon">
              <LogoutIcon />
            </span>
            <span className="nav-label">Logout</span>
          </button>
        </nav>
      </aside>
    </>
  )
}
