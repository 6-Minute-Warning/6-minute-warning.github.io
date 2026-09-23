const fs = require('fs');
const d = require('docx');
const BLUE = '1E8BFF';
const INK = '10141B';
const MUTED = '262E3B';
const FONT = 'Arial';
const logo = fs.readFileSync(require('path').join(__dirname, '../src/assets/brand/press/logo-horizontal-on-light.png'));
const W = 216, H = Math.round(W * 578 / 2376);

const p = (text, opts = {}) => new d.Paragraph({
  spacing: { after: opts.after ?? 0, before: opts.before ?? 0 },
  children: [new d.TextRun({ text, color: opts.color ?? INK, bold: opts.bold })],
});

const doc = new d.Document({
  creator: '6 Minute Warning',
  title: '6 Minute Warning Letterhead',
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: INK }, paragraph: { spacing: { line: 288 } } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 2160, bottom: 1440, left: 1440, right: 1440, header: 720, footer: 576 },
      },
    },
    headers: {
      default: new d.Header({
        children: [new d.Paragraph({
          border: { bottom: { style: d.BorderStyle.SINGLE, size: 12, color: BLUE, space: 8 } },
          children: [new d.ImageRun({ type: 'png', data: logo, transformation: { width: W, height: H },
            altText: { title: '6 Minute Warning', description: '6 Minute Warning wordmark', name: 'logo' } })],
        })],
      }),
    },
    footers: {
      default: new d.Footer({
        children: [new d.Paragraph({
          alignment: d.AlignmentType.CENTER,
          children: [new d.TextRun({ text: 'manager@6minutewarning.com  ·  6minutewarning.com  ·  Edmonton, Alberta', size: 16, color: MUTED })],
        })],
      }),
    },
    children: [
      p('[Date]', { after: 360 }),
      p('[Recipient name]'),
      p('[Title]'),
      p('[Organization]'),
      p('[Street address]'),
      p('[City, Province  Postal code]', { after: 360 }),
      p('Dear [Recipient name],', { after: 200 }),
      p('[Letter body]', { color: MUTED, after: 360 }),
      p('Sincerely,', { after: 840 }),
      p('[Your name]', { bold: true }),
      p('[Title]'),
      p('6 Minute Warning'),
    ],
  }],
});
d.Packer.toBuffer(doc).then(b => fs.writeFileSync(require('path').join(__dirname, '6mw-letterhead.docx'), b));
