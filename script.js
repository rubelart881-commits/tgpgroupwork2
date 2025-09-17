// Firebase কনফিগারেশন
const firebaseConfig = {
    apiKey: "AIzaSyA6Qcog97mvfc_RysaH420wdIqNweGgHg8",
    authDomain: "tgp-group-work.firebaseapp.com",
    databaseURL: "https://tgp-group-work-default-rtdb.firebaseio.com",
    projectId: "tgp-group-work",
    storageBucket: "tgp-group-work.appspot.com",
    messagingSenderId: "254968365131",
    appId: "1:254968365131:web:bedae8eaf2c2a71959cdce",
    measurementId: "G-8K6NH5KGZF"
};

// Firebase শুরু করা
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// গ্লোবাল ভেরিয়েবল
let currentUser = { userId: null, nickname: null, sessionCode: null };
let activeSessionRef = null;

// DOM এলিমেন্টস
const lobbyView = document.getElementById("lobby-view");
const dashboardView = document.getElementById("dashboard-view");
const createNicknameInput = document.getElementById("create-nickname-input");
const createSessionBtn = document.getElementById("create-session-btn");
const joinNicknameInput = document.getElementById("join-nickname-input");
const sessionCodeInput = document.getElementById("session-code-input");
const joinSessionBtn = document.getElementById("join-session-btn");
const joinErrorMsg = document.getElementById("join-error-msg");
const sessionCodeLabel = document.getElementById("session-code-label");
const logoutBtn = document.getElementById("logout-btn");
const logProgressBtn = document.getElementById("log-progress-btn");
const membersGrid = document.getElementById("members-grid-container");
const progressModal = document.getElementById("progress-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const progressForm = document.getElementById("progress-form");
const loadingOverlay = document.getElementById("loading-overlay");

// ইউজার আইডি ম্যানেজমেন্ট
const getOrCreateUserId = () => {
    let userId = localStorage.getItem("tgp_permanent_userId");
    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        localStorage.setItem("tgp_permanent_userId", userId);
    }
    return userId;
};

// সেশন ম্যানেজমেন্ট
const generateSessionCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();

async function createSession() {
    const nickname = createNicknameInput.value.trim();
    if (!nickname) return alert("Please enter a nickname.");
    
    showLoading();
    currentUser.userId = getOrCreateUserId();
    currentUser.nickname = nickname;
    currentUser.sessionCode = generateSessionCode();

    try {
        await database.ref(`sessions/${currentUser.sessionCode}`).set({
            members: { [currentUser.userId]: { nickname } },
            scores: {}
        });
        saveCurrentSession();
        initializeDashboard();
    } catch (e) { console.error(e); alert("Error creating session."); }
    finally { hideLoading(); }
}

async function joinSession() {
    const nickname = joinNicknameInput.value.trim();
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    if (!nickname || !sessionCode) { joinErrorMsg.textContent = "Nickname and session code are required."; return; }

    showLoading();
    joinErrorMsg.textContent = "";

    try {
        const snapshot = await database.ref(`sessions/${sessionCode}`).once('value');
        if (!snapshot.exists()) {
            joinErrorMsg.textContent = "Session not found.";
            return;
        }

        currentUser.userId = getOrCreateUserId();
        currentUser.nickname = nickname;
        currentUser.sessionCode = sessionCode;

        await database.ref(`sessions/${sessionCode}/members/${currentUser.userId}`).update({ nickname });
        saveCurrentSession();
        initializeDashboard();
    } catch (e) { console.error(e); alert("Error joining session."); }
    finally { hideLoading(); }
}

function logout() {
    if(confirm("Are you sure you want to logout?")){
        if (activeSessionRef) activeSessionRef.off();
        localStorage.removeItem("missionScholarship_currentSession");
        currentUser = { userId: getOrCreateUserId(), nickname: null, sessionCode: null };
        showView('lobby');
    }
}


// UI এবং স্টেট ম্যানেজমেন্ট
const showLoading = () => loadingOverlay.style.display = "flex";
const hideLoading = () => loadingOverlay.style.display = "none";
const showView = (view) => {
    lobbyView.style.display = view === 'lobby' ? 'block' : 'none';
    dashboardView.style.display = view === 'dashboard' ? 'block' : 'none';
};
const saveCurrentSession = () => localStorage.setItem("missionScholarship_currentSession", JSON.stringify(currentUser));
const loadCurrentSession = () => {
    const data = localStorage.getItem("missionScholarship_currentSession");
    if(data) currentUser = JSON.parse(data);
    return !!data;
}


// ড্যাশবোর্ড লজিক
function initializeDashboard() {
    sessionCodeLabel.textContent = currentUser.sessionCode;
    showView('dashboard');
    listenToSessionChanges();
}

function listenToSessionChanges() {
    if (activeSessionRef) activeSessionRef.off(); // আগের Listener বন্ধ করা
    
    activeSessionRef = database.ref(`sessions/${currentUser.sessionCode}`);
    activeSessionRef.on('value', snapshot => {
        const data = snapshot.val();
        if (!data || !data.members || !data.members[currentUser.userId]) {
            // যদি সেশন ডিলিট হয়ে যায় বা ইউজার রিমুভ হয়ে যায়
            if (dashboardView.style.display === 'block') {
                 alert("Session ended or you have been removed.");
                 logout();
            }
            return;
        }
        renderDashboard(data.members, data.scores || {});
    });
}


function renderDashboard(members, scores) {
    membersGrid.innerHTML = '';
    for(const userId in members){
        const memberData = members[userId];
        const card = document.createElement('div');
        card.className = 'member-card';
        if (userId === currentUser.userId) card.classList.add('current-user');
        
        const stats = calculateUserStats(scores[userId] || {});
        
        card.innerHTML = `
            <div class="member-header">
                <span class="member-name">${memberData.nickname} ${userId === currentUser.userId ? '(You)' : ''}</span>
                <span class="streak-info">🔥 ${stats.streak}</span>
            </div>
            <div class="weekly-score">
                <div class="score-value">${stats.weeklyScore}</div>
                <div class="score-label">Weekly Score</div>
            </div>
            <div class="today-log">
                <h4>Today's Log</h4>
                <div class="log-items">
                    ${stats.todayLog.length ? stats.todayLog.map(log => `
                        <div class="log-item">
                            <span>${log.subject}</span>
                            <span>${log.score}/10</span>
                        </div>
                    `).join('') : `<span>No activities logged.</span>`}
                </div>
            </div>
        `;
        membersGrid.appendChild(card);
    }
}

function calculateUserStats(userScores) {
    let weeklyScore = 0;
    const todayLog = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Calculate weekly score and today's log
    Object.entries(userScores).forEach(([date, dayScores]) => {
        const dateDiff = (today - new Date(date)) / (1000 * 3600 * 24);
        if (dateDiff < 7) {
            Object.values(dayScores).forEach(log => {
                weeklyScore += log.score || 0;
            });
        }
        if (date === todayStr) {
            Object.entries(dayScores).forEach(([subject, data]) => todayLog.push({ subject, score: data.score }));
        }
    });

    // Calculate Streak
    const dates = Object.keys(userScores).sort().reverse();
    let streak = 0;
    if (dates.length > 0) {
        let currentDate = new Date(todayStr);
        for (let i = 0; i < dates.length; i++) {
            if (dates[i] === currentDate.toISOString().split('T')[0]) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
    }
    
    return { weeklyScore, streak, todayLog };
}


// মডাল (Modal) এর কাজ
function openProgressModal() {
    progressForm.reset();
    const today = new Date().toISOString().split('T')[0];
    database.ref(`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}`).once('value').then(snapshot => {
        const scores = snapshot.val();
        if (scores) {
            for(const subject in scores) {
                document.getElementById(`${subject.toLowerCase()}-score`).value = scores[subject].score;
                document.getElementById(`${subject.toLowerCase()}-note`).value = scores[subject].note;
            }
        }
    });
    progressModal.style.display = 'flex';
}

function closeProgressModal() {
    progressModal.style.display = 'none';
}

async function handleProgressSubmit(e) {
    e.preventDefault();
    showLoading();

    const today = new Date().toISOString().split('T')[0];
    const updates = {};
    const subjects = ['math', 'english', 'bangla', 'science'];
    
    subjects.forEach(subject => {
        const score = document.getElementById(`${subject}-score`).value;
        const note = document.getElementById(`${subject}-note`).value;
        if(score || note) {
            updates[`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}/${subject.charAt(0).toUpperCase() + subject.slice(1)}`] = { score: Number(score) || 0, note: note || "" };
        }
    });

    try {
        await database.ref().update(updates);
        closeProgressModal();
    } catch(err) {
        alert('Could not save progress');
        console.error(err);
    } finally {
        hideLoading();
    }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    currentUser.userId = getOrCreateUserId();
    if(loadCurrentSession()) {
        showLoading();
        database.ref(`sessions/${currentUser.sessionCode}/members/${currentUser.userId}`).once('value').then(snapshot => {
            if(snapshot.exists()) {
                initializeDashboard();
            } else {
                clearCurrentSession();
                showView('lobby');
            }
        }).catch(err => {
            console.error(err);
            clearCurrentSession();
        }).finally(() => hideLoading());
    }
});

createSessionBtn.addEventListener('click', createSession);
joinSessionBtn.addEventListener('click', joinSession);
logoutBtn.addEventListener('click', logout);
logProgressBtn.addEventListener('click', openProgressModal);
closeModalBtn.addEventListener('click', closeProgressModal);
progressModal.addEventListener('click', (e) => {
    if (e.target === progressModal) closeProgressModal();
});
progressForm.addEventListener('submit', handleProgressSubmit);
