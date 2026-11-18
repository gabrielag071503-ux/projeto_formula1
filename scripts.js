const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const mainEl = document.querySelector('main');
const transitionCanvas = document.getElementById('tab-transition-canvas');
const ctx = transitionCanvas.getContext('2d');
const headerBg = document.querySelector('.header-bg');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resizeTransitionCanvas() {
    const rect = mainEl.getBoundingClientRect();
    transitionCanvas.width = rect.width;
    transitionCanvas.height = rect.height;
}

function buildChequerGrid() {
    const cell = 42;
    const cols = Math.ceil(transitionCanvas.width / cell) + 1;
    const rows = Math.ceil(transitionCanvas.height / cell) + 1;
    const cells = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            cells.push({
                x: col * cell,
                y: row * cell,
                delay: Math.random() * 220,
                color: (col + row) % 2 === 0 ? '#0A0A0A' : '#FFD100'
            });
        }
    }
    return { cells, cell };
}

function playDissolve(direction, duration) {
    return new Promise(resolve => {
        resizeTransitionCanvas();
        const { cells, cell } = buildChequerGrid();
        const start = performance.now();
        transitionCanvas.style.display = 'block';

        function frame(now) {
            const elapsed = now - start;
            ctx.clearRect(0, 0, transitionCanvas.width, transitionCanvas.height);
            let allDone = true;

            for (const square of cells) {
                let local = (elapsed - square.delay) / duration;
                local = Math.max(0, Math.min(1, local));
                if (local < 1) allDone = false;

                const opacity = direction === 'in' ? local : 1 - local;
                if (opacity > 0) {
                    ctx.globalAlpha = opacity;
                    ctx.fillStyle = square.color;
                    ctx.fillRect(square.x, square.y, cell, cell);
                }
            }

            ctx.globalAlpha = 1;

            if (!allDone) {
                requestAnimationFrame(frame);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(frame);
    });
}

function animateCounters(section) {
    const numbers = section.querySelectorAll('.stat-number[data-target]');

    numbers.forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        const suffix = el.dataset.suffix || '';

        if (reduceMotion) {
            el.textContent = target + suffix;
            return;
        }

        const duration = 1200;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.floor(target * eased);
            el.textContent = value + suffix;

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = target + suffix;
            }
        }

        requestAnimationFrame(tick);
    });
}

function revealWords(el, stagger) {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';

    const words = text.split(' ');
    words.forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'reveal-word';
        span.textContent = word;
        span.setAttribute('aria-hidden', 'true');
        span.style.transitionDelay = reduceMotion ? '0ms' : (i * stagger) + 'ms';
        el.appendChild(span);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.querySelectorAll('.reveal-word').forEach(span => span.classList.add('visible'));
        });
    });
}

async function switchTab(button) {
    const target = button.dataset.tab;
    const currentActive = document.querySelector('.tab-content.active');
    if (currentActive && currentActive.id === target) return;

    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const activateSection = section => {
        section.classList.add('active');
        if (target === 'titulos') animateCounters(section);
        if (target === 'linha-tempo') updateTimelineRail();
        const heading = section.querySelector('h2');
        if (heading && !heading.dataset.revealed) {
            heading.dataset.revealed = 'true';
            revealWords(heading, 60);
        }
    };

    if (reduceMotion) {
        tabContents.forEach(content => content.classList.remove('active'));
        activateSection(document.getElementById(target));
        return;
    }

    await playDissolve('in', 260);
    tabContents.forEach(content => content.classList.remove('active'));
    activateSection(document.getElementById(target));
    await playDissolve('out', 260);
    transitionCanvas.style.display = 'none';
}

tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button));
});

if (!reduceMotion && headerBg) {
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const offset = window.scrollY * 0.12;
                headerBg.style.transform = `translateY(${offset}px)`;
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('paused-animations', document.hidden);
});

const timelineItems = document.querySelectorAll('.timeline-item');

if (timelineItems.length) {
    if (reduceMotion) {
        timelineItems.forEach(item => item.classList.add('visible'));
    } else {
        const timelineObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    timelineObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        timelineItems.forEach(item => timelineObserver.observe(item));
    }
}

const headerVideo = document.querySelector('.header-video');

if (headerVideo) {
    const isNarrowScreen = window.matchMedia('(max-width: 640px)').matches;
    const connection = navigator.connection;
    const isSlowOrSaver = connection && (connection.saveData || /2g/.test(connection.effectiveType || ''));

    if (!reduceMotion && !isNarrowScreen && !isSlowOrSaver) {
        document.body.classList.add('video-bg-active');
        headerVideo.preload = 'auto';
        headerVideo.load();
        headerVideo.play().catch(() => {
            document.body.classList.remove('video-bg-active');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                headerVideo.pause();
            } else {
                headerVideo.play().catch(() => {});
            }
        });
    }
}

const galleryItems = document.querySelectorAll('.gallery-item');
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox.querySelector('.lightbox-img');
const lightboxModel = lightbox.querySelector('.lightbox-model');
const lightboxCaption = lightbox.querySelector('.lightbox-caption');
const lightboxClose = lightbox.querySelector('.lightbox-close');
let lastFocusedGalleryItem = null;

galleryItems.forEach(item => {
    const img = item.querySelector('img');

    img.addEventListener('error', () => {
        img.classList.add('img-missing');
        item.classList.add('missing');
    });

    item.addEventListener('click', () => {
        if (item.classList.contains('missing')) return;

        lastFocusedGalleryItem = item;
        lightboxImg.src = item.dataset.file;
        lightboxImg.alt = img.alt;
        lightboxModel.textContent = item.dataset.model;
        lightboxCaption.textContent = item.dataset.caption;
        lightbox.hidden = false;
        document.body.classList.add('lightbox-open');
        lightboxClose.focus();
    });
});

function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = '';
    document.body.classList.remove('lightbox-open');
    if (lastFocusedGalleryItem) lastFocusedGalleryItem.focus();
}

lightboxClose.addEventListener('click', closeLightbox);

lightbox.addEventListener('click', event => {
    if (event.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
});

const headerH1 = document.querySelector('header h1');
if (headerH1) revealWords(headerH1, 90);

const loadingVeil = document.getElementById('loading-veil');
if (loadingVeil) {
    const alreadyShown = sessionStorage.getItem('ferrariVeilShown');
    if (reduceMotion || alreadyShown) {
        loadingVeil.remove();
    } else {
        const veilFill = loadingVeil.querySelector('.veil-fill');
        const start = performance.now();
        let settled = false;

        function veilTick(now) {
            if (settled) return;
            const t = Math.min(1, (now - start) / 1400);
            const eased = 1 - Math.pow(1 - t, 3);
            veilFill.style.transform = `scaleY(${eased * 0.7})`;
            if (t < 1) requestAnimationFrame(veilTick);
        }

        requestAnimationFrame(veilTick);

        window.addEventListener('load', () => {
            settled = true;
            veilFill.style.transition = 'transform 300ms ease';
            veilFill.style.transform = 'scaleY(1)';
            setTimeout(() => {
                loadingVeil.classList.add('veil-hidden');
                sessionStorage.setItem('ferrariVeilShown', '1');
                setTimeout(() => loadingVeil.remove(), 550);
            }, 350);
        });
    }
}

const circuitPath = document.querySelector('.circuit-trace path');
const circuitMarkers = document.querySelectorAll('.circuit-marker');

if (circuitPath) {
    if (reduceMotion) {
        circuitPath.style.strokeDashoffset = '0';
        circuitMarkers.forEach(marker => marker.classList.add('lit'));
    } else {
        const length = circuitPath.getTotalLength();
        circuitPath.style.strokeDasharray = length;
        circuitPath.style.strokeDashoffset = length;

        const drawCircuit = () => {
            const duration = 2400;
            const start = performance.now();

            function tick(now) {
                const t = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                circuitPath.style.strokeDashoffset = length * (1 - eased);

                circuitMarkers.forEach((marker, i) => {
                    const threshold = 0.3 + i * 0.25;
                    if (t >= threshold) marker.classList.add('lit');
                });

                if (t < 1) requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
        };

        const headerEl = document.querySelector('header');
        const circuitObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    drawCircuit();
                    circuitObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        circuitObserver.observe(headerEl);
    }
}

function addCorners(el) {
    ['tl', 'tr', 'bl', 'br'].forEach(position => {
        const span = document.createElement('span');
        span.className = 'corner corner-' + position;
        span.setAttribute('aria-hidden', 'true');
        el.appendChild(span);
    });
}

document.querySelectorAll('.stat, .idol-card').forEach(addCorners);

let halftoneReady = false;
let halftoneDraw = null;

function initHalftone() {
    const canvas = document.querySelector('.halftone-canvas');
    if (!canvas) return;
    const parent = canvas.parentElement;
    const context = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    const pointer = { x: -9999, y: -9999 };

    function resize() {
        const rect = parent.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
        if (!width || !height) return;
        context.clearRect(0, 0, width, height);
        const spacing = 22;
        for (let y = spacing / 2; y < height; y += spacing) {
            for (let x = spacing / 2; x < width; x += spacing) {
                const d = Math.hypot(x - pointer.x, y - pointer.y);
                const t = Math.max(0, 1 - d / 140);
                const r = 1.2 + t * 2.3;
                context.beginPath();
                context.fillStyle = `rgba(255, 209, 0, ${0.12 + t * 0.65})`;
                context.arc(x, y, r, 0, Math.PI * 2);
                context.fill();
            }
        }
    }

    resize();
    draw();
    halftoneDraw = () => { resize(); draw(); };

    window.addEventListener('resize', () => { resize(); draw(); });

    if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        parent.addEventListener('pointermove', event => {
            const rect = canvas.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            requestAnimationFrame(draw);
        });
        parent.addEventListener('pointerleave', () => {
            pointer.x = -9999;
            pointer.y = -9999;
            draw();
        });
    }

    halftoneReady = true;
}

const originalAnimateCounters = animateCounters;
animateCounters = function (section) {
    if (!halftoneReady) {
        initHalftone();
    } else if (halftoneDraw) {
        halftoneDraw();
    }
    originalAnimateCounters(section);
};

function updateTimelineRail() {
    const wrap = document.querySelector('.timeline-wrap');
    if (!wrap || wrap.offsetParent === null) return;

    const timelineEl = wrap.querySelector('.timeline');
    const marker = wrap.querySelector('.timeline-marker');
    if (!timelineEl || !marker) return;

    const rect = timelineEl.getBoundingClientRect();
    const vh = window.innerHeight;
    let progress = (vh - rect.top) / (rect.height + vh);
    progress = Math.max(0, Math.min(1, progress));

    const maxTop = Math.max(0, timelineEl.clientHeight - 14);
    marker.style.top = (progress * maxTop) + 'px';
    marker.style.transform = `rotate(${progress * 720}deg)`;

    const markerRect = marker.getBoundingClientRect();
    timelineEl.querySelectorAll('.timeline-dot').forEach(dot => {
        const dotRect = dot.getBoundingClientRect();
        dot.classList.toggle('active', markerRect.top + markerRect.height / 2 >= dotRect.top);
    });
}

if (!reduceMotion) {
    let railTicking = false;
    window.addEventListener('scroll', () => {
        if (!railTicking) {
            requestAnimationFrame(() => {
                updateTimelineRail();
                railTicking = false;
            });
            railTicking = true;
        }
    }, { passive: true });
}

function setupGalleryReveal(item, img) {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const reveal = document.createElement('div');
    reveal.className = 'color-reveal';
    reveal.style.backgroundImage = `url(${img.currentSrc || img.src})`;
    item.appendChild(reveal);
    item.classList.add('has-reveal');

    item.addEventListener('pointermove', event => {
        const rect = item.getBoundingClientRect();
        const mx = ((event.clientX - rect.left) / rect.width * 100) + '%';
        const my = ((event.clientY - rect.top) / rect.height * 100) + '%';
        item.style.setProperty('--mx', mx);
        item.style.setProperty('--my', my);
    });
}

galleryItems.forEach(item => {
    const img = item.querySelector('img');
    if (img.complete && img.naturalWidth > 0) {
        setupGalleryReveal(item, img);
    } else {
        img.addEventListener('load', () => setupGalleryReveal(item, img));
    }
});