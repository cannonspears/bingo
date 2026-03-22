// ===================================================================
// BINGO BREAK — app.js  (v2)
// 5-card deck: Work | Break | Now Playing | Achievements | Settings
// ===================================================================

// ===== DEFAULTS =====
const DEFAULT_BREAK_TABS = {
  all: [
    "20 pushups",
    "Drink water",
    "5 min walk",
    "Tidy desk",
    "Deep breaths",
    "Journal 1 min",
    "10 squats",
    "Text a friend",
    "Stretch arms",
    "Read a page",
    "Dance break",
    "Wipe counters",
    "Cold water face",
    "Gratitude note",
    "10 jumping jacks",
    "Step outside",
  ],
  body: [
    "20 pushups",
    "5 min walk",
    "Stretch arms",
    "30 jumping jacks",
    "20 squats",
    "20 bicep curls",
    "2x 30s planks",
    "20 crunches",
    "Neck rolls",
    "20 Calf raises",
    "Wall sits",
    "20 tricep ext",
    "Leg stretches",
    "Shoulder rolls",
    "20 sec plank",
    "Arm stretches",
  ],
  mind: [
    "Journal",
    "Read from a book",
    "Do nothing",
    "Gratitude note",
    "Free draw",
    "Memorize something",
    "Write a tiny story",
    "Positive affirmation",
    "Box breathing",
    "Memory recall",
    "Reframe a situation",
    "Read poetry",
    "Brain teaser",
    "Visualise a goal",
    "Tech-free walk",
    "Word association game",
  ],
  home: [
    "Make your bed",
    "Tidy desk",
    "Do the dishes",
    "Wipe counters",
    "Clean litterbox",
    "Take out trash",
    "Water plants",
    "Sweep a room",
    "Fold laundry",
    "Wipe mirrors",
    "Quick vacuum",
    "Clear floor clutter",
    "Wipe stovetop",
    "Organise a drawer",
    "Refill water pitcher",
    "Family appreciation note",
  ],
};

// Keep legacy single array for migration
const DEFAULT_BREAK_CELLS = DEFAULT_BREAK_TABS.body;

const DEFAULT_WORK_CELLS = []; // Work list is user-defined, starts empty

const STATIONS = [
  {
    id: "lofi",
    label: "Lofi Girl",
    videos: ["jfKfPfyJRdk", "oJnF5VxTO5g", "jpaNXwW0iZk"],
    color: "#7c5cbf",
    bg: "#f0ebff",
  },
  {
    id: "jazz",
    label: "Jazz Café",
    videos: ["HuFYqnbVbzY", "CfPxlb8-ZQ0", "5yx6BWlEVcY"],
    color: "#c0622b",
    bg: "#fff3eb",
  },
  {
    id: "classical",
    label: "Classical",
    videos: ["jXAEIWcGXwE", "y6TZHLAzg5o", "QU-b5mi4e9U"],
    color: "#2b6cc0",
    bg: "#ebf3ff",
  },
  {
    id: "ambient",
    label: "Ambient",
    videos: ["xORCbIptqcc", "AXvnFk38sDQ", "S_MOd40zlYU"],
    color: "#2b9c6e",
    bg: "#ebfff6",
  },
];
