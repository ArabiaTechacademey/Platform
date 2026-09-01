const inp     = document.getElementById('sid');
  const errDiv  = document.getElementById('err');
  const loadRow = document.getElementById('loadingRow');
  const btn     = document.getElementById('loginBtn');

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  inp.addEventListener('input',   ()  => { errDiv.classList.remove('show'); inp.style.borderColor = ''; });

  async function doLogin() {
    const id = inp.value.trim().toUpperCase();
    if (!id) { showErr('أدخل الرقم التعريفي الخاص بك.'); return; }

    setLoading(true);

    let students = [];
    try {
      const res = await fetch('./data/data.json');
      if (!res.ok) throw new Error('fetch failed');
      students = await res.json();
    } catch (e) {
      setLoading(false);
      showErr('⚠️ تعذّر تحميل بيانات الطلاب. تأكد من وجود ملف data.json.');
      return;
    }

    // Support both array and object-with-students key
    if (!Array.isArray(students)) {
      students = students.students || students.data || Object.values(students);
    }

    const student = students.find(s => String(s.id).toUpperCase() === id);

    setLoading(false);

    if (!student) {
      showErr('❌ الرقم التعريفي غير صحيح. تأكد منه وحاول مجدداً.');
      inp.focus();
      return;
    }

    sessionStorage.setItem('loggedStudentId', student.id);
    window.location.href = 'student_profile.html';
  }

  function setLoading(on) {
    btn.disabled = on;
    btn.textContent = on ? '...' : 'Login';
    loadRow.classList.toggle('show', on);
    errDiv.classList.remove('show');
  }

  function showErr(msg) {
    errDiv.textContent = msg;
    errDiv.classList.remove('show');
    void errDiv.offsetWidth;
    errDiv.classList.add('show');
    inp.style.borderColor = '#e74c3c';
    setTimeout(() => { inp.style.borderColor = ''; }, 1800);
  }