/**
 * FilmCraft — Nonlinear Video Editor Engine
 * Pure client-side timeline editing, multi-track sequencing, and canvas video export.
 * 100% offline, zero server required.
 */

(function () {
  "use strict";

  // Timeline & Media State
  const state = {
    mediaPool: [],
    tracks: [
      { id: "v1", type: "video", name: "Video 1", clips: [] },
      { id: "v2", type: "video", name: "Video 2 (Overlay)", clips: [] },
      { id: "a1", type: "audio", name: "Audio 1", clips: [] },
      { id: "a2", type: "audio", name: "Audio 2", clips: [] }
    ],
    currentTime: 0,
    totalDuration: 60, // seconds
    pxPerSec: 25,
    isPlaying: false,
    selectedClipId: null,
    selectedMediaId: null,
    animFrameId: null,
    lastTick: 0,
    audioCtx: null
  };

  // DOM Elements
  const mediaListEl = document.getElementById("mediaList");
  const mediaFileInput = document.getElementById("mediaFileInput");
  const previewCanvas = document.getElementById("previewCanvas");
  const prevCtx = previewCanvas.getContext("2d");
  const timecodeDisplay = document.getElementById("timecodeDisplay");
  const playhead = document.getElementById("playhead");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const timelineRuler = document.getElementById("timelineRuler");
  const tracksScrollArea = document.getElementById("tracksScrollArea");
  const sourceMediaName = document.getElementById("sourceMediaName");
  const sourceVideo = document.getElementById("sourceVideo");
  const sourceImage = document.getElementById("sourceImage");
  const sourceAudio = document.getElementById("sourceAudio");
  const sourcePlaceholder = document.getElementById("sourcePlaceholder");
  const addSourceButton = document.getElementById("btnAddSourceToTimeline");

  // Format Seconds to HH:MM:SS:FF Timecode
  function formatTimecode(secs) {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remSecs = s % 60;
    const frames = Math.floor((secs % 1) * 30);
    return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
  }

  // Import Media File (Video, Audio, Image)
  async function importMedia(file) {
    const isVideo = file.type.startsWith("video/") || file.name.match(/\.(mp4|webm|mov|m4v)$/i);
    const isAudio = file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|ogg|aac)$/i);
    const isImg = file.type.startsWith("image/");

    const url = URL.createObjectURL(file);
    let duration = 5; // default for images
    let el = null;
    let audioBuffer = null;

    if (isVideo) {
      el = document.createElement("video");
      el.src = url;
      el.muted = true;
      el.preload = "auto";
      await new Promise((res) => {
        el.onloadedmetadata = () => {
          duration = el.duration || 10;
          res();
        };
      });
    } else if (isAudio) {
      el = document.createElement("audio");
      el.src = url;
      await new Promise((res) => {
        el.onloadedmetadata = () => {
          duration = el.duration || 10;
          res();
        };
      });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Audio decoding is not supported by this browser.");
      state.audioCtx ||= new AudioContext();
      const encodedAudio = await file.arrayBuffer();
      audioBuffer = await state.audioCtx.decodeAudioData(encodedAudio);
    } else if (isImg) {
      el = new Image();
      el.src = url;
      await new Promise((res) => (el.onload = res));
      duration = 5;
    }

    const mediaItem = {
      id: "media_" + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: isVideo ? "video" : (isAudio ? "audio" : "image"),
      duration: duration,
      audioBuffer,
      element: el,
      url: url
    };

    state.mediaPool.push(mediaItem);
    renderMediaPoolUI();
    selectSourceMedia(mediaItem.id);

    // Auto-add to Track 1 if timeline is empty
    if (state.tracks[0].clips.length === 0 && (isVideo || isImg)) {
      addClipToTrack(mediaItem.id, 0, 0);
    }
  }

  // Render Media Pool List
  function renderMediaPoolUI() {
    mediaListEl.innerHTML = "";
    state.mediaPool.forEach((item) => {
      const div = document.createElement("div");
      div.className = "media-item";
      div.dataset.mediaId = item.id;
      div.draggable = true;
      div.classList.toggle("selected", item.id === state.selectedMediaId);
      const icon = item.type === "video" ? "🎬" : (item.type === "audio" ? "🎵" : "🖼️");
      div.innerHTML = `
        <span>${icon}</span>
        <div style="flex:1; overflow:hidden;">
          <div style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(item.name)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${item.type.toUpperCase()} &middot; ${Math.round(item.duration)}s</div>
        </div>
        <button class="thumb-btn" title="Add to timeline" onclick="event.stopPropagation(); window.FilmCraft.addClip('${item.id}')">➕</button>
      `;
      div.addEventListener("click", () => selectSourceMedia(item.id));
      div.addEventListener("dragstart", event => {
        event.dataTransfer.setData("application/x-filmcraft-media-id", item.id);
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "copy";
      });
      mediaListEl.appendChild(div);
    });
  }

  function selectSourceMedia(mediaId) {
    const item = state.mediaPool.find(media => media.id === mediaId);
    if (!item) return;
    state.selectedMediaId = item.id;
    sourceMediaName.textContent = item.name;
    addSourceButton.disabled = false;
    sourceVideo.pause(); sourceAudio.pause();
    sourceVideo.hidden = item.type !== "video";
    sourceImage.hidden = item.type !== "image";
    sourceAudio.hidden = item.type !== "audio";
    sourcePlaceholder.hidden = true;
    if (item.type === "video") {
      sourceVideo.src = item.url;
      sourceVideo.currentTime = 0;
      sourceVideo.load();
    } else if (item.type === "image") {
      sourceImage.src = item.url;
    } else {
      sourceAudio.src = item.url;
      sourceAudio.load();
    }
    mediaListEl.querySelectorAll(".media-item").forEach(node => {
      node.classList.toggle("selected", node.dataset.mediaId === item.id);
    });
  }

  // Add Clip to Track
  function addClipToTrack(mediaId, trackIndex = 0, startTime = null) {
    const media = state.mediaPool.find((m) => m.id === mediaId);
    if (!media) return;

    const track = state.tracks[trackIndex];
    let start = startTime !== null ? startTime : state.currentTime;

    // Place after last clip if overlap
    if (track.clips.length > 0 && startTime === null) {
      const lastClip = track.clips[track.clips.length - 1];
      start = Math.max(start, lastClip.start + lastClip.duration);
    }

    const clip = {
      id: "clip_" + Math.random().toString(36).substr(2, 9),
      mediaId: mediaId,
      trackIndex: trackIndex,
      start: start,
      duration: Math.min(media.duration, 30),
      trimStart: 0,
      scale: 1,
      opacity: 1,
      x: 0,
      y: 0
    };

    track.clips.push(clip);
    refreshTimelineExtent();
    renderTimelineClips();
    renderPreviewFrame();
  }

  // Render Timeline Clips UI
  function renderTimelineClips() {
    const canvas = document.querySelector(".tracks-canvas-container");
    if (canvas) canvas.style.width = `${Math.max(1600, state.totalDuration * state.pxPerSec)}px`;
    state.tracks.forEach((track, tIdx) => {
      const row = document.getElementById(`trackRow_${tIdx}`);
      if (!row) return;
      row.innerHTML = "";

      track.clips.forEach((clip) => {
        const media = state.mediaPool.find((m) => m.id === clip.mediaId);
        const clipEl = document.createElement("div");
        clipEl.className = `timeline-clip ${track.type === "audio" ? "audio" : ""} ${clip.id === state.selectedClipId ? "selected" : ""}`;

        const leftPx = clip.start * state.pxPerSec;
        const widthPx = clip.duration * state.pxPerSec;
        clipEl.style.left = `${leftPx}px`;
        clipEl.style.width = `${widthPx}px`;
        clipEl.innerText = media ? media.name : "Clip";

        ["left", "right"].forEach((side) => {
          const handle = document.createElement("span");
          handle.className = `clip-trim-handle ${side}`;
          handle.title = `Trim ${side} edge`;
          handle.addEventListener("mousedown", (event) => {
            event.preventDefault(); event.stopPropagation();
            state.selectedClipId = clip.id;
            const startX = event.clientX;
            const original = { start: clip.start, duration: clip.duration, trimStart: clip.trimStart };
            const move = (moveEvent) => {
              const delta = (moveEvent.clientX - startX) / state.pxPerSec;
              if (side === "left") {
                const shift = Math.max(-original.trimStart, Math.min(original.duration - 0.1, delta));
                clip.start = original.start + shift;
                clip.trimStart = original.trimStart + shift;
                clip.duration = original.duration - shift;
              } else {
                clip.duration = Math.max(0.1, Math.min(media.duration - clip.trimStart, original.duration + delta));
              }
              clipEl.style.left = `${clip.start * state.pxPerSec}px`;
              clipEl.style.width = `${clip.duration * state.pxPerSec}px`;
            };
            const up = () => {
              window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
              refreshTimelineExtent(); renderTimelineClips(); renderPreviewFrame();
            };
            window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
          });
          clipEl.appendChild(handle);
        });

        clipEl.onclick = (e) => {
          e.stopPropagation();
          state.selectedClipId = clip.id;
          syncClipInspector();
          renderTimelineClips();
        };

        // Clip Dragging
        let isDragging = false;
        let dragStartX = 0;
        let origStart = clip.start;

        clipEl.addEventListener("mousedown", (e) => {
          isDragging = true;
          state.selectedClipId = clip.id;
          dragStartX = e.clientX;
          origStart = clip.start;

          const onMove = (mv) => {
            if (!isDragging) return;
            const deltaSec = (mv.clientX - dragStartX) / state.pxPerSec;
            clip.start = Math.max(0, Math.round((origStart + deltaSec) * 30) / 30);
            clipEl.style.left = `${clip.start * state.pxPerSec}px`;
          };

          const onUp = (upEvent) => {
            isDragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const destination = upEvent.target.closest(".track-row");
            const destinationIndex = destination ? Number(destination.id.replace("trackRow_", "")) : tIdx;
            const destinationTrack = state.tracks[destinationIndex];
            const compatible = destinationTrack && ((media?.type === "audio") === (destinationTrack.type === "audio"));
            if (compatible && destinationIndex !== tIdx) {
              track.clips = track.clips.filter((item) => item !== clip);
              clip.trackIndex = destinationIndex;
              destinationTrack.clips.push(clip);
            }
            refreshTimelineExtent();
            renderTimelineClips();
            renderPreviewFrame();
          };

          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        });

        row.appendChild(clipEl);
      });
    });
  }

  // Split Clip At Playhead
  function splitClipAtPlayhead() {
    let targetClip = null;
    let targetTrack = null;

    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if (state.currentTime > clip.start && state.currentTime < clip.start + clip.duration) {
          targetClip = clip;
          targetTrack = track;
          break;
        }
      }
      if (targetClip) break;
    }

    if (!targetClip) {
      return alert("No clip under the playhead to split.");
    }

    const cutPoint = state.currentTime - targetClip.start;
    const secondDuration = targetClip.duration - cutPoint;

    // Shorten first clip
    targetClip.duration = cutPoint;

    // Create second clip
    const secondClip = {
      ...targetClip,
      id: "clip_" + Math.random().toString(36).substr(2, 9),
      start: state.currentTime,
      duration: secondDuration,
      trimStart: targetClip.trimStart + cutPoint
    };

    targetTrack.clips.push(secondClip);
    refreshTimelineExtent();
    renderTimelineClips();
    renderPreviewFrame();
  }

  // Delete Selected Clip
  function deleteSelectedClip() {
    if (!state.selectedClipId) return;
    state.tracks.forEach((track) => {
      track.clips = track.clips.filter((c) => c.id !== state.selectedClipId);
    });
    state.selectedClipId = null;
    renderTimelineClips();
    renderPreviewFrame();
  }

  // Seek Time
  function seek(time) {
    state.currentTime = Math.max(0, Math.min(state.totalDuration, Math.round(time * 30) / 30));
    timecodeDisplay.innerText = formatTimecode(state.currentTime);
    playhead.style.left = `${state.currentTime * state.pxPerSec}px`;
    renderPreviewFrame();
  }

  function refreshTimelineExtent() {
    const end = Math.max(0, ...state.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)));
    state.totalDuration = Math.max(60, end + 1);
  }

  // Render Video Preview Frame At Current Playhead
  function renderPreviewFrame() {
    prevCtx.fillStyle = "#000000";
    prevCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Look for active clips on Video Tracks
    for (let tIdx = 0; tIdx < 2; tIdx++) {
      const track = state.tracks[tIdx];
      for (const clip of track.clips) {
        if (state.currentTime >= clip.start && state.currentTime <= clip.start + clip.duration) {
          const media = state.mediaPool.find((m) => m.id === clip.mediaId);
          if (!media || !media.element) continue;

          const localTime = clip.trimStart + (state.currentTime - clip.start);

          prevCtx.save();
          prevCtx.globalAlpha = clip.opacity ?? 1;
          prevCtx.translate(previewCanvas.width / 2 + (clip.x || 0), previewCanvas.height / 2 + (clip.y || 0));
          prevCtx.scale(clip.scale || 1, clip.scale || 1);
          if (media.type === "video") {
            if (Math.abs(media.element.currentTime - localTime) > 0.15) {
              media.element.currentTime = localTime;
            }
            prevCtx.drawImage(media.element, -previewCanvas.width / 2, -previewCanvas.height / 2, previewCanvas.width, previewCanvas.height);
          } else if (media.type === "image") {
            prevCtx.drawImage(media.element, -previewCanvas.width / 2, -previewCanvas.height / 2, previewCanvas.width, previewCanvas.height);
          }
          prevCtx.restore();
        }
      }
    }
  }

  function getSelectedClip() {
    if (!state.selectedClipId) return null;
    for (const track of state.tracks) {
      const clip = track.clips.find((item) => item.id === state.selectedClipId);
      if (clip) return clip;
    }
    return null;
  }

  function syncClipInspector() {
    const clip = getSelectedClip();
    ["clipScale", "clipOpacity", "clipPosX", "clipPosY"].forEach((id) => { document.getElementById(id).disabled = !clip; });
    if (!clip) return;
    document.getElementById("clipScale").value = clip.scale ?? 1;
    document.getElementById("clipOpacity").value = clip.opacity ?? 1;
    document.getElementById("clipPosX").value = clip.x ?? 0;
    document.getElementById("clipPosY").value = clip.y ?? 0;
    document.getElementById("clipScaleValue").value = `${Math.round((clip.scale ?? 1) * 100)}%`;
    document.getElementById("clipOpacityValue").value = `${Math.round((clip.opacity ?? 1) * 100)}%`;
  }

  [["clipScale", "scale"], ["clipOpacity", "opacity"], ["clipPosX", "x"], ["clipPosY", "y"]].forEach(([id, key]) => {
    document.getElementById(id).addEventListener("input", (event) => {
      const clip = getSelectedClip();
      if (!clip) return;
      clip[key] = Number(event.target.value);
      syncClipInspector();
      renderPreviewFrame();
    });
  });

  // Playback Loop
  function togglePlayback() {
    if (state.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    state.isPlaying = true;
    playPauseBtn.innerText = "⏸";
    state.lastTick = performance.now();

    function loop(now) {
      if (!state.isPlaying) return;
      const delta = (now - state.lastTick) / 1000;
      state.lastTick = now;

      state.currentTime += delta;
      if (state.currentTime >= state.totalDuration) {
        state.currentTime = 0;
      }

      timecodeDisplay.innerText = formatTimecode(state.currentTime);
      playhead.style.left = `${state.currentTime * state.pxPerSec}px`;
      renderPreviewFrame();

      state.animFrameId = requestAnimationFrame(loop);
    }

    state.animFrameId = requestAnimationFrame(loop);
  }

  function pausePlayback() {
    state.isPlaying = false;
    playPauseBtn.innerText = "▶";
    if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  }

  // Video Export using MediaRecorder & Canvas Capture Stream
  async function exportVideo() {
    pausePlayback();
    const videoClips = state.tracks.filter((track) => track.type === "video").flatMap((track) => track.clips);
    if (!videoClips.length) return alert("Add at least one video or image clip before exporting.");
    const allClips = state.tracks.flatMap((track) => track.clips);
    const exportEnd = Math.max(0, ...allClips.map((clip) => clip.start + clip.duration));
    const stream = previewCanvas.captureStream(30);
    let audioSource = null;
    let audioDestination = null;
    const audioClips = state.tracks.filter((track) => track.type === "audio").flatMap((track) => track.clips);
    try {
      const clipsWithAudio = audioClips.map((clip) => ({
        clip,
        media: state.mediaPool.find((item) => item.id === clip.mediaId)
      })).filter(({ media }) => media && media.audioBuffer);

      if (clipsWithAudio.length) {
        const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!OfflineContext || !AudioContext) throw new Error("Audio rendering is not supported by this browser.");
        state.audioCtx ||= new AudioContext();
        if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
        const sampleRate = 44100;
        const offline = new OfflineContext(2, Math.ceil(sampleRate * exportEnd), sampleRate);
        clipsWithAudio.forEach(({ clip, media }) => {
          const source = offline.createBufferSource();
          source.buffer = media.audioBuffer;
          source.connect(offline.destination);
          source.start(clip.start, clip.trimStart || 0, clip.duration);
        });
        const mixedAudio = await offline.startRendering();
        audioDestination = state.audioCtx.createMediaStreamDestination();
        audioSource = state.audioCtx.createBufferSource();
        audioSource.buffer = mixedAudio;
        audioSource.connect(audioDestination);
        audioDestination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      return alert(`Could not render timeline audio: ${error.message}`);
    }

    const hasAudioTrack = stream.getAudioTracks().length > 0;
    const mimeCandidates = hasAudioTrack
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      return alert("This browser cannot record the local video export format.");
    }
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "filmcraft_export.webm";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (audioSource) {
        try { audioSource.stop(); } catch (e) {}
      }
      stream.getTracks().forEach((track) => track.stop());
    };

    seek(0);
    mediaRecorder.start();
    if (audioSource) audioSource.start();
    startPlayback();

    // Auto-stop at end of duration
    const checkEnd = setInterval(() => {
      if (state.currentTime >= exportEnd || !state.isPlaying) {
        clearInterval(checkEnd);
        pausePlayback();
        seek(exportEnd);
        mediaRecorder.stop();
      }
    }, 200);
  }

  function escapeHTML(str) {
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
  }

  // Timeline Ruler Scrubbing
  timelineRuler.addEventListener("click", (e) => {
    const rect = timelineRuler.getBoundingClientRect();
    const clickX = e.clientX - rect.left + tracksScrollArea.scrollLeft;
    seek(clickX / state.pxPerSec);
  });

  // Wiring Toolbar
  playPauseBtn.addEventListener("click", togglePlayback);
  document.getElementById("btnSplit").addEventListener("click", splitClipAtPlayhead);
  document.getElementById("btnDelete").addEventListener("click", deleteSelectedClip);
  document.getElementById("btnExportVideo").addEventListener("click", exportVideo);
  addSourceButton.addEventListener("click", () => {
    const item = state.mediaPool.find(media => media.id === state.selectedMediaId);
    if (item) window.FilmCraft.addClip(item.id);
  });

  mediaFileInput.addEventListener("change", (e) => {
    Array.from(e.target.files).forEach((f) => importMedia(f));
  });
  document.getElementById("importMediaBtn").addEventListener("click", () => mediaFileInput.click());

  state.tracks.forEach((track, index) => {
    const row = document.getElementById(`trackRow_${index}`);
    row.addEventListener("dragover", event => {
      if (event.dataTransfer.types.includes("application/x-filmcraft-media-id") || event.dataTransfer.types.includes("text/plain")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        row.classList.add("media-drop-target");
      }
    });
    row.addEventListener("dragleave", event => {
      if (!row.contains(event.relatedTarget)) row.classList.remove("media-drop-target");
    });
    row.addEventListener("drop", event => {
      event.preventDefault();
      row.classList.remove("media-drop-target");
      const mediaId = event.dataTransfer.getData("application/x-filmcraft-media-id") || event.dataTransfer.getData("text/plain");
      const media = state.mediaPool.find(item => item.id === mediaId);
      if (!media) return;
      const mediaTrackType = media.type === "audio" ? "audio" : "video";
      if (track.type !== mediaTrackType) return;
      const rect = row.getBoundingClientRect();
      const startTime = Math.max(0, (event.clientX - rect.left + tracksScrollArea.scrollLeft) / state.pxPerSec);
      addClipToTrack(media.id, index, startTime);
    });
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      togglePlayback();
    } else if (e.key.toLowerCase() === "s") {
      splitClipAtPlayhead();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelectedClip();
    }
  });

  // Global helper for inline UI
  window.FilmCraft = {
    addClip: (id) => {
      const media = state.mediaPool.find((item) => item.id === id);
      addClipToTrack(id, media && media.type === "audio" ? 2 : 0);
    }
  };

  // Initial draw
  renderPreviewFrame();
  syncClipInspector();

})();
