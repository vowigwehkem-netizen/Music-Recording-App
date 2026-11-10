/**
 * Music Recording App - Core Application Logic & Web Audio Engine
 * Handles:
 * 1. Web Audio API Context & Engine Initialization
 * 2. Microphone Voice Recording & Canvas Visualizer
 * 3. Virtual Piano Synthesizer with Computer Keyboard & Touch Mappings
 * 4. Virtual Drum Pads & Synthesized Drum Sounds
 * 5. 16-Step Drum Beat Sequencer with BPM Control
 * 6. PWA Installation Prompt Management
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. Web Audio API Context & State
    // =========================================================================
    let audioCtx = null;
    let isAudioInitialized = false;

    const audioStatusBadge = document.getElementById('audio-status');

    function initAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        isAudioInitialized = true;
        if (audioStatusBadge) {
            audioStatusBadge.textContent = 'Engine Active';
            audioStatusBadge.className = 'status-badge status-connected';
        }
    }

    // Initialize audio engine on first user interaction
    ['click', 'touchstart', 'keydown'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (!isAudioInitialized) {
                initAudioContext();
            }
        }, { once: true });
    });

    // =========================================================================
    // 2. Microphone Voice Recording & Visualizer
    // =========================================================================
    let mediaRecorder = null;
    let audioChunks = [];
    let recordedAudioBlob = null;
    let recordingTimerInterval = null;
    let recordingSeconds = 0;
    let analyserNode = null;
    let microphoneStream = null;
    let visualizerAnimationFrame = null;

    const startRecBtn = document.getElementById('start-rec-btn');
    const pauseRecBtn = document.getElementById('pause-rec-btn');
    const stopRecBtn = document.getElementById('stop-rec-btn');
    const recordingTimer = document.getElementById('recording-timer');
    const audioPreview = document.getElementById('audio-preview');
    const downloadRecBtn = document.getElementById('download-rec-btn');
    const visualizerCanvas = document.getElementById('audio-visualizer');
    const canvasCtx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;

    if (startRecBtn) {
        startRecBtn.addEventListener('click', async () => {
            initAudioContext();
            try {
                microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                mediaRecorder = new MediaRecorder(microphoneStream);
                audioChunks = [];

                // Setup Audio Analysis for Visualizer
                const source = audioCtx.createMediaStreamSource(microphoneStream);
                analyserNode = audioCtx.createAnalyser();
                analyserNode.fftSize = 256;
                source.connect(analyserNode);
                drawVisualizer();

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(recordedAudioBlob);
                    audioPreview.src = audioUrl;
                    downloadRecBtn.href = audioUrl;
                    downloadRecBtn.classList.remove('disabled-link');
                    downloadRecBtn.removeAttribute('disabled');
                };

                mediaRecorder.start();
                startRecBtn.disabled = true;
                pauseRecBtn.disabled = false;
                stopRecBtn.disabled = false;
                pauseRecBtn.textContent = '⏸️ Pause';

                startRecordingTimer();
            } catch (err) {
                console.error('Microphone access denied or error:', err);
                alert('Could not access microphone. Please check permissions.');
            }
        });
    }

    if (pauseRecBtn) {
        pauseRecBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.pause();
                pauseRecBtn.textContent = '▶️ Resume';
                clearInterval(recordingTimerInterval);
            } else if (mediaRecorder && mediaRecorder.state === 'paused') {
                mediaRecorder.resume();
                pauseRecBtn.textContent = '⏸️ Pause';
                startRecordingTimer();
            }
        });
    }

    if (stopRecBtn) {
        stopRecBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                if (microphoneStream) {
                    microphoneStream.getTracks().forEach(track => track.stop());
                }
                startRecBtn.disabled = false;
                pauseRecBtn.disabled = true;
                stopRecBtn.disabled = true;
                pauseRecBtn.textContent = '⏸️ Pause';
                clearInterval(recordingTimerInterval);
                if (visualizerAnimationFrame) {
                    cancelAnimationFrame(visualizerAnimationFrame);
                }
                clearVisualizerCanvas();
            }
        });
    }

    function startRecordingTimer() {
        recordingSeconds = 0;
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = setInterval(() => {
            recordingSeconds++;
            const hrs = Math.floor(recordingSeconds / 3600).toString().padStart(2, '0');
            const mins = Math.floor((recordingSeconds % 3600) / 60).toString().padStart(2, '0');
            const secs = (recordingSeconds % 60).toString().padStart(2, '0');
            recordingTimer.textContent = `${hrs}:${mins}:${secs}`;
        }, 1000);
    }

    function drawVisualizer() {
        if (!canvasCtx || !analyserNode) return;
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function renderFrame() {
            visualizerAnimationFrame = requestAnimationFrame(renderFrame);
            analyserNode.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = '#1a1a1e';
            canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

            const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
                canvasCtx.fillStyle = `rgb(${dataArray[i] + 50}, 71, 247)`;
                canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        }
        renderFrame();
    }

    function clearVisualizerCanvas() {
        if (!canvasCtx) return;
        canvasCtx.fillStyle = '#1a1a1e';
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }

    // =========================================================================
    // 3. Virtual Piano Synthesizer
    // =========================================================================
    const noteFrequencies = {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
        'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
        'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88, 'C2': 523.25
    };

    const computerKeyToNote = {
        'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#', 'd': 'E',
        'f': 'F', 't': 'F#', 'g': 'G', 'y': 'G#', 'h': 'A',
        'u': 'A#', 'j': 'B', 'k': 'C2'
    };

    const pianoOctaveSelect = document.getElementById('piano-octave');

    function playPianoNote(noteName) {
        initAudioContext();
        if (!audioCtx) return;

        let baseFreq = noteFrequencies[noteName] || 440;
        const octaveMultiplier = Math.pow(2, parseInt(pianoOctaveSelect ? pianoOctaveSelect.value : 4) - 4);
        const freq = baseFreq * octaveMultiplier;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
    }

    // Piano key DOM event listeners
    document.querySelectorAll('.piano-key').forEach(keyEl => {
        const note = keyEl.getAttribute('data-note');
        keyEl.addEventListener('mousedown', () => {
            playPianoNote(note);
            keyEl.classList.add('active');
        });
        keyEl.addEventListener('mouseup', () => keyEl.classList.remove('active'));
        keyEl.addEventListener('mouseleave', () => keyEl.classList.remove('active'));
        
        // Touch support
        keyEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            playPianoNote(note);
            keyEl.classList.add('active');
        });
        keyEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            keyEl.classList.remove('active');
        });
    });

    // Computer keyboard listener for piano
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const note = computerKeyToNote[e.key.toLowerCase()];
        if (note) {
            playPianoNote(note);
            const keyEl = document.querySelector(`.piano-key[data-note="${note}"]`);
            if (keyEl) keyEl.classList.add('active');
        }
    });

    window.addEventListener('keyup', (e) => {
        const note = computerKeyToNote[e.key.toLowerCase()];
        if (note) {
            const keyEl = document.querySelector(`.piano-key[data-note="${note}"]`);
            if (keyEl) keyEl.classList.remove('active');
        }
    });

    // =========================================================================
    // 4. Virtual Drum Pads Synthesizer
    // =========================================================================
    function playDrumSound(soundType) {
        initAudioContext();
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const now = audioCtx.currentTime;

        switch (soundType) {
            case 'kick':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
                gainNode.gain.setValueAtTime(1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.5);
                break;

            case 'snare':
                // White noise buffer for snare
                const bufferSize = audioCtx.sampleRate * 0.2;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 800;

                gainNode.gain.setValueAtTime(0.7, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                noise.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                noise.start(now);
                break;

            case 'hihat-closed':
                playHiHat(0.05, 8000, 0.4);
                break;

            case 'hihat-open':
                playHiHat(0.3, 6000, 0.5);
                break;

            case 'tom-low':
                playTom(100, 0.3);
                break;

            case 'tom-mid':
                playTom(150, 0.25);
                break;

            case 'crash':
                playHiHat(0.8, 4000, 0.6);
                break;

            case 'clap':
                playClap();
                break;

            default:
                break;
        }
    }

    function playHiHat(duration, filterFreq, volume) {
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = filterFreq;

        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        noise.start();
    }

    function playTom(freq, duration) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const now = audioCtx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + duration);

        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    function playClap() {
        playHiHat(0.15, 1200, 0.5);
    }

    // Drum pad DOM listeners
    document.querySelectorAll('.drum-pad').forEach(pad => {
        const sound = pad.getAttribute('data-sound');
        pad.addEventListener('click', () => {
            playDrumSound(sound);
            triggerPadVisual(pad);
        });
        pad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            playDrumSound(sound);
            triggerPadVisual(pad);
        });
    });

    function triggerPadVisual(padEl) {
        padEl.classList.add('active');
        setTimeout(() => padEl.classList.remove('active'), 150);
    }

    // Computer keyboard shortcut for drum pads [1-8]
    const drumKeyMap = {
        '1': 'kick', '2': 'snare', '3': 'hihat-closed', '4': 'hihat-open',
        '5': 'tom-low', '6': 'tom-mid', '7': 'crash', '8': 'clap'
    };

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const sound = drumKeyMap[e.key];
        if (sound) {
            playDrumSound(sound);
            const padEl = document.querySelector(`.drum-pad[data-sound="${sound}"]`);
            if (padEl) triggerPadVisual(padEl);
        }
    });

    // =========================================================================
    // 5. 16-Step Drum Beat Sequencer
    // =========================================================================
    let isSequencerPlaying = false;
    let currentStep = 0;
    let sequencerTimer = null;

    const seqPlayBtn = document.getElementById('seq-play-btn');
    const seqStopBtn = document.getElementById('seq-stop-btn');
    const seqClearBtn = document.getElementById('seq-clear-btn');
    const seqBpmInput = document.getElementById('seq-bpm');

    // Step toggle logic
    document.querySelectorAll('.seq-step').forEach(stepBtn => {
        stepBtn.addEventListener('click', () => {
            stepBtn.classList.toggle('active');
        });
    });

    if (seqPlayBtn) {
        seqPlayBtn.addEventListener('click', () => {
            if (isSequencerPlaying) return;
            initAudioContext();
            isSequencerPlaying = true;
            currentStep = 0;
            startSequencerLoop();
        });
    }

    if (seqStopBtn) {
        seqStopBtn.addEventListener('click', () => {
            isSequencerPlaying = false;
            clearInterval(sequencerTimer);
            clearStepHighlights();
            currentStep = 0;
        });
    }

    if (seqClearBtn) {
        seqClearBtn.addEventListener('click', () => {
            document.querySelectorAll('.seq-step').forEach(s => s.classList.remove('active'));
        });
    }

    function startSequencerLoop() {
        clearInterval(sequencerTimer);
        const bpm = seqBpmInput ? parseInt(seqBpmInput.value) || 120 : 120;
        const stepIntervalMs = (60 / bpm / 4) * 1000; // 16th notes

        sequencerTimer = setInterval(() => {
            if (!isSequencerPlaying) return;

            // Update UI highlights
            clearStepHighlights();

            const tracks = ['kick', 'snare', 'hihat-closed', 'hihat-open'];
            tracks.forEach(trackName => {
                const container = document.querySelector(`.steps-container[data-instrument="${trackName}"]`);
                if (!container) return;
                const stepBtn = container.querySelector(`.seq-step[data-step="${currentStep}"]`);
                if (stepBtn) {
                    stepBtn.classList.add('playing');
                    if (stepBtn.classList.contains('active')) {
                        playDrumSound(trackName);
                    }
                }
            });

            currentStep = (currentStep + 1) % 16;
        }, stepIntervalMs);
    }

    function clearStepHighlights() {
        document.querySelectorAll('.seq-step').forEach(s => s.classList.remove('playing'));
    }

    if (seqBpmInput) {
        seqBpmInput.addEventListener('change', () => {
            if (isSequencerPlaying) {
                startSequencerLoop();
            }
        });
    }

    // =========================================================================
    // 6. PWA Installation Support & Service Worker Registration
    // =========================================================================
    let deferredPrompt = null;
    const installBtn = document.getElementById('install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) {
            installBtn.classList.remove('hidden');
        }
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            installBtn.classList.add('hidden');
        });
    }

    window.addEventListener('appinstalled', () => {
        console.log('Music Recording App successfully installed.');
        if (installBtn) installBtn.classList.add('hidden');
    });

   
