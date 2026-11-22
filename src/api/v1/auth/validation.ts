export const codeLength = 6;

export const passwordRules = [
  { label: "8 characters minimum", test: (value: string) => value.length >= 8 },
  { label: "1 lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "1 uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "1 number", test: (value: string) => /\d/.test(value) },
];

export function getEmailProblem(email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function getCodeProblem(code: string) {
  return code.length === codeLength && /^\d+$/.test(code)
    ? null
    : `Enter the ${codeLength}-digit code.`;
}

export function getPasswordProblem(password: string) {
  const failedRules = passwordRules.filter((rule) => !rule.test(password));
  if (failedRules.length === 0) return null;
  return `Password needs ${failedRules.map((rule) => rule.label.toLowerCase()).join(", ")}.`;
}
