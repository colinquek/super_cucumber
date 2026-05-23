/**
 * SUPER CUCUMBER SLICER - GAME ENGINE
 * Core game physics, cartoon vector graphics rendering, and logic
 */

class SlicerGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game settings & states
        this.gameScale = 1.0;
        this.currentMode = 'zen'; // 'zen', 'rhythm', 'time'
        this.score = 0;
        this.totalCuts = 0;
        this.perfectCuts = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.sliceCount = 0;
        this.totalThickness = 0;
        
        // Mode Specifics
        this.isGameOver = false;
        this.timer = 30; // for Time Attack
        this.timerInterval = null;
        this.targetThickness = 8; // for Rhythm Cut (in pixels/mm relative)
        this.lastSliceThickness = 0;
        
        // Cucumber Data
        this.segments = []; // Active segments of the cucumber
        this.feedOffset = 0; // Leftward sliding feed
        this.feedSpeed = 0.5; // Default Zen auto-feed speed
        this.autoFeedEnabled = true;
        this.guideEnabled = true;
        this.cucumberHoldingHandOffset = 0;
        
        // Physics Objects
        this.debrisSlices = []; // Sliced off pieces flying away
        this.particles = [];    // Splatter droplets & seeds
        this.knifeMarks = [];   // Persistent chops on the wooden board
        
        // Board Geometry (Responsive)
        this.board = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            colorLight: '#d97706',
            colorDark: '#b45309'
        };
        
        // Knife & Hand Kinematics
        this.knife = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            width: 70,
            height: 140,
            chopProgress: 0, // 0 = idle/hover, 1 = maximum down
            isChopping: false,
            chopDir: 1, // 1 = down, -1 = up
            angle: -0.05, // Slight idle angle for cartoon style
            shadowOffset: 15
        };

        // User Input Controls
        this.isDraggingCucumber = false;
        this.dragStartX = 0;
        this.dragStartFeedOffset = 0;
        
        // Initialize
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Canvas events
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        
        // Touch support for mobile devices
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseMove(touch);
        }, { passive: false });
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseMove(touch);
            this.handleMouseDown(touch);
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.handleMouseUp();
        });
        
        // Keyboard support
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Sidebar Controls
        document.getElementById('mode-zen').addEventListener('click', () => this.switchMode('zen'));
        document.getElementById('mode-rhythm').addEventListener('click', () => this.switchMode('rhythm'));
        document.getElementById('mode-time').addEventListener('click', () => this.switchMode('time'));
        
        document.getElementById('auto-feed-toggle').addEventListener('change', (e) => {
            this.autoFeedEnabled = e.target.checked;
            window.audio.playClick();
        });
        
        document.getElementById('guide-toggle').addEventListener('change', (e) => {
            this.guideEnabled = e.target.checked;
            window.audio.playClick();
        });
        
        document.getElementById('audio-toggle').addEventListener('click', () => {
            const isMuted = window.audio.toggleMute();
            document.getElementById('audio-icon').textContent = isMuted ? '🔇' : '🔊';
            window.audio.playClick();
        });
        
        document.getElementById('btn-reset').addEventListener('click', () => {
            window.audio.playClick();
            this.resetWorkspace();
        });
        
        document.getElementById('btn-restart').addEventListener('click', () => {
            window.audio.playClick();
            this.resetWorkspace();
            document.getElementById('gameover-modal').classList.add('hidden');
        });
        
        // Setup initial cucumber
        this.resetWorkspace();
        
        // Start Loop
        requestAnimationFrame((timestamp) => this.update(timestamp));
    }

    /**
     * Set viewport dimensions nicely
     */
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Dynamically compute game scale based on width for mobile compatibility
        this.gameScale = this.canvas.width < 600 ? 0.68 : 1.0;
        
        // Re-calculate chopping board dimensions procedurally
        this.board.width = this.canvas.width * 0.85;
        this.board.height = 120 * this.gameScale;
        this.board.x = (this.canvas.width - this.board.width) / 2;
        
        // Lower board position on mobile so stats HUD doesn't overlap
        this.board.y = this.canvas.height * (this.canvas.width < 600 ? 0.64 : 0.58);
        
        // Reset knife metrics to default (drawn using canvas scale)
        this.knife.width = 70;
        this.knife.height = 140;
        this.knife.shadowOffset = 15;
        
        // Place knife at standard starting hover (accounting for scale)
        this.knife.x = this.canvas.width / 2;
        this.knife.y = this.board.y - 120 * this.gameScale;
    }

    /**
     * Switch Game Modes and re-initialize parameters
     */
    switchMode(mode) {
        if (this.currentMode === mode) return;
        window.audio.playClick();
        
        this.currentMode = mode;
        this.resetWorkspace();
        
        // Style Buttons
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`mode-btn-${mode}`)?.classList.add('active'); // backup matching
        document.getElementById(`mode-${mode}`).classList.add('active');
        
        // Show/hide relevant HTML components
        const targetContainer = document.getElementById('target-container');
        const timerContainer = document.getElementById('timer-container');
        const scoreHud = document.getElementById('stat-score-container');
        
        const modeTitle = document.getElementById('mode-title-display');
        const modeDesc = document.getElementById('mode-desc-display');
        
        // Reset timers
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (mode === 'zen') {
            modeTitle.textContent = 'Zen Slicer';
            modeDesc.textContent = 'Take your time, make beautiful slices, and enjoy the satisfying feedback. Drag the cucumber with your mouse/touch or use Arrow keys to feed it manually, or toggle Auto-Feed!';
            targetContainer.classList.add('hidden');
            timerContainer.classList.add('hidden');
            scoreHud.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            scoreHud.style.background = 'rgba(16, 185, 129, 0.05)';
        } else if (mode === 'rhythm') {
            modeTitle.textContent = 'Rhythm Cut';
            modeDesc.textContent = 'Chop exact slice widths matching the green target guide! Build up a high score and combo multiplier. Slicing too thin or too thick breaks your combo!';
            targetContainer.classList.remove('hidden');
            timerContainer.classList.add('hidden');
            scoreHud.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            scoreHud.style.background = 'rgba(245, 158, 11, 0.08)';
            this.generateNewTargetThickness();
        } else if (mode === 'time') {
            modeTitle.textContent = 'Time Attack';
            modeDesc.textContent = 'Chop as fast as you possibly can! You have 30 seconds to slice as many pieces as possible. Fast consecutive chops unlock a scoring multiplier combo!';
            targetContainer.classList.add('hidden');
            timerContainer.classList.remove('hidden');
            scoreHud.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            scoreHud.style.background = 'rgba(239, 68, 68, 0.08)';
            this.timer = 30;
            document.getElementById('timer-val').textContent = '30s';
            this.startTimer();
        }
    }

    /**
     * Start the countdown timer for Time Attack Mode
     */
    startTimer() {
        this.timer = 30;
        this.isGameOver = false;
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.timer--;
            document.getElementById('timer-val').textContent = `${this.timer}s`;
            
            if (this.timer <= 5) {
                document.getElementById('timer-val').style.animation = 'pulseCombo 0.5s infinite';
            } else {
                document.getElementById('timer-val').style.animation = 'none';
            }
            
            if (this.timer <= 0) {
                clearInterval(this.timerInterval);
                this.endChallenge();
            }
        }, 1000);
    }

    /**
     * Ends the game and shows the stats modal overlay
     */
    endChallenge() {
        this.isGameOver = true;
        
        // Populate modal data
        document.getElementById('modal-score').textContent = this.score;
        document.getElementById('modal-cuts').textContent = this.totalCuts;
        document.getElementById('modal-perfects').textContent = this.perfectCuts;
        
        if (this.currentMode === 'time') {
            document.getElementById('modal-title').textContent = 'Time Attack Complete!';
        } else {
            document.getElementById('modal-title').textContent = 'Challenge Finished!';
        }
        
        // Show Modal
        document.getElementById('gameover-modal').classList.remove('hidden');
    }

    /**
     * Resets the entire workbench (fresh cucumber, clears debris/splatter)
     */
    resetWorkspace() {
        this.debrisSlices = [];
        this.particles = [];
        this.knifeMarks = [];
        this.score = 0;
        this.totalCuts = 0;
        this.perfectCuts = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.sliceCount = 0;
        this.totalThickness = 0;
        this.lastSliceThickness = 0;
        
        this.feedOffset = 0;
        this.isGameOver = false;
        
        // Generate a single starting cucumber segment scaled
        const cucumberY = this.board.y + 15 * this.gameScale;
        const cucumberRadius = 38 * this.gameScale;
        
        // Prevent starter segment from overflowing small boards
        const startOffset = Math.min(200 * this.gameScale, this.board.width * 0.35);
        const endOffset = Math.min(50 * this.gameScale, this.board.width * 0.15);
        
        this.segments = [
            {
                startX: this.board.x + startOffset,
                endX: this.board.x + this.board.width - endOffset,
                y: cucumberY,
                radius: cucumberRadius,
                leftCut: false, // Rounded standard head
                rightCut: false // Rounded blossom end
            }
        ];
        
        // Update HTML interface
        this.updateHUD();
        
        if (this.currentMode === 'time') {
            this.startTimer();
        }
        
        document.getElementById('feedback-display').textContent = '—';
        document.getElementById('feedback-display').className = 'thickness-feedback';
    }

    /**
     * Randomizes target thickness guideline for Rhythm Mode
     */
    generateNewTargetThickness() {
        // Generates target width between 6mm and 20mm (where 1mm = 4.5 pixels visually)
        this.targetThickness = Math.floor(Math.random() * 12) + 7; // 7mm to 18mm
        document.getElementById('target-val').textContent = `${this.targetThickness.toFixed(1)} mm`;
    }

    /**
     * Feed the cucumber automatically or by keyboard controls
     */
    feedCucumber(amount) {
        if (this.isGameOver) return;

        // Shift all active segments leftwards
        this.segments.forEach(segment => {
            segment.startX -= amount;
            segment.endX -= amount;
        });

        // We accumulate total feedOffset
        this.feedOffset += amount;

        // Check if there are no segments left on the board, or if the main cucumber has moved too far left
        let rightmostX = 0;
        this.segments.forEach(seg => {
            if (seg.endX > rightmostX) rightmostX = seg.endX;
        });

        // Spawn a brand new cucumber sliding in from the right scaled
        const minRightThreshold = this.board.x + Math.min(200 * this.gameScale, this.board.width * 0.35);
        if (rightmostX < minRightThreshold) {
            const cucumberY = this.board.y + 15 * this.gameScale;
            const cucumberRadius = 38 * this.gameScale;
            const spawnX = Math.max(this.canvas.width + 50, this.board.x + this.board.width + 100 * this.gameScale);
            
            // Add a new cucumber
            this.segments.push({
                startX: spawnX,
                endX: spawnX + 450 * this.gameScale, // Standard size
                y: cucumberY,
                radius: cucumberRadius,
                leftCut: false,
                rightCut: false
            });
            
            // Generate a new target thickness for Rhythm Mode if spawned new cucumber
            if (this.currentMode === 'rhythm') {
                this.generateNewTargetThickness();
            }
        }
        
        // Remove segments that have completely slid off-screen left (so memory is kept light)
        this.segments = this.segments.filter(seg => seg.endX > -100);
    }

    /**
     * Keyboard bindings for sliding the cucumber manually
     */
    handleKeyDown(e) {
        // Spacebar triggers chop
        if (e.code === 'Space') {
            e.preventDefault();
            this.triggerChop();
        }
        
        // Left/Right Arrow or A/D slider feed
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            this.feedCucumber(-12);
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            this.feedCucumber(12);
        }
    }

    /**
     * Capture mouse/touch movement and map coordinates
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        
        // Update knife target horizontal position exactly
        this.knife.targetX = clientX;
        
        // The knife vertical position is dynamic based on hover height
        // But if dragging, slide cucumber
        if (this.isDraggingCucumber && !this.autoFeedEnabled) {
            const deltaX = clientX - this.dragStartX;
            const newFeedChange = this.dragStartFeedOffset - deltaX;
            const feedDiff = newFeedChange - this.feedOffset;
            this.feedCucumber(feedDiff);
        }
    }

    /**
     * Mouse or tap trigger
     */
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        
        // Check if player clicked the cucumber body to drag feed manually (Only if Auto-Feed is disabled)
        let clickedCucumber = false;
        if (!this.autoFeedEnabled && !this.isGameOver) {
            this.segments.forEach(segment => {
                if (clientX > segment.startX && clientX < segment.endX &&
                    clientY > segment.y - segment.radius && clientY < segment.y + segment.radius) {
                    clickedCucumber = true;
                }
            });
        }
        
        if (clickedCucumber) {
            this.isDraggingCucumber = true;
            this.dragStartX = clientX;
            this.dragStartFeedOffset = this.feedOffset;
        } else {
            // Otherwise, it is a chop!
            this.triggerChop();
        }
    }

    handleMouseUp() {
        this.isDraggingCucumber = false;
    }

    /**
     * Triggers the fast physical Nakiri knife chop sequence
     */
    triggerChop() {
        if (this.knife.isChopping || this.isGameOver) return;
        
        this.knife.isChopping = true;
        this.knife.chopProgress = 0;
        this.knife.chopDir = 1; // Start heading down fast
    }

    /**
     * Slices the active cucumber segment at the specified X coordinate
     */
    sliceCucumberAt(cutX) {
        let hit = false;
        let slicedSegmentIndex = -1;
        
        // Find which segment this coordinate splits
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            if (cutX > seg.startX && cutX < seg.endX) {
                slicedSegmentIndex = i;
                hit = true;
                break;
            }
        }
        
        if (!hit) {
            // Hit empty wooden board
            window.audio.playChop(false, 0.7);
            this.triggerBoardChopFx(cutX);
            return;
        }
        
        const seg = this.segments[slicedSegmentIndex];
        
        // Split cucumber segment into two segments:
        // Left piece: seg.startX to cutX
        // Right piece: cutX to seg.endX
        const leftWidth = cutX - seg.startX;
        const rightWidth = seg.endX - cutX;
        
        // Identify which portion is cut off.
        // Since we anchor and feed from the right, the LEFT portion represents the sliced off piece!
        // The slice thickness is exactly the width of this left segment!
        const sliceThicknessPx = leftWidth;
        const sliceThicknessMm = sliceThicknessPx / (4.5 * this.gameScale); // scale-independent thickness math
        
        this.lastSliceThickness = sliceThicknessMm;
        this.sliceCount++;
        this.totalThickness += sliceThicknessMm;
        
        // Trigger satisfying physics slice object (the left cut off piece)
        this.spawnPhysicalSlice(seg.startX, cutX, seg.y, seg.radius, seg.leftCut);
        
        // The right segment remains on the cutting board!
        // We modify the original segment to start at cutX, and label its left side as cut (sliced face)
        seg.startX = cutX;
        seg.leftCut = true; // Mark as a raw cut face exposing pale green flesh & seeds
        
        // If the left segment had any positive width, it is sliced away, so we just trim the segment array.
        // Wait, what if they chop very close to the right end? The right segment stays, left flies away.
        // What if the left segment is extremely tiny? We still create it and let it fly.
        
        // Trigger Audio, screen shakes, and particle splatters!
        window.audio.playChop(true, 1.0);
        this.triggerSliceFx(cutX, seg.y, seg.radius);
        
        // Game mode evaluations!
        this.processScoreAndStats(sliceThicknessMm);
    }

    /**
     * Calculates precision score and multipliers for game modes
     */
    processScoreAndStats(thickness) {
        this.totalCuts++;
        
        // Mode Specific scoring
        if (this.currentMode === 'zen') {
            this.score += 10;
            this.combo++;
            this.showComboBadge();
        } else if (this.currentMode === 'rhythm') {
            const difference = Math.abs(thickness - this.targetThickness);
            const feedbackDisplay = document.getElementById('feedback-display');
            const toastNotif = document.getElementById('toast-notif');
            
            feedbackDisplay.classList.remove('perfect', 'good', 'poor');
            
            if (difference < 1.2) {
                // PERFECT slice!
                this.perfectCuts++;
                this.combo++;
                this.score += 100 * this.combo;
                
                feedbackDisplay.textContent = `Perfect! (${thickness.toFixed(1)} mm)`;
                feedbackDisplay.classList.add('perfect');
                
                // Show floating toaster UI
                toastNotif.textContent = 'PERFECT!';
                toastNotif.className = 'toast-notification show';
                setTimeout(() => toastNotif.classList.remove('show'), 800);
                
                window.audio.playPerfectChime();
                this.showComboBadge();
                this.generateNewTargetThickness();
            } else if (difference < 3.0) {
                // GOOD slice
                this.score += 40 * this.combo;
                feedbackDisplay.textContent = `Good (${thickness.toFixed(1)} mm)`;
                feedbackDisplay.classList.add('good');
                
                this.combo = Math.max(1, this.combo); // preserve or start combo
                this.showComboBadge();
            } else {
                // POOR slice
                feedbackDisplay.textContent = `${difference > 0 ? 'Too Thick' : 'Too Thin'} (${thickness.toFixed(1)} mm)`;
                feedbackDisplay.classList.add('poor');
                this.combo = 0;
                this.hideComboBadge();
                window.audio.playMissBuzz();
            }
        } else if (this.currentMode === 'time') {
            // Time Attack: fast slicing gives speed combo multiplier!
            this.combo++;
            this.score += 15 * this.combo;
            this.showComboBadge();
        }
        
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        
        this.updateHUD();
    }

    /**
     * Spawns a physically simulated cartoon cucumber slice that rolls and spins away
     */
    spawnPhysicalSlice(startX, endX, y, radius, hasLeftCut) {
        const width = endX - startX;
        const centerX = startX + width / 2;
        
        // Physics attributes
        this.debrisSlices.push({
            startX: startX,
            endX: endX,
            centerX: centerX,
            y: y,
            radius: radius,
            vx: -3.5 + Math.random() * 1.5, // Toss leftwards off board
            vy: -4 - Math.random() * 3,      // Pop upwards
            gravity: 0.35,
            rotation: 0,
            spin: -0.15 - Math.random() * 0.15, // Dynamic rolling rotation
            hasLeftCut: hasLeftCut,
            hasRightCut: true, // Right side is always raw sliced face from the cut!
            bounceCount: 0,
            alpha: 1.0
        });
    }

    /**
     * Trigger juice splash and seed explosions
     */
    triggerSliceFx(x, y, radius) {
        // Screen Shake
        const container = document.querySelector('.canvas-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 150);
        
        // 1. Spawning green juicy droplet particles
        const dropletCount = 18 + Math.floor(Math.random() * 10);
        for (let i = 0; i < dropletCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() * 1.2 - 0.6); // Spurt upwards mostly
            const speed = 3 + Math.random() * 6;
            
            this.particles.push({
                x: x,
                y: y + (Math.random() * radius * 0.6 - radius * 0.3),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 3 + Math.random() * 5,
                color: Math.random() > 0.4 ? '#a3e635' : '#84cc16', // flesh green vs juice tint
                gravity: 0.28,
                friction: 0.98,
                bounce: 0.3,
                type: 'juice',
                alpha: 1.0,
                fadeSpeed: 0.015 + Math.random() * 0.015
            });
        }
        
        // 2. Spawning white seed particles flying out
        const seedCount = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < seedCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() * 1.6 - 0.8);
            const speed = 2 + Math.random() * 4;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rx: 2.5 + Math.random() * 1.5,
                ry: 1 + Math.random() * 1,
                rotation: Math.random() * Math.PI,
                spin: -0.1 + Math.random() * 0.2,
                color: '#f8fafc', // cream seeds
                gravity: 0.25,
                friction: 0.99,
                bounce: 0.45,
                type: 'seed',
                alpha: 1.0,
                fadeSpeed: 0.008 + Math.random() * 0.008
            });
        }
        
        // 3. Save a knife mark on the chopping board
        this.knifeMarks.push({
            x: x,
            width: 3 + Math.random() * 3,
            depth: 8 + Math.random() * 6,
            alpha: 0.55
        });
        
        // Limit persistent board cuts to 35 to prevent lag
        if (this.knifeMarks.length > 35) {
            this.knifeMarks.shift();
        }
    }

    /**
     * Triggers simple brown wood splinter particles if player chops bare board
     */
    triggerBoardChopFx(x) {
        const container = document.querySelector('.canvas-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 120);
        
        // Wood splinter particles
        const splinterCount = 6 + Math.floor(Math.random() * 5);
        for (let i = 0; i < splinterCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() * 1.4 - 0.7);
            const speed = 2.5 + Math.random() * 3.5;
            
            this.particles.push({
                x: x,
                y: this.board.y + 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 2,
                color: Math.random() > 0.5 ? '#b45309' : '#d97706', // wood brown particles
                gravity: 0.3,
                friction: 0.97,
                bounce: 0.2,
                type: 'wood',
                alpha: 1.0,
                fadeSpeed: 0.02 + Math.random() * 0.02
            });
        }
        
        // Store knife mark
        this.knifeMarks.push({
            x: x,
            width: 2 + Math.random() * 2,
            depth: 4 + Math.random() * 4,
            alpha: 0.4
        });
    }

    /**
     * Show glassmorphic popup badges for combo streaks
     */
    showComboBadge() {
        if (this.combo < 2) return;
        const badge = document.getElementById('combo-container');
        document.getElementById('combo-val').textContent = `x${this.combo}`;
        badge.className = 'combo-badge pop';
    }

    hideComboBadge() {
        const badge = document.getElementById('combo-container');
        badge.className = 'combo-badge hidden';
    }

    /**
     * Sync data to HUD indicators
     */
    updateHUD() {
        document.getElementById('score-val').textContent = this.score;
        document.getElementById('cuts-val').textContent = this.totalCuts;
        
        // Average thickness
        const avg = this.sliceCount > 0 ? (this.totalThickness / this.sliceCount) : 0;
        document.getElementById('thickness-val').textContent = `${avg.toFixed(1)} mm`;
        
        // Precision Accuracy
        const accuracy = this.totalCuts > 0 ? Math.round((this.perfectCuts / this.totalCuts) * 100) : 100;
        document.getElementById('accuracy-val').textContent = `${accuracy}%`;
    }

    /* ==========================================================================
       PHYSICS & ENGINE LOOP
       ========================================================================== */

    update(timestamp) {
        // 1. Continuous auto-feed cucumber
        if (this.autoFeedEnabled && !this.isGameOver) {
            // Gradually feed cucumber leftwards
            // Feed slightly faster as combo multiplier builds!
            const dynamicSpeed = this.feedSpeed * (1 + Math.min(this.combo * 0.1, 1.2));
            this.feedCucumber(dynamicSpeed);
        }
        
        // 2. Animate Knife Chop sequence
        if (this.knife.isChopping) {
            const chopSpeed = 0.28; // Rapid downward stroke
            const raiseSpeed = 0.12; // Controlled lift stroke
            
            if (this.knife.chopDir === 1) {
                this.knife.chopProgress += chopSpeed;
                if (this.knife.chopProgress >= 1.0) {
                    this.knife.chopProgress = 1.0;
                    this.knife.chopDir = -1; // Hit bottom, rebound!
                    
                    // Actually perform the slicing calculation!
                    this.sliceCucumberAt(this.knife.x);
                }
            } else {
                this.knife.chopProgress -= raiseSpeed;
                if (this.knife.chopProgress <= 0) {
                    this.knife.chopProgress = 0;
                    this.knife.isChopping = false;
                }
            }
        }
        
        // 3. Smooth Knife Horizontal Motion tracking
        const lerpFactor = 0.38; // Snappy responsiveness
        this.knife.x += (this.knife.targetX - this.knife.x) * lerpFactor;
        
        // Smoothly lock knife vertical height depending on chop progress
        const hoverY = this.board.y - 120 * this.gameScale;
        const boardY = this.board.y + 12 * this.gameScale; // Exact board chop boundary
        this.knife.y = hoverY + (boardY - hoverY) * this.knife.chopProgress;
        
        // Tilt knife based on speed for cute organic cartoon styling
        const speedX = this.knife.targetX - this.knife.x;
        const targetAngle = -0.05 + (speedX * 0.003) - (this.knife.chopProgress * 0.05);
        this.knife.angle += (targetAngle - this.knife.angle) * 0.2;

        // 4. Update flying debris slices physics
        this.debrisSlices.forEach(slice => {
            // Apply gravity and horizontal momentum
            slice.centerX += slice.vx;
            slice.startX += slice.vx;
            slice.endX += slice.vx;
            
            slice.vy += slice.gravity;
            slice.y += slice.vy;
            slice.rotation += slice.spin;
            
            // Check bouncing on the chopping board
            const bottomY = this.board.y + 15;
            if (slice.y + slice.radius * 0.4 >= bottomY && slice.vy > 0) {
                slice.y = bottomY - slice.radius * 0.4;
                slice.vy = -slice.vy * 0.45; // dampening bounce
                slice.spin *= 0.8;
                slice.vx *= 0.85; // slide friction
                slice.bounceCount++;
            }
            
            // Fade out as it rolls off screen
            if (slice.centerX < 0 || slice.y > this.canvas.height + 50) {
                slice.alpha -= 0.05;
            }
        });
        
        // Filter out dead slices
        this.debrisSlices = this.debrisSlices.filter(slice => slice.alpha > 0);

        // 5. Update juicy particle physics
        this.particles.forEach(p => {
            p.vx *= p.friction;
            p.vy *= p.friction;
            
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.type === 'seed') {
                p.rotation += p.spin;
            }
            
            // Bounce on board surface
            const bottomY = this.board.y + 15;
            if (p.y >= bottomY && p.vy > 0) {
                p.y = bottomY;
                p.vy = -p.vy * p.bounce;
                p.vx *= 0.8; // slider wood friction
            }
            
            p.alpha -= p.fadeSpeed;
        });
        
        this.particles = this.particles.filter(p => p.alpha > 0);

        // 6. Draw Everything
        this.draw();
        
        // Continue Loop
        requestAnimationFrame((timestamp) => this.update(timestamp));
    }

    /* ==========================================================================
       CARTOONISH VECTOR RENDERING GRAPHICS
       ========================================================================== */

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Draw Chopping Board (Thick cartoon style)
        this.drawChoppingBoard();
        
        // 2. Draw Knife Marks/Scratches inside the Board
        this.drawKnifeMarks();

        // 3. Draw Slicing Guidelines (Rhythm Cut mode target outlines)
        if (this.guideEnabled && !this.isGameOver) {
            this.drawSlicingGuidelines();
        }

        // 4. Draw Cucumber Segments (Resting on board)
        this.drawCucumbers();
        
        // 5. Draw Flying Debris Slices
        this.drawDebrisSlices();
        
        // 6. Draw Particles (Splash juice/seeds)
        this.drawParticles();
        
        // 7. Draw Player's Hand holding the Nakiri Knife
        this.drawKnifeAndHand();
    }

    /**
     * Renders a cartoon wooden board with warm amber gradients and dark lines
     */
    drawChoppingBoard() {
        const b = this.board;
        this.ctx.save();
        
        // Board drop shadow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        this.ctx.shadowBlur = 24;
        this.ctx.shadowOffsetY = 14;
        
        // Main Board wood core
        this.ctx.fillStyle = b.colorLight;
        this.ctx.strokeStyle = '#271203'; // Heavy cartoon wood outline
        this.ctx.lineWidth = 7;
        
        // Draw wood block
        this.ctx.beginPath();
        this.ctx.roundRect(b.x, b.y, b.width, b.height, 22);
        this.ctx.fill();
        this.ctx.shadowColor = 'transparent'; // Reset shadows
        this.ctx.stroke();
        
        // Draw board side rim (3D cartoon depth effect)
        this.ctx.fillStyle = b.colorDark;
        this.ctx.beginPath();
        this.ctx.roundRect(b.x + 3.5, b.y + b.height - 18, b.width - 7, 14, {bottomLeft: 18, bottomRight: 18});
        this.ctx.fill();
        
        // Draw wood grain lines (Simplified cartoon lines - very cheap!)
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        
        for (let i = 1; i <= 4; i++) {
            const gy = b.y + 20 * i;
            this.ctx.beginPath();
            this.ctx.moveTo(b.x + 40, gy);
            this.ctx.lineTo(b.x + b.width - 40, gy);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    /**
     * Renders knife cuts made on the chopping board surface
     */
    drawKnifeMarks() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(39, 18, 3, 0.25)'; // dark scratch lines
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
        
        this.knifeMarks.forEach(mark => {
            this.ctx.beginPath();
            this.ctx.moveTo(mark.x, this.board.y + 4);
            this.ctx.lineTo(mark.x + (Math.random() * 4 - 2), this.board.y + mark.depth);
            this.ctx.stroke();
        });
        this.ctx.restore();
    }

    /**
     * Draw green slicing target rings and guidelines
     */
    drawSlicingGuidelines() {
        if (this.currentMode !== 'rhythm' || this.segments.length === 0) return;
        
        // We find the leftmost cut face of the cucumber, which is the starting point of the next slice.
        // The target slicing coordinate is startX + (targetThickness * 4.5 * gameScale)
        const activeSegment = this.segments.find(seg => seg.endX > this.board.x + 100 * this.gameScale);
        if (!activeSegment) return;
        
        const targetOffset = this.targetThickness * 4.5 * this.gameScale;
        const targetX = activeSegment.startX + targetOffset;
        
        this.ctx.save();
        
        // Target vertical dash line
        this.ctx.strokeStyle = '#22c55e'; // Bright neon green line
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(targetX, this.board.y - 40);
        this.ctx.lineTo(targetX, this.board.y + this.board.height);
        this.ctx.stroke();
        
        // Target pulse guide ring on the cucumber body
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        this.ctx.lineWidth = 3.5;
        
        this.ctx.beginPath();
        this.ctx.ellipse(targetX, activeSegment.y, 8, activeSegment.radius, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * Renders cartoon cucumbers (skin body, pale cross sections, blossom scar)
     */
    drawCucumbers() {
        this.segments.forEach(seg => {
            this.ctx.save();
            
            const radius = seg.radius;
            const length = seg.endX - seg.startX;
            
            if (length <= 0) {
                this.ctx.restore();
                return;
            }

            // Outline style
            this.ctx.strokeStyle = '#022c16'; // Very dark forest green stroke
            this.ctx.lineWidth = 6;
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';

            // Skin Fill Style
            const skinGradient = this.ctx.createLinearGradient(0, seg.y - radius, 0, seg.y + radius);
            skinGradient.addColorStop(0, '#166534'); // Shiny dark green top
            skinGradient.addColorStop(0.3, '#15803d');
            skinGradient.addColorStop(0.8, '#14532d'); // Shadows bottom
            
            // 1. Draw Main Cucumber Body Cylinder
            this.ctx.fillStyle = skinGradient;
            this.ctx.beginPath();
            this.ctx.roundRect(seg.startX, seg.y - radius, length, radius * 2, 8);
            this.ctx.fill();
            this.ctx.stroke();

            // 2. Draw Cute Lighter Green Cartoon Spines (simplified bumps - cheap & cartoonish!)
            this.ctx.fillStyle = '#4ade80';
            const bumpSpacing = 36 * this.gameScale;
            const startBump = Math.ceil(seg.startX / bumpSpacing) * bumpSpacing;
            
            for (let bx = startBump; bx < seg.endX - 10; bx += bumpSpacing) {
                // Wave Y offset slightly
                const phase = bx * 0.05;
                const by = seg.y + Math.sin(phase) * (radius * 0.4);
                
                this.ctx.beginPath();
                this.ctx.arc(bx, by, 3.5 * this.gameScale, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // 3. Draw Cut Face on the LEFT (if it was sliced by a knife)
            if (seg.leftCut) {
                this.drawCrossSection(seg.startX, seg.y, radius, 0.45); // narrow 3D ellipse face
            } else {
                // Round original starting tail (Tail end scar)
                this.ctx.fillStyle = '#14532d';
                this.ctx.beginPath();
                this.ctx.arc(seg.startX, seg.y, 4 * this.gameScale, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // 4. Draw Cut Face on the RIGHT (if it was sliced, otherwise it's the blossom tail tip)
            if (seg.rightCut) {
                this.drawCrossSection(seg.endX, seg.y, radius, 0.45);
            } else {
                // Cartoon blossom scar (yellowish star-tip at end)
                this.ctx.fillStyle = '#f59e0b';
                this.ctx.strokeStyle = '#d97706';
                this.ctx.lineWidth = 2.5 * this.gameScale;
                
                const tipX = seg.endX;
                const tipY = seg.y;
                
                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI) / 5;
                    const rx = i % 2 === 0 ? 8 * this.gameScale : 4 * this.gameScale;
                    this.ctx.lineTo(tipX + Math.cos(angle) * rx, tipY + Math.sin(angle) * rx);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            }

            this.ctx.restore();
        });

        // Draw Helper Hand holding the cucumber on the right side!
        this.drawHelperHand();
    }

    /**
     * Draws the inner sliced pale-green flesh, core, and seed pattern
     */
    drawCrossSection(x, y, radius, aspect = 0.45) {
        this.ctx.save();
        
        // 1. Pale green flesh ellipse
        const fleshGrad = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        fleshGrad.addColorStop(0, '#f7fee7'); // White core center
        fleshGrad.addColorStop(0.3, '#ecfccb'); // Pale cream-green core
        fleshGrad.addColorStop(0.75, '#d9f99d'); // Lime-green flesh
        fleshGrad.addColorStop(0.9, '#a3e635');  // Bright boundary
        fleshGrad.addColorStop(1.0, '#15803d');  // Skin ring connection
        
        this.ctx.fillStyle = fleshGrad;
        this.ctx.strokeStyle = '#022c16';
        this.ctx.lineWidth = 5;
        
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, radius * aspect, radius, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // 2. Draw center core division line
        this.ctx.strokeStyle = 'rgba(163, 230, 53, 0.45)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, radius * aspect * 0.48, radius * 0.48, 0, 0, Math.PI * 2);
        this.ctx.stroke();

        // 3. Draw cute white circular seeds inside core ring
        this.ctx.fillStyle = '#ffffff';
        const seedCount = 7;
        const seedRadiusX = 2;
        const seedRadiusY = 3.5;
        
        for (let i = 0; i < seedCount; i++) {
            const seedAngle = (i * 2 * Math.PI) / seedCount + 0.3;
            // Oval distribution
            const sx = x + Math.cos(seedAngle) * (radius * aspect * 0.38);
            const sy = y + Math.sin(seedAngle) * (radius * 0.38);
            
            this.ctx.beginPath();
            this.ctx.ellipse(sx, sy, seedRadiusX, seedRadiusY, seedAngle, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    /**
     * Render the cartoon hand pushing the cucumber
     */
    drawHelperHand() {
        if (this.segments.length === 0) return;
        
        // Find the rightmost active segment
        let rightmostSeg = this.segments[this.segments.length - 1];
        if (rightmostSeg.endX < this.board.x + 200 * this.gameScale) return;
        
        const handX = rightmostSeg.endX - 90 * this.gameScale;
        const handY = rightmostSeg.y;
        
        this.ctx.save();
        this.ctx.translate(handX, handY);
        this.ctx.scale(this.gameScale, this.gameScale);
        
        // Hand shadow
        this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetY = 6;
        
        // Draw a cute cartoonish cream-colored kitchen glove/hand gripping the cucumber
        this.ctx.fillStyle = '#fef08a'; // Pastel yellow glove
        this.ctx.strokeStyle = '#78350f'; // Dark outline
        this.ctx.lineWidth = 5;
        this.ctx.lineJoin = 'round';
        
        // Glove fingers wrapper (relative to 0,0)
        this.ctx.beginPath();
        this.ctx.roundRect(0, -48, 55, 96, [14, 28, 28, 14]);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw finger knuckle dividers
        this.ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
        this.ctx.lineWidth = 3.5;
        for (let i = -1; i <= 1; i++) {
            const fy = i * 22;
            this.ctx.beginPath();
            this.ctx.moveTo(10, fy);
            this.ctx.lineTo(45, fy);
            this.ctx.stroke();
        }
        
        // Cuff band sleeve
        this.ctx.fillStyle = '#ef4444'; // Red cuffs
        this.ctx.strokeStyle = '#78350f';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.roundRect(45, -54, 40, 108, 6);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * Renders sliced cucumber pieces bouncing off the board
     */
    drawDebrisSlices() {
        this.debrisSlices.forEach(slice => {
            this.ctx.save();
            
            // Translate and rotate around slice center of mass
            this.ctx.translate(slice.centerX, slice.y);
            this.ctx.rotate(slice.rotation);
            this.ctx.globalAlpha = slice.alpha;
            
            const sliceWidth = slice.endX - slice.startX;
            const radius = slice.radius;
            
            // Draw cartoon wheel slice
            // If the width of slice is small (standard slice), we render it as a wheel cross-section
            if (sliceWidth < 30) {
                // Render flat sliced wheel
                this.drawCrossSection(0, 0, radius, 0.85); // rounder cross-section when falling
            } else {
                // Sliced cylinder segment
                // Draw skin cylinder body
                this.ctx.strokeStyle = '#022c16';
                this.ctx.lineWidth = 5.5;
                
                const skinGrad = this.ctx.createLinearGradient(0, -radius, 0, radius);
                skinGrad.addColorStop(0, '#166534');
                skinGrad.addColorStop(1, '#14532d');
                this.ctx.fillStyle = skinGrad;
                
                this.ctx.beginPath();
                this.ctx.roundRect(-sliceWidth/2, -radius, sliceWidth, radius*2, 6);
                this.ctx.fill();
                this.ctx.stroke();
                
                // Draw cut ends
                if (slice.hasLeftCut) {
                    this.drawCrossSection(-sliceWidth/2, 0, radius, 0.4);
                }
                if (slice.hasRightCut) {
                    this.drawCrossSection(sliceWidth/2, 0, radius, 0.4);
                }
            }
            
            this.ctx.restore();
        });
    }

    /**
     * Renders splash and seed particles
     */
    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            
            if (p.type === 'juice') {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'seed') {
                // Seed oval shape
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'wood') {
                // Tiny wood chips/rectangles
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        });
    }

    /**
     * Draw beautiful cartoon Japanese Nakiri chef's knife and holding hand
     */
    drawKnifeAndHand() {
        if (this.isGameOver) return;

        const k = this.knife;
        this.ctx.save();
        
        // Translate to blade position
        this.ctx.translate(k.x, k.y);
        this.ctx.rotate(k.angle);
        
        // Scale the entire knife + holding hand system in one command!
        this.ctx.scale(this.gameScale, this.gameScale);
        
        // 1. Draw Knife Drop Shadow (offset for hover visual depth)
        const shadowScale = 1.0 - k.chopProgress * 0.4;
        const currentShadowOffset = k.shadowOffset * shadowScale;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        this.ctx.beginPath();
        // Offset shadow to bottom-right
        this.ctx.roundRect(currentShadowOffset, currentShadowOffset, k.width, k.height - 40, [6, 2, 2, 6]);
        this.ctx.fill();
        
        // 2. Draw Knife Metallic Blade (Nakiri rectangular style)
        this.ctx.strokeStyle = '#1e293b'; // Slate thick outline
        this.ctx.lineWidth = 6;
        this.ctx.lineJoin = 'round';
        
        // Blade steel gradient reflection
        const steelGrad = this.ctx.createLinearGradient(0, 0, k.width, 0);
        steelGrad.addColorStop(0, '#cbd5e1'); // light steel highlight
        steelGrad.addColorStop(0.3, '#cbd5e1');
        steelGrad.addColorStop(0.7, '#94a3b8'); // dark reflection
        steelGrad.addColorStop(1, '#cbd5e1');
        
        this.ctx.fillStyle = steelGrad;
        this.ctx.beginPath();
        this.ctx.roundRect(0, 0, k.width, k.height - 40, [6, 2, 2, 6]);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw sharp cutting edge (bright white polish line at the bottom tip of blade)
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.moveTo(3, k.height - 43);
        this.ctx.lineTo(k.width - 3, k.height - 43);
        this.ctx.stroke();

        // 3. Draw Knife Wood Handle & Bolster
        // Bolster (dark collar metal)
        this.ctx.fillStyle = '#334155';
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.roundRect(k.width / 2 - 10, -18, 20, 18, 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Wood Handle grip
        const handleGrad = this.ctx.createLinearGradient(k.width/2 - 10, -80, k.width/2 + 10, -80);
        handleGrad.addColorStop(0, '#78350f');
        handleGrad.addColorStop(0.5, '#92400e');
        handleGrad.addColorStop(1, '#78350f');
        
        this.ctx.fillStyle = handleGrad;
        this.ctx.beginPath();
        this.ctx.roundRect(k.width / 2 - 8, -80, 16, 62, 5);
        this.ctx.fill();
        this.ctx.stroke();

        // 4. Draw Player Hand holding the handle! (Very cute cartoon grip)
        this.drawPlayerHand(k.width / 2, -50);

        this.ctx.restore();
    }

    /**
     * Render the player's cartoon grip hand on the knife handle
     */
    drawPlayerHand(hx, hy) {
        this.ctx.save();
        
        // Hand shadow
        this.ctx.shadowColor = 'rgba(0,0,0,0.15)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 4;
        
        // Light skin tone or glove
        this.ctx.fillStyle = '#fbcfe8'; // Cute pink cartoon glove!
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 5;
        this.ctx.lineJoin = 'round';
        
        // Main fist/glove holding handle
        this.ctx.beginPath();
        this.ctx.arc(hx - 5, hy, 22, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Thumb folded over handle
        this.ctx.beginPath();
        this.ctx.roundRect(hx - 14, hy - 16, 26, 12, 6);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Sleeve arm coming from the top off-screen
        this.ctx.fillStyle = '#06b6d4'; // Cyan sleeve
        this.ctx.beginPath();
        this.ctx.roundRect(hx - 16, hy - 120, 32, 100, 4);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
}

// Instantiate game on load
window.addEventListener('load', () => {
    window.game = new SlicerGame();
});
