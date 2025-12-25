// DOM Element Selectors
const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");
const exportChatButton = document.getElementById("exportChat");

// State Variables
let currentUserMessage = null;
let isGeneratingResponse = false;
let lastAIMessageElement = null;


// Utility Functions
const getFormattedTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const scrollToBottom = (force = false) => {
    const isNearBottom = 
    chatHistoryContainer.scrollHeight -
    chatHistoryContainer.scrollTop -
    chatHistoryContainer.clientHeight < 100;

    if(force || isNearBottom) {
        chatHistoryContainer.scrollTo({
            top : chatHistoryContainer.scrollHeight,behavior:'smooth'
        });
    }
}

const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
};

const addCopyButtonToCodeBlocks = () => {
    document.querySelectorAll("pre").forEach(block => {
        const codeElement = block.querySelector("code");
        const language = [...codeElement.classList]
            .find(cls => cls.startsWith("language-"))
            ?.replace("language-", "") || "Text";

        const languageLabel = document.createElement("div");
        languageLabel.textContent = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add("code__language-label");
        block.appendChild(languageLabel);

        const copyButton = document.createElement("button");
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
        copyButton.classList.add("code__copy-btn");
        block.appendChild(copyButton);

        copyButton.addEventListener("click", () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`;
                setTimeout(() => {
                    copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
                }, 2000);
            }).catch(err => {
                console.error("Copy failed:", err);
                alert("Unable to copy text!");
            });
        });
    });
};

const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.closest('.message__content') ?
        copyButton.closest('.message__content').querySelector(".message__text")?.innerText :
        copyButton.parentElement.querySelector(".message__text")?.innerText;

    if (!messageContent) {
        alert("Unable to copy message");
        return;
    }
    navigator.clipboard.writeText(messageContent).then(() => {
        copyButton.innerHTML = `<i class='bx bx-check'></i>`;
        setTimeout(() => (copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`), 1500);
    }).catch(err => {
        alert("Failed to copy message to clipboard");
    });
};

const deleteMessage = (deleteButton) => {
    const messageElement = deleteButton.closest('.message');
    messageElement.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
        messageElement.remove();
    }, 300);
};

// Load Chat History
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';
    chatHistoryContainer.innerHTML = "";

    savedConversations.forEach(conversation => {
        const userMessageHTML = `
            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
                <p class="message__text">${conversation.userMessage}</p>
            </div>
        `;
        const outgoingMessageElement = createChatMessageElement(userMessageHTML, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        const responseText = conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
        const responseHTML = `
            <div class="message__content">
                <img class="message__avatar" src="assets/gemini.svg" alt="Gemini Avatar">
                <p class="message__text">${responseText}</p>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
        `;
        const incomingMessageElement = createChatMessageElement(responseHTML, "message--incoming");
        chatHistoryContainer.appendChild(incomingMessageElement);
    });
    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// Handle Theme Toggle
themeToggleButton.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';
});

// Clear Chat History
clearChatButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");
        loadSavedChatHistory();
        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});

// Export Chat History
exportChatButton.addEventListener("click", () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    if (savedConversations.length === 0) {
        alert("No chat history to export!");
        return;
    }

    const textContent = savedConversations.map((conv, i) =>
        `Message ${i + 1}:\nUser: ${conv.userMessage}\nGemini: ${conv.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'}\n---\n`
    ).join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent));
    element.setAttribute('download', `gemini-chat-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
});

// Handle Suggestion Clicks
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener("click", () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// Handle Outgoing Message
const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim();
    if (!currentUserMessage || isGeneratingResponse) return;
    messageForm.reset();


    isGeneratingResponse = true;

    const timestamp = getFormattedTime();
    const outgoingMessageHTML = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <div>
                <p class="message__text">${currentUserMessage}</p>
                <div class="message__timestamp">${timestamp}</div>
            </div>
        </div>
    `;
    const outgoingMessageElement = createChatMessageElement(outgoingMessageHTML, "message--outgoing");
    chatHistoryContainer.appendChild(outgoingMessageElement);
    scrollToBottom(true);

    messageForm.reset();
    document.body.classList.add("hide-header");

    // Add loading state to send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) sendButton.disabled = true;

    displayLoadingAnimation();
};

// Display Loading Animation
const displayLoadingAnimation = () => {
    const loadingHTML = `
        <div class="message__content">
            <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
            <p class="message__text">...</p>
        </div>
    `;
    const loadingMessageElement = createChatMessageElement(loadingHTML, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);
    scrollToBottom(true);

    requestApiResponse(loadingMessageElement);
};


// Request API Response
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");
    console.log("FRONTEND fetch type:", typeof fetch);


    try {
        const response = await fetch(`http://localhost:5000/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: currentUserMessage
            }),
        });

        const responseData = await response.json();

        const responseText =
            responseData?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response from Gemini";

        messageTextElement.innerText = responseText;
        scrollToBottom(true);

        // Save chat history
        const savedConversations =
            JSON.parse(localStorage.getItem("saved-api-chats")) || [];

        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseData,
        });

        localStorage.setItem(
            "saved-api-chats",
            JSON.stringify(savedConversations)
        );

    } catch (error) {
        console.error(error);
        messageTextElement.innerText = "Error communicating with server.";
    } finally {
        incomingMessageElement.classList.remove("message--loading");
        isGeneratingResponse = false;

        const sendButton = document.getElementById("sendButton");
        if (sendButton) sendButton.disabled = false;
    }
};


// Initialize Application
messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

loadSavedChatHistory();
