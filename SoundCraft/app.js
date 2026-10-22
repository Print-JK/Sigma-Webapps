/**
 * SoundCraft — Digital Audio Workstation Engine
 * Pure client-side multi-track mixer, live microphone recording, Web Audio effects, and master WAV export.
 */

(function () {
  "use strict";

  // Constants
  const NUM_TRACKS = 4;
  const PX_PER_SEC = 40;
  const TIMELINE_DURATION = 120; // 2 minutes default timeline length

  // DAW State
  const state = {
    audioCtx: null,
    isPlaying: false,
    isRecording: false,
    isLooping: false,
    currentTime: 0,
    startTimeMarker: 0,
    animFrameId: null,
    selectedClipId: null,
    tracks: [
      { name: "Track 1", vol: 1, pan: 0, mute: false, solo: false },
      { name: "Track 2", vol: 1, pan: 0, mute: false, solo: false },
      { name: "Track 3", vol: 1, pan: 0, mute: false, solo: false },
      { name: "Track 4 (Vocals)", vol: 1, pan: 0, mute: false, solo: false }
    ],
    clips: [], // { id, trackIdx, name, buffer, startTime, duration, offset }
    activeSources: []
  };

  // MediaRecorder State
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordStartTime = 0;

  // DOM Elements
  const projectTitleInput = document.getElementById("projectTitle");
  const timecodeDisplay = document.getElementById("timecodeDisplay");
  const playhead = document.getElementById("playhead");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnRecord = document.getElementById("btnRecord");
  const btnLoop = document.getElementById("btnLoop");
  const tracksScrollArea = document.getElementById("tracksScrollArea");
  const timelineRuler = document.getElementById("timelineRuler");
  const audioFileInput = document.getElementById("audioFileInput");
  const masterVisualizer = document.getElementById("masterVisualizer");
  const visCtx = masterVisualizer.getContext("2d");
  const peakLevelText = document.getElementById("peakLevelText");

  // Effects Controls
  const eqLow = document.getElementById("eqLow");
  const eqMid = document.getElementById("eqMid");
  const eqHigh = document.getElementById("eqHigh");
  const reverbTime = document.getElementById("reverbTime");
  const reverbWet = document.getElementById("reverbWet");
  const masterVolume = document.getElementById("masterVolume");

  // Audio Context & Graph Setup
  let masterGain = null;
  let eqLowNode = null;
  let eqMidNode = null;
  let eqHighNode = null;
  let delayNode = null;
  let delayGain = null;
  let analyserNode = null;
  let trackNodes = [];

  function initAudioContext() {
    if (state.audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();

    // Master Gain
    masterGain = state.audioCtx.createGain();
    masterGain.gain.value = parseFloat(masterVolume.value);

    // 3-Band Parametric EQ
    eqLowNode = state.audioCtx.createBiquadFilter();
    eqLowNode.type = "lowshelf";
    eqLowNode.frequency.value = 100;
    eqLowNode.gain.value = parseFloat(eqLow.value);

    eqMidNode = state.audioCtx.createBiquadFilter();
    eqMidNode.type = "peaking";
    eqMidNode.frequency.value = 1000;
    eqMidNode.Q.value = 1.0;
    eqMidNode.gain.value = parseFloat(eqMid.value);

    eqHighNode = state.audioCtx.createBiquadFilter();
    eqHighNode.type = "highshelf";
    eqHighNode.frequency.value = 8000;
    eqHighNode.gain.value = parseFloat(eqHigh.value);

    // Reverb / Delay Module
    delayNode = state.audioCtx.createDelay();
    delayNode.delayTime.value = parseFloat(reverbTime.value);
    delayGain = state.audioCtx.createGain();
    delayGain.gain.value = parseFloat(reverbWet.value);

    // Analyser Node
    analyserNode = state.audioCtx.createAnalyser();
    analyserNode.fftSize = 256;

    // Connect Master Graph
    eqLowNode.connect(eqMidNode);
    eqMidNode.connect(eqHighNode);
    eqHighNode.connect(masterGain);

    // Reverb parallel loop
    eqHighNode.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(masterGain);
    delayGain.connect(delayNode); // feedback

    masterGain.connect(analyserNode);
    analyserNode.connect(state.audioCtx.destination);

    // Track Mixer Nodes
    for (let i = 0; i < NUM_TRACKS; i++) {
      const tGain = state.audioCtx.createGain();
      let tPan = null;
      if (state.audioCtx.createStereoPanner) {
        tPan = state.audioCtx.createStereoPanner();
        tPan.pan.value = state.tracks[i].pan;
      }
      tGain.gain.value = state.tracks[i].vol;

      if (tPan) {
        tGain.connect(tPan);
        tPan.connect(eqLowNode);
      } else {
        tGain.connect(eqLowNode);
      }

      trackNodes.push({ gain: tGain, pan: tPan });
    }

    startVisualizerLoop();
  }

  // Update EQ / FX Settings
  eqLow.addEventListener("input", (e) => {
    if (eqLowNode) eqLowNode.gain.value = parseFloat(e.target.value);
  });
  eqMid.addEventListener("input", (e) => {
    if (eqMidNode) eqMidNode.gain.value = parseFloat(e.target.value);
  });
  eqHigh.addEventListener("input", (e) => {
    if (eqHighNode) eqHighNode.gain.value = parseFloat(e.target.value);
  });
  reverbTime.addEventListener("input", (e) => {
    if (delayNode) delayNode.delayTime.value = parseFloat(e.target.value);
  });
  reverbWet.addEventListener("input", (e) => {
    if (delayGain) delayGain.gain.value = parseFloat(e.target.value);
  });
  masterVolume.addEventListener("input", (e) => {
    if (masterGain) masterGain.gain.value = parseFloat(e.target.value);
  });

  // Track Mixer Controls (Vol, Pan, Mute, Solo)
  document.querySelectorAll(".track-vol").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.track, 10);
      state.tracks[idx].vol = parseFloat(e.target.value);
      applyTrackGains();
    });
  });

  document.querySelectorAll(".track-pan").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.track, 10);
      state.tracks[idx].pan = parseFloat(e.target.value);
      if (trackNodes[idx] && trackNodes[idx].pan) {
        trackNodes[idx].pan.pan.value = state.tracks[idx].pan;
      }
    });
  });

  document.querySelectorAll(".track-toggle-btn.mute").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.track, 10);
      state.tracks[idx].mute = !state.tracks[idx].mute;
      btn.classList.toggle("active", state.tracks[idx].mute);
      applyTrackGains();
    });
  });

  document.querySelectorAll(".track-toggle-btn.solo").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.track, 10);
      state.tracks[idx].solo = !state.tracks[idx].solo;
      btn.classList.toggle("active", state.tracks[idx].solo);
      applyTrackGains();
    });
  });

  function applyTrackGains() {
    const hasSolo = state.tracks.some((t) => t.solo);
    for (let i = 0; i < NUM_TRACKS; i++) {
      if (!trackNodes[i]) continue;
      const t = state.tracks[i];
      let effectiveGain = t.vol;
      if (t.mute || (hasSolo && !t.solo)) {
        effectiveGain = 0;
      }
      trackNodes[i].gain.gain.value = effectiveGain;
    }
  }

  // Format Timecode: MM:SS:ms
  function formatTimecode(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(ms).padStart(2, "0")}`;
  }

  // Draw Timeline Ruler
  function renderTimelineRuler() {
    timelineRuler.innerHTML = "";
    const totalSecs = TIMELINE_DURATION;
    for (let s = 0; s < totalSecs; s += 2) {
      const mark = document.createElement("div");
      mark.style.position = "absolute";
      mark.style.left = `${s * PX_PER_SEC}px`;
      mark.style.top = "0";
      mark.style.bottom = "0";
      mark.style.borderLeft = "1px solid rgba(255,255,255,0.1)";
      mark.style.paddingLeft = "4px";
      mark.style.fontSize = "10px";
      mark.style.color = "#777";
      mark.textContent = formatTimecode(s);
      timelineRuler.appendChild(mark);
    }
  }

  // Ruler Scrubbing
  timelineRuler.addEventListener("click", (e) => {
    const rect = timelineRuler.getBoundingClientRect();
    const scrollLeft = tracksScrollArea.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    seekTime(clickX / PX_PER_SEC);
  });

  function seekTime(targetTime) {
    state.currentTime = Math.max(0, targetTime);
    updatePlayheadPosition();
    if (state.isPlaying) {
      stopPlayback();
      startPlayback();
    }
  }

  function updatePlayheadPosition() {
    const px = state.currentTime * PX_PER_SEC;
    playhead.style.left = `${px}px`;
    timecodeDisplay.textContent = formatTimecode(state.currentTime);
  }

  // Import Audio File
  document.getElementById("btnImportAudio").addEventListener("click", () => {
    initAudioContext();
    audioFileInput.click();
  });

  audioFileInput.addEventListener("change", async () => {
    const file = audioFileInput.files[0];
    if (!file) return;

    initAudioContext();
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await state.audioCtx.decodeAudioData(arrayBuffer);

      // Find first track with space
      const clip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        trackIdx: 0,
        name: file.name.replace(/\.[^/.]+$/, ""),
        buffer: audioBuffer,
        startTime: state.currentTime,
        duration: audioBuffer.duration,
        offset: 0
      };

      state.clips.push(clip);
      state.selectedClipId = clip.id;
      renderClips();
    } catch (err) {
      alert("Error decoding audio: " + err.message);
    }
    audioFileInput.value = "";
  });

  // Render Clips on Timeline
  function renderClips() {
    for (let i = 0; i < NUM_TRACKS; i++) {
      const lane = document.getElementById(`trackLane_${i}`);
      lane.innerHTML = "";
    }

    state.clips.forEach((clip) => {
      const lane = document.getElementById(`trackLane_${clip.trackIdx}`);
      if (!lane) return;

      const clipEl = document.createElement("div");
      clipEl.id = clip.id;
      clipEl.className = `audio-clip ${clip.id === state.selectedClipId ? "selected" : ""}`;
      clipEl.style.left = `${clip.startTime * PX_PER_SEC}px`;
      clipEl.style.width = `${clip.duration * PX_PER_SEC}px`;

      const title = document.createElement("div");
      title.className = "clip-header";
      title.textContent = clip.name;
      clipEl.appendChild(title);

      // Render Waveform Canvas
      const waveCanvas = document.createElement("canvas");
      waveCanvas.className = "clip-waveform";
      waveCanvas.width = Math.max(100, Math.round(clip.duration * PX_PER_SEC));
      waveCanvas.height = 68;
      drawWaveform(waveCanvas, clip.buffer);
      clipEl.appendChild(waveCanvas);

      // Dragging Interaction
      let isDragging = false;
      let startX = 0;
      let startStartTime = 0;

      clipEl.addEventListener("mousedown", (e) => {
        state.selectedClipId = clip.id;
        document.querySelectorAll(".audio-clip").forEach((c) => c.classList.remove("selected"));
        clipEl.classList.add("selected");

        isDragging = true;
        startX = e.clientX;
        startStartTime = clip.startTime;
        e.stopPropagation();

        function onMouseMove(moveEv) {
          if (!isDragging) return;
          const deltaX = moveEv.clientX - startX;
          const deltaSec = deltaX / PX_PER_SEC;
          clip.startTime = Math.max(0, startStartTime + deltaSec);
          clipEl.style.left = `${clip.startTime * PX_PER_SEC}px`;
        }

        function onMouseUp() {
          isDragging = false;
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      lane.appendChild(clipEl);
    });
  }

  // Draw Audio Waveform onto Canvas
  function drawWaveform(canvas, audioBuffer) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(16, 185, 129, 0.4)";

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }

  // Playback Control
  function startPlayback() {
    initAudioContext();
    if (state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }

    state.isPlaying = true;
    btnPlayPause.textContent = "⏸";
    btnPlayPause.classList.add("active");

    const now = state.audioCtx.currentTime;
    state.startTimeMarker = now - state.currentTime;

    // Schedule active sources for clips that fall within or ahead of playhead
    state.activeSources = [];
    state.clips.forEach((clip) => {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > state.currentTime) {
        const source = state.audioCtx.createBufferSource();
        source.buffer = clip.buffer;

        const trackNode = trackNodes[clip.trackIdx];
        source.connect(trackNode.gain);

        let offset = 0;
        let when = now;

        if (state.currentTime >= clip.startTime) {
          offset = (state.currentTime - clip.startTime) + clip.offset;
          when = now;
        } else {
          offset = clip.offset;
          when = now + (clip.startTime - state.currentTime);
        }

        source.start(when, offset);
        state.activeSources.push(source);
      }
    });

    runPlaybackLoop();
  }

  function stopPlayback() {
    state.isPlaying = false;
    btnPlayPause.textContent = "▶";
    btnPlayPause.classList.remove("active");

    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }

    state.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {}
    });
    state.activeSources = [];
  }

  function runPlaybackLoop() {
    if (!state.isPlaying) return;

    state.currentTime = state.audioCtx.currentTime - state.startTimeMarker;

    // Check loop
    if (state.isLooping && state.currentTime >= TIMELINE_DURATION) {
      seekTime(0);
      return;
    }

    updatePlayheadPosition();
    state.animFrameId = requestAnimationFrame(runPlaybackLoop);
  }

  // Transport Listeners
  btnPlayPause.addEventListener("click", () => {
    if (state.isPlaying) stopPlayback();
    else startPlayback();
  });

  document.getElementById("btnStop").addEventListener("click", () => {
    stopPlayback();
    seekTime(0);
  });

  document.getElementById("btnRewind").addEventListener("click", () => {
    seekTime(0);
  });

  btnLoop.addEventListener("click", () => {
    state.isLooping = !state.isLooping;
    btnLoop.classList.toggle("active", state.isLooping);
  });

  window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      if (state.isPlaying) stopPlayback();
      else startPlayback();
    } else if (e.key === "s" || e.key === "S") {
      splitSelectedClip();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelectedClip();
    }
  });

  // Clip Actions: Split & Delete
  function splitSelectedClip() {
    if (!state.selectedClipId) return;
    const clipIdx = state.clips.findIndex((c) => c.id === state.selectedClipId);
    if (clipIdx === -1) return;

    const clip = state.clips[clipIdx];
    const splitPoint = state.currentTime - clip.startTime;

    if (splitPoint > 0.1 && splitPoint < clip.duration - 0.1) {
      const part1 = { ...clip, duration: splitPoint };
      const part2 = {
        ...clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        startTime: state.currentTime,
        duration: clip.duration - splitPoint,
        offset: clip.offset + splitPoint
      };

      state.clips.splice(clipIdx, 1, part1, part2);
      state.selectedClipId = part2.id;
      renderClips();
    }
  }

  function deleteSelectedClip() {
    if (!state.selectedClipId) return;
    state.clips = state.clips.filter((c) => c.id !== state.selectedClipId);
    state.selectedClipId = null;
    renderClips();
  }

  document.getElementById("btnSplitClip").addEventListener("click", splitSelectedClip);
  document.getElementById("btnDeleteClip").addEventListener("click", deleteSelectedClip);

  // Live Microphone Recording
  btnRecord.addEventListener("click", async () => {
    initAudioContext();
    if (!state.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        recordStartTime = state.currentTime;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(recordedChunks, { type: "audio/webm" });
          const ab = await blob.arrayBuffer();
          const audioBuffer = await state.audioCtx.decodeAudioData(ab);

          const newClip = {
            id: `rec_${Date.now()}`,
            trackIdx: 3, // Vocals track
            name: `Take ${state.clips.length + 1}`,
            buffer: audioBuffer,
            startTime: recordStartTime,
            duration: audioBuffer.duration,
            offset: 0
          };

          state.clips.push(newClip);
          state.selectedClipId = newClip.id;
          renderClips();
        };

        mediaRecorder.start();
        state.isRecording = true;
        btnRecord.classList.add("active");
        if (!state.isPlaying) startPlayback();
      } catch (err) {
        alert("Microphone access denied: " + err.message);
      }
    } else {
      mediaRecorder.stop();
      state.isRecording = false;
      btnRecord.classList.remove("active");
      if (state.isPlaying) stopPlayback();
    }
  });

  // Master Visualizer FFT Loop
  function startVisualizerLoop() {
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    function draw() {
      requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      visCtx.fillStyle = "#0a0908";
      visCtx.fillRect(0, 0, masterVisualizer.width, masterVisualizer.height);

      const barWidth = (masterVisualizer.width / dataArray.length) * 2.2;
      let x = 0;
      let maxVal = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i];
        if (v > maxVal) maxVal = v;
        const barHeight = (v / 255) * masterVisualizer.height;

        const grad = visCtx.createLinearGradient(0, masterVisualizer.height, 0, 0);
        grad.addColorStop(0, "#10b981");
        grad.addColorStop(0.7, "#f59e0b");
        grad.addColorStop(1, "#ef4444");

        visCtx.fillStyle = grad;
        visCtx.fillRect(x, masterVisualizer.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }

      const db = maxVal > 0 ? Math.round(20 * Math.log10(maxVal / 255)) : -Infinity;
      peakLevelText.textContent = isFinite(db) ? `${db} dB` : "-inf dB";
    }

    draw();
  }

  // Master Audio Mixdown Export (.wav 16-bit PCM)
  document.getElementById("btnExportWav").addEventListener("click", async () => {
    if (state.clips.length === 0) {
      alert("No audio clips to export.");
      return;
    }

    initAudioContext();
    const title = projectTitleInput.value.trim() || "Mixdown";

    // Compute maximum session duration
    let maxDuration = 1;
    state.clips.forEach((c) => {
      const end = c.startTime + c.duration;
      if (end > maxDuration) maxDuration = end;
    });

    const sampleRate = 44100;
    const numChannels = 2;
    const offlineCtx = new OfflineAudioContext(numChannels, Math.ceil(sampleRate * maxDuration), sampleRate);

    // Replicate track graph in OfflineAudioContext
    state.clips.forEach((clip) => {
      const t = state.tracks[clip.trackIdx];
      if (t.mute) return;

      const src = offlineCtx.createBufferSource();
      src.buffer = clip.buffer;

      const gain = offlineCtx.createGain();
      gain.gain.value = t.vol;

      if (offlineCtx.createStereoPanner) {
        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = t.pan;
        src.connect(gain);
        gain.connect(panner);
        panner.connect(offlineCtx.destination);
      } else {
        src.connect(gain);
        gain.connect(offlineCtx.destination);
      }

      src.start(clip.startTime, clip.offset, clip.duration);
    });

    try {
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWavBlob(renderedBuffer);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error exporting WAV: " + err.message);
    }
  });

  // Convert AudioBuffer to 16-Bit PCM WAV Blob
  function audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const samples = buffer.length;
    const dataSize = samples * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    // RIFF chunk descriptor
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, "WAVE");

    // fmt sub-chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // Interleave channels
    let offset = 44;
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < samples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  // Initialize
  renderTimelineRuler();
})();
