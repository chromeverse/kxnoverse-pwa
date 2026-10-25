function dedupeTracks(tracks, same) {
  if (!Array.isArray(tracks)) return [];
  const kept = [];
  for (const track of tracks) {
    if (!kept.some((other) => same(other, track))) kept.push(track);
  }
  return kept;
}

function mergePlaylistTracks(existingTracks, playlists, same) {
  if (typeof same !== 'function') throw new TypeError('A track comparison function is required');
  const tracks = Array.isArray(existingTracks) ? existingTracks.slice() : [];
  const incomingTracks = [];
  for (const playlist of Array.isArray(playlists) ? playlists : []) {
    if (playlist && Array.isArray(playlist.tracks)) incomingTracks.push(...playlist.tracks);
  }

  let imported = 0;
  for (const track of incomingTracks) {
    if (tracks.some((existing) => same(existing, track))) continue;
    tracks.push(track);
    imported++;
  }

  return { tracks, imported, skipped: incomingTracks.length - imported };
}

if (typeof module !== 'undefined') module.exports = { dedupeTracks, mergePlaylistTracks };
