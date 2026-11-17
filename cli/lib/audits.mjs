// Audit prefilters: cheap text scans that flag files for one focused model pass. They aim for
// recall on the flagged set, not precision; the audit skill's model pass judges each flag.
// Each scanner takes [{ path, text }] and the audits config, and returns [{ path, line?, note }].

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Strip // and block comments so issue numbers and prose in comments don't flag. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

const isTsx = (p) => p.endsWith('.tsx') || p.endsWith('.jsx');

export function stateMachines(files) {
  const out = [];
  const compared = new Map(); // identifier -> { literals:Set, files:Set }
  for (const { path, text } of files) {
    const code = stripComments(text);
    const bools = [...code.matchAll(/useState(?:<boolean>)?\(\s*(?:true|false)\s*\)/g)];
    if (bools.length >= 3) {
      out.push({ path, line: lineOf(code, bools[0].index), note: `${bools.length} boolean useState flags in one file; check for impossible combinations (a hidden state machine)` });
    }
    for (const m of code.matchAll(/\b([\w.]*?(?:status|state|phase|mode|step|stage|kind))\s*[!=]==?\s*['"]([\w-]+)['"]/gi)) {
      const id = m[1].split('.').pop();
      if (!compared.has(id)) compared.set(id, { literals: new Set(), files: new Set() });
      const e = compared.get(id);
      e.literals.add(m[2]);
      e.files.add(path);
    }
  }
  for (const [id, e] of compared) {
    if (e.literals.size >= 3 && e.files.size >= 2) {
      out.push({ path: [...e.files].slice(0, 4).join(', '), note: `\`${id}\` compared against ${e.literals.size} string values across ${e.files.size} files (${[...e.literals].slice(0, 5).join(', ')}); consider one union type and one transition function` });
    }
  }
  return out;
}

const HEX = /['"`(\s:,]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])/g;
const FN_COLOR = /\b(?:rgba?|hsla?|oklch|oklab)\(/g;
const PX = /['"`\s:(]-?\d+(?:\.\d+)?px\b/g;

export function styleDrift(files, cfg, allFiles = files) {
  const out = [];
  const tokenFiles = new Set(cfg.tokenFiles ?? []);
  for (const { path, text } of files) {
    if (tokenFiles.has(path)) continue;
    const code = stripComments(text);
    const hits = [...code.matchAll(HEX), ...code.matchAll(FN_COLOR)];
    // A hex that is all digits is far more likely an issue number than a colour.
    const colours = hits.filter((m) => /[a-fA-F]/.test(m[0]) || !m[0].includes('#'));
    if (colours.length) out.push({ path, line: lineOf(code, colours[0].index), note: `${colours.length} colour literal(s) outside the token files (first: ${colours[0][0].trim()})` });
    // Hairlines (0-2px) are normal in CSS; larger sizes should come from the scale.
    const px = [...code.matchAll(PX)].filter((m) => Math.abs(parseFloat(m[0].replace(/^[^-\d]/, ''))) > 2);
    if (px.length >= 3) out.push({ path, line: lineOf(code, px[0].index), note: `${px.length} px literals; sizes should come from tokens` });
  }
  // Tokens nothing references.
  const others = allFiles.filter((f) => !tokenFiles.has(f.path)).map((f) => f.text).join('\n');
  for (const tf of allFiles.filter((f) => tokenFiles.has(f.path))) {
    const keys = [...new Set([...tf.text.matchAll(/^\s*['"]?([A-Za-z_][\w-]*)['"]?\s*:/gm)].map((m) => m[1]))];
    // Used as a property (.key), a string ('key') or a CSS custom property (var(--key)).
    const unused = keys.filter((k) => !new RegExp(`(?:\\.|['"\`]|--)${k.replace(/-/g, '\\-')}(?![\\w-])`).test(others));
    if (unused.length) out.push({ path: tf.path, note: `${unused.length} token key(s) referenced nowhere else: ${unused.slice(0, 10).join(', ')}${unused.length > 10 ? ', …' : ''} (keys used only inside the token file count as unused)` });
  }
  return out;
}

export function reactComposition(files, cfg) {
  const out = [];
  const max = cfg.componentMaxLines ?? 250;
  for (const { path, text } of files) {
    if (!isTsx(path)) continue;
    const lines = text.split('\n').length;
    if (lines > max) out.push({ path, note: `${lines} lines (limit ${max}); look for components to split` });
    const code = stripComments(text);
    for (const m of code.matchAll(/useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[/g)) {
      const stmts = m[1].split('\n').map((l) => l.trim()).filter(Boolean);
      if (stmts.length && stmts.every((s) => /^set[A-Z]\w*\(.*\);?$/.test(s))) {
        out.push({ path, line: lineOf(code, m.index), note: 'useEffect only sets state; derive the value during render (or useMemo) instead' });
      }
    }
    for (const m of code.matchAll(/function\s+([A-Z]\w*)\s*\(\s*\{([^}]*)\}/g)) {
      const props = m[2].split(',').map((s) => s.trim()).filter(Boolean);
      if (props.length >= 10) out.push({ path, line: lineOf(code, m.index), note: `${m[1]} takes ${props.length} props; check for prop drilling or a missing composition seam` });
    }
  }
  return out;
}

// RFC 2606 / 6761 reserved names never leave the machine.
const RESERVED_HOST = /(^|\.)(example|test|invalid|localhost)$|(^|\.)example\.(com|org|net)$/;

const BUILTIN_ENV =new Set(['NODE_ENV', 'CI', 'PATH', 'HOME', 'TZ', 'PORT', 'DEV', 'PROD', 'MODE', 'SSR', 'BASE_URL', 'VITEST']);

export function privacy(files, cfg, envExampleText = '') {
  const out = [];
  const allowed = new Set(cfg.allowedHosts ?? []);
  const declared = new Set([...envExampleText.matchAll(/^\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
  const hosts = new Map();
  const missingEnv = new Map();
  for (const { path, text } of files) {
    const code = stripComments(text);
    for (const m of code.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const host = m[1].toLowerCase();
      if (allowed.has(host) || RESERVED_HOST.test(host)) continue;
      if (!hosts.has(host)) hosts.set(host, []);
      hosts.get(host).push(`${path}:${lineOf(code, m.index)}`);
    }
    for (const m of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]|import\.meta\.env\.([A-Z][A-Z0-9_]*)/g)) {
      const name = m[1] ?? m[2] ?? m[3];
      if (declared.has(name) || BUILTIN_ENV.has(name)) continue;
      if (!missingEnv.has(name)) missingEnv.set(name, []);
      missingEnv.get(name).push(`${path}:${lineOf(code, m.index)}`);
    }
  }
  for (const [host, refs] of hosts) out.push({ path: refs.slice(0, 3).join(', '), note: `outbound host ${host} (not in audits.allowedHosts): does it receive user data? does it follow the polite-fetching rule?` });
  for (const [name, refs] of missingEnv) out.push({ path: refs.slice(0, 3).join(', '), note: `env var ${name} is read but not listed in ${cfg.envExample}` });
  return out;
}

export function docsDrift(files, cfg, specText = '') {
  const out = [];
  if (!specText || !cfg.specDoc) return out;
  const sections = new Set([...specText.matchAll(/^#{2,3}\s+(\d+)\./gm)].map((m) => m[1]));
  // In prose, § also cites statutes ("5 U.S.C. §552"); count it only on a line naming the doc.
  const docName = new RegExp(cfg.specDoc.split('/').pop().replace(/\.[^.]+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  for (const { path, text } of files) {
    if (path === cfg.specDoc) continue;
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (path.endsWith('.md') && !docName.test(l)) return;
      for (const m of l.matchAll(/§\s?(\d{1,2})(?!\d)/g)) {
        if (!sections.has(m[1])) out.push({ path, line: i + 1, note: `refers to §${m[1]}, which ${cfg.specDoc} doesn't have` });
      }
    });
  }
  return out;
}

export const AUDITS = {
  'state-machines': { scan: (ctx) => stateMachines(ctx.files), focus: 'Is each flagged set of flags or status strings an implicit state machine? If so, name the states and transitions, and whether an impossible combination is reachable.' },
  'style-drift': { scan: (ctx) => styleDrift(ctx.files, ctx.cfg, ctx.files), focus: 'Does each literal bypass the theme (it should come from a token), and is each unused token truly orphaned?' },
  'react-composition': { scan: (ctx) => reactComposition(ctx.files, ctx.cfg), focus: 'Where would splitting, composition (children/slots) or derived state make the component simpler? Only flag changes worth their diff.' },
  privacy: { scan: (ctx) => privacy(ctx.files, ctx.cfg, ctx.envExample), focus: 'Does any flagged host receive user data or get fetched faster than the polite-fetching rule allows? Is every read env var documented? Also check that every API route is behind the auth guard.' },
  'docs-drift': { scan: (ctx) => docsDrift(ctx.files, ctx.cfg, ctx.spec), focus: 'For each stale reference, which section is meant, and does the code still match that section?' },
};
