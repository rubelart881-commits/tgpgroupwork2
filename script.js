// Firebase কনফিগারেশন - তোমার দেওয়া কী-গুলো এখানে বসানো আছে
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

// Global Variables
let currentUser = { userId: null, nickname: null, sessionCode: null };
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
const cancelBtn = document.getElementById("cancel-btn");
const progressForm = document.getElementById("progress-form");
const loadingOverlay = document.getElementById("loading-overlay");

// ---> এই ফাংশনটি এখন অ্যাপের মূল ভিত্তি <---
function getOrGeneratePermanentUserId() {
    let permanentId = localStorage.getItem("missionScholarship_permanent_userId");
    if (!permanentId) {
        permanentId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem("missionScholarship_permanent_userId", permanentId);
    }
    return permanentId;
}

// Utility Functions
function generateSessionCode() { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let result = ""; for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } return result; }
function showLoading(msg = 'Loading...') { loadingOverlay.classList.add("active"); }
function hideLoading() { loadingOverlay.classList.remove("active"); }
function showView(viewName) { lobbyView.classList.remove("active"); dashboardView.classList.remove("active"); document.getElementById(`${viewName}-view`).classList.add("active"); }

// Local Storage for current session
function saveCurrentSession() { localStorage.setItem("missionScholarship_currentSession", JSON.stringify(currentUser)); }
function loadCurrentSession() { const data = localStorage.getItem("missionScholarship_currentSession"); if (data) { currentUser = JSON.parse(data); return true; } return false; }
function clearCurrentSession() { localStorage.removeItem("missionScholarship_currentSession"); }

// Session Management Functions
async function createSession() {
    const nickname = createNicknameInput.value.trim();
    if (!nickname) return alert("Please enter a nickname");
    showLoading();
    try {
        const sessionCode = generateSessionCode();
        currentUser.userId = getOrGeneratePermanentUserId();
        currentUser.nickname = nickname;
        currentUser.sessionCode = sessionCode;

        await database.ref(`sessions/${sessionCode}`).set({
            members: { [currentUser.userId]: { nickname: nickname } },
            scores: {}
        });

        saveCurrentSession();
        initializeDashboard(sessionCode);
    } catch (error) { console.error("Create Error:", error); alert("Failed to create session."); }
    finally { hideLoading(); }
}

async function joinSession() {
    const nickname = joinNicknameInput.value.trim();
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    if (!nickname || !sessionCode) { joinError.textContent = "Please provide nickname and code"; return; }
    showLoading();
    joinError.textContent = "";

    try {
        const snapshot = await database.ref(`sessions/${sessionCode}`).once("value");
        if (!snapshot.exists()) {
            joinError.textContent = "Session code not found.";
            return;
        }

        currentUser.userId = getOrGeneratePermanentUserId();
        currentUser.nickname = nickname;
        currentUser.sessionCode = sessionCode;

        await database.ref(`sessions/${sessionCode}/members/${currentUser.userId}`).set({ nickname: nickname });

        saveCurrentSession();
        initializeDashboard(sessionCode);
    } catch (error) { console.error("Join Error:", error); joinError.textContent = "An error occurred."; }
    finally { hideLoading(); }
}

function logout() {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
    clearCurrentSession();
    currentUser.sessionCode = null;
    currentUser.nickname = null;
    showView("lobby");
}

function initializeDashboard(sessionCode) {
    currentSessionCodeSpan.textContent = sessionCode;
    showView("dashboard");
    setupRealtimeListeners(sessionCode);
}

// Real-time Dashboard & Score Calculation (No change needed here)
function setupRealtimeListeners(sessionCode) { /* আগের মতোই থাকবে */ }
function renderDashboard(members, scores) { /* আগের মতোই থাকবে */ }
// (আগের কোডের বাকি ফাংশনগুলো এখানে அப்படியே থাকবে... `createMemberCard`, `calculateUserStats`, `openProgressModal`... etc)


// --- এখান থেকে নিচের সব ফাংশন আগের কোডের সাথে মিলিয়ে নাও অথবা পুরোটা কপি করো ---

function setupRealtimeListeners(sessionCode) {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
    const sessionRef = database.ref(`sessions/${sessionCode}`);
    const listener = sessionRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data && data.members) {
            renderDashboard(data.members, data.scores || {});
        } else {
            alert("This session may have been deleted.");
            logout();
        }
    });
    sessionListenerUnsubscribe = () => sessionRef.off("value", listener);
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
    let weeklyScore = 0, streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
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
    if (loggedDates.length > 0) {
        let currentDate = new Date(); currentDate.setHours(0,0,0,0);
        for (const dateStr of loggedDates) {
            let logDate = new Date(dateStr); logDate.setHours(0,0,0,0);
            const diffDays = Math.round((currentDate - logDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                if (streak === 0) streak = 1;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (diffDays === 1 && streak > 0) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (diffDays > 1) {
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
            document.getElementById(`${subject.toLowerCase()}-score`).value = data.score || "";
            document.getElementById(`${subject.toLowerCase()}-note`).value = data.note || "";
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
progressModal.addEventListener("click", e => { if (e.target === progressModal) closeProgressModal(); });

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
    // এই লাইনটা নিশ্চিত করে যে তোমার ডিভাইসের একটা স্থায়ী আইডি আছে
    currentUser.userId = getOrGeneratePermanentUserId(); 

    if (loadCurrentSession() && currentUser.sessionCode) {
        showLoading("Rejoining session...");
        database.ref(`sessions/${currentUser.sessionCode}`).once("value")
            .then((snapshot) => {
                if (snapshot.exists() && snapshot.val().members[currentUser.userId]) {
                    initializeDashboard(currentUser.sessionCode);
                } else {
                    // সেশনটা হয় মুছে গেছে অথবা তুমি এই সেশনের মেম্বার নও
                    clearCurrentSession();
                    showView("lobby");
                }
            })
            .catch(error => { console.error("Rejoin failed:", error); logout(); }) 
            .finally(() => hideLoading());
    }
});
