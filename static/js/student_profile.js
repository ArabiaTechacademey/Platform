const studentId = sessionStorage.getItem('loggedStudentId');
  if (!studentId) window.location.href = 'login.html';

  const BAR_CLS = { HTML:'html', CSS:'css', JS:'js', Py:'py', GUI:'ai', data:'ml', Ma:'ai' };

  function matchKey(raw, db) {
    if (db[raw]) return raw;
    const up = raw.toUpperCase();
    for (const k of Object.keys(db)) if (k.toUpperCase() === up) return k;
    for (const k of Object.keys(db)) if (k.toUpperCase().includes(up)||up.includes(k.toUpperCase())) return k;
    return null;
  }

  const DAY_AR = { Sunday:'الأحد', Monday:'الاثنين', Tuesday:'الثلاثاء', Wednesday:'الأربعاء', Thursday:'الخميس', Friday:'الجمعة', Saturday:'السبت' };
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function nextSession(dayEn, timeStr) {
    const parts = timeStr.trim().split(' ');
    let [h,m]   = parts[0].split(':').map(Number);
    const p     = (parts[1]||'').toUpperCase();
    if (p==='PM'&&h!==12) h+=12;
    if (p==='AM'&&h===12) h=0;
    const now  = new Date();
    const d    = (DAYS.indexOf(dayEn) - now.getDay() + 7) % 7;
    const next = new Date(now);
    next.setDate(now.getDate()+d);
    next.setHours(h,m,0,0);
    if (next<=now) next.setDate(next.getDate()+7);
    return next;
  }

  const pad = n => String(n).padStart(2,'0');

  function startCountdown(dayEn, timeStr) {
    let target = nextSession(dayEn, timeStr);
    function tick() {
      const now  = new Date(), diff = target - now;
      const stEl = document.getElementById('cd-status');
      if (!stEl) return;
      if (diff <= 0) {
        stEl.className = 'session-badge s-now'; stEl.textContent = 'الحصة الآن';
        ['cd-d','cd-h','cd-m','cd-s'].forEach(id => { const e=document.getElementById(id); if(e) e.textContent='00'; });
        setTimeout(()=>{ target=nextSession(dayEn,timeStr); tick(); }, 60000);
        return;
      }
      const days=Math.floor(diff/86400000), hrs=Math.floor((diff%86400000)/3600000),
            mins=Math.floor((diff%3600000)/60000), secs=Math.floor((diff%60000)/1000);
      const map={d:days,h:hrs,m:mins,s:secs};
      Object.entries(map).forEach(([k,v])=>{ const e=document.getElementById('cd-'+k); if(e) e.textContent=pad(v); });

      /* highlight urgent units */
      document.querySelectorAll('.cd-unit').forEach((b,i)=>{
        b.classList.toggle('live', days===0 && i>0);
      });

      if (days===0&&hrs===0&&mins<30) { stEl.className='session-badge s-soon'; stEl.textContent='قريباً جداً'; }
      else                            { stEl.className='session-badge s-upcoming'; stEl.textContent='الحصة القادمة'; }
    }
    tick(); setInterval(tick,1000);
  }

  /* ── LOAD ── */
  Promise.all([
    fetch('data/data.json').then(r=>{ if(!r.ok) throw new Error('data.json'); return r.json(); }),
    fetch('data/courses.json').then(r=>{ if(!r.ok) throw new Error('courses.json'); return r.json(); })
  ])
  .then(([data,courses])=>{
    const s = data.students.find(s=>s.id===studentId);
    if (!s) { showError(`الطالب برقم "${studentId}" غير موجود`); return; }
    render(s, courses);
  })
  .catch(err=>showError('تعذّر تحميل البيانات — '+err.message));

  function showError(msg) {
    document.getElementById('loadingState').style.display='none';
    document.getElementById('errorState').style.display='';
    document.getElementById('errorMsg').textContent=msg;
  }

  /* ── RENDER ── */
  function render(s, courses) {
    document.getElementById('loadingState').style.display='none';
    document.getElementById('heroBand').style.display='';
    document.getElementById('contentGrid').style.display='grid';

    const isActive  = s.status===1;
    const typeLabel = s.type||'';
    const price     = s.monthly_price||0;
    const renewLink = s.renewalLink||'https://forms.gle/dCyxeR7mvH9L764E7';

    /* Hero */
    const initials = s.name ? s.name.split(' ').map(w=>w[0]).join('').slice(0,2) : '؟';
    document.getElementById('heroAvatar').textContent = initials;
    document.getElementById('heroName').textContent   = s.name||'';
    const badges = document.getElementById('heroBadges');
    if (s.track)   badges.insertAdjacentHTML('beforeend',`<span class="hero-badge">${s.track}</span>`);
    if (typeLabel) badges.insertAdjacentHTML('beforeend',`<span class="hero-badge hi">${typeLabel}</span>`);

    /* Info */
    const rows=[
      ['رقم الهاتف',       s.phone_number],
      ['البريد الإلكتروني', s.email],
      ['السن',              s.age?s.age+' عام':null],
      ['المرحلة الدراسية',  s.level],
      ['تاريخ الانضمام',   s.joinDate],
      ['كود الطالب',        s.id],
    ].filter(r=>r[1]);
    document.getElementById('infoRows').innerHTML = rows.map(([k,v])=>
      `<li><span class="ik">${k}</span><span class="iv">${v}</span></li>`
    ).join('');

    /* Subscription */
    const isFardi = typeLabel==='فردي';
    let sub = `<ul class="info-list">`;
    if (typeLabel)
      sub+=`<li><span class="ik">نوع الاشتراك</span><span class="iv"><span class="tag ${isFardi?'tag-blue':'tag-purple'}">${typeLabel}</span></span></li>`;
    if (price)
      sub+=`<li><span class="ik">الرسوم الشهرية</span><span class="iv" style="color:var(--blue-dk)">${price.toLocaleString('ar-EG')} ج.م</span></li>`;
    if (s.paidMonths)
      sub+=`<li><span class="ik">الأشهر المدفوعة</span><span class="iv">${s.paidMonths}</span></li>`;
    sub+='</ul>';
    if (price)
      sub+=`<div class="pay-notice">المستحق شهرياً: <strong>${price.toLocaleString('ar-EG')} ج.م</strong></div>`;
    sub+=`<a href="${renewLink}" target="_blank" class="btn btn-green">تجديد الاشتراك</a>`;
    document.getElementById('subCardBody').innerHTML=sub;

    /* Action row */
    const ar = document.getElementById('actionRow');
    ar.style.display='flex';
    if (isActive) {
      const link = s.link||'./meeting.html';
      ar.innerHTML=`<a class="btn btn-solid" href="${link}" target="_blank" rel="noopener">الانضمام إلى الاجتماع</a>`;
    } else {
      ar.innerHTML=`
        <a class="btn btn-expired" href="${renewLink}" target="_blank">تجديد الاشتراك</a>
        <span class="expire-note">اشتراكك منتهٍ — يرجى التجديد للمتابعة</span>`;
    }

    /* Session countdown */
    if (s.Day && s.Time) {
      const el = document.getElementById('sessionSection');
      el.style.display='block';
      el.innerHTML=`
        <div class="session-card">
          <div class="session-meta">
            <span class="session-eyebrow">الحصة القادمة</span>
            <div class="session-when">
              <span class="day-chip">${DAY_AR[s.Day]||s.Day}</span>
              <span class="session-time">${s.Time}</span>
            </div>
            <span class="session-badge s-upcoming" id="cd-status">الحصة القادمة</span>
          </div>
          <div class="cd-row">
            <div class="cd-unit"><span class="cd-n" id="cd-d">--</span><span class="cd-l">يوم</span></div>
            <span class="cd-dot">:</span>
            <div class="cd-unit"><span class="cd-n" id="cd-h">--</span><span class="cd-l">ساعة</span></div>
            <span class="cd-dot">:</span>
            <div class="cd-unit"><span class="cd-n" id="cd-m">--</span><span class="cd-l">دقيقة</span></div>
            <span class="cd-dot">:</span>
            <div class="cd-unit"><span class="cd-n" id="cd-s">--</span><span class="cd-l">ثانية</span></div>
          </div>
        </div>`;
      startCountdown(s.Day, s.Time);
    }

    /* Courses */
    const done = s.completed_courses||[];
    const all  = [...done];
    if (isActive&&s.current_course) all.push(s.current_course);
    if (!all.length) return;

    const groups={};
    all.forEach(raw=>{
      const key  = matchKey(raw,courses);
      const info = key?courses[key]:null;
      const spec = info?info.special:'أخرى';
      if(!groups[spec]) groups[spec]=[];
      groups[spec].push({raw,key,info});
    });

    const track = document.getElementById('trackSection');
    track.style.display='block';
    track.innerHTML='';

    Object.entries(groups).forEach(([spec,items])=>{
      const label = spec==='Web development'?'تصميم المواقع':spec==='Artificial Intelligence'?'الذكاء الاصطناعي':spec;
      const sec   = document.createElement('div');
      sec.style.marginBottom='28px';
      sec.innerHTML=`<div class="sec-title">مسار ${label}</div>`;

      const grid=document.createElement('div');
      grid.className='courses-grid';

      items.forEach(({raw,key,info})=>{
        const isDone    = done.map(d=>d.toUpperCase()).includes(raw.toUpperCase());
        const isCurrent = isActive&&raw.toUpperCase()===(s.current_course||'').toUpperCase();
        const bar       = BAR_CLS[key]||'def';

        let btn;
        if (isDone&&info)         btn=`<a class="c-btn done" href="${info.link}">مكتمل</a>`;
        else if (isCurrent&&info) btn=`<a class="c-btn join" href="${info.link}">الانضمام</a>`;
        else                      btn=`<span class="c-btn locked">قريباً</span>`;

        const card=document.createElement('div');
        card.className='c-card';
        card.innerHTML=`
          <div class="c-bar ${bar}"></div>
          <div class="c-body">
            <div class="c-tag">${info?info.special:''}</div>
            <div class="c-name">${info?info.course_name:raw}</div>
            <div class="c-dur">${info?info.duration:''}</div>
            ${btn}
          </div>`;
        grid.appendChild(card);
      });

      sec.appendChild(grid);
      track.appendChild(sec);
    });
  }