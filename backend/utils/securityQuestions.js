const QUESTIONS = [
  'What is the name of your first school?',
  'What is your mother’s maiden name?',
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your favorite book?',
  'What is your favorite food?',
  'What is the name of your childhood best friend?',
  'What was your first job?',
];

function normalizeAnswer(answer) {
  return String(answer || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export { QUESTIONS, normalizeAnswer };
