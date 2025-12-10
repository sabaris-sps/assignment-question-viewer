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

// enable persistence if possible
db.enablePersistence().catch((err) => {
  console.error("Firestore persistence failed:", err);
});

const state = {
  currentUser: null,
  currentQuestion: 1,
  textareaHasFocus: false,
  isLoginMode: true,
  markStatusTypes: ["done", "good", "review", "doubt", "flag", "none"],
  timerInterval: null,
  timerSeconds: 0,
  questions: {},
  viewingCurrentQuestion: true,
  isFullSizeZoom: false,
};

const elements = {
  authContainer: document.getElementById("authContainer"),
  resetContainer: document.getElementById("resetContainer"),
  verifyContainer: document.getElementById("verifyContainer"),
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
  // verify UI elements
  verifyEmail: document.getElementById("verifyEmail"),
  resendVerificationBtn: document.getElementById("resendVerificationBtn"),
  checkVerificationBtn: document.getElementById("checkVerificationBtn"),
  signoutFromVerify: document.getElementById("signoutFromVerify"),
  verifyError: document.getElementById("verifyError"),
  // reset UI elements
  forgotPasswordLink: document.getElementById("forgotPasswordLink"),
  resetEmailInput: document.getElementById("resetEmailInput"),
  sendResetBtn: document.getElementById("sendResetBtn"),
  backToAuthFromReset: document.getElementById("backToAuthFromReset"),
  resetError: document.getElementById("resetError"),
  // progress elements
  assignmentProgressText: document.getElementById("assignmentProgressText"),
  assignmentProgressBar: document.getElementById("assignmentProgressBar"),
  //image zoom
  imageToggleZoomBtn: document.getElementById("imageToggleZoomBtn"),
};

let assignmentData = {};
let answersMap = {};

// ---------------- Auth & verification & reset flow ----------------

const initAuth = () => {
  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      // Not signed in
      showAuthUI();
      resetUI();
      return;
    }

    // Signed in: check email verification
    if (user.emailVerified) {
      // Show main UI and initialize app
      showMainUIForVerifiedUser(user);
      await initApp();
    } else {
      // Show verification UI (do NOT load assignment data)
      showVerificationUI(user);
    }
  });

  elements.authSwitch.addEventListener("click", () => {
    state.isLoginMode = !state.isLoginMode;
    updateAuthUI();
  });

  elements.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      elements.authError.textContent = "";
      if (state.isLoginMode) {
        await auth.signInWithEmailAndPassword(
          elements.authEmail.value,
          elements.authPassword.value
        );
        // onAuthStateChanged will handle the rest
      } else {
        // Create account and send verification email
        const userCredential = await auth.createUserWithEmailAndPassword(
          elements.authEmail.value,
          elements.authPassword.value
        );
        // send verification email
        if (userCredential && userCredential.user) {
          await userCredential.user.sendEmailVerification();
        }
        // Keep user signed in but they will see the verify UI via onAuthStateChanged
      }
    } catch (error) {
      elements.authError.textContent = error.message;
    }
  });

  elements.logoutButton.addEventListener("click", () => {
    auth.signOut();
  });

  // Verification UI buttons
  elements.resendVerificationBtn.addEventListener("click", async () => {
    try {
      elements.verifyError.textContent = "";
      elements.resendVerificationBtn.disabled = true;
      if (auth.currentUser) {
        await auth.currentUser.sendEmailVerification();
        elements.verifyError.style.color = "#cfeede";
        elements.verifyError.textContent =
          "Verification email sent — check inbox/spam.";
      } else {
        elements.verifyError.style.color = "#ff8b8b";
        elements.verifyError.textContent =
          "No signed-in user to send email to.";
      }
    } catch (err) {
      elements.verifyError.style.color = "#ff8b8b";
      elements.verifyError.textContent =
        "Error sending verification email: " + err.message;
      console.error(err);
    } finally {
      elements.resendVerificationBtn.disabled = false;
    }
  });

  elements.checkVerificationBtn.addEventListener("click", async () => {
    try {
      elements.verifyError.textContent = "";
      elements.checkVerificationBtn.disabled = true;
      // reload current user and check verified flag
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          // hide verify UI and initialize app
          showMainUIForVerifiedUser(auth.currentUser);
          await initApp();
        } else {
          elements.verifyError.style.color = "#ff8b8b";
          elements.verifyError.textContent =
            "Still not verified. Click the link in the verification email and then click 'I've verified — Check now'.";
        }
      }
    } catch (err) {
      elements.verifyError.style.color = "#ff8b8b";
      elements.verifyError.textContent =
        "Error checking verification: " + err.message;
      console.error(err);
    } finally {
      elements.checkVerificationBtn.disabled = false;
    }
  });

  elements.signoutFromVerify.addEventListener("click", async () => {
    await auth.signOut();
  });

  // Forgot password flow
  elements.forgotPasswordLink.addEventListener("click", () => {
    // show reset UI, prefill email if available
    elements.authContainer.style.display = "none";
    elements.resetContainer.style.display = "flex";
    elements.resetError.textContent = "";
    elements.resetEmailInput.value = elements.authEmail.value || "";
  });

  elements.backToAuthFromReset.addEventListener("click", () => {
    elements.resetContainer.style.display = "none";
    showAuthUI();
  });

  elements.sendResetBtn.addEventListener("click", async () => {
    try {
      elements.resetError.textContent = "";
      elements.sendResetBtn.disabled = true;
      elements.sendResetBtn.textContent = "Sending...";
      const email = elements.resetEmailInput.value.trim();
      if (!email) {
        elements.resetError.style.color = "#ff8b8b";
        elements.resetError.textContent = "Please enter your email address.";
        elements.sendResetBtn.disabled = false;
        elements.sendResetBtn.textContent = "Send reset email";
        return;
      }

      await auth.sendPasswordResetEmail(email);
      elements.resetError.style.color = "#cfeede";
      elements.resetError.textContent = `Reset email sent to ${email}. Check inbox/spam.`;
    } catch (err) {
      console.error("Error sending password reset:", err);
      elements.resetError.style.color = "#ff8b8b";
      elements.resetError.textContent =
        err.message || "Failed to send reset email.";
    } finally {
      elements.sendResetBtn.disabled = false;
      elements.sendResetBtn.textContent = "Send reset email";
    }
  });
};

const showAuthUI = () => {
  elements.authContainer.style.display = "flex";
  elements.resetContainer.style.display = "none";
  elements.verifyContainer.style.display = "none";
  elements.userInfo.style.display = "none";
  // main content stays hidden until verified and initApp runs
};

const showVerificationUI = (user) => {
  elements.authContainer.style.display = "none";
  elements.resetContainer.style.display = "none";
  elements.verifyContainer.style.display = "flex";
  elements.userInfo.style.display = "none";
  elements.verifyEmail.textContent = user.email || "";
  elements.verifyError.textContent = "";
};

const showMainUIForVerifiedUser = (user) => {
  elements.authContainer.style.display = "none";
  elements.resetContainer.style.display = "none";
  elements.verifyContainer.style.display = "none";
  elements.userInfo.style.display = "block";
  elements.userEmail.textContent = user.email || "";
};

// ---------------- App init & assignment loading ----------------

const initApp = async () => {
  // At this point we expect state.currentUser to be set and verified
  createMarkButtons();
  await loadAssignmentData(); // get list of assignments from json
  // set defaults if absent
  if (!state.currentChapter || !state.currentAssignment) {
    if (Object.keys(assignmentData).length > 0) {
      state.currentChapter = Object.keys(assignmentData)[0];
      state.currentAssignment = Object.keys(
        assignmentData[state.currentChapter].assignments
      )[0];
    }
  }
  const currentChapterData =
    assignmentData[state.currentChapter] &&
    assignmentData[state.currentChapter]["assignments"]
      ? assignmentData[state.currentChapter]["assignments"]
      : { default: { questionCount: 1 } };
  state.totalQuestions =
    currentChapterData[state.currentAssignment] &&
    currentChapterData[state.currentAssignment]["questionCount"]
      ? currentChapterData[state.currentAssignment]["questionCount"]
      : 1;
  initDropdowns();
  await loadAssignment();
  setupEventListeners();
};

// Create the mark buttons from the list
const createMarkButtons = () => {
  elements.markOptions.innerHTML = "";

  // Create a button for each status type
  let style_list = ``;
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

    style_list += `
      .question-number.marked-${status} {
        background: color-mix(in oklab, var(--${status}) 20%, transparent);
        color: var(--${status});
        border-color: currentColor;
        border-width: 1px;
      }
    `;

    button.style = `
    background: color-mix(in oklab, var(--${status}) 10%, transparent);
    color: var(--${status});
    border: 1px solid var(--${status});`;

    elements.markOptions.appendChild(button);
  });

  questionNumberStylesheet = document.createElement("style");
  questionNumberStylesheet.innerHTML = style_list;
  document.head.appendChild(questionNumberStylesheet);

  // Update elements object with the new buttons
  state.markStatusTypes.forEach((status) => {
    const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
    elements[`mark${capitalized}Button`] = document.getElementById(
      `mark${capitalized}Button`
    );
  });
};

// Load the assignment data list and fetch from firebase
const loadAssignmentData = async () => {
  try {
    // Fetch assignment list data
    const response = await fetch("./data.json");
    const data = await response.json();

    // Fetch unrestricted users for restricted assignments
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
          // only allow if current user's email is in unrestricted list
          if (
            state.currentUser &&
            unrestrictedUsers.includes(state.currentUser.email)
          ) {
            filteredAssignments[assignmentKey] = assignment;
          }
        }
      }

      if (Object.keys(filteredAssignments).length != 0) {
        assignmentData[subjectKey] = {
          name: subject.name,
          subject: subject.subject,
          assignments: filteredAssignments,
        };
      }
    }

    if (
      Object.keys(assignmentData).length != 0 &&
      (!state.currentChapter || !state.currentAssignment)
    ) {
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
  if (!assignmentData[state.currentChapter]) {
    elements.chapterSelect.innerHTML = "";
    elements.assignmentSelect.innerHTML = "";
    return;
  }

  const currentChapterData =
    assignmentData[state.currentChapter]["assignments"];

  elements.chapterSelect.innerHTML = "";
  Object.entries(assignmentData).forEach(([id, details]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = details.name;
    elements.chapterSelect.appendChild(option);

    option.style.background = `var(--${details.subject?.toLowerCase()})`;
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

    await fetchFromFirebase();

    // Update question number styles for the new assignment question list
    updateQNumberStyleForAssignment();

    // update progress bar
    updateProgressIndicator();

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

  try {
    const response = await fetch(
      `images/${state.currentChapter}/${state.currentAssignment}/answers_map.json`
    );
    answersMap = await response.json();
  } catch (error) {
    console.warn(
      "answers_map.json not found or invalid, fallback to last question."
    );
    answersMap = {}; // fallback to empty object
  }
};

// fetch only once (optimised)
const fetchFromFirebase = async () => {
  try {
    if (!state.currentUser) {
      return;
    }

    // Query all status documents for this user
    isNewAssignment = true;
    for (const key in state.questions) {
      data = state.questions[key];
      if (
        data.chapter == state.currentChapter &&
        data.assignment == state.currentAssignment
      ) {
        isNewAssignment = false;
        break;
      }
    }
    if (isNewAssignment) {
      const querySnapshot = await db
        .collection("users")
        .doc(state.currentUser.uid)
        .collection("assignments")
        .where("chapter", "==", state.currentChapter)
        .where("assignment", "==", state.currentAssignment)
        .get();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        state.questions[
          `${data.chapter}_${data.assignment}_${data.questionNumber}`
        ] = data;
      });
    }
  } catch (error) {
    console.error("Error loading data from firebase");
  }
};

const updateQNumberStyleForAssignment = () => {
  try {
    if (!state.currentUser) {
      // If no user, set all questions to 'none' status
      for (let i = 1; i <= state.totalQuestions; i++) {
        updateQuestionNumberStyle(i, "none");
      }
      return;
    }

    // Filter and process the documents
    const statusMap = {};
    for (let docId in state.questions) {
      data = state.questions[docId];
      if (
        data.assignment === state.currentAssignment &&
        data.chapter === state.currentChapter &&
        data.questionNumber
      ) {
        statusMap[data.questionNumber] = data.markStatus || "none";
      }
    }

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

const updateProgressIndicator = () => {
  const totalQuestions = state.totalQuestions;
  let completedCount = 0;

  // 1. Iterate through the stored questions for the current assignment
  for (let docId in state.questions) {
    const data = state.questions[docId];
    if (
      data.assignment === state.currentAssignment &&
      data.chapter === state.currentChapter &&
      (data.markStatus === "done" || data.markStatus === "good")
    ) {
      completedCount++;
    }
  }

  // Handle the case where the assignment might be empty
  if (totalQuestions === 0) {
    elements.assignmentProgressBar.style.width = "0%";
    elements.assignmentProgressText.textContent = "0/0 Completed (0%)";
    return;
  }

  // 2. Calculate percentage
  const percentage = Math.round((completedCount / totalQuestions) * 100);

  // 3. Update the display
  elements.assignmentProgressBar.style.width = `${percentage}%`;
  elements.assignmentProgressText.textContent = `${completedCount}/${totalQuestions} Completed (${percentage}%)`;
};

const loadQuestion = async (questionNumber) => {
  try {
    state.viewingCurrentQuestion = true;
    if (elements.loadLastQuestionButton)
      elements.loadLastQuestionButton.innerText = "Load Answer Key";
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

    // set image zoom state
    state.isFullSizeZoom = false;
    elements.questionImage.classList.remove("full-size");
    elements.imageToggleZoomBtn.textContent = "Zoom Image";

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
    const docKey = `${state.currentChapter}_${state.currentAssignment}_${questionNumber}`;
    if (state.questions[docKey]) {
      elements.notesArea.value = state.questions[docKey].notes || "";
      updateMarkButtons(state.questions[docKey].markStatus || "none");
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
      } else if (e.altKey) {
        if (e.key == "q") {
          toggleLastQuestion();
        } else if (e.key.match(/^[0-9]+$/) != null) {
          index = parseInt(e.key);
          if (index >= 1 && index <= state.markStatusTypes.length) {
            await saveMarkStatus(
              state.currentQuestion,
              state.markStatusTypes[index - 1]
            );
          }
        }
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

  // Load last question button
  if (elements.loadLastQuestionButton) {
    elements.loadLastQuestionButton.addEventListener("click", () => {
      toggleLastQuestion();
    });
  }

  // handle image zoom toggle
  if (elements.imageToggleZoomBtn) {
    elements.imageToggleZoomBtn.addEventListener("click", () => {
      toggleImageZoom();
    });
  }
};

const toggleLastQuestion = () => {
  let questionNumber = state.totalQuestions;
  if (!state.viewingCurrentQuestion) {
    questionNumber = state.currentQuestion;
  }

  // Determine the image source
  let imageSrc = "";
  if (state.viewingCurrentQuestion) {
    if (answersMap[state.currentQuestion]) {
      imageSrc = `images/${state.currentChapter}/${state.currentAssignment}/${
        answersMap[state.currentQuestion]
      }`;
    } else {
      imageSrc = `images/${state.currentChapter}/${state.currentAssignment}/${state.totalQuestions}.png`;
    }
  } else {
    imageSrc = `images/${state.currentChapter}/${state.currentAssignment}/${state.currentQuestion}.png`;
  }

  elements.questionImage.src = imageSrc;
  elements.questionImage.alt = `Image for ${
    state.viewingCurrentQuestion ? "Answer Key" : "Question"
  } ${state.currentQuestion}`;

  const imageLoader = document.getElementById("imageLoader");
  if (imageLoader) {
    imageLoader.style.display = "flex";
  }
  elements.questionImage.style.display = "none";
  elements.questionImage.classList.remove("visible");

  const img = new Image();
  img.src = imageSrc;
  img.onload = () => {
    if (imageLoader) {
      imageLoader.style.display = "none";
    }
    elements.questionImage.src = img.src;
    elements.questionImage.style.display = "block";
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
  if (elements.loadLastQuestionButton) {
    elements.loadLastQuestionButton.innerText = state.viewingCurrentQuestion
      ? "Load Answer Key"
      : "Load Current Question";
  }
};

const saveNotes = async () => {
  try {
    elements.saveNotesBtn.disabled = true;
    elements.saveNotesBtn.innerText = "Loading...";
    if (!state.currentUser) {
      console.log("No user logged in - skipping save");
      elements.saveNotesBtn.disabled = false;
      elements.saveNotesBtn.innerText = "Save Notes";
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
    updateProgressIndicator();
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

const toggleImageZoom = () => {
  state.isFullSizeZoom = !state.isFullSizeZoom;

  elements.questionImage.classList.toggle("full-size", state.isFullSizeZoom);
  elements.imageToggleZoomBtn.textContent = state.isFullSizeZoom
    ? "Fit to Screen"
    : "Zoom Image";
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
  if (elements.questionImage) elements.questionImage.style.display = "none";
  const notes = document.querySelector(".notes-container");
  if (notes) notes.style.display = "none";
  const nav = document.querySelector(".navigation");
  if (nav) nav.style.display = "none";
  const marks = document.querySelector(".mark-options");
  if (marks) marks.style.display = "none";
};

initAuth();
