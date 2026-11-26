// Renders one animated story scene. Loops about every 6 seconds. Honors prefers-reduced-motion (CSS inside STORY_CSS).
import React from 'react';
import { STORY_CSS, STORY_SCENES } from './storyScenes';

let cssInjected = false;
function useStoryCss() {
  React.useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.setAttribute('data-story-scene-css', '');
    el.textContent = STORY_CSS;
    document.head.appendChild(el);
    cssInjected = true;
  }, []);
}

// props: story ('red' | 'pigs' | 'goldi' | 'tort', default 'red'), index (0-8 for red, 0-6 for the others), paused (boolean), label (aria-label), className, style
export default function StoryScene({ story = 'red', index = 0, paused = false, label = 'Story scene', className = '', style }) {
  useStoryCss();
  return (
    <svg
      className={`sb ${className}`}
      viewBox="0 0 480 300"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
      style={{ display: 'block', ...(paused ? { animationPlayState: 'paused' } : {}), ...style }}
      // key forces a restart of the animations when the step changes
      key={story + index}
      dangerouslySetInnerHTML={{ __html: (STORY_SCENES[story] || STORY_SCENES.red)[index] || '' }}
    />
  );
}
// To pause all animations (Pause button or dialogs), add class "paused" to a parent and this CSS to the game stylesheet:
// .paused .sb * { animation-play-state: paused !important; }
