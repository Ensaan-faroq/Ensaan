// ⚠️ استبدل هذه القيم بمفاتيح Supabase الخاصة بك
const SUPABASE_URL = 'https://YOUR_PROJECT_URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentAdmin = {
    username: localStorage.getItem('admin_username'),
    role: localStorage.getItem('admin_role'),
    fullName: localStorage.getItem('admin_full_name')
};
if (!localStorage.getItem('admin_logged_in')) window.location.href = 'admin-login.html';
document.getElementById('adminInfo').innerHTML = `👋 ${currentAdmin.fullName || currentAdmin.username} <span class="role-badge role-${currentAdmin.role}">${currentAdmin.role === 'super_admin' ? 'مدير عام' : (currentAdmin.role === 'admin' ? 'مشرف' : 'مراقب')}</span>`;

function applyPermissions() {
    const isSuper = currentAdmin.role === 'super_admin';
    const isViewer = currentAdmin.role === 'viewer';
    const addSection = document.getElementById('addAdminSection');
    if (addSection) isSuper ? addSection.classList.remove('hidden') : addSection.classList.add('hidden');
    if (isViewer) {
        document.querySelectorAll('.ban-btn, .delete-btn').forEach(btn => btn.remove());
    }
}
applyPermissions();

async function loadUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return;
    const donors = data.filter(u => u.role === 'donor');
    const seekers = data.filter(u => u.role === 'seeker');
    document.getElementById('totalDonors').innerText = donors.length;
    document.getElementById('totalSeekers').innerText = seekers.length;
    renderUsersTable(data);
}
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    const isViewer = currentAdmin.role === 'viewer';
    users.forEach(user => {
        let actions = '';
        if (!isViewer) {
            actions = `<button class="ban-btn" onclick="toggleUserStatus('${user.id}', ${user.is_active})">${user.is_active ? 'حظر' : 'إلغاء الحظر'}</button>`;
            if (currentAdmin.role === 'super_admin') actions += `<button class="delete-btn" onclick="deleteUser('${user.id}')">🗑️ حذف</button>`;
        } else actions = '🔒';
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${user.name}${user.phone}${user.blood_type}
            <td>${user.role === 'donor' ? '🟢 متبرع' : '🔴 محتاج'}
            <td class="${user.verified ? 'verified-yes' : 'verified-no'}">${user.verified ? '✓ موثق' : '✗ غير موثق'}${user.points || 0}
            <td>${user.is_active ? '✅ نشط' : '⛔ محظور'}${actions}
        `;
    });
}
window.toggleUserStatus = async (id, current) => {
    if (currentAdmin.role === 'viewer') return alert('لا صلاحية');
    await supabase.from('users').update({ is_active: !current }).eq('id', id);
    loadUsers();
};
window.deleteUser = async (id) => {
    if (currentAdmin.role !== 'super_admin') return alert('فقط المدير العام');
    if (confirm('حذف نهائي؟')) await supabase.from('users').delete().eq('id', id);
    loadUsers();
};
document.getElementById('searchUsers').addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase();
    const { data } = await supabase.from('users').select('*');
    const filtered = data.filter(u => u.name.toLowerCase().includes(term) || u.phone.includes(term));
    renderUsersTable(filtered);
});

async function loadRequests() {
    const { data, error } = await supabase.from('blood_requests').select('*, seeker:users(name), matched_donor:users!matched_donor_id(name)');
    if (error) return;
    document.getElementById('totalRequests').innerText = data.length;
    renderRequestsTable(data);
}
function renderRequestsTable(requests) {
    const tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = '';
    requests.forEach(req => {
        let actions = '';
        if (currentAdmin.role === 'super_admin') actions = `<button class="delete-btn" onclick="deleteRequest('${req.id}')">حذف</button>`;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${req.seeker?.name || '-'}${req.blood_type_needed}${req.lat?.toFixed(4) || '-'}, ${req.lng?.toFixed(4) || '-'}
            <td>${new Date(req.request_time).toLocaleString()}${req.status === 'pending' ? '⏳ معلق' : (req.status === 'accepted' ? '✅ تم القبول' : '✔️ مكتمل')}${req.matched_donor?.name || '-'}${actions}
        `;
    });
}
window.deleteRequest = async (id) => {
    if (confirm('حذف الطلب؟')) await supabase.from('blood_requests').delete().eq('id', id);
    loadRequests();
};

async function loadDonations() {
    const { data, error } = await supabase.from('donation_transactions').select('*, donor:users!donor_id(name), recipient:users!recipient_id(name)');
    if (error) return;
    renderDonationsTable(data);
}
function renderDonationsTable(donations) {
    const tbody = document.getElementById('donationsTableBody');
    tbody.innerHTML = '';
    donations.forEach(d => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${d.donor?.name || '-'}${d.recipient?.name || '-'}${d.confirmation_code}${d.points_awarded}
            <td>${new Date(d.completed_at || d.created_at).toLocaleString()}
        `;
    });
}

async function loadAdmins() {
    const { data, error } = await supabase.from('admins').select('*');
    if (error) return;
    renderAdminsTable(data);
}
function renderAdminsTable(admins) {
    const tbody = document.getElementById('adminsTableBody');
    tbody.innerHTML = '';
    const isSuper = currentAdmin.role === 'super_admin';
    admins.forEach(admin => {
        let actions = '';
        if (isSuper && admin.username !== currentAdmin.username) actions = `<button class="delete-btn" onclick="deleteAdmin('${admin.id}')">حذف</button>`;
        const row = tbody.insertRow();
        row.innerHTML = `<td>${admin.full_name || '-'}${admin.username}<td><span class="role-badge role-${admin.role}">${admin.role === 'super_admin' ? 'مدير عام' : (admin.role === 'admin' ? 'مشرف' : 'مراقب')}</span>${actions}`;
    });
}
async function hashPassword(pwd) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(pwd));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}
window.addNewAdmin = async () => {
    if (currentAdmin.role !== 'super_admin') return alert('غير مصرح');
    const username = document.getElementById('newUsername').value;
    const pwd = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const fullName = document.getElementById('newFullName').value;
    if (!username || !pwd) return alert('املأ البيانات');
    const hashed = await hashPassword(pwd);
    const { error } = await supabase.from('admins').insert([{ username, password: hashed, role, full_name: fullName }]);
    if (error) alert(error.message);
    else { alert('تمت الإضافة'); loadAdmins(); }
};
window.deleteAdmin = async (id) => {
    if (confirm('حذف المسؤول؟')) await supabase.from('admins').delete().eq('id', id);
    loadAdmins();
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tabId = btn.dataset.tab + 'Tab';
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'usersTab') loadUsers();
        if (tabId === 'requestsTab') loadRequests();
        if (tabId === 'donationsTab') loadDonations();
        if (tabId === 'adminsTab') loadAdmins();
    });
});

loadUsers();
loadRequests();
loadDonations();
loadAdmins();
