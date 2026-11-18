/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const productModal = document.getElementById("productModal");
const closeModal = document.getElementById("closeModal");
const modalProductDetails = document.getElementById("modalProductDetails");
const clearSelectedProducts = document.getElementById("clearSelectedProducts");
const generateRoutine = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");

// This array keeps track of every product the user has selected
let selectedProducts = [];
const selectedProductsKey = "lorealSelectedProducts";
const workerUrl = "https://chatgbt.michaelyalsina.workers.dev/";

// This array keeps the full conversation for the AI follow-up chat
let messages = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Save selected products in the browser so they remain after a refresh */
function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(selectedProductsKey, JSON.stringify(selectedIds));
}

/* Create an instruction that limits the AI to the user's selected products */
function createSystemMessage() {
  const productDetails = selectedProducts
    .map(
      (product) =>
        `${product.brand} - ${product.name} (${product.category}): ${product.description}`
    )
    .join("\n");

  if (selectedProducts.length === 0) {
    return {
      role: "system",
      content:
        "You are a L'Oréal skincare and beauty advisor. The user has not selected any products. Ask them to select products before building a routine.",
    };
  }

  return {
    role: "system",
    content:
      "You are a L'Oréal skincare and beauty advisor. Build routines and answer follow-up questions using only these selected products. Do not recommend or mention other products:\n" +
      productDetails,
  };
}

/* Add a message bubble to the chat window */
function addChatMessage(role, text) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send the full conversation to the Cloudflare Worker */
async function sendMessagesToWorker() {
  // Keep the system instructions updated with the latest selected products
  if (messages.length > 0) {
    messages[0] = createSystemMessage();
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Worker request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("The worker returned an unexpected response");
  }

  return data.choices[0].message.content;
}

/* Restore saved products when the page loads */
async function restoreSelectedProducts() {
  let savedIds = [];

  try {
    savedIds = JSON.parse(localStorage.getItem(selectedProductsKey)) || [];
  } catch (error) {
    // Start with an empty list if saved browser data is not valid
    savedIds = [];
  }

  const allProducts = await loadProducts();

  // Keep only saved IDs that match products in the current product list
  selectedProducts = allProducts.filter((product) => savedIds.includes(product.id));
  updateSelectedProducts();
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-product-id="${product.id}" role="button" tabindex="0">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <button class="details-btn" type="button" aria-label="View details for ${product.name}">
        <i class="fa-solid fa-circle-info"></i>
        <span>Details</span>
      </button>
    </div>
  `
    )
    .join("");

  // Add a click and keyboard handler to each product card
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach((card) => {
    card.addEventListener("click", () => {
      const productId = Number(card.dataset.productId);
      const product = products.find((item) => item.id === productId);
      toggleProduct(product);
    });

    card.addEventListener("keydown", (e) => {
      if (e.target !== card) {
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.prevent();
        const productId = Number(card.dataset.productId);
        const product = products.find((item) => item.id === productId);
        toggleProduct(product);
      }
    });

    // Open the product details without selecting or deselecting the card
    const detailsButton = card.querySelector(".details-btn");
    detailsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const productId = Number(card.dataset.productId);
      const product = products.find((item) => item.id === productId);
      openProductModal(product);
    });
  });

  updateSelectedProducts();
}

/* Show all available information for one product in the modal */
function openProductModal(product) {
  modalProductDetails.innerHTML = `
    <img class="modal-product-image" src="${product.image}" alt="${product.name}">
    <p class="modal-product-brand">${product.brand}</p>
    <h2>${product.name}</h2>
    <p class="modal-product-category"><strong>Category:</strong> ${product.category}</p>
    <p class="modal-product-description">${product.description}</p>
  `;
  productModal.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");
  closeModal.focus();
}

/* Close the product details modal */
function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");
}

closeModal.addEventListener("click", closeProductModal);

// Close the modal when the user clicks outside the modal content
productModal.addEventListener("click", (e) => {
  if (e.target === productModal) {
    closeProductModal();
  }
});

// Close the modal with the Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && productModal.classList.contains("open")) {
    closeProductModal();
  }
});

/* Add or remove a product when its card is clicked */
function toggleProduct(product) {
  const alreadySelected = selectedProducts.some((item) => item.id === product.id);

  if (alreadySelected) {
    // Remove the product if it is already selected
    selectedProducts = selectedProducts.filter((item) => item.id !== product.id);
  } else {
    // Add the product if it is not selected yet
    selectedProducts.push(product);
  }

  saveSelectedProducts();
  updateSelectedProducts();
}

/* Update the highlight and the Selected Products list */
function updateSelectedProducts() {
  // Highlight cards that are in the selectedProducts array
  document.querySelectorAll(".product-card").forEach((card) => {
    const productId = Number(card.dataset.productId);
    const isSelected = selectedProducts.some((item) => item.id === productId);
    card.classList.toggle("selected", isSelected);
  });

  // Show selected products in the list below
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <button class="selected-product" type="button" data-product-id="${product.id}" aria-label="Remove ${product.name}">
        ${product.name} <span aria-hidden="true">&times;</span>
      </button>
    `
    )
    .join("");

  // Clicking a selected product removes it
  const selectedProductButtons = document.querySelectorAll(".selected-product");
  selectedProductButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = Number(button.dataset.productId);
      selectedProducts = selectedProducts.filter((item) => item.id !== productId);
      saveSelectedProducts();
      updateSelectedProducts();
    });
  });

  // Show Clear All only when at least one product is selected
  clearSelectedProducts.hidden = selectedProducts.length === 0;
}

// Remove every selected product
clearSelectedProducts.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedProducts();
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Generate a routine using only the user's selected products */
generateRoutine.addEventListener("click", async () => {
  const routinePrompt =
    selectedProducts.length > 0
      ? "Create a personalized routine using only the selected products. Explain the recommended order, when to use each product, and any simple usage tips."
      : "The user has not selected any products. Ask them to select products from the product list before creating a routine.";

  messages = [
    createSystemMessage(),
    { role: "user", content: routinePrompt },
  ];

  chatWindow.innerHTML = "";
  addChatMessage("user", routinePrompt);

  generateRoutine.disabled = true;
  addChatMessage("assistant", "Creating your routine...");

  try {
    const reply = await sendMessagesToWorker();
    messages.push({ role: "assistant", content: reply });

    const loadingMessage = chatWindow.querySelector(".chat-message.assistant:last-child");
    if (loadingMessage) {
      loadingMessage.remove();
    }
    addChatMessage("assistant", reply);
  } catch (error) {
    const loadingMessage = chatWindow.querySelector(".chat-message.assistant:last-child");
    if (loadingMessage) {
      loadingMessage.remove();
    }
    addChatMessage("assistant", "Sorry, I could not generate a routine. Please try again.");
  } finally {
    generateRoutine.disabled = false;
  }
});

/* Send follow-up questions to the AI using the full conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();

  if (question === "") {
    return;
  }

  if (messages.length === 0) {
    addChatMessage("assistant", "Generate a routine first, then ask me a follow-up question.");
    return;
  }

  messages.push({ role: "user", content: question });
  addChatMessage("user", question);
  userInput.value = "";

  const sendButton = document.getElementById("sendBtn");
  sendButton.disabled = true;
  addChatMessage("assistant", "Thinking...");

  try {
    const reply = await sendMessagesToWorker();
    messages.push({ role: "assistant", content: reply });

    const loadingMessage = chatWindow.querySelector(".chat-message.assistant:last-child");
    if (loadingMessage) {
      loadingMessage.remove();
    }
    addChatMessage("assistant", reply);
  } catch (error) {
    const loadingMessage = chatWindow.querySelector(".chat-message.assistant:last-child");
    if (loadingMessage) {
      loadingMessage.remove();
    }
    addChatMessage("assistant", "Sorry, I could not answer that question. Please try again.");
  } finally {
    sendButton.disabled = false;
  }
});

// Load saved selections as soon as the page starts
restoreSelectedProducts();
