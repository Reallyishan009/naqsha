/*
 * Sets data-theme on the root element before the first paint (R4.12). It is a file of its own, loaded as a classic
 * blocking script before the stylesheet, so the page can send a Content-Security-Policy with script-src 'self'
 * and no inline script. The logic is the one the inline script of index.html had: a stored day or night wins,
 * else the colour-scheme preference, else day; it never throws.
 */
(function () {
  var theme = null;
  try { var stored = localStorage.getItem('naqsha.theme'); if (stored === 'day' || stored === 'night') theme = stored; } catch (e) {}
  if (theme === null) { try { theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'; } catch (e) { theme = 'day'; } }
  document.documentElement.setAttribute('data-theme', theme);
})();
