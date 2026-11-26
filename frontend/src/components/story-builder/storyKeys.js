// Which animated scene set a story uses. The stories come from the database, so they are matched by name; a story
// that is not one of the four (or a step beyond the scenes that exist) keeps its own picture.
import { STORY_SCENES } from '../../games/storyBuilder/storyScenes'

export function storyKeyOf(story) {
  const name = `${story?.story_key || ''} ${story?.level_name || ''} ${story?.short_title || ''}`.toLowerCase()
  if (/riding|\bred\b/.test(name)) return 'red'
  if (/pig/.test(name)) return 'pigs'
  if (/goldi|bears?/.test(name)) return 'goldi'
  if (/tortoise|hare/.test(name)) return 'tort'
  return null
}

export const hasScene = (key, index) => Boolean(key && STORY_SCENES[key]?.[index])
