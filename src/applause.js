
// ─── SON APPLAUDISSEMENTS ─────────────────────────────────────────────────────
export function jouerApplaudissements() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var duration = 3.0;
    var sampleRate = ctx.sampleRate;
    var buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);

    // Générer un bruit blanc filtré qui ressemble à des applaudissements
    for (var channel = 0; channel < 2; channel++) {
      var data = buffer.getChannelData(channel);
      for (var i = 0; i < data.length; i++) {
        var t = i / sampleRate;
        // Enveloppe en vagues (claps répétés)
        var claps = 8;
        var env = 0;
        for (var c = 0; c < claps; c++) {
          var tc = c * (duration / claps);
          var dist = Math.abs(t - tc - 0.05);
          env += Math.exp(-dist * 18) * (1 - c / claps * 0.3);
        }
        // Bruit blanc * enveloppe + légère décroissance globale
        data[i] = (Math.random() * 2 - 1) * env * Math.exp(-t * 0.5) * 0.6;
      }
    }

    // Filtre passe-haut pour enlever les basses (plus réaliste)
    var source = ctx.createBufferSource();
    source.buffer = buffer;

    var filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;

    var filter2 = ctx.createBiquadFilter();
    filter2.type = "peaking";
    filter2.frequency.value = 3000;
    filter2.gain.value = 6;

    var gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.8, 0);
    gainNode.gain.exponentialRampToValueAtTime(0.01, duration);

    source.connect(filter);
    filter.connect(filter2);
    filter2.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  } catch(e) {
    console.warn("Audio non disponible:", e);
  }
}
