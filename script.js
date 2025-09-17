// Firebase কনফিগারেশন - তোমার দেওয়া কী-গুলো এখানে ঠিকমতো বসানো আছে
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

// Firebase শুরু করা (index.html থেকে আসা 'firebase' অবজেক্ট দিয়ে)
firebase.initializeApp(firebaseConfig);
const database = firebase.database(); // v8 সিনট্যাক্স ব্যবহার করা হচ্ছে

// Global Variables
let currentUser = { userId: null, nickname: null, sessionCode: null };
let sessionListenerUnsubscribe = null; // Listener বন্ধ করার জন্য

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
const cancelBtn = document.getElementById("cancel-btn");
const progressForm = document.getElementById("progress-form");
const loadingOverlay = document.getElementById("loading-overlay");

// Utility Functions
function generateSessionCode() { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let result = ""; for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } return result; }
function generateUserId() { return "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9); }
function showLoading() { loadingOverlay.classList.add("active"); }
function hideLoading() { loadingOverlay.classList.remove("active"); }
function showView(viewName) { lobbyView.classList.remove("active"); dashboardView.classList.remove("active"); document.getElementById(`${viewName}-view`).classList.add("active"); }

// Local Storage Functions
function saveToLocalStorage() { localStorage.setItem("missionScholarshipUser", JSON.stringify(currentUser)); }
function loadFromLocalStorage() { const data = localStorage.getItem("missionScholarshipUser"); if (data) { currentUser = JSON.parse(data); return true; } return false; }
function clearLocalStorage() { localStorage.removeItem("missionScholarshipUser"); }

// Session Management Functions
async function createSession() {
    const nickname = createNicknameInput.value.trim();
    if (!nickname) { alert("Please enter a nickname"); return; }
    showLoading();
    try {
        const sessionCode = generateSessionCode();
        if (!currentUser.userId) currentUser.userId = generateUserId();
        
        await database.ref(`sessions/${sessionCode}`).set({
            members: { [currentUser.userId]: { nickname: nickname } },
            scores: {}
        });
        
        currentUser.nickname = nickname;
        currentUser.sessionCode = sessionCode;
        saveToLocalStorage();
        
        currentSessionCodeSpan.textContent = sessionCode;
        showView("dashboard");
        setupRealtimeListeners(sessionCode);
    } catch (error) { console.error("Create Session Error:", error); alert("Failed to create session."); } 
    finally { hideLoading(); }
}

async function joinSession() {
    const nickname = joinNicknameInput.value.trim();
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    if (!nickname || !sessionCode) { joinError.textContent = "Please enter both nickname and session code"; return; }
    showLoading();
    joinError.textContent = "";

    try {
        const sessionRef = database.ref(`sessions/${sessionCode}`);
        const snapshot = await sessionRef.once("value");

        if (!snapshot.exists()) {
            joinError.textContent = "Session code not found.";
            return;
        }

        if (!currentUser.userId) currentUser.userId = generateUserId();
        await database.ref(`sessions/${sessionCode}/members/${currentUser.userId}`).set({ nickname: nickname });

        currentUser.nickname = nickname;
        currentUser.sessionCode = sessionCode;
        saveToLocalStorage();

        currentSessionCodeSpan.textContent = sessionCode;
        showView("dashboard");
        setupRealtimeListeners(sessionCode);
    } catch (error) { console.error("Join Session Error:", error); joinError.textContent = "An error occurred."; }
    finally { hideLoading(); }
}

function logout() {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe(); // Listener বন্ধ করা
    clearLocalStorage();
    currentUser = { userId: null, nickname: null, sessionCode: null };
    showView("lobby");
}

// Real-time Dashboard Functions
function setupRealtimeListeners(sessionCode) {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe(); // আগের listener বন্ধ করা

    const sessionRef = database.ref(`sessions/${sessionCode}`);
    sessionRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data && data.members) {
            renderDashboard(data.members, data.scores || {});
        } else {
            // যদি সেশন মুছে যায় বা কোনো মেম্বার না থাকে
            alert("This session has been closed or you were removed.");
            logout();
        }
    });

    sessionListenerUnsubscribe = () => sessionRef.off("value");
}

function renderDashboard(members, scores) {
    membersGrid.innerHTML = "";
    Object.entries(members).forEach(([userId, memberData]) => {
        const card = createMemberCard(userId, memberData, scores[userId] || {});
        membersGrid.appendChild(card);
    });
}

function createMemberCard(userId, memberData, userScores) {
    const card = document.createElement("div");
    card.className = "member-card";
    const { weeklyScore, streak, todayLog } = calculateUserStats(userScores);

    const todayLogHtml = todayLog.length > 0 ? 
        todayLog.map(item => `<div class="log-item"><span class="subject-name">${item.subject}</span><span class="subject-score">${item.score}/10</span></div>`).join("") :
        '<div class="log-item"><span>No activities logged today</span></div>';

    card.innerHTML = `
        <div class="member-header">
            <div class="member-name">${memberData.nickname}</div>
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

function calculateUserStats(userScores) {
    const todayStr = new Date().toISOString().split('T')[0];
    let weeklyScore = 0, streak = 0;
    const todayLog = [];
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    Object.entries(userScores).forEach(([date, dayScores]) => {
        if (date >= sevenDaysAgo) {
            Object.values(dayScores).forEach(data => { weeklyScore += data.score || 0; });
        }
        if (date === todayStr) {
            Object.entries(dayScores).forEach(([subject, data]) => todayLog.push({ subject, score: data.score }));
        }
    });
    
    // Streak Calculation
    const loggedDates = Object.keys(userScores).sort().reverse();
    if(loggedDates.length > 0 && loggedDates[0] === todayStr) {
        streak = 1;
        let yesterday = new Date(Date.now() - 24*60*60*1000);
        for (let i = 1; i < loggedDates.length; i++) {
             if (loggedDates[i] === yesterday.toISOString().split('T')[0]) {
                 streak++;
                 yesterday.setDate(yesterday.getDate() - 1);
             } else {
                 break;
             }
        }
    }

    return { weeklyScore, streak, todayLog };
}


// Progress Modal Functions
async function openProgressModal() {
    progressForm.reset();
    const today = new Date().toISOString().split("T")[0];
    const snapshot = await database.ref(`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}`).once("value");
    const todayData = snapshot.val();
    if (todayData) {
        Object.entries(todayData).forEach(([subject, data]) => {
            const scoreInput = document.getElementById(`${subject.toLowerCase()}-score`);
            const noteInput = document.getElementById(`${subject.toLowerCase()}-note`);
            if (scoreInput) scoreInput.value = data.score || "";
            if (noteInput) noteInput.value = data.note || "";
        });
    }
    progressModal.classList.add("active");
}
function closeProgressModal() { progressModal.classList.remove("active"); }

async function saveProgress(event) {
    event.preventDefault();
    const today = new Date().toISOString().split("T")[0];
    const subjects = ["math", "english", "bangla", "science"];
    const progressData = {};

    subjects.forEach((subject) => {
        const score = Number.parseInt(document.getElementById(`${subject}-score`).value) || 0;
        const note = document.getElementById(`${subject}-note`).value.trim();
        if (score > 0 || note) { progressData[subject.charAt(0).toUpperCase() + subject.slice(1)] = { score, note }; }
    });
    
    if (Object.keys(progressData).length === 0) { alert("Please enter at least one score or note"); return; }

    showLoading();
    try {
        await database.ref(`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}`).set(progressData);
        closeProgressModal();
    } catch (error) { console.error("Save Progress Error:", error); alert("Failed to save progress."); } 
    finally { hideLoading(); }
}


// Event Listeners Setup
createSessionBtn.addEventListener("click", createSession);
joinSessionBtn.addEventListener("click", joinSession);
logoutBtn.addEventListener("click", logout);
logProgressBtn.addEventListener("click", openProgressModal);
closeModalBtn.addEventListener("click", closeProgressModal);
cancelBtn.addEventListener("click", closeProgressModal);
progressForm.addEventListener("submit", saveProgress);
progressModal.addEventListener("click", (e) => { if (e.target === progressModal) closeProgressModal(); });
[createNicknameInput, joinNicknameInput, sessionCodeInput].forEach(input => {
    input.addEventListener("keypress", (e) => { if (e.key === "Enter") e.target.parentElement.querySelector('button').click(); });
});


// App Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (loadFromLocalStorage() && currentUser.sessionCode) {
        showLoading("Verifying session...");
        database.ref(`sessions/${currentUser.sessionCode}/members/${currentUser.userId}`).once("value")
            .then((snapshot) => {
                if (snapshot.exists()) {
                    currentSessionCodeSpan.textContent = currentUser.sessionCode;
                    showView("dashboard");
                    setupRealtimeListeners(currentUser.sessionCode);
                } else {
                    clearLocalStorage();
                    showView("lobby");
                }
            })
            .catch((error) => {
                console.error("Session verification failed:", error);
                clearLocalStorage();
                showView("lobby");
            })
            .finally(() => {
                hideLoading();
            });
    } else {
        showView("lobby");
    }
});
