import { useParams, useNavigate } from 'react-router-dom'
import './TherapyDetail.css'

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export default function TherapyDetail() {
  const { category } = useParams()
  const navigate = useNavigate()

  const therapyData = {
    occupational: {
      title: 'Occupational Therapy',
      color: '#5a9eff',
      icon: '🤝',
      description: 'Improve daily living skills and independence',
      exercises: [
        { name: 'Button Fastening Practice', duration: '10 min', completed: true },
        { name: 'Handwriting Exercises', duration: '15 min', completed: true },
        { name: 'Fine Motor Skill Games', duration: '20 min', completed: false },
        { name: 'Dressing Practice', duration: '10 min', completed: false }
      ],
      milestones: [
        { text: 'Self-feeding mastered', achieved: true, date: 'June 15, 2026' },
        { text: 'Dressing independently', achieved: true, date: 'June 20, 2026' },
        { text: 'Writing full name', achieved: false, target: 'July 5, 2026' }
      ]
    },
    speech: {
      title: 'Speech Therapy',
      color: '#4ade80',
      icon: '💬',
      description: 'Support speech and language development',
      exercises: [
        { name: 'Articulation Drills', duration: '15 min', completed: true },
        { name: 'Reading Aloud Practice', duration: '20 min', completed: false },
        { name: 'Pronunciation Exercises', duration: '10 min', completed: false },
        { name: 'Conversation Practice', duration: '15 min', completed: true }
      ],
      milestones: [
        { text: 'Clear consonant sounds', achieved: true, date: 'June 10, 2026' },
        { text: 'Full sentence communication', achieved: true, date: 'June 22, 2026' },
        { text: 'Complex sentence structure', achieved: false, target: 'July 10, 2026' }
      ]
    },
    physical: {
      title: 'Physical Therapy',
      color: '#fb923c',
      icon: '💪',
      description: 'Improve movement, strength, and mobility',
      exercises: [
        { name: 'Leg Stretches', duration: '10 min', completed: true },
        { name: 'Balance Exercises', duration: '15 min', completed: false },
        { name: 'Core Strengthening', duration: '15 min', completed: false },
        { name: 'Walking Practice', duration: '20 min', completed: true }
      ],
      milestones: [
        { text: 'Walking 50m unassisted', achieved: true, date: 'June 18, 2026' },
        { text: 'Climbing stairs independently', achieved: false, target: 'July 8, 2026' },
        { text: 'Running for 2 minutes', achieved: false, target: 'July 20, 2026' }
      ]
    },
    cognitive: {
      title: 'Cognitive Therapy',
      color: '#fbbf24',
      icon: '🧠',
      description: 'Enhance thinking, learning, and memory',
      exercises: [
        { name: 'Memory Card Games', duration: '15 min', completed: true },
        { name: 'Puzzle Solving', duration: '20 min', completed: true },
        { name: 'Pattern Recognition', duration: '10 min', completed: false },
        { name: 'Sequencing Activities', duration: '15 min', completed: false }
      ],
      milestones: [
        { text: 'Remembering daily routines', achieved: true, date: 'June 12, 2026' },
        { text: 'Following multi-step instructions', achieved: false, target: 'July 3, 2026' },
        { text: 'Problem-solving independently', achieved: false, target: 'July 15, 2026' }
      ]
    }
  }

  const therapy = therapyData[category]

  if (!therapy) {
    return (
      <div className="therapy-detail-page">
        <div className="therapy-not-found">
          <h1>Therapy Category Not Found</h1>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  const completedExercises = therapy.exercises.filter(e => e.completed).length
  const completionRate = Math.round((completedExercises / therapy.exercises.length) * 100)

  return (
    <div className="therapy-detail-page">
      <header className="therapy-header" style={{ background: `linear-gradient(135deg, ${therapy.color}20 0%, ${therapy.color}40 100%)` }}>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          <BackIcon />
        </button>
        <div className="therapy-header-content">
          <span className="therapy-icon">{therapy.icon}</span>
          <h1 className="therapy-title">{therapy.title}</h1>
          <p className="therapy-description">{therapy.description}</p>
        </div>
      </header>

      <main className="therapy-content">
        {/* Progress Overview */}
        <div className="progress-card">
          <h2>Today's Progress</h2>
          <div className="progress-stats">
            <div className="stat">
              <span className="stat-value">{completedExercises}/{therapy.exercises.length}</span>
              <span className="stat-label">Exercises Complete</span>
            </div>
            <div className="stat">
              <span className="stat-value">{completionRate}%</span>
              <span className="stat-label">Completion Rate</span>
            </div>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${completionRate}%`, background: therapy.color }}
            />
          </div>
        </div>

        {/* Exercise List */}
        <section className="exercises-section">
          <h2>Today's Exercises</h2>
          <div className="exercise-cards">
            {therapy.exercises.map((exercise, index) => (
              <div key={index} className={`exercise-card ${exercise.completed ? 'completed' : ''}`}>
                <div className="exercise-checkbox">
                  {exercise.completed && <span>✓</span>}
                </div>
                <div className="exercise-info">
                  <h3>{exercise.name}</h3>
                  <p>{exercise.duration}</p>
                </div>
                <span className={`exercise-status ${exercise.completed ? 'done' : 'pending'}`}>
                  {exercise.completed ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Milestones */}
        <section className="milestones-section">
          <h2>Milestones</h2>
          <div className="milestone-cards">
            {therapy.milestones.map((milestone, index) => (
              <div key={index} className={`milestone-card ${milestone.achieved ? 'achieved' : ''}`}>
                <div className="milestone-icon">
                  {milestone.achieved ? '🏆' : '🎯'}
                </div>
                <div className="milestone-content">
                  <h3>{milestone.text}</h3>
                  <p>
                    {milestone.achieved 
                      ? `Achieved on ${milestone.date}` 
                      : `Target: ${milestone.target}`
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="action-btn primary">Start Session</button>
          <button className="action-btn secondary">Schedule Appointment</button>
        </div>
      </main>
    </div>
  )
}
