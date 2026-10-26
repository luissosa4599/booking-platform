// Native-only text/icon visibility audit (2026-10-26) — static, no app or
// device needed. Web passes (contrast-audit.cjs) can't catch these: each one
// renders fine on react-native-web and black-on-black on a phone in dark mode.
//
// Walks every .tsx under src/ with the TypeScript compiler and flags:
//   A  <Text>/<TextInput> with no colour of its own and no coloured <Text>
//      ancestor. Native Text does NOT inherit colour from a View (web does,
//      via CSS) — it falls back to black.
//   B  colour only from a prop/style the caller supplies — review only.
//   C  an inline style key that can be `undefined` while the className sets
//      that same property. NativeWind assigns the inline style over the
//      className, undefined included, so the class value is wiped.
//   D  `style` given as a function — NativeWind's native runtime drops it.
//   E  a lucide icon without an explicit `color` (defaults to black).
//   F  a <TextInput> placeholder without placeholderTextColor.
// Elements under a `Platform.OS === "web"` condition are skipped.
//
// Usage, from app/:  node scripts/native-style-audit.cjs
// Exits 1 if anything other than B is found.
const path = require("path");
const ts = require("typescript");

const appDir = path.join(__dirname, "..");

const FONT_SIZE_KEYS = new Set([
  "title-lg", "title-md", "title-sm", "body-emph", "body", "subhead", "footnote",
  "title-screen", "title-master", "profile-name", "stat-number",
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  "center", "left", "right", "justify", "start", "end", "ellipsis", "clip", "wrap", "nowrap",
]);
const PREFIX = /^(dark:|web:|native:|android:|ios:|active:)+/;

function isColorClass(token) {
  const m = /^text-(.+)$/.exec(token.replace(PREFIX, ""));
  if (!m) return false;
  if (FONT_SIZE_KEYS.has(m[1])) return false;
  if (m[1].startsWith("[")) return /^\[(#|rgb|hsl)/.test(m[1]);
  return true;
}

// Which className tokens set a given style property (for check C).
const PROP_CLASS = {
  color: isColorClass,
  backgroundColor: (t) => /^bg-/.test(t.replace(PREFIX, "")),
  borderColor: (t) => /^border-(?!(\d|x|y|t|b|l|r|\[\d|solid|dashed|dotted|none)\b)/.test(t.replace(PREFIX, "")),
  borderWidth: (t) => /^border(-\d|-x|-y|-t|-b|-l|-r)?$/.test(t.replace(PREFIX, "")),
  opacity: (t) => /^opacity-/.test(t.replace(PREFIX, "")),
  width: (t) => /^w-/.test(t.replace(PREFIX, "")),
  height: (t) => /^h-/.test(t.replace(PREFIX, "")),
};
for (const side of ["", "Horizontal", "Vertical", "Top", "Bottom", "Left", "Right"]) {
  PROP_CLASS[`padding${side}`] = (t) => /^p[xytblr]?-/.test(t.replace(PREFIX, ""));
  PROP_CLASS[`margin${side}`] = (t) => /^m[xytblr]?-/.test(t.replace(PREFIX, ""));
}

const configPath = ts.findConfigFile(appDir, ts.sys.fileExists, "tsconfig.json");
const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, appDir);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();

const files = program
  .getSourceFiles()
  .filter((f) => /\/src\/.*\.tsx$/.test(f.fileName.replace(/\\/g, "/")))
  .filter((f) => !/__tests__|__mocks__/.test(f.fileName));

const findings = [];
function report(kind, node, msg) {
  const sf = node.getSourceFile();
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
  findings.push({ kind, file: path.relative(appDir, sf.fileName).replace(/\\/g, "/"), line: line + 1, msg });
}

function resolvedSymbol(node) {
  let sym = checker.getSymbolAtLocation(node);
  if (sym && sym.flags & ts.SymbolFlags.Alias) {
    try { sym = checker.getAliasedSymbol(sym); } catch { /* keep alias */ }
  }
  return sym;
}

function declFile(tagName) {
  const sym = resolvedSymbol(tagName);
  const d = sym && sym.declarations && sym.declarations[0];
  return d ? d.getSourceFile().fileName.replace(/\\/g, "/") : "";
}

function hostKind(opening) {
  const tag = opening.tagName.getText();
  const last = tag.split(".").pop();
  if (last !== "Text" && last !== "TextInput") return null;
  const f = declFile(opening.tagName);
  if (/node_modules\/(react-native|react-native-reanimated)\//.test(f)) return last;
  if (tag.includes(".") && (f === "" || /node_modules\//.test(f))) return last;
  return null;
}

const isIcon = (opening) => /lucide-react-native/.test(declFile(opening.tagName));

function attr(opening, name) {
  return opening.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === name);
}

// className → { tokens, maps, opaque }: literal tokens, the value lists of
// `MAP[key]` lookups into a const object literal, and whether some part
// couldn't be resolved (an identifier/prop).
function classInfo(opening) {
  const a = attr(opening, "className");
  const info = { present: !!a, tokens: [], maps: [], opaque: false };
  if (!a || !a.initializer) return info;
  (function walk(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) info.tokens.push(...n.text.split(/\s+/));
    else if (ts.isTemplateExpression(n)) {
      info.tokens.push(...n.head.text.split(/\s+/));
      n.templateSpans.forEach((s) => { info.tokens.push(...s.literal.text.split(/\s+/)); walk(s.expression); });
    } else if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const d = resolvedSymbol(n.expression)?.valueDeclaration;
      const init = d && ts.isVariableDeclaration(d) ? d.initializer : null;
      const obj = init && ts.isAsExpression(init) ? init.expression : init;
      if (obj && ts.isObjectLiteralExpression(obj)) {
        info.maps.push(
          obj.properties
            .filter(ts.isPropertyAssignment)
            .map((p) => (ts.isStringLiteral(p.initializer) ? p.initializer.text.split(/\s+/) : [])),
        );
      } else info.opaque = true;
    } else if (ts.isIdentifier(n) && n.parent && !ts.isCallExpression(n.parent)) {
      info.opaque = true;
    } else ts.forEachChild(n, walk);
  })(a.initializer);
  info.tokens = info.tokens.filter(Boolean);
  return info;
}

function classSets(info, test) {
  return info.tokens.some(test) || info.maps.some((vals) => vals.length > 0 && vals.every((v) => v.some(test)));
}

function typeIncludesUndefined(t) {
  if (t.flags & ts.TypeFlags.Undefined) return true;
  return t.isUnion() ? t.types.some(typeIncludesUndefined) : false;
}

// "inline" | "maybe" | "none" for the `color` key of a style expression.
function styleColor(expr) {
  if (!expr) return "none";
  if (ts.isParenthesizedExpression(expr)) return styleColor(expr.expression);
  if (ts.isObjectLiteralExpression(expr)) {
    const p = expr.properties.find((q) => q.name && q.name.getText() === "color");
    if (!p) return "none";
    if (ts.isPropertyAssignment(p) && typeIncludesUndefined(checker.getTypeAtLocation(p.initializer))) return "maybe";
    return "inline";
  }
  if (ts.isArrayLiteralExpression(expr)) {
    const r = expr.elements.map(styleColor);
    return r.includes("inline") ? "inline" : r.includes("maybe") ? "maybe" : "none";
  }
  if (ts.isConditionalExpression(expr)) {
    const a = styleColor(expr.whenTrue), b = styleColor(expr.whenFalse);
    return a === "inline" && b === "inline" ? "inline" : a === "none" && b === "none" ? "none" : "maybe";
  }
  if (ts.isBinaryExpression(expr)) {
    const r = [styleColor(expr.left), styleColor(expr.right)];
    return r.includes("inline") || r.includes("maybe") ? "maybe" : "none";
  }
  const t = checker.getTypeAtLocation(expr);
  let found = "none";
  for (const tt of t.isUnion() ? t.types : [t]) {
    for (const c of checker.isArrayType(tt) ? checker.getTypeArguments(tt) : [tt]) {
      for (const x of c.isUnion() ? c.types : [c]) {
        const prop = x.getProperty && x.getProperty("color");
        if (!prop) continue;
        found = prop.flags & ts.SymbolFlags.Optional ? (found === "inline" ? "inline" : "maybe") : "inline";
      }
    }
  }
  return found;
}

function colorOf(opening) {
  const info = classInfo(opening);
  if (classSets(info, isColorClass)) return "class";
  const s = attr(opening, "style");
  const c = s && s.initializer && ts.isJsxExpression(s.initializer) ? styleColor(s.initializer.expression) : "none";
  return c === "none" && info.opaque ? "maybe" : c;
}

const openingOf = (n) => (ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null);

function ancestorTextColored(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p) && !ts.isArrowFunction(p)) break;
    const o = openingOf(p);
    if (o && p !== node && hostKind(o) === "Text") {
      const c = colorOf(o);
      if (c === "class" || c === "inline") return true;
    }
  }
  return false;
}

// A <Text> that only wraps other <Text>s (each with its own colour) paints
// nothing itself.
function onlyWrapsColoredText(n) {
  if (!ts.isJsxElement(n)) return false;
  const isColoredText = (e) => {
    if (!e) return true;
    if (ts.isParenthesizedExpression(e)) return isColoredText(e.expression);
    if (e.kind === ts.SyntaxKind.NullKeyword) return true;
    if (ts.isConditionalExpression(e)) return isColoredText(e.whenTrue) && isColoredText(e.whenFalse);
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return isColoredText(e.right);
    const o = openingOf(e);
    if (!o || hostKind(o) !== "Text") return false;
    const c = colorOf(o);
    return c === "class" || c === "inline";
  };
  return n.children.every((ch) => {
    if (ts.isJsxText(ch)) return ch.text.trim() === "";
    if (ts.isJsxExpression(ch)) return isColoredText(ch.expression);
    return isColoredText(ch);
  });
}

function webOnly(node) {
  for (let p = node.parent; p; p = p.parent) {
    const cond = ts.isConditionalExpression(p) ? p.condition : ts.isBinaryExpression(p) ? p.left : null;
    if (cond && /Platform\.OS\s*===\s*["']web["']/.test(cond.getText())) return true;
    if (ts.isFunctionLike(p) && !ts.isArrowFunction(p)) return false;
  }
  return false;
}

for (const sf of files) {
  (function walk(n) {
    const o = openingOf(n);
    if (o) {
      const tag = o.tagName.getText();
      const kind = hostKind(o);
      const s = attr(o, "style");
      const styleExpr = s && s.initializer && ts.isJsxExpression(s.initializer) ? s.initializer.expression : null;

      if (styleExpr && (ts.isArrowFunction(styleExpr) || ts.isFunctionExpression(styleExpr))) {
        report("D", o, `<${tag}> style is a function`);
      }

      const info = classInfo(o);
      if (info.present && styleExpr) {
        const objs = ts.isObjectLiteralExpression(styleExpr)
          ? [styleExpr]
          : ts.isArrayLiteralExpression(styleExpr) ? styleExpr.elements.filter(ts.isObjectLiteralExpression) : [];
        for (const obj of objs) {
          for (const p of obj.properties) {
            if (!ts.isPropertyAssignment(p)) continue;
            const test = PROP_CLASS[p.name.getText()];
            if (!test || !classSets(info, test)) continue;
            if (typeIncludesUndefined(checker.getTypeAtLocation(p.initializer))) {
              report("C", p, `<${tag}> inline \`${p.name.getText()}\` can be undefined, wiping the className's`);
            }
          }
        }
      }

      if (kind && !webOnly(n)) {
        const c = colorOf(o);
        if (!ancestorTextColored(n) && !onlyWrapsColoredText(n)) {
          if (c === "none") report("A", o, `<${tag}> has no colour of its own (className: "${info.tokens.join(" ")}")`);
          else if (c === "maybe") report("B", o, `<${tag}> colour comes from the caller / may be undefined`);
        }
        if (kind === "TextInput" && attr(o, "placeholder") && !attr(o, "placeholderTextColor")) {
          report("F", o, "<TextInput> placeholder without placeholderTextColor");
        }
      } else if (!kind && isIcon(o) && !attr(o, "color") && !o.attributes.properties.some(ts.isJsxSpreadAttribute)) {
        report("E", o, `icon <${tag}> without color`);
      }
    }
    ts.forEachChild(n, walk);
  })(sf);
}

findings.sort((a, b) => a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file) || a.line - b.line);
const counts = {};
for (const f of findings) counts[f.kind] = (counts[f.kind] || 0) + 1;
console.log(`native-style-audit: ${files.length} files, findings ${JSON.stringify(counts)}`);
for (const f of findings) console.log(`${f.kind} ${f.file}:${f.line}  ${f.msg}`);
process.exitCode = findings.some((f) => f.kind !== "B") ? 1 : 0;
