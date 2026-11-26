/**
 * Turns page references in rich text ("see the LNG page") into story links.
 *
 * `links` maps a phrase to { uuid, full_slug }. Each text node is split
 * around the first case-insensitive match of any phrase, longest phrase
 * first, so "Marine and Cargo Management page" wins over "Marine and Cargo
 * page". Text that already carries a link mark is left alone.
 */
export function linkPageReferences(doc, links) {
  const phrases = Object.keys(links).sort((a, b) => b.length - a.length);
  if (!phrases.length) return doc;
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(phrases.map(escape).join('|'), 'i');
  const target = (match) => links[phrases.find((p) => p.toLowerCase() === match.toLowerCase())];

  const splitText = (node) => {
    const marks = node.marks || [];
    if (marks.some((m) => m.type === 'link')) return [node];
    const m = node.text.match(pattern);
    if (!m) return [node];
    const t = target(m[0]);
    const piece = (text, extra = []) => {
      const all = [...marks, ...extra];
      return text ? [{ type: 'text', text, ...(all.length ? { marks: all } : {}) }] : [];
    };
    const link = { type: 'link', attrs: { href: `/${t.full_slug}`, uuid: t.uuid, anchor: null, target: '_self', linktype: 'story' } };
    return [
      ...piece(node.text.slice(0, m.index)),
      ...piece(m[0], [link]),
      ...splitText({ ...node, text: node.text.slice(m.index + m[0].length) }).filter((n) => n.text),
    ];
  };

  const walk = (node) => {
    if (!node.content) return node;
    return { ...node, content: node.content.flatMap((c) => (c.type === 'text' ? splitText(c) : [walk(c)])) };
  };
  return walk(doc);
}
