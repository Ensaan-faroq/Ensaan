// ⚠️ استبدل هذه القيم بمفاتيح Supabase الخاصة بك
const SUPABASE_URL = 'https://YOUR_PROJECT_URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let userId = localStorage.getItem('userId');
let map;

async function loadDonorData() {
    const { data: donor, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !donor) { window.location.href = 'index.html'; return; }
    document.getElementById('points').innerText = donor.points || 0;
    if (donor.last_successful_donation_at) {
        const last = new Date(donor.last_successful_donation_at);
        const diffDays = (Date.now() - last) / (1000*3600*24);
        if (diffDays < 90) document.getElementById('coolingMsg').innerHTML = `⛔ لا يمكنك التبرع قبل ${Math.ceil(90-diffDays)} يوم (فترة التهدئة)`;
    }
    map = L.map('requestsMap').setView([donor.lat, donor.lng], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
    const { data: requests } = await supabase.from('blood_requests').select('*, seeker:users(name, phone, lat, lng)').eq('status', 'pending').eq('blood_type_needed', donor.blood_type);
    requests.forEach(req => {
        L.marker([req.seeker.lat, req.seeker.lng]).addTo(map).bindPopup(`<b>${req.seeker.name}</b><br>فصيلة ${req.blood_type_needed}<br><button onclick="acceptRequest('${req.id}')">تبرع الآن</button>`);
    });
}

async function acceptRequest(requestId) {
    const { data: donor } = await supabase.from('users').select('last_successful_donation_at').eq('id', userId).single();
    if (donor.last_successful_donation_at && (Date.now() - new Date(donor.last_successful_donation_at)) < 90*24*3600*1000) {
        alert('لا يمكنك التبرع حالياً بسبب فترة التهدئة (3 أشهر)');
        return;
    }
    await supabase.from('blood_requests').update({ status: 'accepted', matched_donor_id: userId }).eq('id', requestId);
    alert('تم قبول الطلب، سيتم إنشاء دردشة مع المحتاج');
    const { data: req } = await supabase.from('blood_requests').select('seeker_id').eq('id', requestId).single();
    const { data: seeker } = await supabase.from('users').select('phone').eq('id', req.seeker_id).single();
    window.open(`https://wa.me/${seeker.phone.replace(/[^0-9]/g,'')}?text=مرحباً، أنا متبرع وأريد مساعدتك`, '_blank');
}

window.acceptRequest = acceptRequest;

document.getElementById('submitConfirm').addEventListener('click', async () => {
    const code = document.getElementById('confirmCode').value;
    const { data: request } = await supabase.from('blood_requests').select('id, seeker_id').eq('matched_donor_id', userId).eq('status', 'accepted').single();
    if (!request) { document.getElementById('confirmResult').innerHTML = 'لا يوجد طلب نشط'; return; }
    const { data: recipient } = await supabase.from('users').select('confirmation_code, id').eq('id', request.seeker_id).single();
    if (recipient.confirmation_code === code) {
        await supabase.from('blood_requests').update({ status: 'completed', completed_at: new Date() }).eq('id', request.id);
        await supabase.from('users').update({ last_successful_donation_at: new Date(), points: supabase.sql`points + 10` }).eq('id', userId);
        await supabase.from('users').update({ last_received_donation_at: new Date() }).eq('id', request.seeker_id);
        await supabase.from('donation_transactions').insert({ donor_id: userId, recipient_id: request.seeker_id, request_id: request.id, confirmation_code: code, status: 'completed', points_awarded: 10 });
        document.getElementById('confirmResult').innerHTML = '✅ تم تأكيد التبرع، شكراً لك! تم إضافة 10 نقاط.';
        loadDonorData();
    } else {
        document.getElementById('confirmResult').innerHTML = '❌ كود غير صحيح';
    }
});

loadDonorData();
