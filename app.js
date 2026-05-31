// ⚠️ استبدل هذه القيم بمفاتيح Supabase الخاصة بك لاحقًا
const SUPABASE_URL = 'https://YOUR_PROJECT_URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let mainMap, donorMiniMap, seekerMiniMap, currentMarker;
let selectedDonorLat = 15.3694, selectedDonorLng = 44.1910;
let selectedSeekerLat = null, selectedSeekerLng = null;
let tempUserData = null, generatedCode = null, codeExpiry = null;
let currentRole = 'donor';

const donorIcon = L.divIcon({ html: '<div style="background:#2ecc71; width:24px; height:24px; border-radius:50%; border:3px solid white;"></div>', iconSize: [24,24] });
const seekerIcon = L.divIcon({ html: '<div style="background:#e74c3c; width:24px; height:24px; border-radius:50%; border:3px solid white;"></div>', iconSize: [24,24] });
const movingIcon = L.divIcon({ html: '<div style="background:#f1c40f; width:24px; height:24px; border-radius:50%; border:3px solid white;"></div>', iconSize: [24,24] });

function initMainMap() {
    mainMap = L.map('mainMap').setView([15.3694, 44.1910], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OSM' }).addTo(mainMap);
    loadVerifiedUsers();
}
async function loadVerifiedUsers() {
    const { data } = await supabase.from('users').select('*').eq('verified', true);
    if (!data) return;
    data.forEach(user => {
        let icon = donorIcon;
        if (user.role === 'seeker') icon = seekerIcon;
        if (user.is_moving) icon = movingIcon;
        L.marker([user.lat, user.lng], { icon })
            .bindPopup(`<b>${user.name}</b><br>🩸 ${user.blood_type}<br>📞 ${user.phone}<br>🏥 ${user.nearby_hospitals?.join(', ') || '-'}`)
            .addTo(mainMap);
    });
}
async function loadLeaderboard() {
    const { data } = await supabase.from('users').select('name, country, points').eq('role', 'donor').order('points', { ascending: false }).limit(10);
    if (!data) return;
    const tbody = document.querySelector('#leaderboardTable tbody');
    if (tbody) {
        tbody.innerHTML = '';
        data.forEach((user, idx) => {
            const row = tbody.insertRow();
            row.innerHTML = `<td>${idx+1}</td><td>${user.name}</td><td>${user.country || ''}</td><td>${user.points}</td>`;
        });
    }
}
function initDonorMiniMap() {
    donorMiniMap = L.map('donorMiniMap').setView([selectedDonorLat, selectedDonorLng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(donorMiniMap);
    currentMarker = L.marker([selectedDonorLat, selectedDonorLng], { draggable: true }).addTo(donorMiniMap);
    currentMarker.on('dragend', e => {
        const pos = e.target.getLatLng();
        selectedDonorLat = pos.lat; selectedDonorLng = pos.lng;
        document.getElementById('donorLat').value = selectedDonorLat;
        document.getElementById('donorLng').value = selectedDonorLng;
    });
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            selectedDonorLat = pos.coords.latitude; selectedDonorLng = pos.coords.longitude;
            donorMiniMap.setView([selectedDonorLat, selectedDonorLng], 15);
            currentMarker.setLatLng([selectedDonorLat, selectedDonorLng]);
            document.getElementById('donorLat').value = selectedDonorLat;
            document.getElementById('donorLng').value = selectedDonorLng;
        });
    }
}
function initSeekerMiniMap() {
    seekerMiniMap = L.map('seekerMiniMap').setView([15.3694, 44.1910], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(seekerMiniMap);
    let seekerMarker = L.marker([15.3694, 44.1910], { draggable: true }).addTo(seekerMiniMap);
    seekerMarker.on('dragend', e => {
        const pos = e.target.getLatLng();
        selectedSeekerLat = pos.lat; selectedSeekerLng = pos.lng;
        document.getElementById('seekerLat').value = selectedSeekerLat;
        document.getElementById('seekerLng').value = selectedSeekerLng;
        document.getElementById('gpsStatus').innerHTML = '✅ تم تحديد الموقع بنجاح';
    });
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            selectedSeekerLat = pos.coords.latitude; selectedSeekerLng = pos.coords.longitude;
            seekerMiniMap.setView([selectedSeekerLat, selectedSeekerLng], 15);
            seekerMarker.setLatLng([selectedSeekerLat, selectedSeekerLng]);
            document.getElementById('seekerLat').value = selectedSeekerLat;
            document.getElementById('seekerLng').value = selectedSeekerLng;
            document.getElementById('gpsStatus').innerHTML = '✅ تم تحديد موقعك تلقائياً';
        }, () => {
            document.getElementById('gpsStatus').innerHTML = '⚠️ يرجى سحب العلامة لتحديد موقعك';
        });
    }
}
function generateCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function sendCodeViaWhatsApp(phone, code) {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '967' + clean.slice(1);
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(`كود التحقق لتطبيق خريطة الدم: ${code}`)}`;
    window.open(url, '_blank');
}
document.getElementById('donorRegisterForm').addEventListener('submit', async (e) => {
    e.preventDefault(); currentRole = 'donor';
    await handleRegistration('donor');
});
document.getElementById('seekerRegisterForm').addEventListener('submit', async (e) => {
    e.preventDefault(); currentRole = 'seeker';
    await handleRegistration('seeker');
});
async function handleRegistration(role) {
    if (role === 'seeker' && (!selectedSeekerLat || !selectedSeekerLng)) {
        alert('⚠️ يجب تحديد موقعك الجغرافي بدقة (اسحب العلامة على الخريطة)');
        return;
    }
    const name = document.getElementById(`${role}Name`).value;
    const phone = document.getElementById(`${role}Phone`).value;
    const bloodType = document.getElementById(`${role}BloodType`).value;
    const birthDate = role === 'donor' ? document.getElementById('donorBirthDate').value : null;
    const gender = role === 'donor' ? document.getElementById('donorGender').value : null;
    const country = document.getElementById(`${role}Country`).value;
    const governorate = document.getElementById(`${role}Governorate`).value;
    const district = document.getElementById(`${role}District`).value;
    const village = document.getElementById(`${role}Village`).value;
    const hamlet = role === 'seeker' ? document.getElementById('seekerHamlet').value : null;
    const hospitalsStr = role === 'donor' ? document.getElementById('donorHospitals').value : null;
    const nearby_hospitals = hospitalsStr ? hospitalsStr.split(',').map(h => h.trim()) : [];
    const lat = role === 'donor' ? selectedDonorLat : selectedSeekerLat;
    const lng = role === 'donor' ? selectedDonorLng : selectedSeekerLng;
    if (!bloodType || !country || !governorate) { alert('املأ الحقول الأساسية'); return; }
    const { data: existing } = await supabase.from('users').select('phone').eq('phone', phone);
    if (existing?.length) { alert('هذا الرقم مسجل مسبقاً'); return; }
    tempUserData = { name, phone, blood_type: bloodType, birth_date: birthDate, gender, country, governorate, district, village, nearby_hospitals, role, lat, lng, is_active: true, verified: false, is_available: true, points: 0 };
    if (hamlet) tempUserData.hamlet = hamlet;
    generatedCode = generateCode();
    codeExpiry = Date.now() + 10 * 60 * 1000;
    sendCodeViaWhatsApp(phone, generatedCode);
    alert(`تم إرسال الكود إلى واتساب ${phone}`);
    document.querySelector(`#${role}FormSection`).style.display = 'none';
    document.getElementById('verificationSection').style.display = 'block';
}
document.getElementById('verifyBtn').addEventListener('click', async () => {
    const userCode = document.getElementById('verificationCode').value;
    if (!userCode) return alert('أدخل الكود');
    if (Date.now() > codeExpiry) return alert('انتهت صلاحية الكود');
    if (userCode !== generatedCode) return alert('الكود غير صحيح');
    const { data, error } = await supabase.from('users').insert([{ ...tempUserData, verified: true }]).select();
    if (error) { alert('خطأ: '+error.message); return; }
    alert('✅ تم التحقق والتسجيل بنجاح');
    localStorage.setItem('userId', data[0].id);
    if (currentRole === 'donor') window.location.href = 'donor-dashboard.html';
    else window.location.href = 'recipient-dashboard.html';
});
document.getElementById('resendBtn').addEventListener('click', () => {
    if (!tempUserData) return alert('لا توجد بيانات');
    generatedCode = generateCode();
    codeExpiry = Date.now() + 10*60*1000;
    sendCodeViaWhatsApp(tempUserData.phone, generatedCode);
    alert('تم إعادة إرسال الكود');
});
document.getElementById('roleDonorBtn').addEventListener('click', () => {
    document.getElementById('roleDonorBtn').classList.add('active');
    document.getElementById('roleSeekerBtn').classList.remove('active');
    document.getElementById('donorFormSection').classList.add('active');
    document.getElementById('seekerFormSection').classList.remove('active');
});
document.getElementById('roleSeekerBtn').addEventListener('click', () => {
    document.getElementById('roleSeekerBtn').classList.add('active');
    document.getElementById('roleDonorBtn').classList.remove('active');
    document.getElementById('seekerFormSection').classList.add('active');
    document.getElementById('donorFormSection').classList.remove('active');
});
initMainMap();
initDonorMiniMap();
initSeekerMiniMap();
loadLeaderboard();
