// Validation simple des entrées (renvoie un tableau d'erreurs lisibles)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL_RE = /^[0-9 +]{8,15}$/;

function check(body, rules) {
  const errors = [];
  for (const [field, r] of Object.entries(rules)) {
    let v = body[field];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (r.required) errors.push(`${r.label} est obligatoire`);
      continue;
    }
    if (r.in && !r.in.includes(v)) errors.push(`${r.label} est invalide`);
    if (r.email && !EMAIL_RE.test(v)) errors.push(`${r.label} n'est pas une adresse valide`);
    if (r.tel && !TEL_RE.test(v)) errors.push(`${r.label} doit contenir 8 chiffres minimum`);
    if (r.min !== undefined && Number(v) < r.min) errors.push(`${r.label} doit être ≥ ${r.min}`);
    if (r.max !== undefined && Number(v) > r.max) errors.push(`${r.label} doit être ≤ ${r.max}`);
    if (r.int && !Number.isInteger(Number(v))) errors.push(`${r.label} doit être un nombre entier`);
    if (r.minLength && String(v).length < r.minLength) errors.push(`${r.label} doit contenir au moins ${r.minLength} caractères`);
    if (r.maxLength && String(v).length > r.maxLength) errors.push(`${r.label} est trop long`);
    if (r.date && isNaN(Date.parse(v))) errors.push(`${r.label} n'est pas une date valide`);
  }
  return errors;
}

/** Middleware : renvoie 400 si la validation échoue */
const validate = (rules) => (req, res, next) => {
  const errors = check(req.body || {}, rules);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });
  next();
};

module.exports = { validate, check };
