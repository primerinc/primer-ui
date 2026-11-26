/**
 * Figma plugin API script: exports a file's local variables and text styles
 * in the shape tokens/figma-to-theme.js reads (tokens/figma/variables.json).
 *
 * Run it through the Figma MCP's use_figma tool (load the figma-use skill
 * first) against the client's design-system file. It only READS the file.
 * It returns the JSON; save the result as tokens/figma/variables.json and
 * commit it, so every token change shows up as a reviewable diff.
 *
 * Shape:
 *   { source: { fileKey, file, exported },
 *     variables: [{ collection, name, type, value | alias, hidden }],
 *     textStyles: [{ name, family, style, size, lineHeight, letterSpacing, textCase, bound }] }
 * Values come from each collection's default mode. Colours are #rrggbb (or
 * #rrggbbaa when not opaque). An alias stores the target variable's name.
 * Collection names are lower-cased ("Primitives" → "primitives").
 */
const hex = ({ r, g, b, a = 1 }) => {
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a) : ''}`;
};

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const byId = new Map();
for (const v of await figma.variables.getLocalVariablesAsync()) byId.set(v.id, v);

const variables = [];
for (const c of collections) {
  for (const id of c.variableIds) {
    const v = byId.get(id) ?? (await figma.variables.getVariableByIdAsync(id));
    if (!v) continue;
    const raw = v.valuesByMode[c.defaultModeId];
    const entry = { collection: c.name.toLowerCase(), name: v.name, type: v.resolvedType, hidden: !!v.hiddenFromPublishing };
    if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') {
      const target = byId.get(raw.id) ?? (await figma.variables.getVariableByIdAsync(raw.id));
      entry.alias = target?.name ?? raw.id;
    } else if (v.resolvedType === 'COLOR') {
      entry.value = hex(raw);
    } else {
      entry.value = raw;
    }
    variables.push(entry);
  }
}

const nameOf = async (alias) => (alias?.id ? (byId.get(alias.id) ?? (await figma.variables.getVariableByIdAsync(alias.id)))?.name : undefined);
const textStyles = [];
for (const s of await figma.getLocalTextStylesAsync()) {
  const bound = {};
  for (const [prop, alias] of Object.entries(s.boundVariables ?? {})) bound[prop] = await nameOf(alias);
  textStyles.push({
    name: s.name,
    family: s.fontName.family,
    style: s.fontName.style,
    size: s.fontSize,
    lineHeight: s.lineHeight.unit === 'AUTO' ? { unit: 'AUTO' } : { unit: s.lineHeight.unit, value: s.lineHeight.value },
    letterSpacing: { unit: s.letterSpacing.unit, value: s.letterSpacing.value },
    textCase: s.textCase,
    bound,
  });
}

return {
  source: { fileKey: figma.fileKey, file: figma.root.name, exported: new Date().toISOString().slice(0, 10) },
  variables,
  textStyles,
};
