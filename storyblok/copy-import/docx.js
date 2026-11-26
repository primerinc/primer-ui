/**
 * Reads a .docx (a zip) without a dependency: finds word/document.xml through
 * the zip's central directory, inflates it with node:zlib, and returns its
 * paragraphs as { style, text } in document order.
 *
 * Soft line breaks (Shift+Enter in Google Docs, <w:br/>) come back as "\n"
 * inside a paragraph's text; the copywriter often puts a label and its copy in
 * one paragraph that way ("Name:\nStephen Finnie").
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function readZipEntry(buf, wanted) {
  // End of central directory record: signature 0x06054b50, at most 64KB + 22 from the end
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file (no end of central directory)');

  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported zip compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in the .docx`);
}

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
   .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&amp;/g, '&');

export function readDocxParagraphs(path) {
  const xml = readZipEntry(readFileSync(path), 'word/document.xml').toString('utf8');
  const paragraphs = [];
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g)) {
    const p = m[0];
    const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] || '';
    let text = '';
    for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\/>|<w:br [^>]*\/>|<w:tab\/>/g)) {
      if (t[0].startsWith('<w:br')) text += '\n';
      else if (t[0] === '<w:tab/>') text += ' ';
      else text += decode(t[1]);
    }
    paragraphs.push({ style, text: text.replace(/ /g, ' ') });
  }
  return paragraphs;
}
