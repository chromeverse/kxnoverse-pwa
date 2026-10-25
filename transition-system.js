(function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    preset: 'off',
    enabled: false,
    mode: 'off',
    duration: 5,
    fadeOut: 2,
    fadeIn: 2,
    curve: 'equal-power',
    manualTransitions: false,
    startBeforeEnd: 5,
    independentStart: false,
    startOnSilence: false,
    reduceShortTracks: true,
    outgoingLevel: 1,
    incomingLevel: 1,
    autoLevel: true,
    maxOverlap: 8
  });

  const PRESETS = Object.freeze({
    off: { enabled: false, mode: 'off', duration: 0, fadeOut: 0, fadeIn: 0 },
    subtle: { enabled: true, mode: 'crossfade', duration: 2, fadeOut: 1, fadeIn: 1, curve: 'linear', outgoingLevel: 0.8, incomingLevel: 0.8, startBeforeEnd: 2 },
    smooth: { enabled: true, mode: 'crossfade', duration: 5, fadeOut: 2.5, fadeIn: 2.5, curve: 'equal-power', outgoingLevel: 1, incomingLevel: 1, startBeforeEnd: 5 },
    'long-mix': { enabled: true, mode: 'crossfade', duration: 8, fadeOut: 4, fadeIn: 4, curve: 'equal-power', outgoingLevel: 1, incomingLevel: 1, startBeforeEnd: 8 },
    'quick-fade': { enabled: true, mode: 'fade', duration: 1, fadeOut: 0.5, fadeIn: 0.5, curve: 'linear', outgoingLevel: 1, incomingLevel: 1, startBeforeEnd: 1 }
  });
  const PAIR_RULES_VERSION = 1;

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function sanitizeConfig(value) {
    const input = value && typeof value === 'object' ? value : {};
    const mode = ['off', 'crossfade', 'fade', 'gapless'].includes(input.mode) ? input.mode : DEFAULTS.mode;
    const curve = ['linear', 'exponential', 'equal-power'].includes(input.curve) ? input.curve : DEFAULTS.curve;
    const preset = ['off', 'subtle', 'smooth', 'long-mix', 'quick-fade', 'custom'].includes(input.preset)
      ? input.preset
      : DEFAULTS.preset;
    return {
      preset,
      enabled: input.enabled === true && mode !== 'off',
      mode,
      duration: clampNumber(input.duration, 0, 12, DEFAULTS.duration),
      fadeOut: clampNumber(input.fadeOut, 0, 12, DEFAULTS.fadeOut),
      fadeIn: clampNumber(input.fadeIn, 0, 12, DEFAULTS.fadeIn),
      curve,
      manualTransitions: input.manualTransitions === true,
      startBeforeEnd: clampNumber(input.startBeforeEnd, 0, 30, DEFAULTS.startBeforeEnd),
      independentStart: input.independentStart === true,
      startOnSilence: input.startOnSilence === true,
      reduceShortTracks: input.reduceShortTracks !== false,
      outgoingLevel: clampNumber(input.outgoingLevel, 0, 1, DEFAULTS.outgoingLevel),
      incomingLevel: clampNumber(input.incomingLevel, 0, 1, DEFAULTS.incomingLevel),
      autoLevel: input.autoLevel !== false,
      maxOverlap: clampNumber(input.maxOverlap, 0, 12, DEFAULTS.maxOverlap)
    };
  }

  function withPreset(config, presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return sanitizeConfig({ ...config, preset: 'custom' });
    return sanitizeConfig({ ...DEFAULTS, ...config, ...preset, preset: presetName });
  }

  function pairKey(outgoingId, incomingId) {
    const outgoing = typeof outgoingId === 'string' ? outgoingId.trim() : '';
    const incoming = typeof incomingId === 'string' ? incomingId.trim() : '';
    return outgoing && incoming && outgoing !== incoming ? JSON.stringify([outgoing, incoming]) : '';
  }

  function sanitizePairTrack(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const track = {};
    for (const key of ['id', 'url', 'videoId', 'platform', 'title', 'artist', 'thumbnail', 'cover', 'image', 'artworkUrl', 'localThumbnail']) {
      if (typeof value[key] === 'string' && value[key].trim()) track[key] = value[key].trim();
    }
    if (Number.isFinite(Number(value.duration))) track.duration = Math.max(0, Number(value.duration));
    return track.title || track.id || track.url ? track : null;
  }

  function getPairEntryConfig(entry) {
    return entry && typeof entry === 'object' && entry.config && typeof entry.config === 'object'
      ? entry.config
      : entry;
  }

  function sanitizePairRules(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const source = input.version === PAIR_RULES_VERSION && input.pairs && typeof input.pairs === 'object' && !Array.isArray(input.pairs)
      ? input.pairs
      : input;
    const pairs = {};
    for (const [key, entryValue] of Object.entries(source)) {
      let ids;
      try {
        ids = JSON.parse(key);
      } catch (error) {
        continue;
      }
      if (!Array.isArray(ids) || ids.length !== 2) continue;
      const normalizedKey = pairKey(ids[0], ids[1]);
      if (!normalizedKey) continue;
      const entry = entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue) ? entryValue : {};
      const hasEntryShape = entry.config && typeof entry.config === 'object';
      pairs[normalizedKey] = {
        config: sanitizeConfig(getPairEntryConfig(entry)),
        outgoing: hasEntryShape ? sanitizePairTrack(entry.outgoing) : null,
        incoming: hasEntryShape ? sanitizePairTrack(entry.incoming) : null
      };
    }
    return { version: PAIR_RULES_VERSION, pairs };
  }

  function getPairConfig(rules, outgoingId, incomingId, fallback) {
    const key = pairKey(outgoingId, incomingId);
    const pairs = rules && rules.version === PAIR_RULES_VERSION && rules.pairs && typeof rules.pairs === 'object'
      ? rules.pairs
      : {};
    return key && Object.prototype.hasOwnProperty.call(pairs, key)
      ? sanitizeConfig(getPairEntryConfig(pairs[key]))
      : sanitizeConfig(fallback);
  }

  function getPairTracks(rules, outgoingId, incomingId) {
    const key = pairKey(outgoingId, incomingId);
    const entry = key && rules && rules.version === PAIR_RULES_VERSION && rules.pairs
      ? rules.pairs[key]
      : null;
    return entry && entry.config
      ? { outgoing: sanitizePairTrack(entry.outgoing), incoming: sanitizePairTrack(entry.incoming) }
      : { outgoing: null, incoming: null };
  }

  function setPairConfig(rules, outgoingId, incomingId, config, tracks = null) {
    const key = pairKey(outgoingId, incomingId);
    const normalized = sanitizePairRules(rules);
    if (!key) return normalized;
    const previous = normalized.pairs[key];
    normalized.pairs[key] = {
      config: sanitizeConfig(config),
      outgoing: sanitizePairTrack(tracks && tracks.outgoing) || (previous && previous.outgoing) || null,
      incoming: sanitizePairTrack(tracks && tracks.incoming) || (previous && previous.incoming) || null
    };
    return normalized;
  }

  function deletePairConfig(rules, outgoingId, incomingId) {
    const normalized = sanitizePairRules(rules);
    const key = pairKey(outgoingId, incomingId);
    if (key) delete normalized.pairs[key];
    return normalized;
  }

  function transitionDuration(config, currentDuration, isManual = false) {
    const settings = sanitizeConfig(config);
    if (isManual && !settings.manualTransitions) return 0;
    if (!settings.enabled || settings.mode === 'off' || settings.mode === 'gapless') return 0;
    const requested = settings.mode === 'fade' ? Math.max(settings.fadeOut, settings.fadeIn) : settings.duration;
    const overlapBound = settings.mode === 'crossfade' ? Math.min(requested, settings.maxOverlap) : requested;
    const trackDuration = Number(currentDuration);
    const shortLimit = settings.reduceShortTracks && Number.isFinite(trackDuration) && trackDuration > 0
      ? trackDuration * 0.5
      : overlapBound;
    return Math.max(0, Math.min(overlapBound, shortLimit));
  }

  function shouldStart(config, currentTime, duration) {
    const settings = sanitizeConfig(config);
    if (!settings.enabled || settings.mode === 'off' || settings.mode === 'gapless') return false;
    const time = Number(currentTime);
    const total = Number(duration);
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(total) || total <= 0) return false;
    const effectiveDuration = transitionDuration(settings, total);
    const leadTime = settings.independentStart
      ? settings.startBeforeEnd
      : Math.min(settings.startBeforeEnd, effectiveDuration || settings.startBeforeEnd);
    return time >= Math.max(0, total - leadTime);
  }

  function gainsAt(progress, config) {
    const settings = sanitizeConfig(config);
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    let outgoing;
    let incoming;
    if (settings.curve === 'equal-power') {
      outgoing = Math.cos(t * Math.PI / 2);
      incoming = Math.sin(t * Math.PI / 2);
    } else if (settings.curve === 'exponential') {
      outgoing = Math.pow(1 - t, 2);
      incoming = Math.pow(t, 2);
    } else {
      outgoing = 1 - t;
      incoming = t;
    }
    outgoing *= settings.outgoingLevel;
    incoming *= settings.incomingLevel;
    if (settings.autoLevel) {
      const power = Math.sqrt(outgoing * outgoing + incoming * incoming);
      if (power > 1) {
        outgoing /= power;
        incoming /= power;
      }
    }
    return { outgoing, incoming };
  }

  function transitionGainsAt(progress, config) {
    const settings = sanitizeConfig(config);
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    if (settings.mode !== 'fade') return gainsAt(t, settings);
    const duration = Math.max(settings.fadeOut, settings.fadeIn, 0.001);
    const outgoingProgress = settings.fadeOut > 0 ? Math.min(1, t * duration / settings.fadeOut) : 1;
    const incomingProgress = settings.fadeIn > 0 ? Math.min(1, t * duration / settings.fadeIn) : 1;
    const outgoing = gainsAt(outgoingProgress, { ...settings, autoLevel: false }).outgoing;
    const incoming = gainsAt(incomingProgress, { ...settings, autoLevel: false }).incoming;
    const power = Math.sqrt(outgoing * outgoing + incoming * incoming);
    const scale = settings.autoLevel && power > 1 ? 1 / power : 1;
    return { outgoing: outgoing * scale, incoming: incoming * scale };
  }

  function shouldStartOnSilence(config, currentTime, duration, levelDb) {
    const settings = sanitizeConfig(config);
    if (!shouldStart(settings, currentTime, duration)) return false;
    const remaining = Number(duration) - Number(currentTime);
    return !settings.startOnSilence || Number(levelDb) <= -42 || remaining <= 1.25;
  }

  const api = {
    DEFAULTS,
    PRESETS,
    PAIR_RULES_VERSION,
    sanitizeConfig,
    withPreset,
    pairKey,
    sanitizePairRules,
    getPairConfig,
    getPairTracks,
    setPairConfig,
    deletePairConfig,
    transitionDuration,
    shouldStart,
    shouldStartOnSilence,
    gainsAt,
    transitionGainsAt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RiffTransitionSystem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);