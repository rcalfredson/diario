const fs = require('fs');
const stream = require('stream');
const express = require('express');
const morgan = require('morgan');
const app = express();
const port = process.env.PORT || 3000;
const basePath = process.env.BASE_PATH;

app.use(morgan('short'));

app.get('/audio/:fileID/:albumID*?', async (req, res) => {
  let readStream;
  const filePath = `${basePath}/Albums/${req.params.albumID}/${req.params.fileID}.mp3`;
  if (!fs.existsSync(filePath)) {
    res.status(404).send('<h1>404, not found</h1>');
    return;
  }
  let buffer = fs.readFileSync(filePath);
  const total = buffer.byteLength;
  if (req.headers.range) {
    const { range } = req.headers;
    const parts = range.replace(/bytes=/, '').split('-');
    const partialStart = parts[0];
    const partialEnd = parts[1];

    const start = parseInt(partialStart, 10);
    let end;
    if (partialEnd) {
      end = parseInt(partialEnd, 10);
      buffer = Buffer.from(buffer.slice(start, end));
    }
    readStream = new stream.PassThrough();
    readStream.end(buffer);

    res.writeHead(206, {
      Range: `bytes ${start}-${end}/${total}`,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': buffer.byteLength,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'audio/mpeg',
    });
    readStream.pipe(res);
  } else {
    readStream = new stream.PassThrough();
    readStream.end(buffer);
    res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'audio/mpeg' });
    readStream.pipe(res);
  }
});

app.listen(port, () => {
  console.log(`Listening on ${port}`); // eslint-disable-line no-console
});
