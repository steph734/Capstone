import PandaMascot from '../../pages/games/PandaMascot'
import { pickCountOf, pickedChoices } from './storyReducer'

const BASKET_IMAGE = '/games/story-builder/icons/basket.svg'

// One story step: the scene and line on the left, the question and choice
// tiles on the right, and Pao's speech bubble along the bottom.
export default function StoryStep({ story, item, stepIndex, state, bubble, onTap, onRead, onBack }) {
  const picks = state.picks[stepIndex] || []
  const missed = state.wrong[stepIndex] || []
  const pickCount = pickCountOf(item)
  const pickedItems = pickedChoices(item, picks)
  const tilesClass = item.choices?.length > 4 ? 'sb-choices sb-choices--three' : 'sb-choices'

  return (
    <div className="sb-screen">
      <div className="sb-topbar">
        <button type="button" className="sb-btn sb-btn--ghost" style={{ minHeight: 56, fontSize: 18, boxShadow: '0 6px 0 #cbd5e1' }} onClick={onBack}>
          ← Stories
        </button>

        <ol className="sb-tracker" aria-label="Story steps">
          {story.items.map((step, i) => {
            const status = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'upcoming'
            return (
              <li
                key={step.label || i}
                className={`sb-step sb-step--${status}`}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className="sb-step-dot">{status === 'done' ? '✓' : i + 1}</span>
                <span>{step.label}</span>
              </li>
            )
          })}
        </ol>

        <div className="sb-pill" style={{ paddingRight: 8 }}>
          {story.cover_image && <img src={story.cover_image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />}
          {story.short_title || story.level_name}
        </div>
      </div>

      <div className="sb-body">
        <section className="sb-scene-card" aria-label="Story scene">
          <img className="sb-scene" src={item.image_url} alt={item.label || ''} />
          <p className="sb-story-line">{item.text}</p>

          {pickCount > 1 && (
            <div className="sb-basket">
              <img src={BASKET_IMAGE} alt="" />
              {Array.from({ length: pickCount }, (_, i) => {
                const filled = pickedItems[i]
                return (
                  <span key={i} className={`sb-slot${filled ? ' sb-slot--filled' : ''}`}>
                    {filled ? filled.label : 'Empty'}
                  </span>
                )
              })}
            </div>
          )}

          <button type="button" className="sb-btn sb-btn--green" onClick={onRead}>
            🔊 Read to me
          </button>
        </section>

        <section className="sb-question-col" aria-label="Choose what happens next">
          <h2 className="sb-question">{item.question}</h2>
          <div className={tilesClass}>
            {(item.choices || []).map((choice) => {
              const isPicked = picks.includes(choice.choice_key)
              const isMissed = missed.includes(choice.choice_key)
              const disabled = isMissed || state.stepDone || (isPicked && pickCount === 1)
              return (
                <button
                  key={choice.choice_key}
                  type="button"
                  className={`sb-tile-choice${isMissed ? ' sb-tile-choice--wrong' : ''}`}
                  aria-pressed={isPicked}
                  disabled={disabled}
                  onClick={() => onTap(choice)}
                >
                  {isPicked && <span className="sb-check" aria-hidden="true">✓</span>}
                  <img src={choice.image_url} alt={choice.label} />
                  <span className="sb-tile-label">{choice.label}</span>
                  {choice.sub && <span className="sb-tile-sub">{choice.sub}</span>}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="sb-pao">
        <PandaMascot entered={true} mouthOpen={false} pandaState={bubble.tone === 'gentle' ? 'normal' : 'happy'} pxWidth={92} />
        <div
          className={`sb-bubble${bubble.tone === 'good' ? ' sb-bubble--good' : bubble.tone === 'gentle' ? ' sb-bubble--gentle' : ''}`}
          aria-live="polite"
        >
          {bubble.text}
        </div>
      </div>
    </div>
  )
}
