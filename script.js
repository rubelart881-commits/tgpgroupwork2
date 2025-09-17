// Import Firebase
import firebase from "firebase/app"
import "firebase/database"

// Firebase Configuration - Replace with your own Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA6Qcog97mvfc_RysaH420wdIqNweGgHg8",
  authDomain: "tgp-group-work.firebaseapp.com",
  databaseURL: "https://tgp-group-work-default-rtdb.firebaseio.com", 
  projectId: "tgp-group-work",
  storageBucket: "tgp-group-work.appspot.com",
  messagingSenderId: "254968365131",
  appId: "1:254968365131:web:bedae8eaf2c2a71959cdce",
  measurementId: "G-8K6NH5KGZF"
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig)
const database = firebase.database()

// Global Variables
let currentUser = {
  userId: null,
  nickname: null,
  sessionCode: null,
}

let membersListener = null
let scoresListener = null

// DOM Elements
const lobbyView = document.getElementById("lobby-view")
const dashboardView = document.getElementById("dashboard-view")
const createNicknameInput = document.getElementById("create-nickname")
const createSessionBtn = document.getElementById("create-session-btn")
const joinNicknameInput = document.getElementById("join-nickname")
const sessionCodeInput = document.getElementById("session-code")
const joinSessionBtn = document.getElementById("join-session-btn")
const joinError = document.getElementById("join-error")
const currentSessionCodeSpan = document.getElementById("current-session-code")
const logoutBtn = document.getElementById("logout-btn")
const logProgressBtn = document.getElementById("log-progress-btn")
const membersGrid = document.getElementById("members-grid")
const progressModal = document.getElementById("progress-modal")
const closeModalBtn = document.getElementById("close-modal")
const cancelBtn = document.getElementById("cancel-btn")
const progressForm = document.getElementById("progress-form")
const loadingOverlay = document.getElementById("loading-overlay")

// Utility Functions
function generateSessionCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateUserId() {
  return "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
}

function showLoading() {
  loadingOverlay.classList.add("active")
}

function hideLoading() {
  loadingOverlay.classList.remove("active")
}

function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active")
  })

  if (viewName === "lobby") {
    lobbyView.classList.add("active")
  } else if (viewName === "dashboard") {
    dashboardView.classList.add("active")
  }
}

function saveToLocalStorage() {
  localStorage.setItem("missionScholarship_userId", currentUser.userId)
  localStorage.setItem("missionScholarship_nickname", currentUser.nickname)
  localStorage.setItem("missionScholarship_sessionCode", currentUser.sessionCode)
}

function loadFromLocalStorage() {
  const userId = localStorage.getItem("missionScholarship_userId")
  const nickname = localStorage.getItem("missionScholarship_nickname")
  const sessionCode = localStorage.getItem("missionScholarship_sessionCode")

  if (userId && nickname && sessionCode) {
    currentUser.userId = userId
    currentUser.nickname = nickname
    currentUser.sessionCode = sessionCode
    return true
  }
  return false
}

function clearLocalStorage() {
  localStorage.removeItem("missionScholarship_userId")
  localStorage.removeItem("missionScholarship_nickname")
  localStorage.removeItem("missionScholarship_sessionCode")
}

// Session Management Functions
async function createSession() {
  const nickname = createNicknameInput.value.trim()

  if (!nickname) {
    alert("Please enter a nickname")
    return
  }

  showLoading()

  try {
    const sessionCode = generateSessionCode()
    const userId = generateUserId()

    // Create session in Firebase
    await database.ref(`sessions/${sessionCode}`).set({
      members: {
        [userId]: { nickname: nickname },
      },
      scores: {},
    })

    // Update current user
    currentUser.userId = userId
    currentUser.nickname = nickname
    currentUser.sessionCode = sessionCode

    // Save to localStorage
    saveToLocalStorage()

    // Navigate to dashboard
    currentSessionCodeSpan.textContent = sessionCode
    showView("dashboard")
    setupRealtimeListeners()
  } catch (error) {
    console.error("Error creating session:", error)
    alert("Failed to create session. Please try again.")
  } finally {
    hideLoading()
  }
}

async function joinSession() {
  const nickname = joinNicknameInput.value.trim()
  const sessionCode = sessionCodeInput.value.trim().toUpperCase()

  if (!nickname || !sessionCode) {
    joinError.textContent = "Please enter both nickname and session code"
    return
  }

  showLoading()
  joinError.textContent = ""

  try {
    // Check if session exists
    const sessionSnapshot = await database.ref(`sessions/${sessionCode}`).once("value")

    if (!sessionSnapshot.exists()) {
      joinError.textContent = "Failed to join session. Please check the session code."
      return
    }

    const userId = generateUserId()

    // Add user to session
    await database.ref(`sessions/${sessionCode}/members/${userId}`).set({
      nickname: nickname,
    })

    // Update current user
    currentUser.userId = userId
    currentUser.nickname = nickname
    currentUser.sessionCode = sessionCode

    // Save to localStorage
    saveToLocalStorage()

    // Navigate to dashboard
    currentSessionCodeSpan.textContent = sessionCode
    showView("dashboard")
    setupRealtimeListeners()
  } catch (error) {
    console.error("Error joining session:", error)
    joinError.textContent = "Failed to join session. Please try again."
  } finally {
    hideLoading()
  }
}

function logout() {
  // Clean up listeners
  if (membersListener) {
    membersListener.off()
    membersListener = null
  }
  if (scoresListener) {
    scoresListener.off()
    scoresListener = null
  }

  // Clear user data
  currentUser = { userId: null, nickname: null, sessionCode: null }
  clearLocalStorage()

  // Reset form inputs
  createNicknameInput.value = ""
  joinNicknameInput.value = ""
  sessionCodeInput.value = ""
  joinError.textContent = ""

  // Show lobby
  showView("lobby")
}

// Real-time Dashboard Functions
function setupRealtimeListeners() {
  const sessionRef = database.ref(`sessions/${currentUser.sessionCode}`)

  // Listen for members changes
  membersListener = sessionRef.child("members")
  membersListener.on("value", (snapshot) => {
    updateMembersDisplay(snapshot.val() || {})
  })

  // Listen for scores changes
  scoresListener = sessionRef.child("scores")
  scoresListener.on("value", (snapshot) => {
    updateScoresDisplay(snapshot.val() || {})
  })
}

function updateMembersDisplay(members) {
  // Store members data for later use with scores
  window.currentMembers = members
  renderMemberCards()
}

function updateScoresDisplay(scores) {
  // Store scores data for later use with members
  window.currentScores = scores
  renderMemberCards()
}

function renderMemberCards() {
  const members = window.currentMembers || {}
  const scores = window.currentScores || {}

  membersGrid.innerHTML = ""

  Object.entries(members).forEach(([userId, memberData]) => {
    const memberCard = createMemberCard(userId, memberData, scores[userId] || {})
    membersGrid.appendChild(memberCard)
  })
}

function createMemberCard(userId, memberData, userScores) {
  const card = document.createElement("div")
  card.className = "member-card"

  // Calculate weekly score and streak
  const { weeklyScore, streak, todayLog } = calculateUserStats(userScores)

  card.innerHTML = `
        <div class="member-header">
            <div class="member-name">${memberData.nickname}</div>
            <div class="streak-info">
                <span>🔥</span>
                <span>${streak}</span>
            </div>
        </div>
        <div class="weekly-score">
            <div class="score-value">${weeklyScore}</div>
            <div class="score-label">Weekly Score</div>
        </div>
        <div class="today-log">
            <h4>Today's Log</h4>
            <div class="log-items">
                ${
                  todayLog.length > 0
                    ? todayLog
                        .map(
                          (item) => `
                        <div class="log-item">
                            <span class="subject-name">${item.subject}</span>
                            <span class="subject-score">${item.score}/10</span>
                        </div>
                    `,
                        )
                        .join("")
                    : '<div class="log-item"><span>No activities logged today</span></div>'
                }
            </div>
        </div>
    `

  return card
}

function calculateUserStats(userScores) {
  const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD format
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  let weeklyScore = 0
  let streak = 0
  const todayLog = []

  // Calculate weekly score and today's log
  Object.entries(userScores).forEach(([date, dayScores]) => {
    if (date >= oneWeekAgo && date <= today) {
      Object.entries(dayScores).forEach(([subject, data]) => {
        weeklyScore += data.score || 0

        if (date === today) {
          todayLog.push({
            subject: subject,
            score: data.score || 0,
          })
        }
      })
    }
  })

  // Calculate streak (consecutive days with any logged activity)
  const sortedDates = Object.keys(userScores).sort().reverse()
  const currentDate = new Date()

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = currentDate.toISOString().split("T")[0]

    if (sortedDates.includes(dateStr)) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      break
    }
  }

  return { weeklyScore, streak, todayLog }
}

// Progress Logging Functions
function openProgressModal() {
  progressModal.classList.add("active")

  // Load today's existing data if any
  loadTodayProgress()
}

function closeProgressModal() {
  progressModal.classList.remove("active")
  resetProgressForm()
}

function resetProgressForm() {
  progressForm.reset()
}

async function loadTodayProgress() {
  const today = new Date().toISOString().split("T")[0]

  try {
    const snapshot = await database
      .ref(`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}`)
      .once("value")
    const todayData = snapshot.val()

    if (todayData) {
      // Populate form with existing data
      Object.entries(todayData).forEach(([subject, data]) => {
        const scoreInput = document.getElementById(`${subject.toLowerCase()}-score`)
        const noteInput = document.getElementById(`${subject.toLowerCase()}-note`)

        if (scoreInput) scoreInput.value = data.score || ""
        if (noteInput) noteInput.value = data.note || ""
      })
    }
  } catch (error) {
    console.error("Error loading today's progress:", error)
  }
}

async function saveProgress(event) {
  event.preventDefault()

  const today = new Date().toISOString().split("T")[0]
  const subjects = ["math", "english", "bangla", "science"]
  const progressData = {}

  // Collect form data
  subjects.forEach((subject) => {
    const scoreInput = document.getElementById(`${subject}-score`)
    const noteInput = document.getElementById(`${subject}-note`)

    const score = Number.parseInt(scoreInput.value) || 0
    const note = noteInput.value.trim()

    if (score > 0 || note) {
      progressData[subject.charAt(0).toUpperCase() + subject.slice(1)] = {
        score: score,
        note: note,
      }
    }
  })

  if (Object.keys(progressData).length === 0) {
    alert("Please enter at least one score or note")
    return
  }

  showLoading()

  try {
    // Save to Firebase
    await database.ref(`sessions/${currentUser.sessionCode}/scores/${currentUser.userId}/${today}`).set(progressData)

    closeProgressModal()
  } catch (error) {
    console.error("Error saving progress:", error)
    alert("Failed to save progress. Please try again.")
  } finally {
    hideLoading()
  }
}

// Event Listeners
createSessionBtn.addEventListener("click", createSession)
joinSessionBtn.addEventListener("click", joinSession)
logoutBtn.addEventListener("click", logout)
logProgressBtn.addEventListener("click", openProgressModal)
closeModalBtn.addEventListener("click", closeProgressModal)
cancelBtn.addEventListener("click", closeProgressModal)
progressForm.addEventListener("submit", saveProgress)

// Handle Enter key in inputs
createNicknameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") createSession()
})

joinNicknameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") joinSession()
})

sessionCodeInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") joinSession()
})

// Close modal when clicking outside
progressModal.addEventListener("click", (e) => {
  if (e.target === progressModal) {
    closeProgressModal()
  }
})

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  // Check if user has existing session
  if (loadFromLocalStorage()) {
    // Verify session still exists in Firebase
    database
      .ref(`sessions/${currentUser.sessionCode}/members/${currentUser.userId}`)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          // Session is valid, go to dashboard
          currentSessionCodeSpan.textContent = currentUser.sessionCode
          showView("dashboard")
          setupRealtimeListeners()
        } else {
          // Session no longer exists, clear localStorage and stay in lobby
          clearLocalStorage()
          currentUser = { userId: null, nickname: null, sessionCode: null }
        }
      })
      .catch((error) => {
        console.error("Error verifying session:", error)
        // On error, clear localStorage and stay in lobby
        clearLocalStorage()
        currentUser = { userId: null, nickname: null, sessionCode: null }
      })
  }
})
