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
      { id: "a1", type: "audio", name: "Audio 1", clips: [] }
    ],
    currentTime: 0,
    totalDuration: 60, // seconds
    pxPerSec: 25,
    isPlaying: false,
    selectedClipId: null,
    animFrameId: null,
    lastTick: 0
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
      element: el,
      url: url
    };

    state.mediaPool.push(mediaItem);
    renderMediaPoolUI();

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
      const icon = item.type === "video" ? "🎬" : (item.type === "audio" ? "🎵" : "🖼️");
      div.innerHTML = `
        <span>${icon}</span>
        <div style="flex:1; overflow:hidden;">
          <div style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(item.name)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${item.type.toUpperCase()} &middot; ${Math.round(item.duration)}s</div>
        </div>
        <button class="thumb-btn" title="Add to timeline" onclick="window.FilmCraft.addClip('${item.id}')">➕</button>
      `;
      mediaListEl.appendChild(div);
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
      trimStart: 0
    };

    track.clips.push(clip);
    renderTimelineClips();
    renderPreviewFrame();
  }

  // Render Timeline Clips UI
  function renderTimelineClips() {
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

        clipEl.onclick = (e) => {
          e.stopPropagation();
          state.selectedClipId = clip.id;
          renderTimelineClips();
        };

        // Clip Dragging
        let isDragging = false;
        let dragStartX = 0;
        let origStart = clip.start;

        clipEl.addEventListener("mousedown", (e) => {
          isDragging = true;
          dragStartX = e.clientX;
          origStart = clip.start;

          const onMove = (mv) => {
            if (!isDragging) return;
            const deltaSec = (mv.clientX - dragStartX) / state.pxPerSec;
            clip.start = Math.max(0, origStart + deltaSec);
            clipEl.style.left = `${clip.start * state.pxPerSec}px`;
          };

          const onUp = () => {
            isDragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
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
      id: "clip_" + Math.random().toString(36).substr(2, 9),
      mediaId: targetClip.mediaId,
      trackIndex: targetClip.trackIndex,
      start: state.currentTime,
      duration: secondDuration,
      trimStart: targetClip.trimStart + cutPoint
    };

    targetTrack.clips.push(secondClip);
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
    state.currentTime = Math.max(0, Math.min(state.totalDuration, time));
    timecodeDisplay.innerText = formatTimecode(state.currentTime);
    playhead.style.left = `${state.currentTime * state.pxPerSec}px`;
    renderPreviewFrame();
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

          if (media.type === "video") {
            if (Math.abs(media.element.currentTime - localTime) > 0.15) {
              media.element.currentTime = localTime;
            }
            prevCtx.drawImage(media.element, 0, 0, previewCanvas.width, previewCanvas.height);
          } else if (media.type === "image") {
            prevCtx.drawImage(media.element, 0, 0, previewCanvas.width, previewCanvas.height);
          }
        }
      }
    }
  }

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
    alert("Export started! The timeline will play through to encode your video.");

    const stream = previewCanvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
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
      alert("Export complete! Download started.");
    };

    seek(0);
    mediaRecorder.start();
    startPlayback();

    // Auto-stop at end of duration
    const checkEnd = setInterval(() => {
      if (state.currentTime >= 15 || !state.isPlaying) { // encode 15s sample or total
        clearInterval(checkEnd);
        pausePlayback();
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

  mediaFileInput.addEventListener("change", (e) => {
    Array.from(e.target.files).forEach((f) => importMedia(f));
  });
  document.getElementById("importMediaBtn").addEventListener("click", () => mediaFileInput.click());

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
    addClip: (id) => addClipToTrack(id, 0)
  };

  // Initial draw
  renderPreviewFrame();

})();
