(() => {
  'use strict';
  const video = document.getElementById('ue-fireworks-video');
  if (!video) return;
  const fps = Number(video.dataset.fps) || 30;
  const frameCount = Number(video.dataset.frames) || 240;
  const status = document.getElementById('video-status');
  document.getElementById('video-speed').addEventListener('change', event => {
    video.playbackRate = Number(event.target.value);
    status.textContent = `播放速度 ${video.playbackRate}×；采集时间步与帧数不变。`;
  });
  document.querySelectorAll('[data-frame-step]').forEach(button => {
    button.addEventListener('click', () => {
      video.pause();
      const frames = Number(button.dataset.frameStep);
      video.currentTime = Math.max(0, Math.min((video.duration || frameCount / fps) - 1 / fps, video.currentTime + frames / fps));
      status.textContent = `已暂停，约第 ${Math.round(video.currentTime * fps)} 帧。可打开下方 PNG 查看无视频压缩的细节。`;
    });
  });
  document.getElementById('video-reset').addEventListener('click', () => {
    video.pause(); video.currentTime = 0; video.playbackRate = 1;
    document.getElementById('video-speed').value = '1';
    status.textContent = `已回到片头。${frameCount / fps} 秒，${frameCount} 帧，${video.videoWidth || video.width}×${video.videoHeight || video.height}。`;
  });
})();
