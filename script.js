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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global State
let currentUser = {};
let sessionListenerUnsubscribe = null;

// DOM Elements
const lobbyView = document.getElementById("lobby-view");
const dashboardView = document.getElementById("dashboard-view");
const createNicknameInput = document.getElementById("create-nickname");
const createSessionBtn = document.getElementById("create-session-btn");
const joinNicknameInput = document.getElementById("join-nickname");
const sessionCodeInput = document.getElementById("session-code");
const joinSessionBtn = document.getElementById("join-session-btn");
const joinError = document.getElementById("join-error");
const currentSessionCodeSpan = document.getElementById("current-session-code");
const logoutBtn = document.getElementById("logout-btn");
const logProgressBtn = document.getElementById("log-progress-btn");
const membersGrid = document.getElementById("members-grid");
const progressModal = document.getElementById("progress-modal");
const closeModalBtn = document.getElementById("close-modal");
const progressForm = document.getElementById("progress-form");
const loadingOverlay = document.getElementById("loading-overlay");

// Core User Identity Function
const getOrCreateUserId = () => {
    let userId = localStorage.getItem("tgp_permanentUserId");
    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("tgp_permanentUserId", userId);
    }
    return userId;
};

// UI & LocalStorage Helpers
const showLoading = () => loadingOverlay.classList.add("active");
const hideLoading = () => loadingOverlay.classList.remove("active");
const showView = (viewName) => {
    lobbyView.classList.remove('active');
    dashboardView.classList.remove('active');
    document.getElementById(`${viewName}-view`).classList.add('active');
};
const saveSessionData = () => localStorage.setItem('currentSession', JSON.stringify(currentUser));
const loadSessionData = () => {
    const session = localStorage.getItem('currentSession');
    if (session) {
        currentUser = { ...currentUser, ...JSON.parse(session) };
        return true;
    }
    return false;
};
const clearSessionData = () => localStorage.removeItem('currentSession');

// Session Logic
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

async function createSession() {
    const nickname = createNicknameInput.value.trim();
    if (!nickname) return alert("Nickname is required.");
    showLoading();

    try {
        currentUser = { userId: getOrCreateUserId(), nickname, sessionCode: generateCode() };
        await database.ref(`sessions/${currentUser.sessionCode}`).set({
            members: { [currentUser.userId]: { nickname } },
            scores: {}
        });
        saveSessionData();
        await initializeDashboard();
    } catch (err) {
        console.error("Create session failed:", err);
        alert("Could not create session.");
    } finally {
        hideLoading();
    }
}

async function joinSession() {
    const nickname = joinNicknameInput.value.trim();
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    if (!nickname || !sessionCode) { joinError.textContent = "Nickname and code are required."; return; }
    showLoading();
    joinError.textContent = "";

    try {
        const sessionRef = database.ref(`sessions/${sessionCode}`);
        const snapshot = await sessionRef.once('value');
        if (!snapshot.exists()) {
            joinError.textContent = "Session code not found.";
            return;
        }

        currentUser = { userId: getOrCreateUserId(), nickname, sessionCode };
        await database.ref(`sessions/${sessionCode}/members/${currentUser.userId}`).set({ nickname });

        saveSessionData();
        await initializeDashboard();
    } catch (err) {
        console.error("Join session failed:", err);
        alert("Could not join session.");
    } finally {
        hideLoading();
    }
}

function logout() {
    if(confirm("Are you sure you want to log out?")){
        if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
        clearSessionData();
        currentUser.nickname = null;
        currentUser.sessionCode = null;
        showView('lobby');
    }
}

// Dashboard Logic
async function initializeDashboard() {
    currentSessionCodeSpan.textContent = currentUser.sessionCode;
    await setupRealtimeListener();
    showView('dashboard');
}

async function setupRealtimeListener() {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
    const sessionRef = database.ref(`sessions/${currentUser.sessionCode}`);
    sessionListenerUnsubscribe = sessionRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            renderDashboard(data.members || {}, data.scores || {});
        } else {
            // If session is deleted
            alert("Session was deleted.");
            logout();
        }
    });
}

function renderDashboard(members, scores) {
    membersGrid.innerHTML = '';
    for (const userId in members) {
        const card = createMemberCard(userId, members[userId], scores[userId] || {});
        membersGrid.appendChild(card);
    }
}

function createMemberCard(userId, memberData, userScores) {
    const card = document.createElement("div");
    card.className = "member-card";
    const { weeklyScore, streak, todayLog } = calculateUserStats(userScores);
    const isCurrentUser = userId === currentUser.userId;

    const todayLogHtml = todayLog.length > 0 
        ? todayLog.map(item => `<div class="log-item"><span>${item.subject}</span><span>${item.score}/10</span></div>`).join("") 
        : '<div class="log-item"><span>No activities logged today.</span></div>';

    card.innerHTML = `
        <div class="member-header">
            <div class="member-name">${memberData.nickname} ${isCurrentUser ? '(You)' : ''}</div>
            <div class="streak-info">🔥 ${streak}</div>
        </div>
        <div class="weekly-score">
            <div class="score-value">${weeklyScore}</div>
            <div class="score-label">Weekly Score</div>
        </div>
        <div class="today-log">
            <h4>Today's Log</h4>
            <div class="log-items">${todayLogHtml}</div>
        </div>`;
    return card;
}


function calculateUserStats(userScores) { /* আগের কোডের মতোই থাকবে, কোনো পরিবর্তন দরকার নেই */ }
// Modal Logic
function openProgressModal() { /* আগের কোডের মতোই থাকবে, কোনো পরিবর্তন দরকার নেই */ }
function closeProgressModal() { progressModal.classList.remove("active"); progressForm.reset(); }
// (Copy the exact functions for 'calculateUserStats' and 'openProgressModal' from your previous code here)


// Event Listeners
createSessionBtn.addEventListener("click", createSession);
joinSessionBtn.addEventListener("click", joinSession);
logoutBtn.addEventListener("click", logout);
logProgressBtn.addEventListener("click", openProgressModal);
closeModalBtn.addEventListener("click", closeProgressModal);
progressForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoading();
    const today = new Date().toISOString().split('T')[0];
    const updates = {};
    let hasData = false;

    ["math", "english", "bangla", "science"].forEach(sub => {
        const score = document.getElementById(`${sub}-score`).value;
        const note = document.getElementById(`${sub}-note`).value.trim();
        if (score || note) {
            updates[`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}/${sub.charAt(0).toUpperCase() + sub.slice(1)}`] = { score: Number(score) || 0, note };
            hasData = true;
        }
    });

    if (!hasData) {
        hideLoading();
        return alert("Please enter at least one score or note.");
    }

    try {
        await database.ref().update(updates);
        closeProgressModal();
    } catch (err) { console.error(err); alert("Failed to save progress."); }
    finally { hideLoading(); }
});

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
    currentUser.userId = getOrCreateUserId();
    if (loadCurrentSession()) {
        showLoading();
        database.ref(`sessions/${currentUser.sessionCode}/members/${currentUser.userId}`).once('value', snapshot => {
            if (snapshot.exists()) {
                initializeDashboard();
            } else {
                clearCurrentSession();
            }
            hideLoading();
        });
    }
});
