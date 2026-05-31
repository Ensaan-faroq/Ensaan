// ⚠️ استبدل هذه القيم بمفاتيح Supabase الخاصة بك
const SUPABASE_URL = 'https://YOUR_PROJECT_URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let userId = localStorage.getItem('userId');
let confirmationCode = null;

async function loadRecipientData() {
    const { data: recipient, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !recipient) { window.location.href = 'index.html'; return; }
    if (!recipient.confirmation_code) {
        confirmationCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        await supabase.from('users').update({ confirmation_code: confirmationCode, confirmation_code_created_at: new Date() }).eq('id', userId);
    } else {
        confirmationCode = recipient.confirmation_code;
    }
    document.getElementById('confirmationCodeDisplay').innerText = confirmationCode;
    if (recipient.last_received_donation_at) {
        const last = new Date(recipient.last_received_donation_at);
        const diffDays = (Date.now() - last) / (1000*3600*24);
        if (diffDays < 7) {
            document.getElementById('newRequestBtn').disabled = true;
            document.getElementById('requestStatus').innerHTML = `⛔ لا يمكنك طلب دم قبل ${Math.ceil(7-diffDays)} يوم (فترة التهدئة)`;
        }
    }
}

document.getElementById('newRequestBtn').addEventListener('click', async () => {
    const { data: recipient } = await supabase.from('users').select('blood_type, lat, lng, last_received_donation_at').eq('id', userId).single();
    if (recipient.last_received_donation_at && (Date.now() - new Date(recipient.last_received_donation_at)) < 7*24*3600*1000) {
        alert('لا يمكنك طلب دم إلا بعد أسبوع من آخر تبرع');
        return;
    }
    const { error } = await supabase.from('blood_requests').insert({
        seeker_id: userId,
        blood_type_needed: recipient.blood_type,
        lat: recipient.lat,
        lng: recipient.lng,
        status: 'pending'
    });
    if (error) alert('فشل إنشاء الطلب: '+error.message);
    else alert('تم إرسال طلبك إلى أقرب المتبرعين');
});

loadRecipientData();
