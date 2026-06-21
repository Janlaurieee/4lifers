/* ============================================================
   FRIENDSHIP LETTER WEB APP — Main Application Logic
   ============================================================
   This script handles:
     1. Webcam initialisation via getUserMedia()
     2. Teachable Machine model loading & inference
     3. Gesture detection (Finger Heart) with configurable threshold
     4. Surprise animation orchestration (letter, bouquet, effects)
     5. Particle engine for hearts, sparkles & petals
   ============================================================ */

; (function () {
  'use strict';

  // =====================================================
  // ❶  CONFIGURATION — easy to customise
  // =====================================================

  /**
   * 🔗  TEACHABLE MACHINE MODEL URL
   * -------------------------------------------------------
   * Replace this URL with your own Teachable Machine model.
   *
   * How to get your model URL:
   *   1. Go to https://teachablemachine.withgoogle.com/
   *   2. Create a new "Image Project"
   *   3. Add at least two classes:
   *        • "Finger Heart"  — record samples of the finger-heart gesture
   *        • "No Gesture"    — record samples of a neutral hand / background
   *   4. Train the model
   *   5. Click "Export Model" → "Upload" → Copy the shareable link
   *   6. Paste it below (keep the trailing slash)
   *
   * The URL should look like:
   *   https://teachablemachine.withgoogle.com/models/XXXXXXX/
   */
  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/TgPxvgI-Q/';

  /**
   * 🏷️  CLASS LABEL
   * The exact class name in your Teachable Machine model that
   * represents the "Finger Heart" gesture. Must match exactly.
   */
  const TARGET_CLASS = 'Class 1';

  /**
   * 🎯  CONFIDENCE THRESHOLD  (0 – 1)
   * The minimum prediction probability required to trigger the surprise.
   * 0.90 = 90% confidence.
   */
  const CONFIDENCE_THRESHOLD = 0.90;

  /**
   * 💌  PERSONALISED LETTER TEXT
   * -------------------------------------------------------
   * Edit this string to change the letter content.
   * The text is displayed with a typewriter animation.
   * Use \n for line breaks.
   */
  const LETTER_TEXT =
    `Dear Besties, 4Lifers 💖

I just wanted to take a moment to tell all of you how incredibly lucky I am to have you in my life. You're the kind of friends who make even the most ordinary days feel special and memorable.

College life is really tough right now, no? 😭 But padayon lang gyapon ta! No matter how stressful things get, I'm always thankful knowing that I have friends like you by my side, even if we're all busy with our own lives.

One request lang gid ah — please don't let our TikTok streak die! 😂 I know we're all very busy, but I still look forward to seeing those notifications every day. Hope you're all doing well. Even if we don't get to talk as often, don't worry because I'm always checking your socials just to stay updated with all of you. HAHAHAHA!

Thank you for all the memories, the laughter, the chika, and for being part of my college journey. Distance, schedules, and responsibilities may keep us busy, but our friendship will always remain the same.

Maye, Jemjem, Bengbeng, Ayen, Gelay, and Darren — thank you for being my people. 💕

Always remember that you are loved, appreciated, and cherished more than you know.

Love you all, always and forever. 💐✨`;

  // =====================================================
  // ❷  DOM REFERENCES
  // =====================================================
  const loadingScreen = document.getElementById('loading-screen');
  const permOverlay = document.getElementById('permission-overlay');
  const btnAllowCamera = document.getElementById('btn-allow-camera');
  const cameraSection = document.getElementById('camera-section');
  const webcamEl = document.getElementById('webcam');
  const statusText = document.getElementById('status-text');
  const confidenceBar = document.getElementById('confidence-bar');
  const surpriseSection = document.getElementById('surprise-section');
  const letterCard = document.getElementById('letter-card');
  const letterBody = document.getElementById('letter-body');
  const letterSign = document.getElementById('letter-sign');
  const letterActions = document.getElementById('letter-actions');
  const bouquetWrap = document.getElementById('bouquet-container');
  const particlesCanvas = document.getElementById('particles-canvas');
  const flowerGarden = document.getElementById('flower-garden');
  const btnReplay = document.getElementById('btn-replay');
  const btnClose = document.getElementById('btn-close');
  const btnEmail = document.getElementById('btn-email');
  const replayBar = document.getElementById('replay-bar');
  const btnReplayBar = document.getElementById('btn-replay-bar');

  const ctx = particlesCanvas.getContext('2d');

  // =====================================================
  // ❸  STATE
  // =====================================================
  let model = null;
  let animationPlaying = false;
  let particleRAF = null;
  let particles = [];
  let typewriterTimer = null;
  let flowersData = [];

  // =====================================================
  // ❹  WEBCAM
  // =====================================================

  /** Request camera permission and start the video feed. */
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      webcamEl.srcObject = stream;
      await webcamEl.play();
      permOverlay.classList.add('hidden');
      return true;
    } catch (err) {
      console.error('Camera access denied:', err);
      statusText.textContent = '⚠️ Camera access is required for this experience.';
      return false;
    }
  }

  // =====================================================
  // ❺  TEACHABLE MACHINE MODEL
  // =====================================================

  /** Load the Teachable Machine image model from MODEL_URL. */
  async function loadModel() {
    const modelURL = MODEL_URL + 'model.json';
    const metadataURL = MODEL_URL + 'metadata.json';
    model = await tmImage.load(modelURL, metadataURL);
    console.log('✅ Teachable Machine model loaded', model.getTotalClasses(), 'classes');
  }

  // =====================================================
  // ❻  PREDICTION LOOP
  // =====================================================

  /** Continuously classify webcam frames. */
  async function predictionLoop() {
    if (!model || animationPlaying) {
      requestAnimationFrame(predictionLoop);
      return;
    }

    const predictions = await model.predict(webcamEl);

    // Find the target class prediction
    let targetPred = null;
    for (const p of predictions) {
      if (p.className === TARGET_CLASS) {
        targetPred = p;
        break;
      }
    }

    if (targetPred) {
      const pct = Math.round(targetPred.probability * 100);
      confidenceBar.style.width = pct + '%';

      if (targetPred.probability >= CONFIDENCE_THRESHOLD) {
        statusText.textContent = '💖 Gesture detected!';
        triggerSurprise();
        return; // stop loop, will be re-started on replay
      } else {
        statusText.textContent = `Scanning… ${pct}% confidence`;
      }
    } else {
      confidenceBar.style.width = '0%';
      statusText.textContent = 'Waiting for gesture…';
    }

    requestAnimationFrame(predictionLoop);
  }

  // =====================================================
  // ❼  SURPRISE ORCHESTRATION
  // =====================================================

  /** Main entry to play the full surprise sequence. */
  function triggerSurprise() {
    if (animationPlaying) return;
    animationPlaying = true;

    // hide camera section
    cameraSection.classList.add('hidden');
    replayBar.classList.remove('visible');

    // show celebration overlay
    surpriseSection.classList.add('active');

    // resize canvas
    resizeCanvas();

    // Staggered timeline:
    //  0.0s  — overlay fades in
    //  0.3s  — bouquet slides up
    //  0.8s  — letter card appears
    //  1.5s  — typewriter starts
    //  end   — sign + actions appear
    // Initialise the growing flower garden
    initFlowerGarden();

    setTimeout(() => bouquetWrap.classList.add('visible'), 300);
    setTimeout(() => letterCard.classList.add('visible'), 800);
    setTimeout(() => startTypewriter(), 1500);

    // particles
    startParticles();

    // spawn CSS floating hearts
    spawnFloatingHearts();
  }

  /** Reset everything so it can be replayed. */
  function resetSurprise() {
    animationPlaying = false;

    // hide surprise
    surpriseSection.classList.remove('active');
    letterCard.classList.remove('visible');
    bouquetWrap.classList.remove('visible');
    letterSign.classList.remove('visible');
    letterActions.classList.remove('visible');

    // clear letter
    letterBody.innerHTML = '';

    // stop particles
    if (particleRAF) cancelAnimationFrame(particleRAF);
    particles = [];
    ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

    // clear typewriter
    if (typewriterTimer) clearTimeout(typewriterTimer);

    // clear flower garden
    if (flowerGarden) {
      flowerGarden.innerHTML = '';
    }
    flowersData = [];

    // remove floating hearts
    document.querySelectorAll('.floating-heart, .sparkle').forEach(el => el.remove());
  }

  // =====================================================
  // ❽  TYPEWRITER ANIMATION
  // =====================================================

  function startTypewriter() {
    const chars = LETTER_TEXT.split('');
    let i = 0;
    letterBody.innerHTML = '<span class="typewriter-cursor"></span>';

    // Set initial growth of flower garden to 0
    updateFlowerGarden(0);

    function type() {
      if (i < chars.length) {
        // insert char before cursor
        const cursor = letterBody.querySelector('.typewriter-cursor');
        const span = document.createTextNode(chars[i]);
        letterBody.insertBefore(span, cursor);
        i++;

        // Update flower garden progress in sync with typewriter text
        const progress = i / chars.length;
        updateFlowerGarden(progress);

        const delay = chars[i - 1] === '\n' ? 100 : (20 + Math.random() * 30);
        typewriterTimer = setTimeout(type, delay);
      } else {
        // done — remove cursor, show sign & buttons
        const cursor = letterBody.querySelector('.typewriter-cursor');
        if (cursor) cursor.remove();

        // Ensure garden is fully bloomed
        updateFlowerGarden(1.0);

        letterSign.classList.add('visible');
        setTimeout(() => letterActions.classList.add('visible'), 400);
      }
    }
    type();
  }

  // =====================================================
  // ❽b  GROWING FLOWER GARDEN
  // =====================================================

  /** Populate the background flower garden with inactive, 0-growth flowers. */
  function initFlowerGarden() {
    if (!flowerGarden) return;
    flowerGarden.innerHTML = '';
    flowersData = [];

    const flowerCount = 18;
    const colors = [
      '#ff8fab', '#ffd6e0', '#c3aed6', '#ffd6a5',
      '#f7cad0', '#e8dff5', '#ffb3c6', '#d4a5ff',
      '#fbc4ab', '#ffd670', '#a2d2ff'
    ];
    const types = ['rose', 'tulip', 'bud', 'daisy'];

    for (let j = 0; j < flowerCount; j++) {
      // Position calculation to frame the letter card:
      // left side (2% - 22%), right side (78% - 98%), center background (25% - 75%)
      let leftPct;
      let stemHeight;
      let bloomSize;

      if (j < 6) {
        // Left side (taller flowers)
        leftPct = 2 + (j * 3.5) + (Math.random() * 2);
        stemHeight = 150 + Math.random() * 120;
        bloomSize = 35 + Math.random() * 15;
      } else if (j < 12) {
        // Right side (taller flowers)
        leftPct = 78 + ((j - 6) * 3.5) + (Math.random() * 2);
        stemHeight = 150 + Math.random() * 120;
        bloomSize = 35 + Math.random() * 15;
      } else {
        // Center background (shorter, peeking from behind the bottom of the letter card)
        leftPct = 25 + ((j - 12) * 8) + (Math.random() * 4);
        stemHeight = 60 + Math.random() * 80;
        bloomSize = 25 + Math.random() * 12;
      }

      const type = types[Math.floor(Math.random() * types.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];

      // Sprouted staggered trigger points (between 5% and 80% typewriter progress)
      const sproutProgress = 0.05 + (j / flowerCount) * 0.75;

      // Create garden-flower element
      const flowerEl = document.createElement('div');
      flowerEl.className = 'garden-flower';
      flowerEl.style.left = `${leftPct}%`;
      flowerEl.style.bottom = `${-10 + Math.random() * 15}px`;
      flowerEl.style.setProperty('--stem-h', `${stemHeight}px`);
      flowerEl.style.setProperty('--bloom-size', `${bloomSize}px`);

      // Randomise swaying properties
      flowerEl.style.setProperty('--sway-dur', `${4 + Math.random() * 3}s`);
      flowerEl.style.setProperty('--sway', `${0.6 + Math.random() * 0.8}`);

      // Create bloom element
      const bloomEl = document.createElement('div');
      bloomEl.className = `flower-bloom ${type === 'daisy' ? '' : type}`;
      bloomEl.style.setProperty('--petal-color', color);

      // Create petals according to flower type
      let petalCount = 6;
      if (type === 'rose') petalCount = 5;
      else if (type === 'tulip') petalCount = 3;
      else if (type === 'bud') petalCount = 2;

      for (let p = 0; p < petalCount; p++) {
        const petal = document.createElement('div');
        petal.className = 'flower-petal';
        bloomEl.appendChild(petal);
      }

      // Daisies get a pistil center
      if (type === 'daisy') {
        const center = document.createElement('div');
        center.className = 'flower-center';
        bloomEl.appendChild(center);
      }

      // Create stem and leaves
      const stemEl = document.createElement('div');
      stemEl.className = 'flower-stem';
      stemEl.style.position = 'relative';

      const leafLeft = document.createElement('div');
      leafLeft.className = 'flower-leaf left';
      const leafRight = document.createElement('div');
      leafRight.className = 'flower-leaf right';

      stemEl.appendChild(leafLeft);
      stemEl.appendChild(leafRight);

      flowerEl.appendChild(bloomEl);
      flowerEl.appendChild(stemEl);

      flowerGarden.appendChild(flowerEl);

      flowersData.push({
        el: flowerEl,
        sproutProgress: sproutProgress,
        growthDuration: 0.15 // Takes 15% progress interval to fully bloom
      });
    }
  }

  /** Update flower growth styles based on typing progress (0.0 to 1.0) */
  function updateFlowerGarden(progress) {
    flowersData.forEach(flower => {
      if (progress >= flower.sproutProgress) {
        const rawGrowth = (progress - flower.sproutProgress) / flower.growthDuration;
        const growth = Math.min(1, Math.max(0, rawGrowth));
        flower.el.style.setProperty('--grow', growth);
        if (growth >= 0.95) {
          flower.el.classList.add('swaying');
        } else {
          flower.el.classList.remove('swaying');
        }
      } else {
        flower.el.style.setProperty('--grow', 0);
        flower.el.classList.remove('swaying');
      }
    });
  }

  // =====================================================
  // ❾  PARTICLE ENGINE (Canvas)
  // =====================================================

  function resizeCanvas() {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
  }

  /** Create a single particle object. */
  function createParticle() {
    const types = ['heart', 'petal', 'sparkle', 'circle'];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
      x: Math.random() * particlesCanvas.width,
      y: particlesCanvas.height + 20 + Math.random() * 80,
      size: 6 + Math.random() * 14,
      speedX: (Math.random() - 0.5) * 1.5,
      speedY: -(1.2 + Math.random() * 2.5),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.06,
      opacity: 0.7 + Math.random() * 0.3,
      type,
      color: randomPastel(),
      life: 1
    };
  }

  function randomPastel() {
    const pastels = [
      '#ff8fab', '#ffd6e0', '#c3aed6', '#ffd6a5',
      '#f7cad0', '#e8dff5', '#ffb3c6', '#d4a5ff',
      '#fbc4ab', '#b5e48c', '#ffd670', '#a2d2ff'
    ];
    return pastels[Math.floor(Math.random() * pastels.length)];
  }

  /** Draw a simple heart shape on canvas. */
  function drawHeart(x, y, size, color, opacity, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = size / 2;
    ctx.moveTo(0, s * 0.4);
    ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.8, s * 0.6, 0, s * 1.6);
    ctx.bezierCurveTo(s * 1.8, s * 0.6, s, -s * 0.5, 0, s * 0.4);
    ctx.fill();
    ctx.restore();
  }

  /** Draw a petal shape. */
  function drawPetal(x, y, size, color, opacity, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Draw a sparkle (4-pointed star). */
  function drawSparkle(x, y, size, color, opacity, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      ctx.lineTo(Math.cos(angle + Math.PI / 4) * size * 0.3,
        Math.sin(angle + Math.PI / 4) * size * 0.3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Main particle animation frame loop. */
  function animateParticles() {
    ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

    // spawn new particles
    if (particles.length < 120) {
      particles.push(createParticle());
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      p.life -= 0.003;
      p.opacity = Math.max(0, p.life);

      if (p.life <= 0 || p.y < -30) {
        particles.splice(i, 1);
        continue;
      }

      switch (p.type) {
        case 'heart':
          drawHeart(p.x, p.y, p.size, p.color, p.opacity, p.rotation);
          break;
        case 'petal':
          drawPetal(p.x, p.y, p.size, p.color, p.opacity, p.rotation);
          break;
        case 'sparkle':
          drawSparkle(p.x, p.y, p.size, p.color, p.opacity, p.rotation);
          break;
        case 'circle':
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
      }
    }

    particleRAF = requestAnimationFrame(animateParticles);
  }

  function startParticles() {
    particles = [];
    // seed with initial burst
    for (let i = 0; i < 40; i++) {
      const p = createParticle();
      p.y = Math.random() * particlesCanvas.height;
      particles.push(p);
    }
    animateParticles();
  }

  // =====================================================
  // ❿  CSS FLOATING HEARTS  (DOM elements, complementing canvas)
  // =====================================================

  function spawnFloatingHearts() {
    const emojis = ['💕', '💖', '💗', '🌸', '🩷', '✨', '🌷', '💐', '🩵', '🦋'];
    let count = 0;
    const maxHearts = 30;

    function spawn() {
      if (count >= maxHearts || !animationPlaying) return;
      const el = document.createElement('span');
      el.className = 'floating-heart';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.bottom = '-40px';
      el.style.setProperty('--dur', (3 + Math.random() * 4) + 's');
      el.style.fontSize = (1.2 + Math.random() * 1.4) + 'rem';
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
      count++;
      setTimeout(spawn, 200 + Math.random() * 500);
    }
    spawn();
  }

  // =====================================================
  // ⓫  EVENT LISTENERS
  // =====================================================

  // Allow camera button
  btnAllowCamera.addEventListener('click', async () => {
    const ok = await startWebcam();
    if (ok) {
      await initModel();
    }
  });

  // Replay from inside the letter
  btnReplay.addEventListener('click', () => {
    resetSurprise();
    setTimeout(() => triggerSurprise(), 400);
  });

  // Close the surprise, go back to camera
  btnClose.addEventListener('click', () => {
    resetSurprise();
    cameraSection.classList.remove('hidden');
    replayBar.classList.add('visible');
    // restart prediction loop
    requestAnimationFrame(predictionLoop);
  });

  // Send letter via email
  btnEmail.addEventListener('click', () => {
    const recipient = 'mail.google.com/mail/u/0/#inbox?compose=DmwnWsTRTbGXDWsVlJWWcHTVVGBVffNlfqCmBkqBCqgcrNDwcNXMpKGBcmzRKXWXwWpbFTXjVhFV';
    const subject = encodeURIComponent('A Special Surprise For You 💖');
    const body = encodeURIComponent(
      LETTER_TEXT + '\n\n— With all my love, Janjan 💖\n\n🌐 Open this link to experience the full surprise with animations!'
    );
    window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_self');
  });

  // Replay from the bottom bar
  btnReplayBar.addEventListener('click', () => {
    replayBar.classList.remove('visible');
    triggerSurprise();
  });

  // Handle window resize for canvas
  window.addEventListener('resize', () => {
    if (animationPlaying) resizeCanvas();
  });

  // =====================================================
  // ⓬  INITIALISATION
  // =====================================================

  async function initModel() {
    loadingScreen.classList.remove('hidden');
    try {
      await loadModel();
      loadingScreen.classList.add('hidden');
      statusText.textContent = 'Show a Finger Heart to reveal the surprise ❤️';
      requestAnimationFrame(predictionLoop);
    } catch (err) {
      console.error('Failed to load model:', err);
      loadingScreen.classList.add('hidden');
      statusText.textContent = '⚠️ Could not load AI model. Check the model URL.';

      // ─── DEMO MODE ───────────────────────────────────
      // If the model fails to load (e.g. placeholder URL),
      // fall back to a click-to-trigger demo.
      enableDemoMode();
    }
  }

  /**
   * Demo fallback: lets users click the camera area to trigger
   * the surprise when a Teachable Machine model isn't available.
   */
  function enableDemoMode() {
    statusText.textContent = '🎭 Demo Mode — Click the camera to trigger the surprise!';

    const wrapper = document.querySelector('.camera-inner');
    wrapper.style.cursor = 'pointer';
    wrapper.addEventListener('click', () => {
      if (!animationPlaying) triggerSurprise();
    }, { once: false });
  }

  // Show permission overlay initially
  // (loading screen is hidden until we actually start loading the model)
  loadingScreen.classList.add('hidden');

})();
