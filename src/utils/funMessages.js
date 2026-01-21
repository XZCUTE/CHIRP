export const blockMessages = [
  // Casual / Friendly
  "No thanks!",
  "Not now 🙂",
  "Maybe later!",
  "I’ll pass for now",
  "Next time!",
  "Skip this one",

  // Playful / Fun
  "Nice try! 😅",
  "Oh no 😭",
  "It’s time to stop ✋",
  "Not today, bro 😆",
  "Hard pass",
  "Nope nope nope",
  "Abort mission 🚫",

  // Encouraging / Positive
  "You can do it! 💪",
  "Try again!",
  "Almost there!",
  "Don’t give up!",
  "One more time!",
  "Keep going!",

  // Dramatic / Meme-style
  "You can do it… about three decades later 😭",
  "This ain’t it, chief",
  "I’m tired, boss 😩",
  "Send help 😆",
  "Why are we still here?",
  "Pain.",
  "Try again next year!",
  "ASAR!!!",
  "Need more brain cells",
  "Oh no hecker!",
  "Another L 💀",
  "Mission failed, we’ll get ’em next time",
  "Maybe in another universe",
  "You tried 🥀"
];

export const getRandomBlockMessage = () => {
  const randomIndex = Math.floor(Math.random() * blockMessages.length);
  return blockMessages[randomIndex];
};
