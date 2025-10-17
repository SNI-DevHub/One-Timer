    // --------------------- Timer logic ---------------------
    const display = document.getElementById('timeDisplay');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const lapBtn = document.getElementById('lapBtn');
    const progress = document.getElementById('progress');
    const modeSelect = document.getElementById('mode');
    const modeLabel = document.getElementById('modeLabel');
    const hoursInput = document.getElementById('hours');
    const minutesInput = document.getElementById('minutes');
    const secondsInput = document.getElementById('seconds');
    const lapsEl = document.getElementById('laps');
    const volumeInput = document.getElementById('volume');
    const notifySelect = document.getElementById('notify');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    let targetSeconds = 60; // default 1 minute
    let remaining = 0;
    let running = false;
    let intervalId = null;
    let totalSeconds = 0;
    let laps = [];

    // Load state from localStorage
    try{
      const s = JSON.parse(localStorage.getItem('mc_timer_state') || 'null');
      if(s){
        hoursInput.value = s.h ?? 0;
        minutesInput.value = s.m ?? 1;
        secondsInput.value = s.s ?? 0;
        modeSelect.value = s.mode ?? 'countdown';
        notifySelect.value = s.notify ?? 'on';
        volumeInput.value = s.volume ?? 0.9;
        laps = s.laps || [];
        renderLaps();
      }
    }catch(e){console.warn(e)}

    function secsFromInputs(){
      const h = Math.max(0, Number(hoursInput.value)||0);
      const m = Math.max(0, Number(minutesInput.value)||0);
      const s = Math.max(0, Number(secondsInput.value)||0);
      return h*3600 + m*60 + s;
    }

    function formatTime(sec){
      if(sec < 0) sec = 0;
      const h = Math.floor(sec/3600);
      const m = Math.floor((sec%3600)/60);
      const s = Math.floor(sec%60);
      return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
    }

    function updateDisplay(){
      if(modeSelect.value === 'countdown'){
        display.textContent = formatTime(remaining);
        const pct = totalSeconds>0? Math.min(100,100*(1 - (remaining/totalSeconds))) : 0;
        progress.style.width = pct + '%';
      }else if(modeSelect.value === 'countup'){
        display.textContent = formatTime(totalSeconds - remaining);
        const pct = totalSeconds>0? Math.min(100,100*((totalSeconds - remaining)/totalSeconds)) : 0;
        progress.style.width = pct + '%';
      }else if(modeSelect.value === 'pomodoro'){
        display.textContent = formatTime(remaining);
        const pct = totalSeconds>0? Math.min(100,100*(1 - (remaining/totalSeconds))) : 0;
        progress.style.width = pct + '%';
      }
    }

    function saveState(){
      const s = {
        h: Number(hoursInput.value)||0,
        m: Number(minutesInput.value)||0,
        s: Number(secondsInput.value)||0,
        mode: modeSelect.value,
        notify: notifySelect.value,
        volume: Number(volumeInput.value)||0.9,
        laps
      };
      try{localStorage.setItem('mc_timer_state', JSON.stringify(s));}catch(e){console.warn(e)}
    }

    function startTimer(){
      if(running) return;
      const mode = modeSelect.value;
      if(mode === 'pomodoro'){
        // 25 minutes work, 5 minutes break. If currently set to 0 -> set to 25:00
        if(totalSeconds === 0 || totalSeconds === null){
          totalSeconds = 25*60; remaining = totalSeconds;
        }
      }else if(mode === 'countdown'){
        totalSeconds = secsFromInputs(); remaining = totalSeconds;
        if(totalSeconds <= 0){
          alert('Atur durasi minimal lebih dari 0 detik');
          return;
        }
      }else if(mode === 'countup'){
        totalSeconds = secsFromInputs(); remaining = 0; // we'll count up from 0
      }

      modeLabel.textContent = 'Mode: ' + (modeSelect.value === 'countdown' ? 'Countdown' : modeSelect.value === 'countup' ? 'Count-up' : 'Pomodoro');
      running = true;
      intervalId = setInterval(tick, 250);
      saveState();
    }

    function tick(){
      const now = Date.now();
      if(modeSelect.value === 'countdown'){
        remaining -= 0.25; // called every 250ms
        if(remaining <= 0){
          remaining = 0; updateDisplay(); stopTimer(); alarm();
        } else updateDisplay();
      }else if(modeSelect.value === 'countup'){
        remaining += 0.25;
        if(totalSeconds>0 && remaining >= totalSeconds){
          remaining = totalSeconds; updateDisplay(); stopTimer(); alarm();
        } else updateDisplay();
      }else if(modeSelect.value === 'pomodoro'){
        remaining -= 0.25;
        if(remaining <= 0){
          remaining = 0; updateDisplay(); stopTimer(); alarm();
        } else updateDisplay();
      }
    }

    function stopTimer(){
      running = false; clearInterval(intervalId); intervalId = null; saveState();
    }

    function resetTimer(){
      stopTimer();
      if(modeSelect.value === 'countup'){
        remaining = 0; totalSeconds = secsFromInputs();
      }else{
        totalSeconds = secsFromInputs(); remaining = totalSeconds;
      }
      updateDisplay();
      laps = [];
      renderLaps();
      saveState();
    }

    function lap(){
      if(!running) return;
      const t = modeSelect.value === 'countup' ? remaining : (modeSelect.value === 'countdown' ? (totalSeconds - remaining) : (totalSeconds - remaining));
      const entry = {time: formatTime(modeSelect.value === 'countdown' ? remaining : Math.round(t)), raw: Date.now()};
      laps.unshift(entry);
      renderLaps();
      saveState();
    }

    function renderLaps(){
      lapsEl.innerHTML = '';
      if(!laps.length){lapsEl.innerHTML = '<div class="tiny">- belum ada lap -</div>';return}
      laps.forEach((l,i)=>{
        const div = document.createElement('div');div.className='lap';
        div.innerHTML = `<div>#${laps.length-i}</div><div>${l.time}</div>`;
        lapsEl.appendChild(div);
      })
    }

    // ------------------ Alarm (WebAudio) ------------------
    const audioCtx = (typeof AudioContext !== 'undefined') ? new AudioContext() : null;
    function alarm(){
      const vol = Number(volumeInput.value) || 0.9;
      // small beep sequence
      if(audioCtx){
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.02);
        o.type = 'square'; o.frequency.setValueAtTime(880, now);
        o.start(now); o.stop(now + 0.18);

        const o2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        o2.connect(g2); g2.connect(audioCtx.destination);
        g2.gain.setValueAtTime(0, now + 0.22);
        g2.gain.linearRampToValueAtTime(vol, now + 0.24);
        o2.type = 'square'; o2.frequency.setValueAtTime(660, now + 0.22);
        o2.start(now + 0.22); o2.stop(now + 0.42);
      } else {
        // fallback: use Notification (if permitted)
      }

      // Browser notification
      if(notifySelect.value === 'on' && 'Notification' in window){
        if(Notification.permission === 'granted'){
          new Notification('Timer selesai!', {body: 'Waktu telah habis.', silent: false});
        } else if(Notification.permission !== 'denied'){
          Notification.requestPermission().then(p => { if(p==='granted') new Notification('Timer selesai!', {body:'Waktu telah habis.'}); });
        }
      }
      // vibration on mobile
      if(navigator.vibrate) navigator.vibrate([200,100,200]);
    }

    // ------------------ Events ------------------
    startBtn.addEventListener('click', ()=>{
      // resume audio context on user gesture
      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      startTimer();
    });
    pauseBtn.addEventListener('click', ()=>{ stopTimer(); });
    resetBtn.addEventListener('click', ()=>{ if(confirm('Reset timer dan lap?')) resetTimer(); });
    lapBtn.addEventListener('click', ()=> lap());

    modeSelect.addEventListener('change', ()=>{
      const v = modeSelect.value;
      modeLabel.textContent = 'Mode: ' + (v==='countdown'?'Countdown':v==='countup'?'Count-up':'Pomodoro');
      if(v==='pomodoro'){
        hoursInput.value = 0; minutesInput.value = 25; secondsInput.value = 0;
      }
      resetTimer();
      saveState();
    });

    // presets
    document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', e=>{
      const h = Number(e.currentTarget.dataset.h)||0;
      const m = Number(e.currentTarget.dataset.m)||0;
      const s = Number(e.currentTarget.dataset.s)||0;
      hoursInput.value = h; minutesInput.value = m; secondsInput.value = s;
      resetTimer();
    }));

    // inputs change
    [hoursInput, minutesInput, secondsInput].forEach(inp => inp.addEventListener('input', ()=>{ saveState(); }));
    volumeInput.addEventListener('input', saveState);
    notifySelect.addEventListener('change', saveState);

    // keyboard shortcuts
    window.addEventListener('keydown', (e)=>{
      if(e.code === 'Space'){
        e.preventDefault();
        if(running) stopTimer(); else startTimer();
      }
      if(e.key.toLowerCase() === 'l') lap();
      if(e.key.toLowerCase() === 'r') resetTimer();
    });

    // fullscreen
    fullscreenBtn.addEventListener('click', ()=>{
      if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    // initialize display
    function init(){
      const mode = modeSelect.value;
      if(mode === 'countdown'){
        totalSeconds = secsFromInputs(); remaining = totalSeconds;
      }else if(mode === 'countup'){
        totalSeconds = secsFromInputs(); remaining = 0;
      }else if(mode === 'pomodoro'){
        totalSeconds = 25*60; remaining = totalSeconds;
      }
      renderLaps(); updateDisplay();
    }

    init();

    // save periodically
    setInterval(saveState, 3000);

    // Accessibility: announce when playing/paused
    const obs = new MutationObserver(()=>{
      // no-op right now, but placeholder for ARIA live updates
    });
    obs.observe(display, {childList:true,characterData:true,subtree:true});