// ===================================================================
// CARD DECK ENGINE
// ===================================================================
const CARD_COUNT = 5;
const MAX_VISIBLE_DEPTH = 3;

function getPeek(prop) {
  return (
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(prop),
    ) || 11
  );
}

const cards = () => Array.from(document.querySelectorAll(".card"));
const navBtns = () => Array.from(document.querySelectorAll(".bnav"));

let deckOrder = [0, 1, 2, 3, 4];
let activeCard = 0;

function transformForDepth(depth) {
  if (depth === 0) return "translate(0px, 0px)";
  const px = getPeek("--peek-x"),
    py = getPeek("--peek-y");
  return `translate(${px * Math.min(depth, MAX_VISIBLE_DEPTH)}px, ${py * Math.min(depth, MAX_VISIBLE_DEPTH)}px)`;
}

function layoutDeck(animate = true) {
  cards().forEach((card, cardIdx) => {
    const depth = deckOrder.indexOf(cardIdx);
    if (animate) card.classList.add("animating");
    else card.classList.remove("animating");
    card.classList.remove("depth-0", "depth-1", "depth-2", "depth-3");
    card.classList.add(`depth-${Math.min(depth, MAX_VISIBLE_DEPTH)}`);
    card.style.transform = transformForDepth(depth);
    card.style.zIndex = CARD_COUNT - depth;
  });
  if (animate) {
    clearTimeout(layoutDeck._t);
    layoutDeck._t = setTimeout(
      () => cards().forEach((c) => c.classList.remove("animating")),
      460,
    );
  }
}

function goTo(targetIdx, direction) {
  if (targetIdx === activeCard) return;
  if (direction === undefined) direction = targetIdx > activeCard ? 1 : -1;

  const leavingCard = document.querySelector(
    `.card[data-card="${activeCard}"]`,
  );
  if (leavingCard && flippedCards.has(activeCard)) {
    flippedCards.delete(activeCard);
    leavingCard.classList.remove("flipped", "flipping");
  }

  let steps = 0;
  while (deckOrder[0] !== targetIdx && steps < CARD_COUNT) {
    if (direction > 0) deckOrder.push(deckOrder.shift());
    else deckOrder.unshift(deckOrder.pop());
    steps++;
  }
  activeCard = targetIdx;
  layoutDeck(true);
  syncBottomNav();
}

function syncBottomNav() {
  navBtns().forEach((b, i) => b.classList.toggle("active", i === activeCard));
}

function initBottomNav() {
  navBtns().forEach((btn, i) =>
    btn.addEventListener("click", () => {
      if (i === activeCard) flipCard(i);
      else goTo(i);
    }),
  );
}

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Don't navigate if user is editing a task input field
    if (e.target.classList.contains("task-item-text-edit")) return;

    if (e.key === "ArrowRight") goTo((activeCard + 1) % CARD_COUNT, 1);
    if (e.key === "ArrowLeft")
      goTo((activeCard - 1 + CARD_COUNT) % CARD_COUNT, -1);
  });
}

function initCardClicks() {
  cards().forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (!card.classList.contains("depth-0")) {
        goTo(i);
        e.stopPropagation();
      }
    });
  });
}

// ===================================================================
// CARD FLIP ENGINE
// ===================================================================
const flippedCards = new Set();

function flipCard(cardIdx) {
  const card = document.querySelector(`.card[data-card="${cardIdx}"]`);
  if (!card) return;
  card.classList.remove("flipping");
  void card.offsetWidth;
  card.classList.add("flipping");
  setTimeout(() => card.classList.remove("flipping"), 580);
  if (flippedCards.has(cardIdx)) {
    flippedCards.delete(cardIdx);
    card.classList.remove("flipped");
    card.classList.remove("drag-flip");
  } else {
    flippedCards.add(cardIdx);
    card.classList.add("flipped");
    card.classList.remove("drag-flip");
  }
}

function initFlipCorners() {
  document.querySelectorAll(".flip-corner").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      flipCard(parseInt(btn.dataset.card));
    });
  });
}

function initCardTitleShortcuts() {
  function openSettingsForCard(cardIdx) {
    if (activeCard === cardIdx) {
      // Already on this card — toggle the flip with animation
      flipCard(cardIdx);
      return;
    }
    // Navigating to a different card — pre-set to settings side with no transition
    // so it arrives already showing settings when the deck slides it in.
    const card = document.querySelector(`.card[data-card="${cardIdx}"]`);
    if (card && !flippedCards.has(cardIdx)) {
      const flipper = card.querySelector(".card-flipper");
      flipper.style.transition = "none";
      flippedCards.add(cardIdx);
      card.classList.add("flipped");
      card.classList.remove("drag-flip", "flipping");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          flipper.style.transition = "";
        }),
      );
    }
    goTo(cardIdx);
  }

  // Right-click bottom nav button
  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 2) return;
      const btn = e.target.closest(".bnav");
      if (!btn) return;
      e.preventDefault();
      openSettingsForCard(parseInt(btn.dataset.i));
    },
    true,
  );

  // Suppress the context menu on nav buttons
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (!e.target.closest(".bnav")) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  // Long-press on mobile
  let longPressTimer = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      const btn = e.target.closest(".bnav");
      if (!btn) return;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        openSettingsForCard(parseInt(btn.dataset.i));
      }, 500);
    },
    { passive: true },
  );
  const cancelLongPress = () => {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  };
  document.addEventListener("touchmove", cancelLongPress, { passive: true });
  document.addEventListener("touchend", cancelLongPress);
  document.addEventListener("touchcancel", cancelLongPress);
}

// Drag/swipe
let drag = null;

function onPointerDown(e) {
  const card = e.currentTarget;
  if (!card.classList.contains("depth-0")) return;
  if (e.target.closest(".flip-corner")) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  drag = {
    startX: clientX,
    startY: clientY,
    currentX: 0,
    velocityX: 0,
    lastX: clientX,
    lastT: Date.now(),
    moved: false,
  };
  card.classList.remove("animating");
}

function onPointerMove(e) {
  if (!drag) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - drag.startX,
    dy = clientY - drag.startY;
  if (!drag.moved && Math.abs(dy) > Math.abs(dx) + 6) {
    drag = null;
    return;
  }
  if (Math.abs(dx) > 4) drag.moved = true;
  if (!drag.moved) return;
  e.preventDefault();
  const now = Date.now(),
    dt = now - drag.lastT || 1;
  drag.velocityX = (clientX - drag.lastX) / dt;
  drag.lastX = clientX;
  drag.lastT = now;
  drag.currentX = dx;
  const topCard = cards()[deckOrder[0]];
  topCard.style.transform = `translate(${dx}px, 0px) rotate(${dx * 0.012}deg)`;
}

function onPointerUp() {
  if (!drag) return;
  const topCard = cards()[deckOrder[0]];
  const dx = drag.currentX,
    vel = drag.velocityX;

  topCard.classList.add("animating");

  const didSwipe = Math.abs(dx) > 80 || Math.abs(vel) > 0.4;
  if (didSwipe) {
    const exitX = dx > 0 ? "110vw" : "-110vw";
    const exitRot = dx > 0 ? "8deg" : "-8deg";
    topCard.style.transform = `translate(${exitX}, 0px) rotate(${exitRot})`;
    setTimeout(() => {
      topCard.style.transform = "";
      goTo((activeCard + 1) % CARD_COUNT, 1);
    }, 180);
  } else {
    topCard.style.transform = transformForDepth(0);
  }

  drag = null;
}

function initDrag() {
  cards().forEach((card) => {
    card.addEventListener("mousedown", onPointerDown);
    card.addEventListener("touchstart", onPointerDown, { passive: true });
  });
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("mouseup", onPointerUp);
  document.addEventListener("touchmove", onPointerMove, { passive: false });
  document.addEventListener("touchend", onPointerUp);
}
