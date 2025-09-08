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
  currentQuestion: 1,
  textareaHasFocus: false,
  isLoginMode: true,
  markStatusTypes: ["done", "good", "review", "doubt", "none"],
  timerInterval: null,
  timerSeconds: 0,
  questions: {},
  viewingCurrentQuestion: true,
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
  questionList: document.getElementById("questionList"),
  saveNotesBtn: document.getElementById("saveNotesBtn"),
  prevButton: document.getElementById("prevButton"),
  nextButton: document.getElementById("nextButton"),
  loadLastQuestionButton: document.getElementById("loadLastQuestionBtn"),
  notesArea: document.getElementById("notesArea"),
  questionImage: document.getElementById("questionImage"),
  currentQuestionDisplay: document.getElementById("currentQuestion"),
  markOptions: document.getElementById("markOptions"),
  questionTimer: document.getElementById("questionTimer"),
};

let assignmentData = {};

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
  createMarkButtons();
  await loadAssignmentData(); // get list of assignments from json
  const currentChapterData =
    assignmentData[state.currentChapter]["assignments"];
  state.totalQuestions =
    currentChapterData[state.currentAssignment]["questionCount"] || 1;
  // await Promise.all([loadNotes(1), loadMarkStatus(1)]);
  initDropdowns();
  await loadAssignment();
  setupEventListeners();
};

const createMarkButtons = () => {
  elements.markOptions.innerHTML = "";

  // Create a button for each status type
  state.markStatusTypes.forEach((status) => {
    const button = document.createElement("button");
    button.id = `mark${status.charAt(0).toUpperCase() + status.slice(1)}Button`;
    button.className = `mark-button ${status}`;
    button.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    // Add click event
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      await saveMarkStatus(state.currentQuestion, status);
    });

    button.style = `
    background: color-mix(in oklab, var(--${status}) 10%, transparent);
    color: var(--${status});
    border: 1px solid var(--${status});`;

    elements.markOptions.appendChild(button);
  });

  // Update elements object with the new buttons
  state.markStatusTypes.forEach((status) => {
    const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
    elements[`mark${capitalized}Button`] = document.getElementById(
      `mark${capitalized}Button`
    );
  });
};

const loadAssignmentData = async () => {
  try {
    const response = await fetch("./data.json");
    const data = await response.json();

    const userResponse = await fetch("./unrestrictedUsers.json");
    const unrestrictedUsers = await userResponse.json();

    for (const subjectKey in data) {
      const subject = data[subjectKey];
      let filteredAssignments = {};

      for (const assignmentKey in subject["assignments"]) {
        const assignment = subject["assignments"][assignmentKey];
        if (assignment.accessForAll) {
          filteredAssignments[assignmentKey] = assignment;
        } else {
          if (unrestrictedUsers.includes(state.currentUser.email)) {
            filteredAssignments[assignmentKey] = assignment;
          }
        }
      }

      if (Object.keys(filteredAssignments).length != 0) {
        assignmentData[subjectKey] = {
          name: subject.name,
          assignments: filteredAssignments,
        };
      }
    }

    if (Object.keys(assignmentData).length != 0) {
      state.currentChapter = Object.keys(assignmentData)[0];
      state.currentAssignment = Object.keys(
        assignmentData[state.currentChapter].assignments
      )[0];
      state.totalQuestions =
        assignmentData[state.currentChapter].assignments[
          state.currentAssignment
        ].totalQuestions;
    }
  } catch (error) {
    console.error("Error loading json data ", error);
  }
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

    // Create question list
    for (let i = 1; i <= state.totalQuestions; i++) {
      const questionNumber = document.createElement("div");
      questionNumber.className = "question-number";
      questionNumber.textContent = i;
      questionNumber.dataset.questionId = i;
      questionNumber.addEventListener("click", () => loadQuestion(i));
      elements.questionList.appendChild(questionNumber);
    }

    // Fetch all data of the assignment from firebase
    await fetchAllData();

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

const fetchAllData = async () => {
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
      state.questions[
        `${data.chapter}_${data.assignment}_${data.questionNumber}`
      ] = data;
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
    state.currentQuestion = questionNumber;
    startQuestionTimer();

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
    // show loader while image downloads
    const imageLoader = document.getElementById("imageLoader");
    if (imageLoader) {
      imageLoader.style.display = "flex";
    }
    elements.questionImage.style.display = "none";
    elements.questionImage.classList.remove("visible");

    // Preload image then show
    const img = new Image();
    img.src = elements.questionImage.src;
    img.onload = () => {
      if (imageLoader) {
        imageLoader.style.display = "none";
      }
      elements.questionImage.src = img.src;
      elements.questionImage.style.display = "block";
      // small timeout so CSS transition triggers reliably
      requestAnimationFrame(() => {
        elements.questionImage.classList.add("visible");
      });
    };
    img.onerror = () => {
      if (imageLoader) {
        imageLoader.style.display = "none";
      }
      elements.questionImage.style.display = "none";
      console.error("Failed to load image:", img.src);
    };

    // update notes and mark buttons
    if (
      state.questions[
        `${state.currentChapter}_${state.currentAssignment}_${questionNumber}`
      ]
    ) {
      elements.notesArea.value =
        state.questions[
          `${state.currentChapter}_${state.currentAssignment}_${questionNumber}`
        ].notes || "";
      updateMarkButtons(
        state.questions[
          `${state.currentChapter}_${state.currentAssignment}_${state.currentQuestion}`
        ].markStatus || "none"
      );
    } else {
      elements.notesArea.value = "";
      updateMarkButtons("none");
    }
  } catch (error) {
    console.error("Error loading question:", error);
  }
};

const setupEventListeners = () => {
  elements.prevButton.addEventListener("click", async () => {
    if (state.currentQuestion > 1) {
      await loadQuestion(state.currentQuestion - 1);
    }
  });
  elements.nextButton.addEventListener("click", async () => {
    if (state.currentQuestion < state.totalQuestions) {
      await loadQuestion(state.currentQuestion + 1);
    }
  });
  elements.saveNotesBtn.addEventListener("click", async () => {
    await saveNotes();
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
  });

  console.log(elements.loadLastQuestionButton);
  // Load last question button
  elements.loadLastQuestionButton.addEventListener("click", () => {
    toggleLastQuestion();
  });
};

const toggleLastQuestion = () => {
  let questionNumber = state.totalQuestions;
  if (!state.viewingCurrentQuestion) {
    questionNumber = state.currentQuestion;
  }

  // Load question image
  elements.questionImage.src = `images/${state.currentChapter}/${state.currentAssignment}/${questionNumber}.png`;
  elements.questionImage.alt = `Question ${questionNumber} image`;
  // show loader while image downloads
  const imageLoader = document.getElementById("imageLoader");
  if (imageLoader) {
    imageLoader.style.display = "flex";
  }
  elements.questionImage.style.display = "none";
  elements.questionImage.classList.remove("visible");

  // Preload image then show
  const img = new Image();
  img.src = elements.questionImage.src;
  img.onload = () => {
    if (imageLoader) {
      imageLoader.style.display = "none";
    }
    elements.questionImage.src = img.src;
    elements.questionImage.style.display = "block";
    // small timeout so CSS transition triggers reliably
    requestAnimationFrame(() => {
      elements.questionImage.classList.add("visible");
    });
  };
  img.onerror = () => {
    if (imageLoader) {
      imageLoader.style.display = "none";
    }
    elements.questionImage.style.display = "none";
    console.error("Failed to load image:", img.src);
  };
  state.viewingCurrentQuestion = !state.viewingCurrentQuestion;
};

const saveNotes = async () => {
  try {
    elements.saveNotesBtn.disabled = true;
    elements.saveNotesBtn.innerText = "Loading...";
    if (!state.currentUser) {
      console.log("No user logged in - skipping save");
      return;
    }

    const docId = `${state.currentChapter}_${state.currentAssignment}_${state.currentQuestion}`;

    const docRef = db
      .collection("users")
      .doc(state.currentUser.uid)
      .collection("assignments")
      .doc(docId);

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

    if (state.questions[docId]) {
      state.questions[docId].notes = elements.notesArea.value;
    } else {
      state.questions[docId] = {
        chapter: state.currentChapter,
        assignment: state.currentAssignment,
        questionNumber: state.currentQuestion,
        markStatus: "none",
        notes: elements.notesArea.value,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      };
    }

    elements.saveNotesBtn.disabled = false;
    elements.saveNotesBtn.innerText = "Save Notes";
  } catch (error) {
    console.error("Error saving notes:", error);
    elements.saveNotesBtn.disabled = false;
    elements.saveNotesBtn.innerText = "Save Notes";
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
      .set(
        {
          documentId: docId,
          chapter: state.currentChapter,
          assignment: state.currentAssignment,
          questionNumber: questionNumber,
          markStatus: status,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    if (state.questions[docId]) {
      state.questions[docId].markStatus = status;
    } else {
      state.questions[docId] = {
        chapter: state.currentChapter,
        assignment: state.currentAssignment,
        questionNumber: state.currentQuestion,
        markStatus: "none",
        notes: elements.notesArea.value,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      };
    }

    updateMarkButtons(status);
    updateQuestionNumberStyle(questionNumber, status);
  } catch (error) {
    console.error("Error saving mark status:", error);
  }
};

const updateMarkButtons = (status) => {
  state.markStatusTypes.forEach((type) => {
    const button =
      elements[`mark${type.charAt(0).toUpperCase() + type.slice(1)}Button`];
    if (button) {
      button.classList.toggle("active", status === type);
      if (status === type) {
        button.style = `
          background: color-mix(in oklab, var(--${type}) 80%, transparent);
          color: var(--bg-0);
          border: 1px solid var(--${type});`;
      } else {
        button.style = `
          background: color-mix(in oklab, var(--${type}) 10%, transparent);
          color: var(--${type});
          border: 1px solid var(--${type});`;
      }
    }
  });
};

const updateQuestionNumberStyle = (questionNumber, status) => {
  const questionElement = document.querySelector(
    `.question-number[data-question-id="${questionNumber}"]`
  );

  if (questionElement) {
    state.markStatusTypes.forEach((markStatus) => {
      questionElement.classList.remove(`marked-${markStatus}`);
    });

    if (state.markStatusTypes.includes(status) && status !== "none") {
      questionElement.classList.add(`marked-${status}`);
    }
  }
};

const startQuestionTimer = () => {
  // Clear any existing timer
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  // Reset seconds
  state.timerSeconds = 0;

  // Update display immediately
  updateTimerDisplay();

  // Start new interval
  state.timerInterval = setInterval(() => {
    state.timerSeconds++;
    updateTimerDisplay();
  }, 1000);
};

const updateTimerDisplay = () => {
  const minutes = Math.floor(state.timerSeconds / 60);
  const seconds = state.timerSeconds % 60;
  elements.questionTimer.textContent = `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
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
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  elements.questionTimer.textContent = "";

  elements.questionList.innerHTML = "";
  elements.currentQuestionDisplay.textContent = "Select an assignment to begin";
  elements.questionImage.style.display = "none";
  document.querySelector(".notes-container").style.display = "none";
  document.querySelector(".navigation").style.display = "none";
  document.querySelector(".mark-options").style.display = "none";
};

initAuth();
