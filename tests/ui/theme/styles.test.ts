import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = path.resolve(import.meta.dirname, '../../../src/ui');
const SCREEN_FOLDERS = ['weave', 'keep', 'scan', 'code'];

/** Every file under `dir` whose name ends with one of the endings, as a path relative to src/ui. */
function filesUnder(dir: string, endings: string[]): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full, endings));
    else if (endings.some((ending) => name.endsWith(ending))) found.push(path.relative(UI, full));
  }
  return found;
}
function read(relative: string): string {
  return readFileSync(path.join(UI, relative), 'utf8');
}
const MODULES = filesUnder(UI, ['.module.css']);
const COMPONENT_SOURCES = filesUnder(UI, ['.tsx']);
const SCREEN_MODULES = MODULES.filter((file) => SCREEN_FOLDERS.some((folder) => file.startsWith(`screens/${folder}/`)));

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}
/** Block comments and line comments; a `//` counts only at the start of a line or after a space, so `https://` stays. */
function stripSourceComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

type Declaration = { file: string; selector: string; property: string; value: string };
type Rule = { selector: string; body: string };

function rulesOf(css: string): Rule[] {
  return [...stripCssComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.trim(),
    body: m[2]!,
  }));
}
/** Splits a declaration block at `;`, never inside brackets or quotes. */
function splitDeclarations(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]!;
    if (quote !== '') {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ';' && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}
function declarationsOf(file: string, css: string): Declaration[] {
  return rulesOf(css).flatMap((rule) =>
    splitDeclarations(rule.body).flatMap((text) => {
      const colon = text.indexOf(':');
      if (colon < 0) return [];
      return [
        {
          file,
          selector: rule.selector,
          property: text.slice(0, colon).trim().toLowerCase(),
          value: text.slice(colon + 1).replace(/\s*!important\s*$/i, '').trim(),
        },
      ];
    }),
  );
}
const DECLARATIONS = MODULES.flatMap((file) => declarationsOf(file, read(file)));
function where(declaration: Declaration): string {
  return `${declaration.file}: ${declaration.selector} { ${declaration.property}: ${declaration.value} }`;
}
/** Splits at commas that are not inside brackets. */
function topLevelItems(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      items.push(value.slice(start, index));
      start = index + 1;
    }
  }
  items.push(value.slice(start));
  return items.map((item) => item.trim());
}
/** The text inside each `calc(` ... `)`, outermost only. */
function calcBodies(value: string): string[] {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const open = value.indexOf('calc(', from);
    if (open < 0) return bodies;
    let depth = 0;
    let end = open + 4;
    for (; end < value.length; end += 1) {
      if (value[end] === '(') depth += 1;
      else if (value[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(value.slice(open + 5, end));
    from = end + 1;
  }
}
const MOTION_VAR = /var\(--motion-[a-z-]+\)/g;
const TIME_LITERAL = /(?<![\w-])\d*\.?\d+m?s\b/;

const NAMED_COLOURS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue ' +
    'lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
    'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange ' +
    'orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna ' +
    'silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet ' +
    'wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
/** Colour literals that are not a palette colour: no paint at all, and the colour of the surrounding text. */
const NEUTRAL_KEYWORDS = new Set(['transparent', 'currentcolor']);
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const HEX_COLOUR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/i;
/** The properties whose value can hold a colour keyword; a keyword is looked for only in these, so `ease` or `solid` is never mistaken for one. */
const COLOUR_PROPERTY =
  /^(?:color|background(?:-[a-z-]+)?|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|fill|stroke|box-shadow|text-shadow|text-decoration(?:-[a-z-]+)?|caret-color|accent-color|column-rule(?:-[a-z-]+)?|scrollbar-color|stop-color|flood-color|filter)$/;
function stripQuotedText(value: string): string {
  return value.replace(/"[^"]*"|'[^']*'/g, '""');
}

/** Emoji: Extended_Pictographic (which includes the copyright and trade mark signs), the emoji variation selector and the keycap mark. */
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}]/u;

describe('the style sheets and component sources', () => {
  it('finds the style sheets and the four Screen modules it checks', () => {
    expect(MODULES.length).toBeGreaterThan(10);
    expect(COMPONENT_SOURCES.length).toBeGreaterThan(10);
    for (const folder of SCREEN_FOLDERS) {
      expect(
        SCREEN_MODULES.some((file) => file.startsWith(`screens/${folder}/`)),
        `a module under screens/${folder}`,
      ).toBe(true);
    }
  });

  it('R3.13 no CSS Module has a gradient function, a backdrop-filter property or a blur function', () => {
    for (const file of MODULES) {
      const css = stripCssComments(read(file));
      expect(css, `${file} gradient(`).not.toMatch(/gradient\(/i);
      expect(css, `${file} backdrop-filter`).not.toMatch(/backdrop-filter/i);
      expect(css, `${file} blur(`).not.toMatch(/blur\(/i);
    }
  });

  it('R14.8 R3.13 no component or illustration source has a gradient, a filter element, a backdrop-filter or a blur', () => {
    for (const file of COMPONENT_SOURCES) {
      const source = stripSourceComments(read(file));
      expect(source, `${file} gradient`).not.toMatch(/gradient/i);
      expect(source, `${file} <filter`).not.toMatch(/<filter\b/);
      expect(source, `${file} filter attribute`).not.toMatch(/\bfilter\s*=/);
      expect(source, `${file} backdrop-filter`).not.toMatch(/backdrop-?filter/i);
      expect(source, `${file} blur(`).not.toMatch(/blur\(/i);
    }
  });

  it('R3.6 every box-shadow, text-shadow and drop-shadow( value in a CSS Module is var(--shadow-card)', () => {
    for (const declaration of DECLARATIONS) {
      if (declaration.property === 'box-shadow' || declaration.property === 'text-shadow') {
        expect(declaration.value, where(declaration)).toBe('var(--shadow-card)');
      }
      for (const drop of declaration.value.matchAll(/drop-shadow\(/g)) {
        const inside = declaration.value.slice(drop.index! + drop[0].length);
        expect(inside.startsWith('var(--shadow-card))'), where(declaration)).toBe(true);
      }
    }
  });

  it('R3.6 no component source sets a shadow of its own', () => {
    for (const file of COMPONENT_SOURCES) {
      const source = stripSourceComments(read(file));
      expect(source, `${file} shadow`).not.toMatch(/box-?shadow|text-?shadow|drop-shadow/i);
    }
  });

  it('R3.8 every transition and animation duration is var(--motion-*) or a calc() of such variables and bare numbers', () => {
    const timed = DECLARATIONS.filter((declaration) => /^(?:transition|animation)(?:-[a-z-]+)?$/.test(declaration.property));
    expect(timed.length, 'at least one transition or animation to check').toBeGreaterThan(0);
    for (const declaration of timed) {
      const label = where(declaration);
      const { property, value } = declaration;
      for (const body of calcBodies(value)) {
        const operands = body.replace(MOTION_VAR, ' ');
        expect(operands, `${label}: calc() holds only motion variables and bare numbers`).toMatch(/^[\d\s.*/+()-]*$/);
        expect(body, `${label}: calc() uses a motion variable`).toMatch(MOTION_VAR);
      }
      const withoutCalc = value.replace(/calc\((?:[^()]|\([^()]*\))*\)/g, ' ');
      expect(withoutCalc.replace(MOTION_VAR, ' '), `${label}: no duration written as a number of seconds or milliseconds`).not.toMatch(
        TIME_LITERAL,
      );
      if (/-(?:duration|delay)$/.test(property)) {
        for (const item of topLevelItems(value)) {
          expect(item.replace(/calc\((?:[^()]|\([^()]*\))*\)/g, 'var(--motion-x)'), label).toMatch(/^(?:0|var\(--motion-[a-z-]+\))$/);
        }
      } else if (property === 'transition' || property === 'animation') {
        for (const item of topLevelItems(value)) {
          if (/^(?:none|initial|inherit|unset|revert)$/i.test(item)) continue;
          expect(item, `${label}: every item names a duration`).toMatch(/var\(--motion-[a-z-]+\)/);
        }
      }
    }
  });

  it('R4.10 no CSS Module has a colour literal (hexadecimal, rgb(), hsl() or colour keyword); only tokens.css does', () => {
    for (const declaration of DECLARATIONS) {
      const value = stripQuotedText(declaration.value);
      expect(value, where(declaration)).not.toMatch(HEX_COLOUR);
      expect(value, where(declaration)).not.toMatch(COLOUR_FUNCTION);
      if (!COLOUR_PROPERTY.test(declaration.property)) continue;
      const words = value.replace(/var\([^)]*\)/g, ' ').toLowerCase().match(/[a-z]+/g) ?? [];
      for (const word of words) {
        expect(NAMED_COLOURS.has(word) && !NEUTRAL_KEYWORDS.has(word), `${where(declaration)} uses the colour keyword ${word}`).toBe(false);
      }
    }
  });

  it('R4.10 R14.4 no component source has a colour literal; fill, stroke and colour come from tokens or currentColor', () => {
    for (const file of COMPONENT_SOURCES) {
      const source = stripSourceComments(read(file));
      expect(source, `${file} hexadecimal colour`).not.toMatch(HEX_COLOUR);
      expect(source, `${file} colour function`).not.toMatch(COLOUR_FUNCTION);
      const attribute = /\b(?:fill|stroke|stopColor|floodColor|color|background|backgroundColor|borderColor|outlineColor)\s*[=:]\s*\{?\s*(['"])([^'"]*)\1/g;
      for (const match of source.matchAll(attribute)) {
        const word = match[2]!.trim().toLowerCase();
        expect(NAMED_COLOURS.has(word), `${file}: ${match[0]} uses a colour keyword`).toBe(false);
      }
    }
  });

  it('R7.6 R14.8 no emoji in any source, style sheet or message under src/ui', () => {
    const files = filesUnder(UI, ['.ts', '.tsx', '.css', '.json']);
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const found = [...read(file)].filter((char) => EMOJI.test(char));
      expect(found, `${file} holds an emoji`).toEqual([]);
    }
  });

  it('R6.6 no button selector or button class in the four Screen modules sets text colour, background, border or border radius', () => {
    const colourOrShape = /^(?:color|background(?:-[a-z-]+)?|border(?:-[a-z-]+)?)$/;
    const checked = DECLARATIONS.filter((declaration) => SCREEN_MODULES.includes(declaration.file));
    expect(checked.length).toBeGreaterThan(20);
    for (const declaration of checked) {
      if (!colourOrShape.test(declaration.property)) continue;
      for (const selector of topLevelItems(declaration.selector)) {
        // The element or class the declaration lands on is the last compound selector (`.marker .shape` styles `.shape`).
        const subject = selector.split(/[\s>+~]+/).filter((part) => part !== '').pop() ?? '';
        const targetsButton = /(?:^|[^.#\w-])button\b/.test(subject) || /\.[\w-]*button[\w-]*/i.test(subject);
        expect(targetsButton, `a button takes ${declaration.property} from a Screen module: ${where(declaration)}`).toBe(false);
      }
    }
  });
});
