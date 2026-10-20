import type { BoardData, Clue } from "./board.js";

// PLACEHOLDER content, written by us for testing and demos. It is not clinical material:
// the therapist edits or replaces all of it. Plans and ideas live in notes/ (private).
const row = (items: [string, string][]): Clue[] =>
  items.map(([question, answer], i) => ({ value: (i + 1) * 100, question, answer }));

const ANY = "Any answer works";

export const feelingsBoard: BoardData = {
  name: "Feelings",
  categories: [
    {
      name: "Name that Feeling",
      clues: row([
        ["You open a surprise gift and smile big.", "Happy"],
        ["Your toy breaks and your eyes feel wet.", "Sad"],
        ["Someone takes your turn and your fists feel tight.", "Angry"],
        ["It is dark and you hear a noise.", "Scared"],
        ["Your party is tomorrow and you can hardly wait.", "Excited"],
      ]),
    },
    {
      name: "Body Clues",
      clues: row([
        ["Your face feels hot and your fists are tight.", "Angry"],
        ["Your tummy feels fluttery before a test.", "Nervous"],
        ["Your shoulders drop and you feel heavy.", "Sad"],
        ["Your heart beats fast and you want to run.", "Scared"],
        ["You feel bouncy and cannot sit still.", "Excited"],
      ]),
    },
    {
      name: "Mild or Strong",
      clues: row([
        ["Is annoyed a mild or a strong feeling?", "Mild"],
        ["Is furious mild or strong?", "Strong"],
        ["Is a little worried mild or strong?", "Mild"],
        ["Is terrified mild or strong?", "Strong"],
        ["Which is stronger: upset or devastated?", "Devastated"],
      ]),
    },
    {
      name: "Faces",
      clues: row([
        ["What feeling does a big smile show?", "Happy"],
        ["What feeling does a frown with droopy eyes show?", "Sad"],
        ["What feeling does a scrunched forehead show?", "Angry"],
        ["What feeling do wide eyes and an open mouth show?", "Surprised"],
        ["Make a face for proud. Show it!", "Any proud face works"],
      ]),
    },
    {
      name: "Your Turn",
      clues: row([
        ["Name one feeling you have had today.", ANY],
        ["Name a feeling you like to have.", ANY],
        ["Name a feeling that is tricky to explain.", ANY],
        ["Name a feeling you would like less of.", ANY],
        ["Pick any feeling and tell about a time you had it.", ANY],
      ]),
    },
  ],
};

export const copingBoard: BoardData = {
  name: "Coping Skills",
  categories: [
    {
      name: "Name It",
      clues: row([
        ["Breathe in slowly through your nose and out through your mouth.", "Slow breathing"],
        ["Squeeze your hands tight, then let go.", "Squeeze and release"],
        ["Count backward from ten.", "Counting"],
        ["Imagine a place where you feel safe.", "A safe place"],
        ["Press your feet into the floor and notice how it feels.", "Feeling your feet"],
      ]),
    },
    {
      name: "Good Choice?",
      clues: row([
        ["Taking a few slow breaths when you feel upset. Good choice or not yet?", "Good choice"],
        ["Walking away for a minute to cool down. Good choice or not yet?", "Good choice"],
        [
          "Yelling at someone who made you mad. Good choice or not yet?",
          "Not yet. We can find a calmer way.",
        ],
        ["Talking to someone you trust about a hard day. Good choice or not yet?", "Good choice"],
        ["Keeping a big feeling secret forever. Good choice or not yet?", "Not yet. Sharing can help."],
      ]),
    },
    {
      name: "Ask for Help",
      clues: row([
        ["Name a person you could ask for help.", "Any trusted person"],
        ["What is one way to ask for a break?", ANY],
        ["Who can help you at school?", "A teacher, counselor or other grown-up"],
        ["Practice saying: I need help, please.", ANY],
        ["What could you say if you are not sure how you feel?", ANY],
      ]),
    },
    {
      name: "What Would You Do?",
      clues: row([
        ["Your tower of blocks falls down. What could you do?", ANY],
        ["Your friend does not want to play. What could you do?", ANY],
        ["You feel nervous before a new class. What could you do?", ANY],
        ["You lose a game. What could you do?", ANY],
        ["You feel angry and your body feels tight. What could you do?", ANY],
      ]),
    },
    {
      name: "Your Turn",
      clues: row([
        ["Show a calming move, like a big stretch.", ANY],
        ["Name something that helps you feel calm.", ANY],
        ["Name a place where you feel calm.", ANY],
        ["Teach a calming skill to the grown-up.", ANY],
        ["Make up your own calming idea.", ANY],
      ]),
    },
  ],
};

export const needsBoard: BoardData = {
  name: "Needs",
  categories: [
    {
      name: "I Need...",
      clues: row([
        ["Finish this: I need a break when...", ANY],
        ["Finish this: I need help when...", ANY],
        ["Finish this: I need quiet when...", ANY],
        ["Finish this: I need more time when...", ANY],
        ["Finish this: I need someone to listen when...", ANY],
      ]),
    },
    {
      name: "Say It",
      clues: row([
        ["Say: I need a break, please.", "Say it out loud"],
        ["Say: Can you help me?", "Say it out loud"],
        ["Say: I feel ___ and I need ___.", ANY],
        ["Say: Please give me a minute.", "Say it out loud"],
        ["Ask for something you need, in your own words.", ANY],
      ]),
    },
    {
      name: "Who Can Help",
      clues: row([
        ["Who can help when you are hungry?", "A grown-up at home or school"],
        ["Who can help when you do not understand your homework?", "A teacher or grown-up"],
        ["Who can help when you feel worried?", "Any trusted person"],
        ["Who can help when someone is being unkind?", "A trusted grown-up"],
        ["Name someone who listens to you well.", ANY],
      ]),
    },
    {
      name: "Body Needs",
      clues: row([
        ["What does your body need when you are thirsty?", "Water"],
        ["What does your body need when you are tired?", "Rest or sleep"],
        ["What does your body need when you are hungry?", "Food"],
        ["What does your body need when you feel restless?", "Moving around"],
        ["What does your body need when it is too noisy?", "Quiet or a break"],
      ]),
    },
    {
      name: "Your Turn",
      clues: row([
        ["Name one thing you need today.", ANY],
        ["Name one thing you want, and one you need.", ANY],
        ["Name a need that is easy to ask for.", ANY],
        ["Name a need that is hard to ask for.", ANY],
        ["Make up a sentence that starts with: I need...", ANY],
      ]),
    },
  ],
};

export const starterBoards: BoardData[] = [feelingsBoard, copingBoard, needsBoard];
