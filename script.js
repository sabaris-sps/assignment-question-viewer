// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAhm9_dg9I-xucnFaFAMOv_v_lIBQAKyJg",
  authDomain: "physics-question-viewer-1bea8.firebaseapp.com",
  projectId: "physics-question-viewer-1bea8",
  storageBucket: "physics-question-viewer-1bea8.firebasestorage.app",
  messagingSenderId: "944516882332",
  appId: "1:944516882332:web:04fcfe4a693ca69216b259",
  measurementId: "G-X6VNMRRMZS",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence().catch((err) => {
  console.error("Firestore persistence failed:", err);
});

const state = {
  currentUser: null,
  currentChapter: "emi",
  currentAssignment: "cpp4",
  currentQuestion: 1,
  totalQuestions: 47,
  textareaHasFocus: false,
  isLoginMode: true,
};

const elements = {
  authContainer: document.getElementById("authContainer"),
  authTitle: document.getElementById("authTitle"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSubmit: document.getElementById("authSubmit"),
  authSwitch: document.getElementById("authSwitch"),
  authError: document.getElementById("authError"),
  userInfo: document.getElementById("userInfo"),
  userEmail: document.getElementById("userEmail"),
  logoutButton: document.getElementById("logoutButton"),
  chapterSelect: document.getElementById("chapterSelect"),
  assignmentSelect: document.getElementById("assignmentSelect"),
  assignmentTitle: document.getElementById("assignmentTitle"),
  questionList: document.getElementById("questionList"),
  prevButton: document.getElementById("prevButton"),
  nextButton: document.getElementById("nextButton"),
  markDoneButton: document.getElementById("markDoneButton"),
  markReviewButton: document.getElementById("markReviewButton"),
  markDoubtButton: document.getElementById("markDoubtButton"),
  markNoneButton: document.getElementById("markNoneButton"),
  notesArea: document.getElementById("notesArea"),
  questionImage: document.getElementById("questionImage"),
  currentQuestionDisplay: document.getElementById("currentQuestion"),
};

const assignmentData = {
  emi: {
    name: "EMI",
    assignments: {
      cpp4: { name: "CPP 4", questionCount: 47 },
    },
  },
  chemistry: {
    name: "Chemistry",
    assignments: {
      amines: { name: "Amines", questionCount: 51 },
      solidstate: { name: "Solid State", questionCount: 51 },
    },
  },
};

const initAuth = () => {
  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;
    if (user) {
      elements.userEmail.textContent = user.email;
      elements.userInfo.style.display = "block";
      elements.authContainer.style.display = "none";
      await initApp();
    } else {
      elements.userInfo.style.display = "none";
      elements.authContainer.style.display = "flex";
      resetUI();
    }
  });

  elements.authSwitch.addEventListener("click", () => {
    state.isLoginMode = !state.isLoginMode;
    updateAuthUI();
  });

  elements.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      if (state.isLoginMode) {
        await auth.signInWithEmailAndPassword(
          elements.authEmail.value,
          elements.authPassword.value
        );
      } else {
        await auth.createUserWithEmailAndPassword(
          elements.authEmail.value,
          elements.authPassword.value
        );
      }
    } catch (error) {
      elements.authError.textContent = error.message;
    }
  });

  elements.logoutButton.addEventListener("click", () => {
    auth.signOut();
  });
};

const initApp = async () => {
  const currentChapterData =
    assignmentData[state.currentChapter]["assignments"];
  state.totalQuestions =
    currentChapterData[state.currentAssignment]["questionCount"] || 1;
  await Promise.all([loadNotes(1), loadMarkStatus(1)]);
  initDropdowns();
  await loadAssignment();
  setupEventListeners();
  await loadQuestion(1);
};

const initDropdowns = () => {
  const currentChapterData =
    assignmentData[state.currentChapter]["assignments"];

  elements.chapterSelect.innerHTML = "";
  Object.entries(assignmentData).forEach(([id, details]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = details.name;
    elements.chapterSelect.appendChild(option);
  });

  elements.assignmentSelect.innerHTML = "";
  Object.entries(currentChapterData).forEach(([id, details]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = details.name;
    elements.assignmentSelect.appendChild(option);
  });

  // Set up event listeners
  elements.chapterSelect.addEventListener("change", (e) => {
    state.currentChapter = e.target.value;
    const currentChapterData =
      assignmentData[state.currentChapter]["assignments"];

    state.currentAssignment = Object.keys(currentChapterData)[0];
    state.totalQuestions =
      currentChapterData[state.currentAssignment]["questionCount"] || 1;
    elements.assignmentSelect.innerHTML = "";

    Object.entries(currentChapterData).forEach(([id, details]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = details.name;
      elements.assignmentSelect.appendChild(option);
    });

    loadAssignment();
  });

  elements.assignmentSelect.addEventListener("change", (e) => {
    state.currentAssignment = e.target.value;
    const currentChapterData =
      assignmentData[state.currentChapter]["assignments"];
    state.totalQuestions =
      currentChapterData[state.currentAssignment]["questionCount"] || 1;
    loadAssignment();
  });
};

const loadAssignment = async () => {
  try {
    // Reset UI
    elements.questionList.innerHTML = "";
    elements.assignmentTitle.textContent = `${state.currentChapter.toUpperCase()} - ${state.currentAssignment.toUpperCase()}`;

    // Create question list
    for (let i = 1; i <= state.totalQuestions; i++) {
      const questionNumber = document.createElement("div");
      questionNumber.className = "question-number";
      questionNumber.textContent = i;
      questionNumber.dataset.questionId = i;
      questionNumber.addEventListener("click", () => loadQuestion(i));
      elements.questionList.appendChild(questionNumber);
    }

    // Load all mark statuses at once
    await loadAllMarkStatuses();

    // Load first question
    await loadQuestion(1);

    // Show UI elements
    document.querySelector(".notes-container").style.display = "block";
    document.querySelector(".navigation").style.display = "flex";
    document.querySelector(".mark-options").style.display = "flex";
    elements.questionImage.style.display = "block";
  } catch (error) {
    console.error("Error loading assignment:", error);
  }
};

const loadAllMarkStatuses = async () => {
  try {
    if (!state.currentUser) {
      // If no user, set all questions to 'none' status
      for (let i = 1; i <= state.totalQuestions; i++) {
        updateQuestionNumberStyle(i, "none");
      }
      return;
    }

    // Query all status documents for this user
    const querySnapshot = await db
      .collection("users")
      .doc(state.currentUser.uid)
      .collection("assignments")
      .get();

    // Filter and process the documents
    const statusMap = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Only process documents for current chapter and assignment
      if (
        data.assignment === state.currentAssignment &&
        data.chapter === state.currentChapter &&
        data.questionNumber
      ) {
        statusMap[data.questionNumber] = data.markStatus || "none";
      }
    });

    // Update all question number styles
    for (let i = 1; i <= state.totalQuestions; i++) {
      const status = statusMap[i] || "none";
      updateQuestionNumberStyle(i, status);
    }
  } catch (error) {
    console.error("Error loading all mark statuses:", error);
    // If there's an error, set all questions to 'none' status
    for (let i = 1; i <= state.totalQuestions; i++) {
      updateQuestionNumberStyle(i, "none");
    }
  }
};

const loadQuestion = async (questionNumber) => {
  try {
    // Save current notes before loading new question

    state.currentQuestion = questionNumber;

    // FIX: Use the correct element reference
    if (elements.currentQuestionDisplay) {
      elements.currentQuestionDisplay.textContent = `Question ${questionNumber}`;
    } else {
      console.error("currentQuestionDisplay element not found");
      return;
    }

    // Update active state
    document.querySelectorAll(".question-number").forEach((el, index) => {
      el.classList.toggle("active", index + 1 === questionNumber);
    });

    // Update navigation buttons
    elements.prevButton.disabled = questionNumber === 1;
    elements.nextButton.disabled = questionNumber === state.totalQuestions;

    // Load question image
    elements.questionImage.src = `images/${state.currentChapter}/${state.currentAssignment}/${questionNumber}.png`;
    elements.questionImage.alt = `Question ${questionNumber} image`;

    // Load notes and mark status
    await Promise.all([
      loadNotes(questionNumber),
      loadMarkStatus(questionNumber),
    ]);
  } catch (error) {
    console.error("Error loading question:", error);
  }
};

const setupEventListeners = () => {
  elements.prevButton.addEventListener("click", async () => {
    if (state.currentQuestion > 1) {
      await saveNotes();
      await loadQuestion(state.currentQuestion - 1);
    }
  });
  elements.nextButton.addEventListener("click", async () => {
    if (state.currentQuestion < state.totalQuestions) {
      await saveNotes();
      await loadQuestion(state.currentQuestion + 1);
    }
  });

  // Mark buttons
  elements.markDoneButton.addEventListener("click", async () => {
    await saveMarkStatus(state.currentQuestion, "done");
  });
  elements.markReviewButton.addEventListener("click", async () => {
    await saveMarkStatus(state.currentQuestion, "review");
  });
  elements.markNoneButton.addEventListener("click", async () => {
    await saveMarkStatus(state.currentQuestion, "none");
  });
  elements.markDoubtButton.addEventListener("click", async () => {
    await saveMarkStatus(state.currentQuestion, "doubt");
  });

  // Keyboard navigation
  document.addEventListener("keydown", async (e) => {
    if (!state.textareaHasFocus) {
      if (e.key === "ArrowLeft" && state.currentQuestion > 1) {
        await loadQuestion(state.currentQuestion - 1);
      } else if (
        e.key === "ArrowRight" &&
        state.currentQuestion < state.totalQuestions
      ) {
        await loadQuestion(state.currentQuestion + 1);
      }
    }
  });

  // Notes area events
  elements.notesArea.addEventListener("focus", () => {
    state.textareaHasFocus = true;
  });

  elements.notesArea.addEventListener("blur", async () => {
    state.textareaHasFocus = false;
    await saveNotes();
  });

  // Auto-save notes periodically (every 30 seconds)
  setInterval(async () => {
    if (state.currentUser && !state.textareaHasFocus) {
      await saveNotes();
    }
  }, 30000);
};

const saveNotes = async () => {
  try {
    if (!state.currentUser) {
      console.log("No user logged in - skipping save");
      return;
    }

    const docRef = db
      .collection("users")
      .doc(state.currentUser.uid)
      .collection("assignments")
      .doc(
        `${state.currentChapter}_${state.currentAssignment}_${state.currentQuestion}`
      );

    await docRef.set(
      {
        chapter: state.currentChapter,
        assignment: state.currentAssignment,
        questionNumber: state.currentQuestion,
        notes: elements.notesArea.value,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving notes:", error);
  }
};

const saveMarkStatus = async (questionNumber, status) => {
  try {
    if (!state.currentUser) return;

    const docId = `${state.currentChapter}_${state.currentAssignment}_${questionNumber}`;

    await db
      .collection("users")
      .doc(state.currentUser.uid)
      .collection("assignments")
      .doc(docId)
      .set({
        documentId: docId,
        chapter: state.currentChapter,
        assignment: state.currentAssignment,
        questionNumber: questionNumber,
        markStatus: status,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      });

    updateMarkButtons(status);
    updateQuestionNumberStyle(questionNumber, status);
  } catch (error) {
    console.error("Error saving mark status:", error);
  }
};

const loadNotes = async (questionNumber) => {
  try {
    if (!state.currentUser) {
      elements.notesArea.value = "";
      return;
    }

    const docRef = db
      .collection("users")
      .doc(state.currentUser.uid)
      .collection("assignments")
      .doc(
        `${state.currentChapter}_${state.currentAssignment}_${questionNumber}`
      );

    const doc = await docRef.get();
    if (doc.exists && doc.data().assignment === state.currentAssignment) {
      elements.notesArea.value = doc.data().notes || "";
    } else {
      elements.notesArea.value = "";
    }
  } catch (error) {
    console.error("Error loading notes:", error);
    elements.notesArea.value = "";
  }
};

const loadMarkStatus = async (questionNumber) => {
  try {
    if (!state.currentUser) {
      updateMarkButtons("none");
      return;
    }

    const docRef = db
      .collection("users")
      .doc(state.currentUser.uid)
      .collection("assignments")
      .doc(
        `${state.currentChapter}_${state.currentAssignment}_${questionNumber}`
      );

    const doc = await docRef.get();
    if (doc.exists && doc.data().assignment === state.currentAssignment) {
      const status = doc.data().markStatus || "none";
      updateMarkButtons(status);
      updateQuestionNumberStyle(questionNumber, status);
    } else {
      updateMarkButtons("none");
      updateQuestionNumberStyle(questionNumber, "none");
    }
  } catch (error) {
    console.error("Error loading mark status:", error);
    updateMarkButtons("none");
    updateQuestionNumberStyle(questionNumber, "none");
  }
};

const updateMarkButtons = (status) => {
  elements.markDoneButton.classList.toggle("active", status === "done");
  elements.markReviewButton.classList.toggle("active", status === "review");
  elements.markDoubtButton.classList.toggle("active", status === "doubt");
  elements.markNoneButton.classList.toggle("active", status === "none");
};

const updateQuestionNumberStyle = (questionNumber, status) => {
  const questionElement = document.querySelector(
    `.question-number[data-question-id="${questionNumber}"]`
  );

  if (questionElement) {
    questionElement.classList.remove(
      "marked-done",
      "marked-review",
      "mark-doubt"
    );

    if (status === "done") {
      questionElement.classList.add("marked-done");
    } else if (status === "review") {
      questionElement.classList.add("marked-review");
    } else if (status === "doubt") {
      questionElement.classList.add("marked-doubt");
    }
  }
};

const updateAuthUI = () => {
  if (state.isLoginMode) {
    elements.authTitle.textContent = "Login";
    elements.authSubmit.textContent = "Login";
    elements.authSwitch.textContent = "Need to create an account?";
  } else {
    elements.authTitle.textContent = "Create Account";
    elements.authSubmit.textContent = "Sign Up";
    elements.authSwitch.textContent = "Already have an account? Login";
  }
  elements.authError.textContent = "";
};

const resetUI = () => {
  elements.questionList.innerHTML = "";
  elements.currentQuestionDisplay.textContent = "Select an assignment to begin";
  elements.assignmentTitle.textContent = "Select an assignment";
  elements.questionImage.style.display = "none";
  document.querySelector(".notes-container").style.display = "none";
  document.querySelector(".navigation").style.display = "none";
  document.querySelector(".mark-options").style.display = "none";
};

initAuth();
