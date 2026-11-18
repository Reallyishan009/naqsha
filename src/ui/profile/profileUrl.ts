/** Where the demo Card_Profile is served from. Relative to the page, so it works under any base path. */
export function profileUrl(): string {
  return `${import.meta.env.BASE_URL}profiles/demo-12x16.json`;
}
