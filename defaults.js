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
    "Stretch arms",
    "Gratitude note",
    "Step outside",
  ],
  body: [
    "20 pushups",
    "5 min walk",
    "Stretch arms",
    "30 jumping jacks",
    "20 squats",
    "2x 30s planks",
    "Neck rolls",
    "Wall sits",
    "Leg stretches",
  ],
  mind: [
    "Journal",
    "Read from a book",
    "Do nothing",
    "Gratitude note",
    "Free draw",
    "Positive affirmation",
    "Box breathing",
    "Brain teaser",
    "Tech-free walk",
  ],
  home: [
    "Make your bed",
    "Tidy desk",
    "Do the dishes",
    "Wipe counters",
    "Take out trash",
    "Water plants",
    "Fold laundry",
    "Quick vacuum",
    "Family appreciation note",
  ],
};

// Keep legacy single array for migration
const DEFAULT_BREAK_CELLS = DEFAULT_BREAK_TABS.body;

const DEFAULT_WORK_CELLS = []; // Work list is user-defined, starts empty

const STATIONS = [
  {
    id: "lofi",
    label: "Lofi",
    videos: ["jfKfPfyJRdk", "oJnF5VxTO5g", "jpaNXwW0iZk"],
    color: "#7c5cbf",
    bg: "#f0ebff",
  },
  {
    id: "jazz",
    label: "Jazz",
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
