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

// ইউজার আইডি তৈরি বা পুরনো আইডি খুঁজে বের করার ফাংশন
function getOrGenerateUserId() {
    let userId = localStorage.getItem("missionScholarship_permanent_userId");
    if (!userId) {
        userId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem("missionScholarship_permanent_userId", userId);
    }
    return userId;
}

// Utility and Local Storage Functions
function generateSessionCode() { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let result = ""; for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } return result; }
function showLoading() { loadingOverlay.classList.add("active"); }
function hideLoading() { loadingOverlay.classList.remove("active"); }
function showView(viewName) { lobbyView.classList.remove("active"); dashboardView.classList.remove("active"); document.getElementById(`${viewName}-view`).classList.add("active"); }
function saveCurrentSession() { localStorage.setItem("missionScholarship_currentSession", JSON.stringify(currentUser)); }
function loadCurrentSession() { const data = localStorage.getItem("missionScholarship_currentSession"); if (data) { currentUser = JSON.parse(data); return true; } return false; }
function clearCurrentSession() { localStorage.removeItem("missionScholarship_currentSession"); }


// ---> Session Management Functions (Fully Updated) <---

async function createSession() {
    const nickname = createNicknameInput.value.trim();
    if (!nickname) return alert("Please enter a nickname");
    showLoading();
    try {
        const sessionCode = generateSessionCode();
        currentUser.userId = getOrGenerateUserId();
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
        const sessionRef = database.ref(`sessions/${sessionCode}`);
        const snapshot = await sessionRef.once("value");
        if (!snapshot.exists()) {
            joinError.textContent = "Session code not found.";
            return;
        }

        const members = snapshot.val().members || {};
        let existingUserId = null;

        // চেক করা হচ্ছে যে এই নামে আগে থেকেই কেউ আছে কি না
        for (const uid in members) {
            if (members[uid].nickname.toLowerCase() === nickname.toLowerCase()) {
                existingUserId = uid;
                break;
            }
        }
        
        currentUser.userId = existingUserId || getOrGenerateUserId();
        currentUser.nickname = nickname;
        currentUser.sessionCode = sessionCode;

        // যদি নতুন ইউজার হয়, তাহলে তাকে ডেটাবেসে যোগ করা
        if (!existingUserId) {
            await database.ref(`sessions/${sessionCode}/members/${currentUser.userId}`).set({ nickname: nickname });
        }

        saveCurrentSession();
        initializeDashboard(sessionCode);
    } catch (error) { console.error("Join Error:", error); joinError.textContent = "An error occurred."; }
    finally { hideLoading(); }
}

function logout() {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
    clearCurrentSession(); // শুধু বর্তমান সেশনের তথ্য মোছা হচ্ছে
    currentUser.sessionCode = null; 
    currentUser.nickname = null; // নিকনেমও রিসেট করা হচ্ছে
    showView("lobby");
}

// Dashboard and Real-time Functions
function initializeDashboard(sessionCode) {
    currentSessionCodeSpan.textContent = sessionCode;
    showView("dashboard");
    setupRealtimeListeners(sessionCode);
}

function setupRealtimeListeners(sessionCode) {
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
    const sessionRef = database.ref(`sessions/${sessionCode}`);
    const listener = sessionRef.on("value", snapshot => {
        const data = snapshot.val();
        if (data && data.members) {
            // নিশ্চিত করা যে বর্তমান ইউজার এখনো মেম্বার লিস্টে আছে
            if (data.members[currentUser.userId]) {
                 renderDashboard(data.members, data.scores || {});
            } else {
                 alert("You have been removed from this session.");
                 logout();
            }
        } else {
             alert("This session seems to have been deleted.");
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
    const loggedDates = Object.keys(userScores).sort((a,b) => new Date(b) - new Date(a));
    let lastDate = new Date();
    lastDate.setHours(0,0,0,0);
    
    for(const dateStr of loggedDates) {
        const logDate = new Date(dateStr);
        logDate.setHours(0,0,0,0);
        
        const diff = (lastDate - logDate) / (1000 * 60 * 60 * 24);
        
        if (diff === 0) { // today
            streak++;
            lastDate.setDate(lastDate.getDate() - 1);
        } else if (diff === 1 && streak > 0) { // yesterday
            streak++;
            lastDate.setDate(lastDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return { weeklyScore, streak, todayLog };
}


// Progress Modal Functions
async function openProgressModal() { /*...*/ } // No change
async function saveProgress(event) { /*...*/ } // No change


// Event Listeners (all are fine)
createSessionBtn.addEventListener("click", createSession);
joinSessionBtn.addEventListener("click", joinSession);
logoutBtn.addEventListener("click", logout);
logProgressBtn.addEventListener("click", openProgressModal);
//... and so on ...

// --- App Initialization (Updated) ---
document.addEventListener("DOMContentLoaded", () => {
    getOrGenerateUserId(); // অ্যাপ শুরুতেই ডিভাইসের জন্য একটা পার্মানেন্ট আইডি তৈরি বা লোড করে নেবে
    
    if (loadCurrentSession() && currentUser.sessionCode) {
        showLoading("Rejoining previous session...");
        database.ref(`sessions/${currentUser.sessionCode}/members/${currentUser.userId}`).once("value")
            .then((snapshot) => {
                if (snapshot.exists()) {
                    initializeDashboard(currentUser.sessionCode);
                } else {
                    // সেশনটা আছে, কিন্তু তোমাকে হয়তো কেউ রিমুভ করে দিয়েছে
                    logout();
                    showView("lobby");
                }
            })
            .catch(error => { console.error("Rejoin failed:", error); logout(); })
            .finally(() => hideLoading());
    }
});
