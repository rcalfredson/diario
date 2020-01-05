const fs = require('fs');
const stream = require('stream');
const cors = require('cors');
const glob = require('glob');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const app = express();
const port = process.env.PORT || 3001;
const basePath = process.env.BASE_PATH;

app.use(morgan('short'));

const whitelist = ['https://dailypage.org', 'http://localhost:3000'];
  const corsOptions = {
    origin: (origin, callback) => {
      if (whitelist.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

app.get('/meta/music/artists', async (_, res) => {
  res.send(fs.readdirSync(`${basePath}/meta/Artists`, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name))
})

app.get('/meta/music/albums', async (_, res) => {
  res.send(glob.GlobSync(`${basePath}/meta/Artists/**/*`, {nodir: true}).matches.map(match => {
    const dirName = path.dirname(Object.keys(match)[0]).split('/');

    const artist = dirName[dirName.length - 1];
    return {artist: artist, name: path.basename(Object.keys(match)[0])}
  }));
});

app.get('/meta/music/songs', async (req, res) => {
  let allTracks = [];
  const albums = glob.GlobSync(`${basePath}/meta/Artists/**/*`, {nodir: true}).matches.map(match => {
    const dirName = path.dirname(Object.keys(match)[0]).split('/');

    const artist = dirName[dirName.length - 1];
    return {artist: artist, name: path.basename(Object.keys(match)[0])}
  });

  albums.forEach((album) => {
      const trackData = JSON.parse(fs.readFileSync(`${basePath}/meta/Artists/${album.artist}/${album.name}`).toString()).tracks
      trackData.forEach((track) => {
        allTracks.push({
          id: track.id, title: track.name, album, artist: (track.artist ? track.artist : album.artist),
        });
      });
  });
  allTracks = allTracks.sort((a, b) => {
    if (a.title > b.title) { return 1; }
    if (b.title > a.title) { return -1; }
    return 0;
  });
  res.send(allTracks);
});

app.get('/meta/music/artist/:artistID/albums', async (req, res) => {
  res.send(glob.GlobSync(`${basePath}/meta/Artists/${req.params.artistID}/*`, {nodir: true}).matches.map(match => {
    return path.basename(Object.keys(match)[0])
  }));
});

app.get('/meta/music/artist/:artistID/:albumID', async (req, res) => {
  const albumFile = JSON.parse(fs.readFileSync(`${basePath}/meta/Artists/${req.params.artistID}/${req.params.albumID}`).toString());
  res.send(albumFile)
});

app.use('/meta', express.static(`${basePath}/meta`));

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
