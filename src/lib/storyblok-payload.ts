/**
 * getPayload() (from @storyblok/astro's live-preview middleware) returns
 * whatever story the Storyblok bridge currently has open in the editor —
 * pushed via a POST the middleware intercepts, independent of which URL the
 * preview iframe is actually showing. Opening a non-page singleton story
 * (config) directly in the Visual Editor hands index.astro/[...slug].astro a
 * payload whose content.component isn't a real page, which used to crash
 * StoryblokComponent's resolver. Route files should discard the payload and
 * fall back to fetching the real story for the URL when this returns false.
 */
const PAGE_CONTENT_TYPES = ['page', 'resource', 'campaign_page'];

export function isPageStory(story: { content?: { component?: string } } | undefined): boolean {
  return !!story?.content?.component && PAGE_CONTENT_TYPES.includes(story.content.component);
}
