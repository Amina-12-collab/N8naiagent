"use strict";

// ==========================================
// AI STUDYMATE - N8N WEBHOOK CONFIGURATION
// ==========================================

const WEBHOOKS = {
  content:
    "https://aminawtt.app.n8n.cloud/webhook/7d9ee2ea-c8ef-4a3d-a12b-1a73fbb1e68e",

  quiz:
    "https://aminawtt.app.n8n.cloud/webhook/771ee0b8-3bc9-4c5b-90a0-b1b2673875f4",

  assessment:
    "https://aminawtt.app.n8n.cloud/webhook/98f6a457-fba8-43f0-a20e-645e8bea868c",

  planner:
    "https://aminawtt.app.n8n.cloud/webhook/ac330924-df34-4cec-8476-c3a210a33e42",

  pdfUpload:
    "https://aminawtt.app.n8n.cloud/webhook/95245296-f3a1-418c-809e-15ff3747a5b9",

  pdfQA:
    "https://aminawtt.app.n8n.cloud/webhook/cc623e67-58f9-4149-8ab9-601b7d997c6a"
};

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let selectedAgent = "content";
let extractedPdfText = "";
let uploadedPdfName = "";
let isProcessing = false;

// ==========================================
// DOM ELEMENTS
// ==========================================

const chatForm = document.getElementById("chat-form");
const questionInput = document.getElementById("question");
const questionCounter = document.getElementById("question-count");
const sendButton = document.getElementById("send-button");
const chatMessages = document.getElementById("chat-messages");

const studyFileInput = document.getElementById("study-file");
const selectedFileElement =
  document.getElementById("selected-file") ||
  document.getElementById("file-status");
const currentDateElement = document.getElementById("current-date");

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  showCurrentDate();
  initializeAgentSelection();
  initializeQuickPrompts();
  initializeNavigation();
  initializeFileUpload();
  initializeChatForm();

  console.log("AI StudyMate initialized successfully.");
});

// ==========================================
// CURRENT DATE
// ==========================================

function showCurrentDate() {
  if (!currentDateElement) return;

  currentDateElement.textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
}

// ==========================================
// AGENT SELECTION
// ==========================================

function initializeAgentSelection() {
  const agentButtons = document.querySelectorAll(
    "[data-agent], .agent-card"
  );

  agentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const agent = button.dataset.agent;

      if (!agent || !WEBHOOKS[agent]) return;

      selectedAgent = agent;

      agentButtons.forEach((item) => {
        item.classList.remove("active", "selected");
      });

      button.classList.add("active", "selected");

      console.log("Selected agent:", selectedAgent);

      const placeholders = {
        content: "Ask a question about your study topic...",
        quiz: "Enter a topic to generate a quiz...",
        assessment: "Enter a topic for your assessment...",
        planner: "Tell me your study goals...",
        pdfQA: "Ask a question about your uploaded PDF..."
      };

      if (questionInput) {
        questionInput.placeholder =
          placeholders[selectedAgent] ||
          "Type your question...";
      }
    });
  });
}

// ==========================================
// QUICK PROMPTS
// ==========================================

function initializeQuickPrompts() {
  const prompts = document.querySelectorAll(
    "[data-prompt], .quick-prompt"
  );

  prompts.forEach((button) => {
    button.addEventListener("click", () => {
      const prompt =
        button.dataset.prompt ||
        button.textContent.trim();

      if (questionInput) {
        questionInput.value = prompt;
        questionInput.focus();
      }
    });
  });
}

// ==========================================
// NAVIGATION
// ==========================================

function initializeNavigation() {
  const navLinks = document.querySelectorAll(
    ".nav-link, [data-page]"
  );

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((item) => {
        item.classList.remove("active");
      });

      link.classList.add("active");
    });
  });
}

// ==========================================
// CHAT FORM
// ==========================================

function initializeChatForm() {
  if (!chatForm) {
    console.warn("Chat form not found: #chat-form");
    return;
  }

  if (questionInput && questionCounter) {
    questionInput.addEventListener("input", () => {
      questionCounter.textContent = `${questionInput.value.length}/500`;
    });
  }

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput?.value.trim();

    if (!question) {
      showStatus("Please enter a question.", "error");
      return;
    }

    if (isProcessing) return;

    if (selectedAgent === "pdfQA") {
      await askPDFQuestion(question);
      return;
    }

    await sendAgentRequest(question);
  });
}

// ==========================================
// CHAT MESSAGE DISPLAY
// ==========================================

function addChatMessage(message, sender = "assistant") {
  if (!chatMessages) {
    console.log(`${sender}:`, message);
    return null;
  }

  const messageText = normalizeMessageText(message);
  const isUser = sender === "user";
  const messageElement = document.createElement("div");
  messageElement.className = isUser
    ? "message chat-message user user-message"
    : "message chat-message assistant assistant-message";

  if (isUser) {
    const content = document.createElement("div");
    const text = document.createElement("p");
    content.className = "message-content plain-message-content";
    text.className = "plain-message";
    text.textContent = messageText;
    content.appendChild(text);
    messageElement.appendChild(content);
  } else {
    const avatar = document.createElement("div");
    avatar.className = "assistant-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "✦";

    const content = document.createElement("div");
    const markdown = document.createElement("div");
    content.className = "message-content assistant-message-content";
    markdown.className = "markdown-content";

    try {
      if (window.marked?.parse && window.DOMPurify?.sanitize) {
        const rendered = window.marked.parse(messageText, {
          gfm: true,
          breaks: false
        });
        markdown.innerHTML = window.DOMPurify.sanitize(rendered, {
          USE_PROFILES: { html: true }
        });

        // Keep Markdown task-list controls display-only.
        markdown.querySelectorAll("input").forEach((input) => {
          input.disabled = true;
          input.tabIndex = -1;
        });
      } else {
        // If a CDN is unavailable, keep the response readable and safe.
        markdown.textContent = messageText;
        markdown.classList.add("markdown-fallback");
      }
    } catch (error) {
      console.error("Could not render assistant Markdown:", error);
      markdown.textContent = messageText;
      markdown.classList.add("markdown-fallback");
    }

    content.appendChild(markdown);
    messageElement.append(avatar, content);
  }

  chatMessages.appendChild(messageElement);
  const responseCard = chatMessages.closest(".response-card");
  if (responseCard) {
    responseCard.hidden = false;
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return messageElement;
}

function normalizeMessageText(message) {
  if (message === null || message === undefined) {
    return "The agent returned an empty response.";
  }

  if (typeof message === "string") {
    return message.trim()
      ? message
      : "The agent returned an empty response.";
  }

  if (typeof message === "number" || typeof message === "boolean") {
    return String(message);
  }

  if (typeof message === "object") {
    const responseKeys = ["answer", "output", "text", "response", "result"];
    for (const key of responseKeys) {
      if (message[key] !== undefined && message[key] !== message) {
        return normalizeMessageText(message[key]);
      }
    }

    try {
      return JSON.stringify(message, null, 2) ||
        "The agent returned an empty response.";
    } catch (error) {
      console.warn("Unexpected non-serializable response:", error);
      return "The agent returned a response in an unsupported format.";
    }
  }

  return String(message);
}

// ==========================================
// STATUS MESSAGE
// ==========================================

function showStatus(message, type = "info") {
  let statusElement = document.getElementById("study-status");

  if (!statusElement) {
    statusElement = document.createElement("div");
    statusElement.id = "study-status";
    statusElement.setAttribute("role", "status");

    if (chatForm?.parentElement) {
      chatForm.parentElement.appendChild(statusElement);
    } else {
      document.body.appendChild(statusElement);
    }
  }

  statusElement.textContent = message;
  statusElement.className = `study-status ${type}`;
}

// ==========================================
// LOADING STATE
// ==========================================

function setLoading(loading) {
  isProcessing = loading;

  if (sendButton) {
    sendButton.disabled = loading;
    sendButton.textContent = loading ? "Processing..." : "Generate";
  }

  if (questionInput) {
    questionInput.disabled = loading;
  }
}

// ==========================================
// READ N8N RESPONSE
// ==========================================

async function readWebhookResponse(response) {
  const responseText = await response.text();

  console.log("HTTP status:", response.status);
  console.log("Webhook response:", responseText);

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      throw new Error(
        `Request failed (${response.status}): ${responseText}`
      );
    }

    // Some workflows may return plain text.
    return { answer: responseText };
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed with status ${response.status}`
    );
  }

  if (data.error) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : JSON.stringify(data.error)
    );
  }

  return data;
}

// ==========================================
// EXTRACT ANSWER FROM N8N RESPONSE
// ==========================================

function extractAnswer(data) {
  if (typeof data === "string") {
    return data;
  }

  if (data == null) {
    return "";
  }

  return (
    data.answer ??
    data.output ??
    data.text ??
    data.response ??
    data.result ??
    data.data?.answer ??
    data.data?.output ??
    ""
  );
}

// ==========================================
// CONTENT / QUIZ / ASSESSMENT / PLANNER
// ==========================================

async function sendAgentRequest(question) {
  const webhookURL = WEBHOOKS[selectedAgent];

  if (!webhookURL) {
    showStatus("The selected agent has no webhook configured.", "error");
    return;
  }

  setLoading(true);
  addChatMessage(question, "user");

  if (questionInput) {
    questionInput.value = "";
  }
  if (questionCounter) questionCounter.textContent = "0/500";

  try {
    const response = await fetch(webhookURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        agent: selectedAgent,
        date: new Date().toISOString()
      })
    });

    const data = await readWebhookResponse(response);
    const answer = extractAnswer(data);

    if (!answer) {
      console.error("Unexpected agent response:", data);
      throw new Error("The workflow returned no answer.");
    }

    addChatMessage(answer, "assistant");
    showStatus("Response received.", "success");

  } catch (error) {
    console.error("Agent request failed:", error);

    addChatMessage(
      `Unable to get a response: ${error.message}`,
      "assistant"
    );

    showStatus(error.message, "error");

  } finally {
    setLoading(false);
  }
}

// ==========================================
// PDF FILE SELECTION
// ==========================================

function initializeFileUpload() {
  if (!studyFileInput) {
    console.warn("PDF input not found: #study-file");
    return;
  }

  studyFileInput.addEventListener("change", async () => {
    const file = studyFileInput.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")) {
      showStatus("Please select a PDF file.", "error");
      studyFileInput.value = "";
      return;
    }

    uploadedPdfName = file.name;

    if (selectedFileElement) {
      selectedFileElement.textContent =
        `Selected: ${file.name}`;
    }

    await uploadPDF(file);
  });
}

// ==========================================
// PDF UPLOAD
// ==========================================

async function uploadPDF(file) {
  setLoading(true);
  showStatus("Uploading and extracting PDF text...", "info");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(WEBHOOKS.pdfUpload, {
      method: "POST",
      body: formData
    });

    const data = await readWebhookResponse(response);

    const pdfText =
      data.pdfText ??
      data.text ??
      data.extractedText ??
      data.data?.pdfText ??
      "";

    if (typeof pdfText !== "string" || !pdfText.trim()) {
      console.error("PDF upload response:", data);
      throw new Error(
        "PDF uploaded, but extracted text was not returned. Check the upload workflow response."
      );
    }

    extractedPdfText = pdfText;

    if (selectedFileElement) {
      selectedFileElement.textContent =
        `${file.name} — PDF uploaded successfully`;
    }

    showStatus(
      `PDF uploaded successfully! Extracted ${extractedPdfText.length} characters.`,
      "success"
    );

    console.log("PDF uploaded:", uploadedPdfName);
    console.log("Extracted text length:", extractedPdfText.length);

  } catch (error) {
    console.error("PDF upload failed:", error);

    extractedPdfText = "";

    showStatus(
      `PDF upload failed: ${error.message}`,
      "error"
    );

    if (selectedFileElement) {
      selectedFileElement.textContent =
        `Upload failed: ${file.name}`;
    }

  } finally {
    setLoading(false);
  }
}

// ==========================================
// ASK A QUESTION ABOUT THE UPLOADED PDF
// ==========================================

async function askPDFQuestion(question) {
  if (!question || !question.trim()) {
    showStatus("Please enter a question.", "error");
    return;
  }

  if (!extractedPdfText || !extractedPdfText.trim()) {
    showStatus("Please upload a PDF first.", "error");
    return;
  }

  setLoading(true);
  addChatMessage(question, "user");

  if (questionInput) {
    questionInput.value = "";
  }
  if (questionCounter) questionCounter.textContent = "0/500";

  try {
    const response = await fetch(WEBHOOKS.pdfQA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: question.trim(),
        pdfText: extractedPdfText,
        fileName: uploadedPdfName,
        agent: "pdfQA"
      })
    });

    const data = await readWebhookResponse(response);
    const answer = extractAnswer(data);

    if (!answer) {
      console.error("Unexpected PDF Q&A response:", data);

      throw new Error(
        "The PDF Q&A workflow ran, but returned no answer. Check the Respond to Webhook node."
      );
    }

    addChatMessage(answer, "assistant");
    showStatus("Answer generated successfully.", "success");

  } catch (error) {
    console.error("PDF Q&A failed:", error);

    addChatMessage(
      `Unable to answer your question: ${error.message}`,
      "assistant"
    );

    showStatus(error.message, "error");

  } finally {
    setLoading(false);
  }
}
