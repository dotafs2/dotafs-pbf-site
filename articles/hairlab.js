const start = document.getElementById('start-lab');
const stop = document.getElementById('stop-lab');
const poster = document.getElementById('lab-poster');
const viewport = document.getElementById('lab-view');
let resize;

function openLab() {
  if (viewport.firstElementChild) return;
  const url = new URL(start.href);
  url.searchParams.set('embed', '1');
  const frame = document.createElement('iframe');
  frame.title = '披发实验';
  frame.src = url.href;
  frame.addEventListener('load', () => {
    const main = frame.contentDocument?.querySelector('main');
    if (!main || !frame.isConnected) return;
    resize = new ResizeObserver(() => {
      frame.style.height = Math.ceil(main.getBoundingClientRect().height + 2) + 'px';
    });
    resize.observe(main);
  }, {once: true});
  viewport.replaceChildren(frame);
  start.hidden = poster.hidden = true;
  stop.hidden = false;
}

start.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openLab();
  stop.focus({preventScroll: true});
});

stop.addEventListener('click', () => {
  resize?.disconnect();
  viewport.replaceChildren();
  stop.hidden = true;
  start.hidden = poster.hidden = false;
  start.focus({preventScroll: true});
});

openLab();
